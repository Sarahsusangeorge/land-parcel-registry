require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.28",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  // Gas reporter ships with hardhat-toolbox. Run: REPORT_GAS=true npx hardhat test
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
    outputJSON: process.env.REPORT_GAS === "true",
    outputJSONFile: "../bench/results/gas-raw.json",
  },
};
