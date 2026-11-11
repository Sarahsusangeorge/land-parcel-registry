"use strict";

// ui/server.js: demo web server for the land parcel registry
//
// Endpoints:
//   POST /api/reset                : kill any running Hardhat node, start fresh, deploy
//   POST /api/register/:parcelId   : run register.js; stream progress via SSE
//   POST /api/register-all         : register every parcel in file order; stream results
//   GET  /api/registrar/parcels    : parcels.json + registrar state
//   GET  /api/chain/state          : occupiedRoot + tokens from the LandRegistry contract
//
// Static files served from ui/public/.

const path       = require("path");
const fs         = require("fs");
const http       = require("http");
const { spawn, execSync } = require("child_process");
const express    = require("express");
const { ethers } = require("ethers");

// ── paths ─────────────────────────────────────────────────────────────────────
const REPO_ROOT     = path.resolve(__dirname, "..");
const CONTRACTS_DIR = path.join(REPO_ROOT, "contracts");
const REGISTRAR_DIR = path.join(REPO_ROOT, "registrar");
const GEO_OUT       = path.join(REPO_ROOT, "geo", "out", "parcels.json");
const REGISTER_JS   = path.join(REGISTRAR_DIR, "src", "register.js");
const STATE_FILE    = path.join(REGISTRAR_DIR, "data", "demo_state.json");
const DEPLOY_FILE   = path.join(CONTRACTS_DIR, "deployments", "local.json");

const PORT    = 3000;
const RPC_URL = "http://127.0.0.1:8545";

// Minimal ABI: only what the public chain queries need.
// Never reads parcels.json or registrar files.
const REGISTRY_ABI = [
  "function occupiedRoot() view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function getParcel(uint256 tokenId) view returns (uint256 commitment, uint64[] coarseCells, string metadataURI, uint256 registeredAt)",
  "event ParcelRegistered(uint256 indexed tokenId, address indexed owner, uint256 commitment, uint256 oldRoot, uint256 newRoot)"
];

// ── derive registrar address from register.js at load time ───────────────────
let REGISTRAR_ADDRESS = "";
try {
  const src = fs.readFileSync(REGISTER_JS, "utf8");
  const m   = src.match(/HH_REGISTRAR_KEY\s*=\s*["']([^"']+)["']/);
  if (m) REGISTRAR_ADDRESS = new ethers.Wallet(m[1]).address;
} catch (e) {
  console.warn("Could not derive registrar address:", e.message);
}

// ── server state ──────────────────────────────────────────────────────────────
let hardhatProc      = null;   // the running Hardhat node process (or null)
let registrationLock = false;  // true while any registration is in progress

// ── app ───────────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ── helpers ───────────────────────────────────────────────────────────────────

function readParcels() {
  return JSON.parse(fs.readFileSync(GEO_OUT, "utf8"));
}

function readState() {
  if (fs.existsSync(STATE_FILE)) {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  }
  return { cellIndex: {}, registrations: [] };
}

function readDeployment() {
  if (!fs.existsSync(DEPLOY_FILE)) return null;
  return JSON.parse(fs.readFileSync(DEPLOY_FILE, "utf8"));
}

function sseHeaders(res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
}

function sseWrite(res, data) {
  res.write("data: " + JSON.stringify(data) + "\n\n");
}

// Poll until the Hardhat node responds or we time out.
function waitForNode(maxMs) {
  maxMs = maxMs || 30000;
  const deadline = Date.now() + maxMs;
  return new Promise(function (resolve, reject) {
    function attempt() {
      const req = http.request(
        { hostname: "127.0.0.1", port: 8545, method: "POST",
          headers: { "Content-Type": "application/json" } },
        function () { resolve(); }
      );
      req.on("error", function () {
        if (Date.now() >= deadline) {
          reject(new Error("Hardhat node did not start in time"));
        } else {
          setTimeout(attempt, 500);
        }
      });
      req.write(JSON.stringify({ jsonrpc: "2.0", method: "eth_chainId", params: [], id: 1 }));
      req.end();
    }
    attempt();
  });
}

// Kill any process already listening on port 8545.
function killPort8545() {
  try {
    execSync("lsof -ti tcp:8545 | xargs kill -TERM 2>/dev/null", {
      shell: "/bin/bash", stdio: "ignore"
    });
  } catch (_) { /* nothing on the port: fine */ }
}

// Run one registration and call onStep / onResult.
// Returns a promise that resolves to the result object.
// If abortRef.aborted is set before spawning, resolves immediately with null.
function doRegistration(parcelId, onStep, onResult, abortRef) {
  return new Promise(function (resolve) {
    // Read fresh state each time (sequential register-all needs this).
    const state = readState();
    const { parcels } = readParcels();
    const parcel = parcels.find(function (p) { return p.parcel_id === parcelId; });

    if (!parcel) {
      const r = { status: "error", parcel_id: parcelId,
                  reason: "Parcel " + parcelId + " not found in parcels.json" };
      onResult(r);
      resolve(r);
      return;
    }

    // Step 1: overlap pre-check using the registrar's current cell index.
    onStep("checking overlap");

    const hits = new Set();
    const cellIndex = state.cellIndex || {};
    for (const cell of parcel.fine_cells_dec) {
      if (cellIndex[cell]) hits.add(cellIndex[cell]);
    }
    if (hits.size > 0) {
      const r = { status: "overlap", parcel_id: parcelId, overlaps: Array.from(hits) };
      onResult(r);
      resolve(r);
      return;
    }

    if (abortRef && abortRef.aborted) { resolve(null); return; }

    // Step 2: generate proof (register.js does the proving + tx in one shot).
    onStep("generating proof");

    const proc = spawn("node", [
      REGISTER_JS,
      "--parcel-id",   parcelId,
      "--state-file",  STATE_FILE,
      "--deployment",  DEPLOY_FILE
    ], { cwd: REPO_ROOT });

    if (abortRef) abortRef.proc = proc;

    let stdout = "";
    proc.stdout.on("data", function (d) { stdout += d.toString(); });

    proc.on("exit", function () {
      if (abortRef) abortRef.proc = null;
      let result;
      try {
        result = JSON.parse(stdout.trim());
      } catch (_) {
        result = {
          status: "error", parcel_id: parcelId,
          reason: "Unexpected output from register.js: " + stdout.slice(0, 200)
        };
      }
      // Show "submitting transaction" step for successful registrations.
      // The tx was submitted inside register.js; this is a visual cue only.
      if (result.status === "registered") {
        onStep("submitting transaction");
      }
      onResult(result);
      resolve(result);
    });
  });
}

// ── POST /api/reset ───────────────────────────────────────────────────────────
app.post("/api/reset", async function (req, res) {
  try {
    // Stop the tracked Hardhat node, if any.
    if (hardhatProc && !hardhatProc.killed) {
      hardhatProc.kill("SIGTERM");
      await new Promise(function (r) { setTimeout(r, 1000); });
    }
    hardhatProc = null;

    // Also kill any stray process on 8545 (e.g. from demo.sh).
    killPort8545();
    await new Promise(function (r) { setTimeout(r, 500); });

    // Clear demo state so the tree starts empty.
    if (fs.existsSync(STATE_FILE)) fs.rmSync(STATE_FILE);

    // Start a fresh Hardhat node.
    hardhatProc = spawn(
      "npx", ["hardhat", "node", "--port", "8545"],
      { cwd: CONTRACTS_DIR, stdio: "ignore" }
    );
    hardhatProc.on("exit", function () { hardhatProc = null; });

    await waitForNode();

    // Deploy real Groth16Verifier + LandRegistry with the registrar address.
    await new Promise(function (resolve, reject) {
      const p = spawn(
        "npx", ["hardhat", "run", "scripts/deploy.js", "--network", "localhost"],
        {
          cwd: CONTRACTS_DIR,
          env: Object.assign({}, process.env, { REGISTRAR_ADDRESS: REGISTRAR_ADDRESS }),
          stdio: "ignore"
        }
      );
      p.on("exit", function (code) {
        if (code === 0) resolve();
        else reject(new Error("deploy.js exited with code " + code));
      });
    });

    res.json({ ok: true, registrar: REGISTRAR_ADDRESS });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/register/:parcelId ──────────────────────────────────────────────
app.post("/api/register/:parcelId", function (req, res) {
  if (registrationLock) {
    res.status(409).json({
      error: "A registration is already in progress. Try again shortly."
    });
    return;
  }

  const parcelId = req.params.parcelId;
  registrationLock = true;
  sseHeaders(res);

  let closed = false;
  const abortRef = { aborted: false, proc: null };

  req.on("close", function () {
    closed = true;
    abortRef.aborted = true;
    // Let register.js finish so it can save state correctly.
  });

  doRegistration(
    parcelId,
    function (step) {
      if (!closed) sseWrite(res, { type: "step", step: step });
    },
    function (result) {
      registrationLock = false;
      if (!closed) {
        sseWrite(res, { type: "result", result: result });
        res.end();
      }
    },
    abortRef
  );
});

// ── POST /api/register-all ────────────────────────────────────────────────────
app.post("/api/register-all", async function (req, res) {
  if (registrationLock) {
    res.status(409).json({
      error: "A registration is already in progress. Try again shortly."
    });
    return;
  }

  registrationLock = true;
  sseHeaders(res);

  let closed = false;
  req.on("close", function () { closed = true; });

  try {
    const { parcels } = readParcels();
    const total = parcels.length;
    let registered = 0, overlap = 0, errors = 0;

    for (let i = 0; i < parcels.length; i++) {
      if (closed) break;

      const parcel = parcels[i];
      sseWrite(res, {
        type: "start", parcel_id: parcel.parcel_id, index: i, total: total
      });

      const result = await doRegistration(
        parcel.parcel_id,
        function (step) {
          if (!closed) sseWrite(res, {
            type: "step", parcel_id: parcel.parcel_id, step: step
          });
        },
        function (r) {
          if (!closed) sseWrite(res, { type: "result", result: r });
        },
        { aborted: false, proc: null }
      );

      if (!result) break;
      if (result.status === "registered") registered++;
      else if (result.status === "overlap") overlap++;
      else errors++;
    }

    if (!closed) {
      sseWrite(res, {
        type: "done", registered: registered, overlap: overlap,
        errors: errors, total: total
      });
      res.end();
    }
  } catch (err) {
    if (!closed) {
      sseWrite(res, { type: "error", error: err.message });
      res.end();
    }
  } finally {
    registrationLock = false;
  }
});

// ── GET /api/registrar/parcels ────────────────────────────────────────────────
// Reads geo/out/parcels.json and the registrar's demo state.
app.get(["/api/registrar", "/api/registrar/parcels"], function (req, res) {
  try {
    const { parcels, meta } = readParcels();
    const state = readState();

    // Index registrations by parcel_id.
    const regMap = {};
    for (const reg of (state.registrations || [])) {
      regMap[reg.parcel_id] = reg;
    }

    const result = parcels.map(function (p) {
      const reg = regMap[p.parcel_id];
      return {
        parcel_id:      p.parcel_id,
        fine_cells:     p.fine_cells,
        fine_cells_dec: p.fine_cells_dec,
        coarse_cells:   p.coarse_cells,
        coarse_cells_dec: p.coarse_cells_dec,
        num_fine_cells: p.num_fine_cells,
        fits_batch:     p.fits_batch,
        status:         reg ? "registered" : "unregistered",
        token_id:       reg ? reg.tokenId : null
      };
    });

    res.json({ parcels: result, meta: meta });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/chain/state ──────────────────────────────────────────────────────
// Reads ONLY from the deployed LandRegistry contract.
// Never reads parcels.json or registrar state files.
app.get(["/api/chain", "/api/chain/state"], async function (req, res) {
  try {
    const deployment = readDeployment();
    if (!deployment) {
      return res.status(503).json({
        error: "Chain not deployed yet. Click Reset first."
      });
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const registry = new ethers.Contract(deployment.registry, REGISTRY_ABI, provider);

    const occupiedRoot = (await registry.occupiedRoot()).toString();

    // Discover all tokens via ParcelRegistered events.
    const events = await registry.queryFilter(registry.filters.ParcelRegistered());

    const tokens = await Promise.all(events.map(async function (ev) {
      const tokenId   = Number(ev.args.tokenId);
      const owner     = ev.args.owner;
      const commitment = ev.args.commitment.toString();
      const oldRoot   = ev.args.oldRoot.toString();
      const newRoot   = ev.args.newRoot.toString();

      const parcelData = await registry.getParcel(tokenId);
      // coarseCells are uint64[] on-chain; convert to decimal strings.
      const coarseCells = Array.from(parcelData.coarseCells).map(function (c) {
        return c.toString();
      });

      return {
        tokenId:     tokenId,
        owner:       owner,
        commitment:  commitment,
        oldRoot:     oldRoot,
        newRoot:     newRoot,
        coarseCells: coarseCells,
        metadataURI: parcelData.metadataURI
      };
    }));

    res.json({
      occupiedRoot: occupiedRoot,
      tokenCount:   tokens.length,
      tokens:       tokens
    });
  } catch (err) {
    const msg = err.message || String(err);
    if (msg.includes("ECONNREFUSED") || msg.includes("connect")) {
      return res.status(503).json({
        error: "Chain not running. Click Reset to start the Hardhat node."
      });
    }
    res.status(500).json({ error: msg });
  }
});

// ── start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, function () {
  console.log("Land Parcel Registry UI: http://localhost:" + PORT);
  console.log("  Registrar view: http://localhost:" + PORT + "/registrar.html");
  console.log("  Public view:    http://localhost:" + PORT + "/public.html");
});
