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
#   bash circuits/scripts/build.sh
#
# Requires:
#   circom  ≥ 2.2.0   (cargo install circom)
#   snarkjs ≥ 0.7.6   (npm install -g snarkjs, or: npx snarkjs)
#   node    ≥ 20

set -euo pipefail
export PATH="$HOME/.cargo/bin:$PATH"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CIRCUITS_DIR="$REPO_ROOT/circuits"
BUILD_DIR="$CIRCUITS_DIR/build"
CONTRACTS_DIR="$REPO_ROOT/contracts/contracts"
NODE_MODULES="$REPO_ROOT/registrar/node_modules"
SNARKJS="npx --prefix $REPO_ROOT/registrar snarkjs"

CIRCUIT="$CIRCUITS_DIR/register_parcel.circom"
R1CS="$BUILD_DIR/register_parcel.r1cs"
WASM_DIR="$BUILD_DIR/register_parcel_js"
PTAU_URL="https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_18.ptau"
PTAU="$BUILD_DIR/pot18_final.ptau"
ZKEY0="$BUILD_DIR/register_parcel_0000.zkey"
ZKEY="$BUILD_DIR/register_parcel_final.zkey"
VKEY="$BUILD_DIR/verification_key.json"
VERIFIER_SRC="$BUILD_DIR/Groth16Verifier.sol"
VERIFIER_DST="$CONTRACTS_DIR/Groth16Verifier.sol"

mkdir -p "$BUILD_DIR"

echo "=== 1. Compile circuit ==="
circom "$CIRCUIT" \
  --r1cs --wasm --sym \
  -l "$NODE_MODULES" \
  -o "$BUILD_DIR"
echo "Constraint count:"
$SNARKJS r1cs info "$R1CS" | grep "^# of Constraints"

echo "=== 2. Powers of Tau (phase 1) ==="
if [ ! -f "$PTAU" ]; then
  echo "Downloading $PTAU_URL …"
  curl -L --progress-bar "$PTAU_URL" -o "$PTAU"
fi

echo "=== 3. Groth16 setup (phase 2) ==="
$SNARKJS groth16 setup "$R1CS" "$PTAU" "$ZKEY0"
# DEV contribution only — replace with a MPC ceremony before production.
$SNARKJS zkey contribute "$ZKEY0" "$ZKEY" --name="dev-build" -e="$(date -u +%s)"

echo "=== 4. Export keys ==="
$SNARKJS zkey export verificationkey "$ZKEY" "$VKEY"
$SNARKJS zkey export solidityverifier "$ZKEY" "$VERIFIER_SRC"

echo "=== 5. Copy Groth16Verifier.sol → contracts/contracts/ ==="
cp "$VERIFIER_SRC" "$VERIFIER_DST"
echo "Copied to $VERIFIER_DST"

echo "=== Build complete ==="
echo "  r1cs:    $R1CS"
echo "  wasm:    $WASM_DIR/register_parcel.wasm"
echo "  zkey:    $ZKEY"
echo "  vkey:    $VKEY"
echo "  solidity: $VERIFIER_DST"
