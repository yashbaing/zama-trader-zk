const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

async function fetchApi<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export const api = {
  getPrices: () => fetchApi<{ prices: any[] }>("/prices").then((r) => r.prices),
  getPrice: (symbol: string) => fetchApi<any>(`/prices/${symbol}`),
  getOrders: (params?: Record<string, string>) => {
    const query = params ? "?" + new URLSearchParams(params).toString() : "";
    return fetchApi<{ orders: any[] }>(`/orders${query}`).then((r) => r.orders);
  },
  getTrades: (limit = 50) => fetchApi<{ trades: any[] }>(`/trades?limit=${limit}`).then((r) => r.trades),
  getStats: () => fetchApi<any>("/stats"),
  getContracts: () => fetchApi<any>("/contracts"),
  getTokens: () => fetchApi<{ tokens: any[] }>("/tokens").then((r) => r.tokens),
};
