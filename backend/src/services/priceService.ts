import { TOKEN_META, config } from "../../config/index.js";

export interface PriceData {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  high24h: number;
  low24h: number;
  lastUpdated: string;
}

interface CoinGeckoPrice {
  [id: string]: {
    usd: number;
    usd_24h_change: number;
    usd_24h_vol: number;
    usd_market_cap: number;
    usd_high_24h?: number;
    usd_low_24h?: number;
  };
}

// In-memory cache for price data (public info — no privacy concern)
let priceCache: Map<string, PriceData> = new Map();
let lastFetch = 0;
const CACHE_TTL = 30_000; // 30 seconds

/**
 * Fetch current prices from CoinGecko.
 * This is PUBLIC market data — not user-specific.
 * User portfolio values are computed CLIENT-SIDE after decrypting their balances.
 */
export async function fetchPrices(): Promise<PriceData[]> {
  const now = Date.now();
  if (now - lastFetch < CACHE_TTL && priceCache.size > 0) {
    return Array.from(priceCache.values());
  }

  try {
    const ids = Object.values(TOKEN_META)
      .map((t) => t.coingeckoId)
      .join(",");
    const url = `${config.priceApiUrl}/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`;

    const response = await fetch(url);
    const data: CoinGeckoPrice = await response.json();

    const prices: PriceData[] = [];
    for (const [key, meta] of Object.entries(TOKEN_META)) {
      const coinData = data[meta.coingeckoId];
      if (coinData) {
        const priceData: PriceData = {
          symbol: key,
          price: coinData.usd,
          change24h: coinData.usd_24h_change || 0,
          volume24h: coinData.usd_24h_vol || 0,
          marketCap: coinData.usd_market_cap || 0,
          high24h: coinData.usd_high_24h || coinData.usd,
          low24h: coinData.usd_low_24h || coinData.usd,
          lastUpdated: new Date().toISOString(),
        };
        prices.push(priceData);
        priceCache.set(key, priceData);
      }
    }

    lastFetch = now;
    return prices;
  } catch (error) {
    console.error("Price fetch error:", error);
    return Array.from(priceCache.values()); // Return stale cache on error
  }
}

export async function getPrice(symbol: string): Promise<PriceData | null> {
  await fetchPrices();
  return priceCache.get(symbol) || null;
}
