import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "fhevm-hardhat-plugin"; // Zama's official Hardhat plugin

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "cancun",
    },
  },
  defaultNetwork: "localfhevm",
  networks: {
    // Local fhEVM node (run via: npx fhevm-hardhat-plugin localfhevm:start)
    localfhevm: {
      url: "http://localhost:8545",
      chainId: 9000,
      accounts: {
        mnemonic: "test test test test test test test test test test test junk",
        count: 10,
      },
    },
    // Zama devnet
    zamaDevnet: {
      url: process.env.ZAMA_RPC_URL || "https://devnet.zama.ai",
      chainId: 8009,
      accounts: process.env.DEPLOYER_PRIVATE_KEY
        ? [process.env.DEPLOYER_PRIVATE_KEY]
        : [],
    },
  },
  mocha: {
    timeout: 300000, // FHE operations are slow — 5 minute timeout
  },
};

export default config;
