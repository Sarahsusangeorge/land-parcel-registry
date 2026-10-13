// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// Sprint 0 only: proves ERC721 + AccessControl compile together.
/// Delete when LandRegistry.sol lands in Sprint 2.
contract SetupCheck is ERC721, AccessControl {
    constructor() ERC721("SetupCheck", "SC") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721, AccessControl) returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
