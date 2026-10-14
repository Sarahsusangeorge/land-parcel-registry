#!/usr/bin/env bash
# circuits/scripts/build.sh
# Build the register_parcel Groth16 circuit end-to-end:
#   1. Compile circom → .r1cs + _js/ (witness generator)
#   2. Hermez Powers-of-Tau — download if missing
#      (Hermez final files are already phase-2 prepared; no prepare phase2 step)
#   3. Groth16 setup (dev contribution only — replace with MPC ceremony for production)
#   4. Export proving key (.zkey), verification key (.json), Solidity verifier
#   5. Copy Groth16Verifier.sol into contracts/contracts/
#
# Usage (from repo root):
#   bash circuits/scripts/build.sh            # production circuit (N=16, pot20, ~500 MB download)
#   bash circuits/scripts/build.sh --dev      # dev/test circuit  (N=8,  pot19, already present)
#
# Requires:
#   circom  ≥ 2.2.0   (cargo install circom)
#   snarkjs ≥ 0.7.6   (npm install -g snarkjs, or: npx snarkjs)
#   node    ≥ 20
#
# ptau sizing (snarkjs groth16 requires 2^k ≥ constraints):
#   Production (N=16, N_LEVELS=32): 588,297 constraints → pot20 (2^20 = 1,048,576 ✓)
#   Dev        (N=8,  N_LEVELS=16):  79,330 constraints → pot19 (2^19 =   524,288 ✓)

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
  PTAU="$BUILD_DIR/pot19_hez_final.ptau"
  echo "=== DEV MODE: N=8, N_LEVELS=16, pot19 (79,330 constraints) ==="
else
  CIRCUIT_NAME="register_parcel"
  # 588,297 constraints; 2^20=1,048,576 > 588,297 → pot20 is sufficient.
  PTAU_URL="https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_20.ptau"
  PTAU="$BUILD_DIR/pot20_hez_final.ptau"
  echo "=== PRODUCTION MODE: N=16, N_LEVELS=32, pot20 (588,297 constraints) ==="
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

echo "=== 2. Powers of Tau (Hermez ceremony file — already phase-2 prepared) ==="
if [ ! -f "$PTAU" ]; then
  echo "Downloading $(basename $PTAU_URL) …"
  curl -L --progress-bar "$PTAU_URL" -o "$PTAU"
else
  echo "Using cached $(basename $PTAU)"
fi

echo "=== 3. Groth16 setup ==="
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
