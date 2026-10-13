require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.28",
    // OpenZeppelin 5.6 uses mcopy, which needs the Cancun EVM target.
    settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "cancun" },
  },
  // hardhat-gas-reporter 1.0.10 (pinned by hardhat-toolbox 5). Text output only;
  // Sprint 4 parses it into bench/results/gas.json.
  // Run: REPORT_GAS=true npx hardhat test
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
    noColors: true,
    outputFile: process.env.REPORT_GAS === "true" ? "../bench/results/gas-report.txt" : undefined,
  },
};
