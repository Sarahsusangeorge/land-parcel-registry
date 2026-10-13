// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// Interface I5: matches the verifier snarkjs exports for public signals
/// [oldRoot, newRoot, commitment].
interface IGroth16Verifier {
    function verifyProof(
        uint[2] calldata a,
        uint[2][2] calldata b,
        uint[2] calldata c,
        uint[3] calldata pubSignals
    ) external view returns (bool);
}

/// @title LandRegistry
/// @notice Land parcels as ERC-721 tokens. A parcel is accepted only with a
/// zero-knowledge proof that all its fine H3 cells were inserted into empty
/// slots of the occupied-cell sparse Merkle tree, moving the tree from
/// `occupiedRoot` (oldRoot) to newRoot. Exact boundaries and fine cells never
/// reach the chain: only the commitment and coarse public cells are stored.
contract LandRegistry is ERC721, AccessControl {
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");

    IGroth16Verifier public immutable verifier;

    /// Root of the occupied-cell sparse Merkle tree. Empty tree root is 0.
    uint256 public occupiedRoot;
    mapping(uint256 => bool) public commitmentUsed;

    struct Parcel {
        uint256 commitment;
        uint64[] coarseCells;
        string metadataURI;
        uint256 registeredAt;
    }

    mapping(uint256 => Parcel) private _parcels;
    uint256 private _nextTokenId = 1;

    event ParcelRegistered(
        uint256 indexed tokenId,
        address indexed owner,
        uint256 commitment,
        uint256 oldRoot,
        uint256 newRoot
    );

    error StaleRoot();
    error InvalidProof();
    error CommitmentReused();
    error EmptyCoarseCells();

    constructor(address verifier_, address admin) ERC721("Land Parcel", "PARCEL") {
        verifier = IGroth16Verifier(verifier_);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /// @param pubSignals [oldRoot, newRoot, commitment], in the circuit's declared order.
    function registerParcel(
        address owner,
        uint[2] calldata a,
        uint[2][2] calldata b,
        uint[2] calldata c,
        uint[3] calldata pubSignals,
        uint64[] calldata coarseCells,
        string calldata metadataURI
    ) external onlyRole(REGISTRAR_ROLE) returns (uint256 tokenId) {
        // Checks, in the I5 order (caller role is the modifier).
        if (coarseCells.length == 0) revert EmptyCoarseCells();
        if (pubSignals[0] != occupiedRoot) revert StaleRoot();
        uint256 commitment = pubSignals[2];
        if (commitmentUsed[commitment]) revert CommitmentReused();
        if (!verifier.verifyProof(a, b, c, pubSignals)) revert InvalidProof();

        // Effects.
        uint256 oldRoot = pubSignals[0];
        occupiedRoot = pubSignals[1];
        commitmentUsed[commitment] = true;
        tokenId = _nextTokenId++;
        Parcel storage p = _parcels[tokenId];
        p.commitment = commitment;
        p.coarseCells = coarseCells;
        p.metadataURI = metadataURI;
        p.registeredAt = block.timestamp;

        // Interaction last. _mint (not _safeMint) so no receiver callback runs.
        _mint(owner, tokenId);
        emit ParcelRegistered(tokenId, owner, commitment, oldRoot, pubSignals[1]);
    }

    function getParcel(uint256 tokenId)
        external
        view
        returns (uint256 commitment, uint64[] memory coarseCells, string memory metadataURI, uint256 registeredAt)
    {
        _requireOwned(tokenId);
        Parcel storage p = _parcels[tokenId];
        return (p.commitment, p.coarseCells, p.metadataURI, p.registeredAt);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return _parcels[tokenId].metadataURI;
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
