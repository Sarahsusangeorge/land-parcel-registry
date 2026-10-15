// Sprint 4: registerParcel gas with the real Groth16Verifier, from transaction
// receipts, written to bench/results/gas.json.
//
//   npx hardhat run scripts/gas_bench.js
//
// Uses the committed proof fixtures (test/fixtures/A.json, C_after_A.json) on a
// fresh in-process Hardhat network. Gas is deterministic, so one run is enough.
// Receipts are used instead of the gas reporter's table because the reporter
// also counts the deliberately reverted calls in the e2e tests.
// If bench/results/full_run.json (registrar full run, all real parcels) exists,
// its gas stats are copied in as a cross-check.
const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");

const FIXTURES = path.join(__dirname, "..", "test", "fixtures");
const RESULTS = path.join(__dirname, "..", "..", "bench", "results");
const toBig = (x) => (Array.isArray(x) ? x.map(toBig) : BigInt(x));

function stats(values) {
  const sum = values.reduce((a, b) => a + b, 0);
  return { n: values.length, mean: Math.round(sum / values.length), min: Math.min(...values), max: Math.max(...values) };
}

async function main() {
  const [deployer, owner] = await ethers.getSigners();

  const vf = await ethers.getContractFactory("Groth16Verifier");
  const verifier = await vf.deploy();
  const verifierDeploy = await verifier.deploymentTransaction().wait();
  const rf = await ethers.getContractFactory("LandRegistry");
  const registry = await rf.deploy(await verifier.getAddress(), deployer.address);
  const registryDeploy = await registry.deploymentTransaction().wait();
  await (await registry.grantRole(await registry.REGISTRAR_ROLE(), deployer.address)).wait();

  const runs = [];
  for (const name of ["A", "C_after_A"]) {
    const file = path.join(FIXTURES, `${name}.json`);
    const f = JSON.parse(fs.readFileSync(file, "utf8"));
    console.log(`read ${file}`);
    const tx = await registry.registerParcel(
      owner.address, toBig(f.a), toBig(f.b), toBig(f.c), toBig(f.pubSignals), toBig(f.coarseCells), f.metadataURI);
    const rc = await tx.wait();
    runs.push({ fixture: `${name}.json`, coarse_cells: f.coarseCells.length, gas_used: Number(rc.gasUsed) });
  }

  const a = JSON.parse(fs.readFileSync(path.join(FIXTURES, "A.json"), "utf8"));
  const verifyOnly = await verifier.verifyProof.estimateGas(toBig(a.a), toBig(a.b), toBig(a.c), toBig(a.pubSignals));

  const out = {
    meta: {
      measured_at: new Date().toISOString(),
      network: network.name,
      verifier: "Groth16Verifier.sol (production zkey, N=16, N_LEVELS=32)",
      method: "gasUsed from transaction receipts; fresh deployment; fixtures registered in order A, C_after_A",
    },
    registerParcel: stats(runs.map((r) => r.gas_used)),
    runs,
    verifyProof_alone_estimate: Number(verifyOnly),
    deployment: {
      Groth16Verifier: Number(verifierDeploy.gasUsed),
      LandRegistry: Number(registryDeploy.gasUsed),
    },
    notes: [
      "A is the first registration: occupiedRoot goes from 0 to non-zero, a fresh storage write, so it costs more.",
      "verifyProof_alone_estimate includes the 21,000 base transaction cost.",
    ],
  };

  const fullRun = path.join(RESULTS, "full_run.json");
  if (fs.existsSync(fullRun)) {
    const fr = JSON.parse(fs.readFileSync(fullRun, "utf8"));
    out.cross_check_full_run = {
      source: "bench/results/full_run.json",
      registered: fr.stats.registered,
      gas_used: fr.stats.gas_used,
    };
    console.log(`read ${fullRun}`);
  }

  fs.mkdirSync(RESULTS, { recursive: true });
  const dest = path.join(RESULTS, "gas.json");
  fs.writeFileSync(dest, JSON.stringify(out, null, 2) + "\n");
  console.log(`registerParcel gas: ${JSON.stringify(out.registerParcel)}`);
  console.log(`wrote ${dest}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
