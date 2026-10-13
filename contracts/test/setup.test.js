const { expect } = require("chai");

// Sprint 0 sanity check: the toolchain compiles and OpenZeppelin is importable.
// Replaced by registry.mock.test.js in Sprint 2.
describe("Sprint 0 setup", function () {
  it("OpenZeppelin ERC721 and AccessControl artifacts compile", async function () {
    const f = await ethers.getContractFactory("SetupCheck");
    const c = await f.deploy();
    expect(await c.name()).to.equal("SetupCheck");
  });
});
