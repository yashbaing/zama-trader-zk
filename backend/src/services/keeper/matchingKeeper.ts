/**
 * Order Matching Keeper (Relayer Bot)
 *
 * This service runs off-chain and continuously attempts to match
 * compatible orders by calling TradingEngine.matchOrders().
 *
 * IMPORTANT SECURITY NOTES:
 * ─────────────────────────
 * • The keeper CANNOT see order prices or amounts (they're encrypted)
 * • It uses a naive strategy: try every buy/sell pair combination
 * • The TradingEngine's FHE comparison determines if orders actually match
 * • Failed matches are cheap (just gas for the encrypted comparison)
 * • A smarter keeper could use order timestamps/metadata for heuristics
 *
 * MATCHING STRATEGIES:
 * ─────────────────────
 * 1. Naive: Try all buy × sell pairs (O(n²) — works for low volume)
 * 2. Time-priority: Match oldest orders first (FIFO)
 * 3. Batch: Collect pairs and submit via batchMatch() for gas efficiency
 *
 * The keeper earns no MEV because it cannot see order details.
 * It's essentially a public good that keeps the order book flowing.
 */

import { ethers, Contract, Wallet, JsonRpcProvider } from "ethers";
import { config } from "../../../config/index.js";

// Minimal ABIs for keeper operations
const ORDER_BOOK_ABI = [
  "function getBuyOrders(address baseToken, address quoteToken) external view returns (uint256[] memory)",
  "function getSellOrders(address baseToken, address quoteToken) external view returns (uint256[] memory)",
  "function getOrderMetadata(uint256 orderId) external view returns (address trader, address baseToken, address quoteToken, uint8 side, uint8 orderType, uint8 status, uint256 timestamp)",
  "function nextOrderId() external view returns (uint256)",
];

const TRADING_ENGINE_ABI = [
  "function matchOrders(uint256 buyOrderId, uint256 sellOrderId) external",
  "function batchMatch(uint256[] calldata buyOrderIds, uint256[] calldata sellOrderIds) external",
  "event TradeExecuted(uint256 indexed matchId, uint256 indexed buyOrderId, uint256 indexed sellOrderId, address baseToken, address quoteToken, uint256 timestamp)",
  "event MatchAttempted(uint256 buyOrderId, uint256 sellOrderId, bool success)",
];

// Order status enum matching the contract
const OrderStatus = {
  OPEN: 0,
  FILLED: 1,
  PARTIALLY_FILLED: 2,
  CANCELLED: 3,
};

interface TradingPair {
  baseToken: string;
  quoteToken: string;
  label: string;
}

interface KeeperConfig {
  /** How often to scan for matchable orders (ms) */
  scanInterval: number;
  /** Maximum order pairs to try per scan cycle */
  maxPairsPerCycle: number;
  /** Use batchMatch for gas efficiency */
  useBatchMatching: boolean;
  /** Maximum batch size */
  batchSize: number;
  /** Gas limit per match attempt */
  gasLimit: bigint;
}

const DEFAULT_CONFIG: KeeperConfig = {
  scanInterval: 15_000, // 15 seconds
  maxPairsPerCycle: 50,
  useBatchMatching: true,
  batchSize: 10,
  gasLimit: 5_000_000n,
};

export class OrderMatchingKeeper {
  private provider: JsonRpcProvider;
  private wallet: Wallet;
  private orderBook: Contract;
  private engine: Contract;
  private tradingPairs: TradingPair[];
  private config: KeeperConfig;
  private running = false;
  private scanTimer: NodeJS.Timeout | null = null;

  // Stats
  private stats = {
    totalScans: 0,
    totalAttempts: 0,
    successfulMatches: 0,
    failedMatches: 0,
    lastScanTime: 0,
    startedAt: Date.now(),
  };

  constructor(
    tradingPairs: TradingPair[],
    keeperConfig: Partial<KeeperConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...keeperConfig };
    this.tradingPairs = tradingPairs;

    // Initialize provider and wallet
    this.provider = new JsonRpcProvider(config.rpcUrl);
    this.wallet = new Wallet(config.relayerKey, this.provider);

    // Initialize contract instances
    this.orderBook = new Contract(
      config.contracts.orderBook,
      ORDER_BOOK_ABI,
      this.wallet
    );
    this.engine = new Contract(
      config.contracts.tradingEngine,
      TRADING_ENGINE_ABI,
      this.wallet
    );
  }

  /**
   * Start the keeper bot.
   * Begins periodic scanning for matchable order pairs.
   */
  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    console.log(`
  ╔═══════════════════════════════════════════╗
  ║   Order Matching Keeper Started           ║
  ║   Scan interval: ${this.config.scanInterval / 1000}s                   ║
  ║   Trading pairs: ${this.tradingPairs.length}                        ║
  ║   Batch mode: ${this.config.useBatchMatching ? "ON " : "OFF"}                       ║
  ╚═══════════════════════════════════════════╝
    `);

    // Run first scan immediately
    await this.scanAndMatch();

    // Schedule periodic scans
    this.scanTimer = setInterval(
      () => this.scanAndMatch(),
      this.config.scanInterval
    );
  }

  /**
   * Stop the keeper bot.
   */
  stop(): void {
    this.running = false;
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    }
    console.log("[Keeper] Stopped. Stats:", this.stats);
  }

  /**
   * Core matching loop:
   *   1. For each trading pair, fetch open buy and sell orders
   *   2. Filter to OPEN or PARTIALLY_FILLED orders
   *   3. Generate candidate match pairs (oldest first)
   *   4. Submit matches via batchMatch or individual calls
   *   5. Track results
   */
  private async scanAndMatch(): Promise<void> {
    const scanStart = Date.now();
    this.stats.totalScans++;

    let totalCandidates = 0;
    let totalMatched = 0;

    for (const pair of this.tradingPairs) {
      try {
        // Step 1: Fetch order IDs for this pair
        const buyOrderIds: bigint[] = await this.orderBook.getBuyOrders(
          pair.baseToken,
          pair.quoteToken
        );
        const sellOrderIds: bigint[] = await this.orderBook.getSellOrders(
          pair.baseToken,
          pair.quoteToken
        );

        if (buyOrderIds.length === 0 || sellOrderIds.length === 0) continue;

        // Step 2: Filter to matchable orders (OPEN or PARTIALLY_FILLED)
        const activeBuys = await this.filterActiveOrders(buyOrderIds);
        const activeSells = await this.filterActiveOrders(sellOrderIds);

        if (activeBuys.length === 0 || activeSells.length === 0) continue;

        // Step 3: Generate candidate pairs (time-priority: oldest first)
        // Sort by timestamp ascending (oldest first gets matched first)
        activeBuys.sort((a, b) => a.timestamp - b.timestamp);
        activeSells.sort((a, b) => a.timestamp - b.timestamp);

        const candidates: Array<{ buyId: bigint; sellId: bigint }> = [];
        for (const buy of activeBuys) {
          for (const sell of activeSells) {
            candidates.push({ buyId: buy.id, sellId: sell.id });
            if (candidates.length >= this.config.maxPairsPerCycle) break;
          }
          if (candidates.length >= this.config.maxPairsPerCycle) break;
        }

        totalCandidates += candidates.length;

        // Step 4: Submit matches
        if (this.config.useBatchMatching && candidates.length > 1) {
          totalMatched += await this.submitBatchMatches(candidates);
        } else {
          totalMatched += await this.submitIndividualMatches(candidates);
        }
      } catch (error: any) {
        console.error(
          `[Keeper] Error scanning ${pair.label}:`,
          error.message
        );
      }
    }

    this.stats.lastScanTime = Date.now() - scanStart;

    if (totalCandidates > 0) {
      console.log(
        `[Keeper] Scan #${this.stats.totalScans}: ${totalCandidates} candidates, ${totalMatched} matched (${this.stats.lastScanTime}ms)`
      );
    }
  }

  /**
   * Filter order IDs to only those that are OPEN or PARTIALLY_FILLED.
   */
  private async filterActiveOrders(
    orderIds: bigint[]
  ): Promise<Array<{ id: bigint; timestamp: number }>> {
    const active: Array<{ id: bigint; timestamp: number }> = [];

    for (const id of orderIds) {
      try {
        const [, , , , , status, timestamp] =
          await this.orderBook.getOrderMetadata(id);

        if (
          status === OrderStatus.OPEN ||
          status === OrderStatus.PARTIALLY_FILLED
        ) {
          active.push({ id, timestamp: Number(timestamp) });
        }
      } catch {
        // Skip orders that can't be read
      }
    }

    return active;
  }

  /**
   * Submit match attempts in a batch for gas efficiency.
   * The contract's batchMatch uses try/catch internally,
   * so failed individual matches don't revert the batch.
   */
  private async submitBatchMatches(
    candidates: Array<{ buyId: bigint; sellId: bigint }>
  ): Promise<number> {
    let matched = 0;

    // Split into batches
    for (let i = 0; i < candidates.length; i += this.config.batchSize) {
      const batch = candidates.slice(i, i + this.config.batchSize);
      const buyIds = batch.map((c) => c.buyId);
      const sellIds = batch.map((c) => c.sellId);

      try {
        this.stats.totalAttempts += batch.length;

        const tx = await this.engine.batchMatch(buyIds, sellIds, {
          gasLimit: this.config.gasLimit,
        });
        const receipt = await tx.wait();

        // Count successful matches from events
        const matchEvents = receipt.logs.filter(
          (log: any) =>
            log.fragment?.name === "MatchAttempted" &&
            log.args?.success === true
        );

        matched += matchEvents.length;
        this.stats.successfulMatches += matchEvents.length;
        this.stats.failedMatches += batch.length - matchEvents.length;
      } catch (error: any) {
        console.error("[Keeper] Batch match failed:", error.message);
        this.stats.failedMatches += batch.length;
      }
    }

    return matched;
  }

  /**
   * Submit match attempts one at a time.
   * Slower but simpler — used when batch mode is off
   * or when there's only one candidate.
   */
  private async submitIndividualMatches(
    candidates: Array<{ buyId: bigint; sellId: bigint }>
  ): Promise<number> {
    let matched = 0;

    for (const { buyId, sellId } of candidates) {
      try {
        this.stats.totalAttempts++;

        const tx = await this.engine.matchOrders(buyId, sellId, {
          gasLimit: this.config.gasLimit,
        });
        const receipt = await tx.wait();

        // Check if the match was successful
        const successEvent = receipt.logs.find(
          (log: any) =>
            log.fragment?.name === "TradeExecuted"
        );

        if (successEvent) {
          matched++;
          this.stats.successfulMatches++;
          console.log(
            `[Keeper] ✓ Matched: buy #${buyId} × sell #${sellId}`
          );
        } else {
          this.stats.failedMatches++;
        }
      } catch (error: any) {
        this.stats.failedMatches++;
        // Expected — prices might not cross. Not an error.
      }
    }

    return matched;
  }

  /**
   * Get keeper statistics.
   */
  getStats() {
    return {
      ...this.stats,
      uptime: Date.now() - this.stats.startedAt,
      matchRate:
        this.stats.totalAttempts > 0
          ? (this.stats.successfulMatches / this.stats.totalAttempts) * 100
          : 0,
    };
  }
}
