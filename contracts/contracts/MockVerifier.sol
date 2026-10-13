// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {IGroth16Verifier} from "./LandRegistry.sol";

/// Sprint 2 only. Stands in for the generated Groth16Verifier so the registry
/// can be tested before the real circuit exists. Never used in the deploy path
/// from Sprint 3 on.
contract MockVerifier is IGroth16Verifier {
    bool public result = true;

    function setResult(bool r) external {
        result = r;
    }

    function verifyProof(
        uint[2] calldata,
        uint[2][2] calldata,
        uint[2] calldata,
        uint[3] calldata
    ) external view returns (bool) {
        return result;
    }
}
