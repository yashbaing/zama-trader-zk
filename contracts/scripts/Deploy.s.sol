// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/MockToken.sol";
import "../src/Vault.sol";
import "../src/OrderBook.sol";
import "../src/TradingEngine.sol";
import "../src/AutoInvestVault.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // ── Step 1: Deploy Mock Tokens ───────────────────────────
        MockToken wbtc = new MockToken("Wrapped Bitcoin", "WBTC", 8);
        MockToken weth = new MockToken("Wrapped Ether", "WETH", 18);
        MockToken wsol = new MockToken("Wrapped Solana", "WSOL", 9);
        MockToken usdc = new MockToken("USD Coin", "USDC", 6);

        console.log("WBTC:", address(wbtc));
        console.log("WETH:", address(weth));
        console.log("WSOL:", address(wsol));
        console.log("USDC:", address(usdc));

        // ── Step 2: Deploy Core Protocol ─────────────────────────
        Vault vault = new Vault();
        OrderBook orderBook = new OrderBook();
        TradingEngine engine = new TradingEngine(address(orderBook), address(vault));

        console.log("Vault:", address(vault));
        console.log("OrderBook:", address(orderBook));
        console.log("TradingEngine:", address(engine));

        // ── Step 3: Deploy Auto-Invest Vault ─────────────────────
        AutoInvestVault autoVault = new AutoInvestVault(address(vault));
        console.log("AutoInvestVault:", address(autoVault));

        // ── Step 4: Configure Permissions ────────────────────────
        // Grant TradingEngine permission to modify vault balances
        vault.setTradingEngine(address(engine));
        // Grant TradingEngine permission to read/update orders
        orderBook.setTradingEngine(address(engine));

        // ── Step 5: Add Supported Tokens ─────────────────────────
        vault.addSupportedToken(address(wbtc));
        vault.addSupportedToken(address(weth));
        vault.addSupportedToken(address(wsol));
        vault.addSupportedToken(address(usdc));

        // ── Step 6: Add Trading Pairs ────────────────────────────
        orderBook.addTradingPair(address(wbtc), address(usdc)); // BTC/USDC
        orderBook.addTradingPair(address(weth), address(usdc)); // ETH/USDC
        orderBook.addTradingPair(address(wsol), address(usdc)); // SOL/USDC
        orderBook.addTradingPair(address(weth), address(wbtc)); // ETH/BTC

        vm.stopBroadcast();

        // ── Output Deployment Addresses ──────────────────────────
        string memory output = string.concat(
            '{\n',
            '  "wbtc": "', vm.toString(address(wbtc)), '",\n',
            '  "weth": "', vm.toString(address(weth)), '",\n',
            '  "wsol": "', vm.toString(address(wsol)), '",\n',
            '  "usdc": "', vm.toString(address(usdc)), '",\n',
            '  "vault": "', vm.toString(address(vault)), '",\n',
            '  "orderBook": "', vm.toString(address(orderBook)), '",\n',
            '  "tradingEngine": "', vm.toString(address(engine)), '",\n',
            '  "autoInvestVault": "', vm.toString(address(autoVault)), '"\n',
            '}'
        );
        vm.writeFile("./deployments.json", output);
        console.log("\nDeployment addresses saved to deployments.json");
    }
}
