// ═══════════════════════════════════════════════════════════════════
// ZKTrader — Full Integration Tests with fhEVM
//
// These tests run on the local fhEVM node (via fhevm-hardhat-plugin).
// All FHE operations are REAL — not mocked. This means:
//   • Tests are slow (~10-30s per test due to FHE computation)
//   • Encrypted values are genuine ciphertexts
//   • Reencryption / decryption uses actual FHE keys
//
// Run with: npx hardhat test --network localfhevm
// ═══════════════════════════════════════════════════════════════════

import { expect } from "chai";
import { ethers } from "hardhat";
import { createInstances } from "../test-utils/instance";
import { getSigners } from "../test-utils/signers";
import { Contract, Signer } from "ethers";

describe("ZKTrader Protocol", function () {
  this.timeout(300000); // 5 minutes — FHE is computationally expensive

  let deployer: Signer;
  let alice: Signer;
  let bob: Signer;
  let vault: Contract;
  let orderBook: Contract;
  let engine: Contract;
  let wbtc: Contract;
  let usdc: Contract;
  let instances: any; // fhevmjs instances for each signer

  before(async function () {
    // Get test signers
    const signers = await getSigners();
    deployer = signers.deployer;
    alice = signers.alice;
    bob = signers.bob;

    // Deploy mock tokens
    const MockToken = await ethers.getContractFactory("MockToken");
    wbtc = await MockToken.deploy("Wrapped Bitcoin", "WBTC", 8);
    usdc = await MockToken.deploy("USD Coin", "USDC", 6);
    await wbtc.waitForDeployment();
    await usdc.waitForDeployment();

    // Deploy protocol contracts
    const Vault = await ethers.getContractFactory("Vault");
    vault = await Vault.deploy();
    await vault.waitForDeployment();

    const OrderBook = await ethers.getContractFactory("OrderBook");
    orderBook = await OrderBook.deploy();
    await orderBook.waitForDeployment();

    const TradingEngine = await ethers.getContractFactory("TradingEngine");
    engine = await TradingEngine.deploy(
      await orderBook.getAddress(),
      await vault.getAddress()
    );
    await engine.waitForDeployment();

    // Configure permissions
    await vault.setTradingEngine(await engine.getAddress());
    await orderBook.setTradingEngine(await engine.getAddress());
    await vault.addSupportedToken(await wbtc.getAddress());
    await vault.addSupportedToken(await usdc.getAddress());
    await orderBook.addTradingPair(await wbtc.getAddress(), await usdc.getAddress());

    // Mint tokens for test users
    await wbtc.mint(await alice.getAddress(), 10n * 10n ** 8n); // 10 BTC
    await wbtc.mint(await bob.getAddress(), 10n * 10n ** 8n);
    await usdc.mint(await alice.getAddress(), 1_000_000n * 10n ** 6n); // 1M USDC
    await usdc.mint(await bob.getAddress(), 1_000_000n * 10n ** 6n);

    // Create fhevmjs instances for encryption/decryption
    instances = await createInstances(
      await vault.getAddress(),
      ethers.provider,
      signers
    );
  });

  // ═══ VAULT TESTS ═══════════════════════════════════════════════

  describe("Vault — Encrypted Balance Storage", function () {
    it("should accept deposits and encrypt the balance", async function () {
      const depositAmount = 100_000n * 10n ** 6n; // 100,000 USDC

      // Alice approves vault
      await usdc.connect(alice).approve(await vault.getAddress(), depositAmount);

      // Alice deposits — this encrypts the balance on-chain
      const tx = await vault.connect(alice).deposit(await usdc.getAddress(), depositAmount);
      const receipt = await tx.wait();

      // Verify the deposit event was emitted
      const depositEvent = receipt.logs.find(
        (log: any) => log.fragment?.name === "Deposited"
      );
      expect(depositEvent).to.not.be.undefined;

      // Verify tokens transferred to vault
      const vaultBalance = await usdc.balanceOf(await vault.getAddress());
      expect(vaultBalance).to.equal(depositAmount);
    });

    it("should allow user to view their own encrypted balance via reencryption", async function () {
      // ╔═══════════════════════════════════════════════════════╗
      // ║  REENCRYPTION TEST:                                   ║
      // ║  1. Alice generates a keypair in "browser" (here)     ║
      // ║  2. Signs EIP-712 message proving ownership           ║
      // ║  3. Contract reencrypts balance under Alice's key     ║
      // ║  4. Alice decrypts locally — sees 100,000 USDC        ║
      // ╚═══════════════════════════════════════════════════════╝

      const aliceAddress = await alice.getAddress();
      const usdcAddress = await usdc.getAddress();

      // Generate reencryption keypair
      const { publicKey, privateKey } = instances.alice.generateKeypair();
      const eip712 = instances.alice.createEIP712(publicKey, await vault.getAddress());
      const signature = await alice.signTypedData(
        eip712.domain,
        { Reencrypt: eip712.types.Reencrypt },
        eip712.message
      );

      // Request reencrypted balance
      const encryptedBalance = await vault
        .connect(alice)
        .getEncryptedBalance(usdcAddress, publicKey, signature);

      // Decrypt locally
      const decryptedBalance = instances.alice.decrypt(
        await vault.getAddress(),
        encryptedBalance,
        privateKey
      );

      // Should be 100,000 USDC (100000 * 1e6)
      expect(decryptedBalance).to.equal(100_000_000_000n);
    });

    it("should allow multiple deposits and accumulate encrypted balance", async function () {
      const deposit1 = 50_000n * 10n ** 6n;
      const deposit2 = 25_000n * 10n ** 6n;

      await usdc.connect(bob).approve(await vault.getAddress(), deposit1 + deposit2);
      await vault.connect(bob).deposit(await usdc.getAddress(), deposit1);
      await vault.connect(bob).deposit(await usdc.getAddress(), deposit2);

      // Bob views his balance
      const { publicKey, privateKey } = instances.bob.generateKeypair();
      const eip712 = instances.bob.createEIP712(publicKey, await vault.getAddress());
      const signature = await bob.signTypedData(
        eip712.domain,
        { Reencrypt: eip712.types.Reencrypt },
        eip712.message
      );

      const encBal = await vault
        .connect(bob)
        .getEncryptedBalance(await usdc.getAddress(), publicKey, signature);
      const decBal = instances.bob.decrypt(
        await vault.getAddress(),
        encBal,
        privateKey
      );

      // 50k + 25k = 75k USDC
      expect(decBal).to.equal(75_000_000_000n);
    });

    it("should reject deposits of unsupported tokens", async function () {
      const MockToken = await ethers.getContractFactory("MockToken");
      const fakeToken = await MockToken.deploy("Fake", "FAKE", 18);
      await fakeToken.waitForDeployment();
      await fakeToken.mint(await alice.getAddress(), 1000n * 10n ** 18n);
      await fakeToken.connect(alice).approve(await vault.getAddress(), 1000n * 10n ** 18n);

      await expect(
        vault.connect(alice).deposit(await fakeToken.getAddress(), 1000n * 10n ** 18n)
      ).to.be.revertedWithCustomError(vault, "TokenNotSupported");
    });

    it("should reject zero amount deposits", async function () {
      await expect(
        vault.connect(alice).deposit(await usdc.getAddress(), 0)
      ).to.be.revertedWithCustomError(vault, "ZeroAmount");
    });

    it("should NOT allow Bob to view Alice's balance", async function () {
      // Bob tries to call getEncryptedBalance for Alice's balance
      // The contract only returns data for msg.sender, so Bob gets his own balance
      // (or zero if the modifier checks)
      const { publicKey } = instances.bob.generateKeypair();
      const eip712 = instances.bob.createEIP712(publicKey, await vault.getAddress());
      const signature = await bob.signTypedData(
        eip712.domain,
        { Reencrypt: eip712.types.Reencrypt },
        eip712.message
      );

      // This returns BOB's balance (75k), not Alice's (100k)
      // The contract uses msg.sender, not a parameter, for the user address
      const encBal = await vault
        .connect(bob)
        .getEncryptedBalance(await usdc.getAddress(), publicKey, signature);
      const decBal = instances.bob.decrypt(
        await vault.getAddress(),
        encBal,
        instances.bob.keypair.privateKey
      );

      // Bob's balance, NOT Alice's
      expect(decBal).to.equal(75_000_000_000n);
    });
  });

  // ═══ ORDER BOOK TESTS ══════════════════════════════════════════

  describe("OrderBook — Encrypted Order Placement", function () {
    it("should place a buy order with encrypted price and amount", async function () {
      const aliceAddress = await alice.getAddress();
      const wbtcAddress = await wbtc.getAddress();
      const usdcAddress = await usdc.getAddress();

      // ╔═══════════════════════════════════════════════════════╗
      // ║  ENCRYPTION: Alice encrypts price and amount locally  ║
      // ║  before submitting to the contract.                   ║
      // ║                                                       ║
      // ║  Price: 60,000 USDC (60000 * 1e6 = 60_000_000_000)  ║
      // ║  Amount: 1 BTC (1 * 1e8 = 100_000_000)              ║
      // ╚═══════════════════════════════════════════════════════╝

      const input = instances.alice.createEncryptedInput(
        await orderBook.getAddress(),
        aliceAddress
      );
      input.add64(60_000_000_000n); // price: 60k USDC
      input.add64(100_000_000n); // amount: 1 BTC
      const encryptedData = input.encrypt();

      const tx = await orderBook
        .connect(alice)
        .placeOrder(
          wbtcAddress,
          usdcAddress,
          0, // BUY
          1, // LIMIT
          encryptedData.handles[0],
          encryptedData.handles[1],
          encryptedData.inputProof
        );

      const receipt = await tx.wait();
      const event = receipt.logs.find(
        (log: any) => log.fragment?.name === "OrderPlaced"
      );
      expect(event).to.not.be.undefined;

      // Verify order metadata (public, non-encrypted)
      const [trader, baseToken, quoteToken, side, orderType, status, timestamp] =
        await orderBook.getOrderMetadata(0);
      expect(trader).to.equal(aliceAddress);
      expect(side).to.equal(0); // BUY
      expect(status).to.equal(0); // OPEN
    });

    it("should place a sell order with encrypted price and amount", async function () {
      const bobAddress = await bob.getAddress();

      // Bob places a sell order: 1 BTC @ 59,000 USDC
      const input = instances.bob.createEncryptedInput(
        await orderBook.getAddress(),
        bobAddress
      );
      input.add64(59_000_000_000n); // price: 59k USDC
      input.add64(100_000_000n); // amount: 1 BTC
      const encryptedData = input.encrypt();

      await orderBook
        .connect(bob)
        .placeOrder(
          await wbtc.getAddress(),
          await usdc.getAddress(),
          1, // SELL
          1, // LIMIT
          encryptedData.handles[0],
          encryptedData.handles[1],
          encryptedData.inputProof
        );

      const [trader, , , side, , status] = await orderBook.getOrderMetadata(1);
      expect(trader).to.equal(bobAddress);
      expect(side).to.equal(1); // SELL
    });

    it("should allow order owner to view encrypted details", async function () {
      // Alice views her own order (orderId = 0)
      const { publicKey, privateKey } = instances.alice.generateKeypair();
      const eip712 = instances.alice.createEIP712(
        publicKey,
        await orderBook.getAddress()
      );
      const signature = await alice.signTypedData(
        eip712.domain,
        { Reencrypt: eip712.types.Reencrypt },
        eip712.message
      );

      const [encPrice, encAmount, encFilled] = await orderBook
        .connect(alice)
        .getMyOrderDetails(0, publicKey, signature);

      const price = instances.alice.decrypt(
        await orderBook.getAddress(),
        encPrice,
        privateKey
      );
      const amount = instances.alice.decrypt(
        await orderBook.getAddress(),
        encAmount,
        privateKey
      );
      const filled = instances.alice.decrypt(
        await orderBook.getAddress(),
        encFilled,
        privateKey
      );

      expect(price).to.equal(60_000_000_000n);
      expect(amount).to.equal(100_000_000n);
      expect(filled).to.equal(0n);
    });

    it("should prevent non-owner from viewing order details", async function () {
      // Bob tries to view Alice's order
      const { publicKey } = instances.bob.generateKeypair();
      const eip712 = instances.bob.createEIP712(
        publicKey,
        await orderBook.getAddress()
      );
      const signature = await bob.signTypedData(
        eip712.domain,
        { Reencrypt: eip712.types.Reencrypt },
        eip712.message
      );

      await expect(
        orderBook.connect(bob).getMyOrderDetails(0, publicKey, signature)
      ).to.be.revertedWith("Not your order");
    });

    it("should allow owner to cancel their order", async function () {
      // Place a new order to cancel
      const input = instances.alice.createEncryptedInput(
        await orderBook.getAddress(),
        await alice.getAddress()
      );
      input.add64(55_000_000_000n);
      input.add64(50_000_000n);
      const enc = input.encrypt();

      await orderBook
        .connect(alice)
        .placeOrder(
          await wbtc.getAddress(),
          await usdc.getAddress(),
          0, 1,
          enc.handles[0], enc.handles[1], enc.inputProof
        );

      const orderId = (await orderBook.nextOrderId()) - 1n;

      // Cancel it
      await orderBook.connect(alice).cancelOrder(orderId);

      const [, , , , , status] = await orderBook.getOrderMetadata(orderId);
      expect(status).to.equal(3); // CANCELLED
    });

    it("should prevent non-owner from cancelling", async function () {
      await expect(
        orderBook.connect(bob).cancelOrder(0) // Alice's order
      ).to.be.revertedWithCustomError(orderBook, "NotOrderOwner");
    });
  });

  // ═══ TRADING ENGINE TESTS ══════════════════════════════════════

  describe("TradingEngine — Encrypted Order Matching", function () {
    before(async function () {
      // Ensure Alice has USDC deposited and Bob has BTC deposited in vault
      // so the engine can settle the trade
      const aliceUsdcDeposit = 100_000n * 10n ** 6n;
      const bobBtcDeposit = 2n * 10n ** 8n;

      await usdc
        .connect(alice)
        .approve(await vault.getAddress(), aliceUsdcDeposit);
      await vault
        .connect(alice)
        .deposit(await usdc.getAddress(), aliceUsdcDeposit);

      await wbtc.connect(bob).approve(await vault.getAddress(), bobBtcDeposit);
      await vault.connect(bob).deposit(await wbtc.getAddress(), bobBtcDeposit);
    });

    it("should match orders when buy price >= sell price", async function () {
      // ╔═══════════════════════════════════════════════════════╗
      // ║  FHE MATCHING TEST:                                   ║
      // ║  Alice's buy @ 60,000 vs Bob's sell @ 59,000          ║
      // ║                                                       ║
      // ║  Engine calls TFHE.le(59000, 60000) → ebool(true)    ║
      // ║  Decrypts ONLY the boolean → match proceeds           ║
      // ║  Fill at sell price: 59,000 USDC for 1 BTC            ║
      // ║  All arithmetic on encrypted values                   ║
      // ╚═══════════════════════════════════════════════════════╝

      const tx = await engine.matchOrders(0, 1); // buyOrderId=0, sellOrderId=1
      const receipt = await tx.wait();

      // Verify TradeExecuted event
      const tradeEvent = receipt.logs.find(
        (log: any) => log.fragment?.name === "TradeExecuted"
      );
      expect(tradeEvent).to.not.be.undefined;
      expect(await engine.totalMatches()).to.equal(1n);
    });

    it("should update order statuses after match", async function () {
      const [, , , , , buyStatus] = await orderBook.getOrderMetadata(0);
      const [, , , , , sellStatus] = await orderBook.getOrderMetadata(1);

      // Both should be FILLED (1 BTC each, fully matched)
      expect(buyStatus).to.equal(1); // FILLED
      expect(sellStatus).to.equal(1); // FILLED
    });

    it("should update encrypted vault balances correctly", async function () {
      // After the trade:
      //   Alice: had USDC, now also has BTC (+1 BTC), lost USDC (-59,000)
      //   Bob: had BTC, now also has USDC (+59,000), lost BTC (-1 BTC)

      // Check Alice's BTC balance
      const aliceKeys = instances.alice.generateKeypair();
      const aliceEip712 = instances.alice.createEIP712(
        aliceKeys.publicKey,
        await vault.getAddress()
      );
      const aliceSig = await alice.signTypedData(
        aliceEip712.domain,
        { Reencrypt: aliceEip712.types.Reencrypt },
        aliceEip712.message
      );

      const aliceBtcEnc = await vault
        .connect(alice)
        .getEncryptedBalance(await wbtc.getAddress(), aliceKeys.publicKey, aliceSig);
      const aliceBtc = instances.alice.decrypt(
        await vault.getAddress(),
        aliceBtcEnc,
        aliceKeys.privateKey
      );

      // Alice received 1 BTC = 100_000_000 units
      expect(aliceBtc).to.equal(100_000_000n);

      // Check Bob's USDC balance
      const bobKeys = instances.bob.generateKeypair();
      const bobEip712 = instances.bob.createEIP712(
        bobKeys.publicKey,
        await vault.getAddress()
      );
      const bobSig = await bob.signTypedData(
        bobEip712.domain,
        { Reencrypt: bobEip712.types.Reencrypt },
        bobEip712.message
      );

      const bobUsdcEnc = await vault
        .connect(bob)
        .getEncryptedBalance(await usdc.getAddress(), bobKeys.publicKey, bobSig);
      const bobUsdc = instances.bob.decrypt(
        await vault.getAddress(),
        bobUsdcEnc,
        bobKeys.privateKey
      );

      // Bob received 59,000 USDC = 59_000_000_000 units
      expect(bobUsdc).to.equal(59_000_000_000n);
    });

    it("should NOT match when buy price < sell price", async function () {
      // Place orders that don't cross
      // Alice buys at 50,000, Bob sells at 55,000
      const aliceInput = instances.alice.createEncryptedInput(
        await orderBook.getAddress(),
        await alice.getAddress()
      );
      aliceInput.add64(50_000_000_000n);
      aliceInput.add64(50_000_000n);
      const aliceEnc = aliceInput.encrypt();

      await orderBook
        .connect(alice)
        .placeOrder(
          await wbtc.getAddress(),
          await usdc.getAddress(),
          0, 1,
          aliceEnc.handles[0], aliceEnc.handles[1], aliceEnc.inputProof
        );

      const bobInput = instances.bob.createEncryptedInput(
        await orderBook.getAddress(),
        await bob.getAddress()
      );
      bobInput.add64(55_000_000_000n);
      bobInput.add64(50_000_000n);
      const bobEnc = bobInput.encrypt();

      await orderBook
        .connect(bob)
        .placeOrder(
          await wbtc.getAddress(),
          await usdc.getAddress(),
          1, 1,
          bobEnc.handles[0], bobEnc.handles[1], bobEnc.inputProof
        );

      const buyId = (await orderBook.nextOrderId()) - 2n;
      const sellId = (await orderBook.nextOrderId()) - 1n;

      // Try to match — should emit MatchAttempted(false)
      const tx = await engine.matchOrders(buyId, sellId);
      const receipt = await tx.wait();

      const matchEvent = receipt.logs.find(
        (log: any) =>
          log.fragment?.name === "MatchAttempted" &&
          log.args?.success === false
      );
      expect(matchEvent).to.not.be.undefined;

      // Total matches should NOT increase
      expect(await engine.totalMatches()).to.equal(1n);
    });

    it("should handle partial fills correctly", async function () {
      // Alice buys 2 BTC @ 62,000, Bob sells 1 BTC @ 61,000
      // Result: 1 BTC filled, Alice's order partially filled

      const aliceInput = instances.alice.createEncryptedInput(
        await orderBook.getAddress(),
        await alice.getAddress()
      );
      aliceInput.add64(62_000_000_000n);
      aliceInput.add64(200_000_000n); // 2 BTC
      const aliceEnc = aliceInput.encrypt();

      await orderBook
        .connect(alice)
        .placeOrder(
          await wbtc.getAddress(), await usdc.getAddress(),
          0, 1,
          aliceEnc.handles[0], aliceEnc.handles[1], aliceEnc.inputProof
        );

      const bobInput = instances.bob.createEncryptedInput(
        await orderBook.getAddress(),
        await bob.getAddress()
      );
      bobInput.add64(61_000_000_000n);
      bobInput.add64(100_000_000n); // 1 BTC
      const bobEnc = bobInput.encrypt();

      await orderBook
        .connect(bob)
        .placeOrder(
          await wbtc.getAddress(), await usdc.getAddress(),
          1, 1,
          bobEnc.handles[0], bobEnc.handles[1], bobEnc.inputProof
        );

      const buyId = (await orderBook.nextOrderId()) - 2n;
      const sellId = (await orderBook.nextOrderId()) - 1n;

      await engine.matchOrders(buyId, sellId);

      // Buy order should be PARTIALLY_FILLED, sell order FILLED
      const [, , , , , buyStatus] = await orderBook.getOrderMetadata(buyId);
      const [, , , , , sellStatus] = await orderBook.getOrderMetadata(sellId);

      expect(buyStatus).to.equal(2); // PARTIALLY_FILLED
      expect(sellStatus).to.equal(1); // FILLED
    });
  });

  // ═══ BATCH MATCHING TESTS ══════════════════════════════════════

  describe("TradingEngine — Batch Matching", function () {
    it("should batch match multiple order pairs", async function () {
      const prevMatches = await engine.totalMatches();

      // Create two matching pairs
      for (let i = 0; i < 2; i++) {
        const buyInput = instances.alice.createEncryptedInput(
          await orderBook.getAddress(),
          await alice.getAddress()
        );
        buyInput.add64(65_000_000_000n);
        buyInput.add64(10_000_000n); // 0.1 BTC
        const buyEnc = buyInput.encrypt();

        await orderBook
          .connect(alice)
          .placeOrder(
            await wbtc.getAddress(), await usdc.getAddress(),
            0, 1,
            buyEnc.handles[0], buyEnc.handles[1], buyEnc.inputProof
          );

        const sellInput = instances.bob.createEncryptedInput(
          await orderBook.getAddress(),
          await bob.getAddress()
        );
        sellInput.add64(64_000_000_000n);
        sellInput.add64(10_000_000n);
        const sellEnc = sellInput.encrypt();

        await orderBook
          .connect(bob)
          .placeOrder(
            await wbtc.getAddress(), await usdc.getAddress(),
            1, 1,
            sellEnc.handles[0], sellEnc.handles[1], sellEnc.inputProof
          );
      }

      const nextId = await orderBook.nextOrderId();
      const buyIds = [nextId - 4n, nextId - 2n];
      const sellIds = [nextId - 3n, nextId - 1n];

      await engine.batchMatch(buyIds, sellIds);

      const newMatches = await engine.totalMatches();
      expect(newMatches).to.equal(prevMatches + 2n);
    });
  });

  // ═══ ACCESS CONTROL TESTS ══════════════════════════════════════

  describe("Access Control", function () {
    it("should prevent non-admin from adding tokens", async function () {
      await expect(
        vault.connect(alice).addSupportedToken(ethers.ZeroAddress)
      ).to.be.reverted;
    });

    it("should prevent non-admin from setting engine", async function () {
      await expect(
        vault.connect(alice).setTradingEngine(ethers.ZeroAddress)
      ).to.be.reverted;
    });

    it("should prevent non-engine from modifying balances", async function () {
      const fakeAmount = instances.alice.createEncryptedInput(
        await vault.getAddress(),
        await alice.getAddress()
      );
      fakeAmount.add64(999_999n);
      const enc = fakeAmount.encrypt();

      // Alice cannot call addEncryptedBalance directly
      await expect(
        vault
          .connect(alice)
          .addEncryptedBalance(
            await alice.getAddress(),
            await usdc.getAddress(),
            enc.handles[0]
          )
      ).to.be.reverted;
    });
  });

  // ═══ EDGE CASE TESTS ══════════════════════════════════════════

  describe("Edge Cases", function () {
    it("should handle very large order amounts near euint64 max", async function () {
      // euint64 max = 2^64 - 1 = 18,446,744,073,709,551,615
      const largeAmount = 18_000_000_000_000_000_000n; // Near max

      const input = instances.alice.createEncryptedInput(
        await orderBook.getAddress(),
        await alice.getAddress()
      );
      input.add64(1_000_000n); // Small price
      input.add64(largeAmount);
      const enc = input.encrypt();

      // Should not revert — euint64 handles this
      await orderBook
        .connect(alice)
        .placeOrder(
          await wbtc.getAddress(), await usdc.getAddress(),
          0, 1,
          enc.handles[0], enc.handles[1], enc.inputProof
        );
    });

    it("should reject matching orders from the same side", async function () {
      const nextId = await orderBook.nextOrderId();

      // Place two buy orders
      for (let i = 0; i < 2; i++) {
        const input = instances.alice.createEncryptedInput(
          await orderBook.getAddress(),
          await alice.getAddress()
        );
        input.add64(60_000_000_000n);
        input.add64(10_000_000n);
        const enc = input.encrypt();
        await orderBook
          .connect(alice)
          .placeOrder(
            await wbtc.getAddress(), await usdc.getAddress(),
            0, 1,
            enc.handles[0], enc.handles[1], enc.inputProof
          );
      }

      await expect(
        engine.matchOrders(nextId, nextId + 1n)
      ).to.be.revertedWithCustomError(engine, "SameSide");
    });
  });
});
