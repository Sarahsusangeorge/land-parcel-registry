// Deploy the verifier and LandRegistry to a local Hardhat node, grant the
// registrar role, and write addresses to contracts/deployments/local.json.
//
//   npx hardhat node                                     # terminal 1
//   npx hardhat run scripts/deploy.js --network localhost  # terminal 2
//
// Sprint 2: the verifier is MockVerifier (USE_MOCK_VERIFIER=1 is the default).
// Sprint 3: run with USE_MOCK_VERIFIER=0 to deploy the generated Groth16Verifier;
// then the mock is removed from this path entirely.
const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");

async function main() {
  const useMock = (process.env.USE_MOCK_VERIFIER ?? "1") === "1";
  const verifierName = useMock ? "MockVerifier" : "Groth16Verifier";
  const [admin, registrar] = await ethers.getSigners();

  const verifier = await (await ethers.getContractFactory(verifierName)).deploy();
  await verifier.waitForDeployment();
  const registry = await (await ethers.getContractFactory("LandRegistry"))
    .deploy(await verifier.getAddress(), admin.address);
  await registry.waitForDeployment();
  await (await registry.grantRole(await registry.REGISTRAR_ROLE(), registrar.address)).wait();

  const out = {
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    verifier: { name: verifierName, address: await verifier.getAddress() },
    registry: await registry.getAddress(),
    admin: admin.address,
    registrar: registrar.address,
    deployedAt: new Date().toISOString(),
  };
  const file = path.join(__dirname, "..", "deployments", "local.json");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
  console.log(`deployed ${verifierName} at ${out.verifier.address}`);
  console.log(`deployed LandRegistry at ${out.registry}; registrar role -> ${registrar.address}`);
  console.log(`wrote ${file}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
