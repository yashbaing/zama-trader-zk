"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Contract, BrowserProvider } from "ethers";
import { useWalletStore, useMarketStore, useVaultStore, useTradingStore } from "@/store";
import {
  initFheClient,
  encryptValue,
  encryptValues,
  generateReencryptionKeypair,
  decryptReencrypted,
} from "@/lib/fheClient";
import { CONTRACTS, TOKENS, VAULT_ABI, ORDER_BOOK_ABI, ERC20_ABI } from "@/lib/contracts";
import { toTokenUnits, fromTokenUnits } from "@/lib/utils";
import type { PriceData, OrderSide, OrderType, VaultBalance } from "@/types";

// ─── useFheEncrypt ───────────────────────────────────────────────
// Hook for encrypting values before contract submission.
// Returns a function that takes plaintext values and returns
// encrypted handles + proof ready for contract calls.

export function useFheEncrypt() {
  const { address, provider, fheReady } = useWalletStore();
  const [encrypting, setEncrypting] = useState(false);

  const encrypt = useCallback(
    async (
      values: (number | bigint)[],
      contractAddress: string
    ) => {
      if (!address || !fheReady) {
        throw new Error("FHE not initialized — connect wallet first");
      }

      setEncrypting(true);
      try {
        const result = await encryptValues(values, contractAddress, address);
        return result;
      } finally {
        setEncrypting(false);
      }
    },
    [address, fheReady]
  );

  return { encrypt, encrypting, fheReady };
}

// ─── useFheDecrypt ───────────────────────────────────────────────
// Hook for requesting reencrypted data from contracts and
// decrypting it locally.

export function useFheDecrypt() {
  const { provider, address } = useWalletStore();
  const [decrypting, setDecrypting] = useState(false);

  const decrypt = useCallback(
    async (contractAddress: string, encryptedData: string) => {
      if (!provider || !address) {
        throw new Error("Wallet not connected");
      }

      setDecrypting(true);
      try {
        const result = await decryptReencrypted(contractAddress, encryptedData);
        return result;
      } finally {
        setDecrypting(false);
      }
    },
    [provider, address]
  );

  const requestReencryption = useCallback(
    async (contractAddress: string) => {
      if (!provider) throw new Error("No provider");
      return generateReencryptionKeypair(contractAddress, provider);
    },
    [provider]
  );

  return { decrypt, requestReencryption, decrypting };
}

// ─── useVaultBalance ─────────────────────────────────────────────
// Hook that fetches and decrypts a single token's vault balance.
// Uses reencryption to view the encrypted balance client-side.

export function useVaultBalance(tokenKey: string) {
  const { provider, address, fheReady } = useWalletStore();
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!provider || !address || !fheReady) return;

    const token = TOKENS[tokenKey];
    if (!token) return;

    setLoading(true);
    setError(null);
    try {
      const signer = await provider.getSigner();
      const vaultContract = new Contract(CONTRACTS.vault, VAULT_ABI, signer);

      // Step 1: Generate reencryption keypair
      const { publicKey, signature } = await generateReencryptionKeypair(
        CONTRACTS.vault,
        provider
      );

      // Step 2: Request reencrypted balance from contract
      const encBalance = await vaultContract.getEncryptedBalance(
        token.address,
        publicKey,
        signature
      );

      // Step 3: Decrypt locally
      const decrypted = await decryptReencrypted(CONTRACTS.vault, encBalance);
      setBalance(fromTokenUnits(decrypted, token.decimals));
    } catch (err: any) {
      setError(err.message || "Failed to fetch balance");
      setBalance(0);
    } finally {
      setLoading(false);
    }
  }, [provider, address, fheReady, tokenKey]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return { balance, loading, error, refresh: fetchBalance };
}

// ─── useTokenBalance ─────────────────────────────────────────────
// Hook for reading plaintext ERC20 wallet balance (not vault).

export function useTokenBalance(tokenKey: string) {
  const { provider, address } = useWalletStore();
  const [balance, setBalance] = useState<number>(0);

  const fetchBalance = useCallback(async () => {
    if (!provider || !address) return;

    const token = TOKENS[tokenKey];
    if (!token?.address) return;

    try {
      const tokenContract = new Contract(token.address, ERC20_ABI, provider);
      const rawBalance = await tokenContract.balanceOf(address);
      setBalance(fromTokenUnits(rawBalance, token.decimals));
    } catch {
      setBalance(0);
    }
  }, [provider, address, tokenKey]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return { balance, refresh: fetchBalance };
}

// ─── usePlaceOrder ───────────────────────────────────────────────
// Hook that handles the full order placement flow:
// encrypt → submit → wait for confirmation.

export function usePlaceOrder() {
  const { placeOrder, isPlacingOrder } = useTradingStore();
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submitOrder = useCallback(
    async (params: {
      baseToken: string;
      quoteToken: string;
      side: OrderSide;
      orderType: OrderType;
      price: number;
      amount: number;
    }) => {
      setError(null);
      setTxHash(null);
      try {
        const hash = await placeOrder(params);
        setTxHash(hash);
        return hash;
      } catch (err: any) {
        const msg = err.message || "Order failed";
        setError(msg);
        throw err;
      }
    },
    [placeOrder]
  );

  return {
    submitOrder,
    isPlacing: isPlacingOrder,
    txHash,
    error,
    clearError: () => setError(null),
  };
}

// ─── useWebSocket ────────────────────────────────────────────────
// Hook for connecting to the backend WebSocket for real-time
// price updates and trade notifications.

export function useWebSocket(channels: string[] = ["prices"]) {
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    const wsUrl =
      process.env.NEXT_PUBLIC_WS_URL ||
      `ws://localhost:3001/ws`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        // Subscribe to requested channels
        channels.forEach((ch) => {
          ws.send(JSON.stringify({ type: "subscribe", channel: ch }));
        });
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);

          // Auto-update market store on price updates
          if (data.type === "price_update" && data.data) {
            useMarketStore.getState().fetchPrices();
          }
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = () => {
        setConnected(false);
        // Auto-reconnect after 5 seconds
        reconnectTimer.current = setTimeout(connect, 5000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      // WebSocket not available (SSR, etc.)
    }
  }, [channels]);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [connect]);

  return { connected, lastMessage };
}

// ─── usePricePolling ─────────────────────────────────────────────
// Fallback price polling when WebSocket is unavailable.

export function usePricePolling(intervalMs = 30000) {
  const { fetchPrices, prices } = useMarketStore();

  useEffect(() => {
    fetchPrices();
    const timer = setInterval(fetchPrices, intervalMs);
    return () => clearInterval(timer);
  }, [fetchPrices, intervalMs]);

  return prices;
}

// ─── useContractEvent ────────────────────────────────────────────
// Hook for listening to specific contract events on-chain.
// Useful for tracking order fills, deposits, etc.

export function useContractEvent(
  contractAddress: string,
  abi: string[],
  eventName: string,
  callback: (...args: any[]) => void
) {
  const { provider } = useWalletStore();

  useEffect(() => {
    if (!provider || !contractAddress) return;

    const contract = new Contract(contractAddress, abi, provider);

    contract.on(eventName, callback);

    return () => {
      contract.off(eventName, callback);
    };
  }, [provider, contractAddress, abi, eventName, callback]);
}

// ─── useFaucet ───────────────────────────────────────────────────
// Hook for minting testnet tokens via the faucet function.

export function useFaucet() {
  const { provider } = useWalletStore();
  const [minting, setMinting] = useState(false);

  const mint = useCallback(
    async (tokenKey: string) => {
      if (!provider) throw new Error("Wallet not connected");

      const token = TOKENS[tokenKey];
      if (!token?.address) throw new Error("Unknown token");

      setMinting(true);
      try {
        const signer = await provider.getSigner();
        const tokenContract = new Contract(token.address, ERC20_ABI, signer);
        const tx = await tokenContract.faucet();
        await tx.wait();
      } finally {
        setMinting(false);
      }
    },
    [provider]
  );

  return { mint, minting };
}
