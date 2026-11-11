#!/usr/bin/env bash
# registrar/scripts/full_run.sh
#
# Full real-parcel run: start a fresh Hardhat node, deploy the real
# Groth16Verifier + LandRegistry, register every parcel in geo/out/parcels.json
# (A first, B second, then the rest in file order), and save per-parcel
# benchmarks to bench/results/full_run.json.
#
# Usage: bash registrar/scripts/full_run.sh
# Run from the repo root.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONTRACTS_DIR="$REPO_ROOT/contracts"
STATE_FILE="$REPO_ROOT/registrar/data/full_run_state.json"

# ── clean up previous state ────────────────────────────────────────────────────
rm -f "$STATE_FILE"

# ── start Hardhat node in background ──────────────────────────────────────────
echo "[full_run] Starting Hardhat node…" >&2
cd "$CONTRACTS_DIR"
npx hardhat node --port 8545 >/tmp/hardhat-full-run.log 2>&1 &
HARDHAT_PID=$!
trap 'echo "[full_run] Stopping Hardhat node (PID $HARDHAT_PID)…" >&2; kill "$HARDHAT_PID" 2>/dev/null || true; wait "$HARDHAT_PID" 2>/dev/null || true' EXIT

# Wait for the node to be ready
for i in $(seq 1 30); do
  if curl -sf -X POST http://127.0.0.1:8545 \
       -H "Content-Type: application/json" \
       -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
       >/dev/null 2>&1; then
    echo "[full_run] Hardhat node ready." >&2
    break
  fi
  sleep 1
done

# ── derive registrar address from register.js's signing key ───────────────────
REGISTRAR_ADDRESS=$(cd "$REPO_ROOT/registrar" && node -e "
const fs = require('fs');
const src = fs.readFileSync('src/register.js', 'utf8');
const m = src.match(/HH_REGISTRAR_KEY\s*=\s*['\"]([^'\"]+)['\"]/);
if (!m) { process.stderr.write('could not find HH_REGISTRAR_KEY in register.js\n'); process.exit(1); }
const { ethers } = require('ethers');
console.log(new ethers.Wallet(m[1]).address);
")
echo "[full_run] Registrar address: $REGISTRAR_ADDRESS" >&2

# ── deploy real Groth16Verifier + LandRegistry ─────────────────────────────────
echo "[full_run] Deploying real Groth16Verifier and LandRegistry…" >&2
USE_MOCK_VERIFIER=0 REGISTRAR_ADDRESS="$REGISTRAR_ADDRESS" npx hardhat run scripts/deploy.js --network localhost >&2

# ── run full registration pass ────────────────────────────────────────────────
echo "[full_run] Starting full registration pass (31 parcels)…" >&2
cd "$REPO_ROOT"
node registrar/scripts/full_run.js

echo "[full_run] Full run complete." >&2
