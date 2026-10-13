// Sprint 2: LandRegistry against MockVerifier (PLAN.md, Sprint 2 Sarah lane).
// Proof bytes are dummies here; the mock decides validity. Coarse cells and
// parcel IDs come from the real geo output, so the uint64 encoding is exercised.
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");
const parcels = require("../../geo/out/parcels.json").parcels;

const byId = Object.fromEntries(parcels.map((p) => [p.parcel_id, p]));
const coarse = (id) => byId[id].coarse_cells_dec.map((d) => BigInt(d));

const A = [1n, 2n];
const B = [[3n, 4n], [5n, 6n]];
const C = [7n, 8n];
const ROOT_1 = 111n;
const ROOT_2 = 222n;
const COMMIT_A = 1001n;
const COMMIT_C = 1003n;

async function deploy() {
  const [admin, registrar, owner, other] = await ethers.getSigners();
  const mock = await (await ethers.getContractFactory("MockVerifier")).deploy();
  const reg = await (await ethers.getContractFactory("LandRegistry"))
    .deploy(await mock.getAddress(), admin.address);
  await reg.grantRole(await reg.REGISTRAR_ROLE(), registrar.address);
  return { reg, mock, admin, registrar, owner, other };
}

function register(reg, signer, owner, pub, cells = coarse("A"), uri = "ipfs://parcel-A") {
  return reg.connect(signer).registerParcel(owner, A, B, C, pub, cells, uri);
}

describe("LandRegistry (mock verifier)", function () {
  it("starts with an empty tree and no tokens", async function () {
    const { reg } = await loadFixture(deploy);
    expect(await reg.occupiedRoot()).to.equal(0n);
    await expect(reg.ownerOf(1)).to.be.revertedWithCustomError(reg, "ERC721NonexistentToken");
  });

  it("registrar registers: root updates, token 1 minted to owner, event emitted", async function () {
    const { reg, registrar, owner } = await loadFixture(deploy);
    await expect(register(reg, registrar, owner.address, [0n, ROOT_1, COMMIT_A]))
      .to.emit(reg, "ParcelRegistered")
      .withArgs(1n, owner.address, COMMIT_A, 0n, ROOT_1);
    expect(await reg.occupiedRoot()).to.equal(ROOT_1);
    expect(await reg.ownerOf(1)).to.equal(owner.address);
    expect(await reg.commitmentUsed(COMMIT_A)).to.equal(true);
  });

  it("chains roots and mints token IDs upwards", async function () {
    const { reg, registrar, owner, other } = await loadFixture(deploy);
    await register(reg, registrar, owner.address, [0n, ROOT_1, COMMIT_A]);
    await expect(register(reg, registrar, other.address, [ROOT_1, ROOT_2, COMMIT_C], coarse("C")))
      .to.emit(reg, "ParcelRegistered")
      .withArgs(2n, other.address, COMMIT_C, ROOT_1, ROOT_2);
    expect(await reg.occupiedRoot()).to.equal(ROOT_2);
    expect(await reg.ownerOf(2)).to.equal(other.address);
  });

  it("non-registrar caller reverts", async function () {
    const { reg, owner, other } = await loadFixture(deploy);
    await expect(register(reg, other, owner.address, [0n, ROOT_1, COMMIT_A]))
      .to.be.revertedWithCustomError(reg, "AccessControlUnauthorizedAccount")
      .withArgs(other.address, await reg.REGISTRAR_ROLE());
  });

  it("admin without the registrar role also reverts", async function () {
    const { reg, admin, owner } = await loadFixture(deploy);
    await expect(register(reg, admin, owner.address, [0n, ROOT_1, COMMIT_A]))
      .to.be.revertedWithCustomError(reg, "AccessControlUnauthorizedAccount");
  });

  it("stale oldRoot reverts with StaleRoot", async function () {
    const { reg, registrar, owner } = await loadFixture(deploy);
    await register(reg, registrar, owner.address, [0n, ROOT_1, COMMIT_A]);
    // Replaying a proof built against the empty tree after A landed.
    await expect(register(reg, registrar, owner.address, [0n, ROOT_2, COMMIT_C], coarse("C")))
      .to.be.revertedWithCustomError(reg, "StaleRoot");
  });

  it("reused commitment reverts with CommitmentReused", async function () {
    const { reg, registrar, owner } = await loadFixture(deploy);
    await register(reg, registrar, owner.address, [0n, ROOT_1, COMMIT_A]);
    await expect(register(reg, registrar, owner.address, [ROOT_1, ROOT_2, COMMIT_A]))
      .to.be.revertedWithCustomError(reg, "CommitmentReused");
  });

  it("empty coarse cells reverts with EmptyCoarseCells", async function () {
    const { reg, registrar, owner } = await loadFixture(deploy);
    await expect(register(reg, registrar, owner.address, [0n, ROOT_1, COMMIT_A], []))
      .to.be.revertedWithCustomError(reg, "EmptyCoarseCells");
  });

  it("mock returns false: reverts with InvalidProof and changes nothing", async function () {
    const { reg, mock, registrar, owner } = await loadFixture(deploy);
    await mock.setResult(false);
    await expect(register(reg, registrar, owner.address, [0n, ROOT_1, COMMIT_A]))
      .to.be.revertedWithCustomError(reg, "InvalidProof");
    expect(await reg.occupiedRoot()).to.equal(0n);
    expect(await reg.commitmentUsed(COMMIT_A)).to.equal(false);
  });

  it("checks run in the I5 order", async function () {
    const { reg, mock, registrar, owner, other } = await loadFixture(deploy);
    await register(reg, registrar, owner.address, [0n, ROOT_1, COMMIT_A]);
    await mock.setResult(false);
    // role before everything
    await expect(register(reg, other, owner.address, [9n, ROOT_2, COMMIT_A], []))
      .to.be.revertedWithCustomError(reg, "AccessControlUnauthorizedAccount");
    // empty coarse cells before stale root
    await expect(register(reg, registrar, owner.address, [9n, ROOT_2, COMMIT_A], []))
      .to.be.revertedWithCustomError(reg, "EmptyCoarseCells");
    // stale root before reused commitment
    await expect(register(reg, registrar, owner.address, [9n, ROOT_2, COMMIT_A]))
      .to.be.revertedWithCustomError(reg, "StaleRoot");
    // reused commitment before proof
    await expect(register(reg, registrar, owner.address, [ROOT_1, ROOT_2, COMMIT_A]))
      .to.be.revertedWithCustomError(reg, "CommitmentReused");
  });

  it("getParcel returns stored values", async function () {
    const { reg, registrar, owner } = await loadFixture(deploy);
    const tx = await register(reg, registrar, owner.address, [0n, ROOT_1, COMMIT_A]);
    const block = await ethers.provider.getBlock((await tx.wait()).blockNumber);
    const [commitment, cells, uri, registeredAt] = await reg.getParcel(1);
    expect(commitment).to.equal(COMMIT_A);
    expect(cells).to.deep.equal(coarse("A"));
    expect(uri).to.equal("ipfs://parcel-A");
    expect(registeredAt).to.equal(BigInt(block.timestamp));
    expect(await reg.tokenURI(1)).to.equal("ipfs://parcel-A");
  });

  it("getParcel on an unknown token reverts", async function () {
    const { reg } = await loadFixture(deploy);
    await expect(reg.getParcel(1)).to.be.revertedWithCustomError(reg, "ERC721NonexistentToken");
  });

  it("minting to the zero address reverts and leaves the root unchanged", async function () {
    const { reg, registrar } = await loadFixture(deploy);
    await expect(register(reg, registrar, ethers.ZeroAddress, [0n, ROOT_1, COMMIT_A]))
      .to.be.revertedWithCustomError(reg, "ERC721InvalidReceiver");
    expect(await reg.occupiedRoot()).to.equal(0n);
  });
});
