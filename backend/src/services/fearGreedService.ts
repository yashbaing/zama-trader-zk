/**
 * Fear & Greed Index Service
 *
 * Fetches the Crypto Fear & Greed Index from alternative.me
 * and maps it to the smart contract's MarketSentiment enum.
 *
 * Used by:
 *   - AutoInvestVault.sol — triggers different allocation strategies
 *   - Frontend — displays current market sentiment
 *   - Keeper — calls updateSentiment() when index changes bracket
 *
 * Index Ranges:
 *   0-20:  Extreme Fear  → Historically best time to buy
 *   21-40: Fear          → Undervalued territory
 *   41-60: Neutral       → Normal market conditions
 *   61-80: Greed         → Overheated territory
 *   81-100: Extreme Greed → Historically best time to sell
 */

import { Contract, Wallet, JsonRpcProvider } from "ethers";
import { config } from "../../config/index.js";

// Smart contract enum values
export enum MarketSentiment {
  EXTREME_FEAR = 0,
  FEAR = 1,
  NEUTRAL = 2,
  GREED = 3,
  EXTREME_GREED = 4,
}

export interface FearGreedData {
  value: number; // 0-100
  label: string; // "Extreme Fear", "Fear", etc.
  sentiment: MarketSentiment;
  timestamp: number;
  nextUpdate: number; // seconds until next update
}

const AUTO_INVEST_ABI = [
  "function updateSentiment(uint8 sentiment) external",
  "function currentSentiment() external view returns (uint8)",
  "function lastSentimentUpdate() external view returns (uint256)",
];

// Cache
let cachedData: FearGreedData | null = null;
let lastFetch = 0;
const CACHE_TTL = 300_000; // 5 minutes

/**
 * Fetch the current Fear & Greed Index from alternative.me API.
 */
export async function fetchFearGreedIndex(): Promise<FearGreedData> {
  const now = Date.now();
  if (cachedData && now - lastFetch < CACHE_TTL) {
    return cachedData;
  }

  try {
    const response = await fetch(
      "https://api.alternative.me/fng/?limit=1&format=json"
    );
    const json = await response.json();

    if (!json.data || json.data.length === 0) {
      throw new Error("No data returned from Fear & Greed API");
    }

    const raw = json.data[0];
    const value = parseInt(raw.value, 10);

    const data: FearGreedData = {
      value,
      label: raw.value_classification,
      sentiment: valueToSentiment(value),
      timestamp: parseInt(raw.timestamp, 10) * 1000,
      nextUpdate: parseInt(raw.time_until_update || "0", 10),
    };

    cachedData = data;
    lastFetch = now;
    return data;
  } catch (error) {
    console.error("[FearGreed] Fetch error:", error);

    // Return cached data if available, otherwise default
    if (cachedData) return cachedData;

    return {
      value: 50,
      label: "Neutral",
      sentiment: MarketSentiment.NEUTRAL,
      timestamp: Date.now(),
      nextUpdate: 0,
    };
  }
}

/**
 * Map a 0-100 index value to the MarketSentiment enum.
 */
function valueToSentiment(value: number): MarketSentiment {
  if (value <= 20) return MarketSentiment.EXTREME_FEAR;
  if (value <= 40) return MarketSentiment.FEAR;
  if (value <= 60) return MarketSentiment.NEUTRAL;
  if (value <= 80) return MarketSentiment.GREED;
  return MarketSentiment.EXTREME_GREED;
}

/**
 * Sentiment Oracle Keeper
 *
 * Periodically checks the Fear & Greed Index and updates the
 * AutoInvestVault contract when the sentiment bracket changes.
 *
 * Only calls updateSentiment() when the bracket actually changes
 * to save gas.
 */
export class SentimentOracle {
  private provider: JsonRpcProvider;
  private wallet: Wallet;
  private contract: Contract;
  private lastSentiment: MarketSentiment | null = null;
  private timer: NodeJS.Timeout | null = null;
  private checkInterval: number;

  constructor(checkIntervalMs = 600_000 /* 10 minutes */) {
    this.checkInterval = checkIntervalMs;
    this.provider = new JsonRpcProvider(config.rpcUrl);
    this.wallet = new Wallet(config.relayerKey, this.provider);
    this.contract = new Contract(
      config.contracts.autoInvestVault,
      AUTO_INVEST_ABI,
      this.wallet
    );
  }

  async start(): Promise<void> {
    console.log("[SentimentOracle] Starting...");

    // Fetch current on-chain sentiment
    try {
      const currentOnChain = await this.contract.currentSentiment();
      this.lastSentiment = Number(currentOnChain) as MarketSentiment;
      console.log(
        `[SentimentOracle] Current on-chain sentiment: ${MarketSentiment[this.lastSentiment]}`
      );
    } catch {
      this.lastSentiment = null;
    }

    // Run first check
    await this.checkAndUpdate();

    // Schedule periodic checks
    this.timer = setInterval(
      () => this.checkAndUpdate(),
      this.checkInterval
    );
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    console.log("[SentimentOracle] Stopped");
  }

  private async checkAndUpdate(): Promise<void> {
    try {
      const data = await fetchFearGreedIndex();
      console.log(
        `[SentimentOracle] Fear & Greed: ${data.value} (${data.label})`
      );

      // Only update if the bracket changed
      if (data.sentiment !== this.lastSentiment) {
        console.log(
          `[SentimentOracle] Sentiment changed: ${
            this.lastSentiment !== null
              ? MarketSentiment[this.lastSentiment]
              : "UNKNOWN"
          } → ${MarketSentiment[data.sentiment]}`
        );

        const tx = await this.contract.updateSentiment(data.sentiment);
        await tx.wait();

        this.lastSentiment = data.sentiment;
        console.log(
          `[SentimentOracle] Updated on-chain sentiment to ${MarketSentiment[data.sentiment]}`
        );
      }
    } catch (error: any) {
      console.error("[SentimentOracle] Update failed:", error.message);
    }
  }
}

/**
 * Get historical Fear & Greed data for charting.
 */
export async function fetchFearGreedHistory(
  days = 30
): Promise<Array<{ value: number; timestamp: number; label: string }>> {
  try {
    const response = await fetch(
      `https://api.alternative.me/fng/?limit=${days}&format=json`
    );
    const json = await response.json();

    return (json.data || []).map((d: any) => ({
      value: parseInt(d.value, 10),
      timestamp: parseInt(d.timestamp, 10) * 1000,
      label: d.value_classification,
    }));
  } catch {
    return [];
  }
}
