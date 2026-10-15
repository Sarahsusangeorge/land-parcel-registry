#!/usr/bin/env bash
# registrar/scripts/demo.sh
#
# Sprint 3 demo: start a Hardhat node, deploy the real Groth16Verifier +
# LandRegistry, then register A, attempt B (expected overlap), register C.
#
# Expected output lines (status fields):
#   registered   ← A
#   overlap      ← B (overlaps A)
#   registered   ← C
#
# The Hardhat node is stopped at the end regardless of success or failure.
# State is written to registrar/data/demo_state.json (fresh each run).
#
# Usage: bash registrar/scripts/demo.sh
# Run from the repo root.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONTRACTS_DIR="$REPO_ROOT/contracts"
REGISTRAR_DIR="$REPO_ROOT/registrar"
STATE_FILE="$REGISTRAR_DIR/data/demo_state.json"
DEPLOY_FILE="$CONTRACTS_DIR/deployments/local.json"

# ── clean up previous state ────────────────────────────────────────────────────
rm -f "$STATE_FILE"

# ── start Hardhat node in background ──────────────────────────────────────────
echo "[demo] Starting Hardhat node…" >&2
cd "$CONTRACTS_DIR"
npx hardhat node --port 8545 >/tmp/hardhat-node.log 2>&1 &
HARDHAT_PID=$!
trap 'echo "[demo] Stopping Hardhat node (PID $HARDHAT_PID)…" >&2; kill "$HARDHAT_PID" 2>/dev/null || true; wait "$HARDHAT_PID" 2>/dev/null || true' EXIT

# Wait for the node to be ready
for i in $(seq 1 30); do
  if curl -sf -X POST http://127.0.0.1:8545 \
       -H "Content-Type: application/json" \
       -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
       >/dev/null 2>&1; then
    echo "[demo] Hardhat node ready." >&2
    break
  fi
  sleep 1
done

# ── deploy real Groth16Verifier + LandRegistry ─────────────────────────────────
echo "[demo] Deploying real Groth16Verifier and LandRegistry…" >&2
USE_MOCK_VERIFIER=0 npx hardhat run scripts/deploy.js --network localhost >&2

# ── register A ────────────────────────────────────────────────────────────────
echo "[demo] Registering A…" >&2
cd "$REPO_ROOT"
LINE_A=$(node registrar/src/register.js \
  --parcel-id A \
  --state-file "$STATE_FILE" \
  --deployment "$DEPLOY_FILE")
echo "$LINE_A"

STATUS_A=$(echo "$LINE_A" | node -e "process.stdin.resume(); let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>console.log(JSON.parse(d).status))")
if [ "$STATUS_A" != "registered" ]; then
  echo "[demo] ERROR: expected registered for A, got $STATUS_A" >&2
  exit 1
fi
PROVE_MS_A=$(echo "$LINE_A" | node -e "process.stdin.resume(); let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>console.log(JSON.parse(d).prove_ms))")
echo "[demo] A: registered (${PROVE_MS_A} ms)" >&2

# ── attempt B (should overlap) ─────────────────────────────────────────────────
echo "[demo] Attempting B…" >&2
LINE_B=$(node registrar/src/register.js \
  --parcel-id B \
  --state-file "$STATE_FILE" \
  --deployment "$DEPLOY_FILE")
echo "$LINE_B"

STATUS_B=$(echo "$LINE_B" | node -e "process.stdin.resume(); let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>console.log(JSON.parse(d).status))")
if [ "$STATUS_B" != "overlap" ]; then
  echo "[demo] ERROR: expected overlap for B, got $STATUS_B" >&2
  exit 1
fi
echo "[demo] B: overlap (as expected)" >&2

# ── register C ────────────────────────────────────────────────────────────────
echo "[demo] Registering C…" >&2
LINE_C=$(node registrar/src/register.js \
  --parcel-id C \
  --state-file "$STATE_FILE" \
  --deployment "$DEPLOY_FILE")
echo "$LINE_C"

STATUS_C=$(echo "$LINE_C" | node -e "process.stdin.resume(); let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>console.log(JSON.parse(d).status))")
if [ "$STATUS_C" != "registered" ]; then
  echo "[demo] ERROR: expected registered for C, got $STATUS_C" >&2
  exit 1
fi
PROVE_MS_C=$(echo "$LINE_C" | node -e "process.stdin.resume(); let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>console.log(JSON.parse(d).prove_ms))")
echo "[demo] C: registered (${PROVE_MS_C} ms)" >&2

echo "[demo] Demo complete. registered / overlap / registered ✓" >&2

# Machine-readable summary for bench
echo "{ \"A_prove_ms\": $PROVE_MS_A, \"C_prove_ms\": $PROVE_MS_C }" >&2
