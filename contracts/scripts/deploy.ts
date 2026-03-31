/**
 * ZKTrader Deployment Script (Hardhat)
 *
 * Deploys all protocol contracts in the correct order:
 *   1. Mock tokens (WBTC, WETH, WSOL, USDC)
 *   2. Vault (encrypted balance storage)
 *   3. OrderBook (encrypted order storage)
 *   4. TradingEngine (FHE matching engine)
 *   5. AutoInvestVault (Fear & Greed strategies)
 *   6. CopyTrading (encrypted strategy copying)
 *   7. Configure permissions and trading pairs
 *
 * Run: npx hardhat run scripts/deploy.ts --network <network>
 */

import { ethers } from "hardhat";
import fs from "fs";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));
  console.log("");

  // ── Step 1: Deploy Mock Tokens ───────────────────────────────
  console.log("═══ Deploying Mock Tokens ═══");

  const MockToken = await ethers.getContractFactory("MockToken");

  const wbtc = await MockToken.deploy("Wrapped Bitcoin", "WBTC", 8);
  await wbtc.waitForDeployment();
  console.log("  WBTC:", await wbtc.getAddress());

  const weth = await MockToken.deploy("Wrapped Ether", "WETH", 18);
  await weth.waitForDeployment();
  console.log("  WETH:", await weth.getAddress());

  const wsol = await MockToken.deploy("Wrapped Solana", "WSOL", 9);
  await wsol.waitForDeployment();
  console.log("  WSOL:", await wsol.getAddress());

  const usdc = await MockToken.deploy("USD Coin", "USDC", 6);
  await usdc.waitForDeployment();
  console.log("  USDC:", await usdc.getAddress());
  console.log("");

  // ── Step 2: Deploy Core Protocol ─────────────────────────────
  console.log("═══ Deploying Core Protocol ═══");

  const Vault = await ethers.getContractFactory("Vault");
  const vault = await Vault.deploy();
  await vault.waitForDeployment();
  console.log("  Vault:", await vault.getAddress());

  const OrderBook = await ethers.getContractFactory("OrderBook");
  const orderBook = await OrderBook.deploy();
  await orderBook.waitForDeployment();
  console.log("  OrderBook:", await orderBook.getAddress());

  const TradingEngine = await ethers.getContractFactory("TradingEngine");
  const engine = await TradingEngine.deploy(
    await orderBook.getAddress(),
    await vault.getAddress()
  );
  await engine.waitForDeployment();
  console.log("  TradingEngine:", await engine.getAddress());
  console.log("");

  // ── Step 3: Deploy Bonus Contracts ───────────────────────────
  console.log("═══ Deploying Bonus Contracts ═══");

  const AutoInvestVault = await ethers.getContractFactory("AutoInvestVault");
  const autoVault = await AutoInvestVault.deploy(await vault.getAddress());
  await autoVault.waitForDeployment();
  console.log("  AutoInvestVault:", await autoVault.getAddress());

  const CopyTrading = await ethers.getContractFactory("CopyTrading");
  const copyTrading = await CopyTrading.deploy(await vault.getAddress());
  await copyTrading.waitForDeployment();
  console.log("  CopyTrading:", await copyTrading.getAddress());
  console.log("");

  // ── Step 4: Configure Permissions ────────────────────────────
  console.log("═══ Configuring Permissions ═══");

  await vault.setTradingEngine(await engine.getAddress());
  console.log("  Vault → TradingEngine: granted ENGINE_ROLE");

  await orderBook.setTradingEngine(await engine.getAddress());
  console.log("  OrderBook → TradingEngine: granted ENGINE_ROLE");

  // ── Step 5: Add Supported Tokens ─────────────────────────────
  console.log("═══ Adding Supported Tokens ═══");

  const tokens = [
    { name: "WBTC", contract: wbtc },
    { name: "WETH", contract: weth },
    { name: "WSOL", contract: wsol },
    { name: "USDC", contract: usdc },
  ];

  for (const token of tokens) {
    await vault.addSupportedToken(await token.contract.getAddress());
    console.log(`  Added ${token.name} to vault`);
  }

  // ── Step 6: Add Trading Pairs ────────────────────────────────
  console.log("═══ Adding Trading Pairs ═══");

  const pairs = [
    { base: wbtc, quote: usdc, label: "BTC/USDC" },
    { base: weth, quote: usdc, label: "ETH/USDC" },
    { base: wsol, quote: usdc, label: "SOL/USDC" },
    { base: weth, quote: wbtc, label: "ETH/BTC" },
  ];

  for (const pair of pairs) {
    await orderBook.addTradingPair(
      await pair.base.getAddress(),
      await pair.quote.getAddress()
    );
    console.log(`  Added pair: ${pair.label}`);
  }

  console.log("");

  // ── Save Deployment Addresses ────────────────────────────────
  const deployment = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      wbtc: await wbtc.getAddress(),
      weth: await weth.getAddress(),
      wsol: await wsol.getAddress(),
      usdc: await usdc.getAddress(),
      vault: await vault.getAddress(),
      orderBook: await orderBook.getAddress(),
      tradingEngine: await engine.getAddress(),
      autoInvestVault: await autoVault.getAddress(),
      copyTrading: await copyTrading.getAddress(),
    },
    tradingPairs: pairs.map((p) => p.label),
  };

  const outputPath = "./deployments.json";
  fs.writeFileSync(outputPath, JSON.stringify(deployment, null, 2));
  console.log(`Deployment saved to ${outputPath}`);

  // ── Generate .env files for frontend and backend ─────────────
  const envLines = [
    `# Auto-generated from deployment at ${deployment.timestamp}`,
    `NEXT_PUBLIC_VAULT_ADDRESS=${deployment.contracts.vault}`,
    `NEXT_PUBLIC_ORDER_BOOK_ADDRESS=${deployment.contracts.orderBook}`,
    `NEXT_PUBLIC_TRADING_ENGINE_ADDRESS=${deployment.contracts.tradingEngine}`,
    `NEXT_PUBLIC_AUTO_INVEST_VAULT_ADDRESS=${deployment.contracts.autoInvestVault}`,
    `NEXT_PUBLIC_WBTC_ADDRESS=${deployment.contracts.wbtc}`,
    `NEXT_PUBLIC_WETH_ADDRESS=${deployment.contracts.weth}`,
    `NEXT_PUBLIC_WSOL_ADDRESS=${deployment.contracts.wsol}`,
    `NEXT_PUBLIC_USDC_ADDRESS=${deployment.contracts.usdc}`,
    `NEXT_PUBLIC_CHAIN_ID=${deployment.chainId}`,
  ].join("\n");

  fs.writeFileSync("../frontend/.env.local", envLines);
  console.log("Frontend .env.local generated");

  const backendEnv = envLines
    .replace(/NEXT_PUBLIC_/g, "")
    .replace("CHAIN_ID", "CHAIN_ID");
  fs.writeFileSync("../backend/.env", backendEnv);
  console.log("Backend .env generated");

  console.log("\n✅ Deployment complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
