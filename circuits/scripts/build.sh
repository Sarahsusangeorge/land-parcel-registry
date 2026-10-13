#!/usr/bin/env bash
# circuits/scripts/build.sh
# Build the register_parcel Groth16 circuit end-to-end:
#   1. Compile circom → .r1cs + _js/ (witness generator)
#   2. Hermez Powers-of-Tau (phase 1) — download if missing
#   3. Groth16 setup (phase 2, dev contribution only — replace for production)
#   4. Export proving key (.zkey), verification key (.json), Solidity verifier
#   5. Copy Groth16Verifier.sol into contracts/contracts/
#
# Usage (from repo root):
#   bash circuits/scripts/build.sh            # production circuit (requires pot21, ~160 min ptau prep)
#   bash circuits/scripts/build.sh --dev      # dev/test circuit  (N=8, N_LEVELS=16, uses pot19)
#
# Requires:
#   circom  ≥ 2.2.0   (cargo install circom)
#   snarkjs ≥ 0.7.6   (npm install -g snarkjs, or: npx snarkjs)
#   node    ≥ 20
#
# NOTE – ptau sizing:
#   Production circuit (N=16, N_LEVELS=32): 588,732 wires → needs pot21 (2^21).
#     powersOfTau28_hez_final_21.ptau is ~3 GB; prepare phase2 takes ~160 min on Apple Silicon.
#   Dev circuit      (N=8,  N_LEVELS=16):  158,555 wires → fits pot19 (2^19).

set -euo pipefail
export PATH="$HOME/.cargo/bin:$PATH"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CIRCUITS_DIR="$REPO_ROOT/circuits"
BUILD_DIR="$CIRCUITS_DIR/build"
CONTRACTS_DIR="$REPO_ROOT/contracts/contracts"
NODE_MODULES="$REPO_ROOT/registrar/node_modules"
SNARKJS="npx --prefix $REPO_ROOT/registrar snarkjs"

mkdir -p "$BUILD_DIR"

# ── select dev vs production ──────────────────────────────────────────────────
DEV_MODE=0
for arg in "$@"; do [ "$arg" = "--dev" ] && DEV_MODE=1; done

if [ "$DEV_MODE" = "1" ]; then
  CIRCUIT_NAME="register_parcel_dev"
  PTAU_URL="https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_19.ptau"
  PTAU_DL="$BUILD_DIR/pot19_hez_final.ptau"
  PTAU="$BUILD_DIR/pot19_pp.ptau"
  echo "=== DEV MODE: N=8, N_LEVELS=16, pot19 ==="
else
  CIRCUIT_NAME="register_parcel"
  # Production needs pot21 (2^21 SRS points — 588,732 wires × 2 > 2^20).
  # Download: https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_21.ptau (~3 GB)
  PTAU_URL="https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_21.ptau"
  PTAU_DL="$BUILD_DIR/pot21_hez_final.ptau"
  PTAU="$BUILD_DIR/pot21_pp.ptau"
  echo "=== PRODUCTION MODE: N=16, N_LEVELS=32, pot21 ==="
  echo "    WARNING: pot21 prepare phase2 takes ~160 min and produces a ~2 GB file."
fi

CIRCUIT="$CIRCUITS_DIR/${CIRCUIT_NAME}.circom"
R1CS="$BUILD_DIR/${CIRCUIT_NAME}.r1cs"
WASM_DIR="$BUILD_DIR/${CIRCUIT_NAME}_js"
ZKEY0="$BUILD_DIR/${CIRCUIT_NAME}_0000.zkey"
ZKEY1="$BUILD_DIR/${CIRCUIT_NAME}_0001.zkey"
ZKEY="$BUILD_DIR/${CIRCUIT_NAME}_final.zkey"
VKEY="$BUILD_DIR/${CIRCUIT_NAME}_vkey.json"
VERIFIER_SRC="$BUILD_DIR/Groth16Verifier.sol"
VERIFIER_DST="$CONTRACTS_DIR/Groth16Verifier.sol"

echo "=== 1. Compile circuit ==="
circom "$CIRCUIT" \
  --r1cs --wasm --sym \
  -l "$NODE_MODULES" \
  -o "$BUILD_DIR"
echo "Constraint count:"
$SNARKJS r1cs info "$R1CS" | grep "# of Constraints"

echo "=== 2. Powers of Tau (download phase 1, prepare phase 2) ==="
if [ ! -f "$PTAU_DL" ]; then
  echo "Downloading $(basename $PTAU_URL) …"
  curl -L --progress-bar "$PTAU_URL" -o "$PTAU_DL"
fi
if [ ! -f "$PTAU" ]; then
  echo "Preparing phase 2 (first run — may take a long time) …"
  $SNARKJS powersoftau prepare phase2 "$PTAU_DL" "$PTAU" -v
fi

echo "=== 3. Groth16 setup (phase 2) ==="
$SNARKJS groth16 setup "$R1CS" "$PTAU" "$ZKEY0"
# DEV contribution only — replace with a MPC ceremony before production.
$SNARKJS zkey contribute "$ZKEY0" "$ZKEY1" --name="dev-build" -e="$(date -u +%s)"
cp "$ZKEY1" "$ZKEY"

echo "=== 4. Export keys ==="
$SNARKJS zkey export verificationkey "$ZKEY" "$VKEY"
$SNARKJS zkey export solidityverifier "$ZKEY" "$VERIFIER_SRC"

echo "=== 5. Copy Groth16Verifier.sol → contracts/contracts/ ==="
cp "$VERIFIER_SRC" "$VERIFIER_DST"
echo "Copied to $VERIFIER_DST"

echo "=== Build complete ==="
echo "  r1cs:     $R1CS"
echo "  wasm:     $WASM_DIR/${CIRCUIT_NAME}.wasm"
echo "  zkey:     $ZKEY"
echo "  vkey:     $VKEY"
echo "  solidity: $VERIFIER_DST"
