import { create } from "zustand";
import { BrowserProvider, Contract } from "ethers";
import type { PriceData, Order, Trade, OrderSide, OrderType, VaultBalance } from "@/types";
import { initFheClient, encryptValues, generateReencryptionKeypair, decryptReencrypted, resetFheClient } from "@/lib/fheClient";
import { CONTRACTS, TOKENS, VAULT_ABI, ORDER_BOOK_ABI, ERC20_ABI, CHAIN_CONFIG } from "@/lib/contracts";
import { toTokenUnits } from "@/lib/utils";
import { api } from "@/lib/api";

// ─── Wallet Store ────────────────────────────────────────────────

interface WalletStore {
  address: string | null;
  chainId: number | null;
  isConnected: boolean;
  isConnecting: boolean;
  provider: BrowserProvider | null;
  fheReady: boolean;

  connect: () => Promise<void>;
  disconnect: () => void;
  switchChain: () => Promise<void>;
}

export const useWalletStore = create<WalletStore>((set, get) => ({
  address: null,
  chainId: null,
  isConnected: false,
  isConnecting: false,
  provider: null,
  fheReady: false,

  connect: async () => {
    if (typeof window === "undefined" || !(window as any).ethereum) {
      throw new Error("MetaMask not found");
    }

    set({ isConnecting: true });
    try {
      const ethereum = (window as any).ethereum;
      const accounts = await ethereum.request({ method: "eth_requestAccounts" });
      const provider = new BrowserProvider(ethereum);
      const network = await provider.getNetwork();

      set({
        address: accounts[0],
        chainId: Number(network.chainId),
        isConnected: true,
        provider,
      });

      // Initialize FHE client
      try {
        await initFheClient(provider);
        set({ fheReady: true });
      } catch (e) {
        console.warn("[FHE] Not available on this network — using demo mode");
      }

      // Listen for account/chain changes
      ethereum.on("accountsChanged", (accs: string[]) => {
        if (accs.length === 0) get().disconnect();
        else set({ address: accs[0] });
      });
      ethereum.on("chainChanged", () => window.location.reload());
    } finally {
      set({ isConnecting: false });
    }
  },

  disconnect: () => {
    resetFheClient();
    set({
      address: null,
      chainId: null,
      isConnected: false,
      provider: null,
      fheReady: false,
    });
  },

  switchChain: async () => {
    const ethereum = (window as any).ethereum;
    if (!ethereum) return;
    try {
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${CHAIN_CONFIG.chainId.toString(16)}` }],
      });
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        await ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: `0x${CHAIN_CONFIG.chainId.toString(16)}`,
            chainName: CHAIN_CONFIG.chainName,
            rpcUrls: [CHAIN_CONFIG.rpcUrl],
            nativeCurrency: CHAIN_CONFIG.nativeCurrency,
          }],
        });
      }
    }
  },
}));

// ─── Market Data Store ───────────────────────────────────────────

interface MarketStore {
  prices: PriceData[];
  loading: boolean;
  selectedPair: { base: string; quote: string };

  fetchPrices: () => Promise<void>;
  setSelectedPair: (base: string, quote: string) => void;
}

export const useMarketStore = create<MarketStore>((set) => ({
  prices: [],
  loading: false,
  selectedPair: { base: "BTC", quote: "USDC" },

  fetchPrices: async () => {
    set({ loading: true });
    try {
      const prices = await api.getPrices();
      set({ prices });
    } catch (e) {
      console.error("Failed to fetch prices:", e);
      // Fallback demo data
      set({
        prices: [
          { symbol: "BTC", price: 67432.18, change24h: 2.34, volume24h: 28_500_000_000, marketCap: 1_320_000_000_000, high24h: 68100, low24h: 65800, lastUpdated: new Date().toISOString() },
          { symbol: "ETH", price: 3521.42, change24h: -0.87, volume24h: 15_200_000_000, marketCap: 423_000_000_000, high24h: 3600, low24h: 3480, lastUpdated: new Date().toISOString() },
          { symbol: "SOL", price: 142.67, change24h: 5.12, volume24h: 3_800_000_000, marketCap: 63_000_000_000, high24h: 148, low24h: 135, lastUpdated: new Date().toISOString() },
          { symbol: "USDC", price: 1.0, change24h: 0.01, volume24h: 8_000_000_000, marketCap: 32_000_000_000, high24h: 1.001, low24h: 0.999, lastUpdated: new Date().toISOString() },
        ],
      });
    } finally {
      set({ loading: false });
    }
  },

  setSelectedPair: (base, quote) => set({ selectedPair: { base, quote } }),
}));

// ─── Trading Store ───────────────────────────────────────────────

interface TradingStore {
  orders: Order[];
  trades: Trade[];
  isPlacingOrder: boolean;

  fetchOrders: (trader?: string) => Promise<void>;
  fetchTrades: () => Promise<void>;
  placeOrder: (params: {
    baseToken: string;
    quoteToken: string;
    side: OrderSide;
    orderType: OrderType;
    price: number;
    amount: number;
  }) => Promise<string>;
  cancelOrder: (orderId: number) => Promise<void>;
}

export const useTradingStore = create<TradingStore>((set, get) => ({
  orders: [],
  trades: [],
  isPlacingOrder: false,

  fetchOrders: async (trader) => {
    try {
      const params = trader ? { trader } : undefined;
      const orders = await api.getOrders(params);
      set({ orders });
    } catch (e) {
      console.error("Failed to fetch orders:", e);
    }
  },

  fetchTrades: async () => {
    try {
      const trades = await api.getTrades();
      set({ trades });
    } catch (e) {
      console.error("Failed to fetch trades:", e);
    }
  },

  placeOrder: async ({ baseToken, quoteToken, side, orderType, price, amount }) => {
    const wallet = useWalletStore.getState();
    if (!wallet.provider || !wallet.address) throw new Error("Wallet not connected");

    set({ isPlacingOrder: true });
    try {
      const signer = await wallet.provider.getSigner();
      const orderBookContract = new Contract(CONTRACTS.orderBook, ORDER_BOOK_ABI, signer);

      const baseTokenAddr = TOKENS[baseToken]?.address;
      const quoteTokenAddr = TOKENS[quoteToken]?.address;
      if (!baseTokenAddr || !quoteTokenAddr) throw new Error("Invalid tokens");

      // Convert to token units
      const priceUnits = toTokenUnits(price, TOKENS[quoteToken].decimals);
      const amountUnits = toTokenUnits(amount, TOKENS[baseToken].decimals);

      // ╔═══════════════════════════════════════════════════════╗
      // ║  FHE ENCRYPTION: Encrypt price and amount locally    ║
      // ║  before sending to the blockchain.                    ║
      // ║  Only the user's browser sees the plaintext values.   ║
      // ╚═══════════════════════════════════════════════════════╝
      const { handles, inputProof } = await encryptValues(
        [priceUnits, amountUnits],
        CONTRACTS.orderBook,
        wallet.address
      );

      const sideEnum = side === "BUY" ? 0 : 1;
      const typeEnum = orderType === "MARKET" ? 0 : 1;

      const tx = await orderBookContract.placeOrder(
        baseTokenAddr,
        quoteTokenAddr,
        sideEnum,
        typeEnum,
        handles[0], // encrypted price
        handles[1], // encrypted amount
        inputProof
      );

      const receipt = await tx.wait();
      return receipt.hash;
    } finally {
      set({ isPlacingOrder: false });
    }
  },

  cancelOrder: async (orderId) => {
    const wallet = useWalletStore.getState();
    if (!wallet.provider) throw new Error("Wallet not connected");

    const signer = await wallet.provider.getSigner();
    const orderBookContract = new Contract(CONTRACTS.orderBook, ORDER_BOOK_ABI, signer);
    const tx = await orderBookContract.cancelOrder(orderId);
    await tx.wait();
  },
}));

// ─── Vault Store ─────────────────────────────────────────────────

interface VaultStore {
  balances: VaultBalance[];
  loading: boolean;
  depositing: boolean;
  withdrawing: boolean;

  deposit: (tokenKey: string, amount: number) => Promise<string>;
  fetchBalances: () => Promise<void>;
}

export const useVaultStore = create<VaultStore>((set) => ({
  balances: [],
  loading: false,
  depositing: false,
  withdrawing: false,

  deposit: async (tokenKey, amount) => {
    const wallet = useWalletStore.getState();
    if (!wallet.provider || !wallet.address) throw new Error("Wallet not connected");

    set({ depositing: true });
    try {
      const signer = await wallet.provider.getSigner();
      const token = TOKENS[tokenKey];
      if (!token) throw new Error("Unknown token");

      const amountUnits = toTokenUnits(amount, token.decimals);

      // Step 1: Approve token transfer
      const tokenContract = new Contract(token.address, ERC20_ABI, signer);
      const allowance = await tokenContract.allowance(wallet.address, CONTRACTS.vault);

      if (allowance < amountUnits) {
        const approveTx = await tokenContract.approve(CONTRACTS.vault, amountUnits);
        await approveTx.wait();
      }

      // Step 2: Deposit — amount will be encrypted on-chain in Vault.sol
      const vaultContract = new Contract(CONTRACTS.vault, VAULT_ABI, signer);
      const tx = await vaultContract.deposit(token.address, amountUnits);
      const receipt = await tx.wait();

      return receipt.hash;
    } finally {
      set({ depositing: false });
    }
  },

  fetchBalances: async () => {
    const wallet = useWalletStore.getState();
    if (!wallet.provider || !wallet.address) return;

    set({ loading: true });
    try {
      const signer = await wallet.provider.getSigner();
      const vaultContract = new Contract(CONTRACTS.vault, VAULT_ABI, signer);

      const balances: VaultBalance[] = [];

      for (const [key, token] of Object.entries(TOKENS)) {
        try {
          // Generate reencryption keypair
          const { publicKey, signature } = await generateReencryptionKeypair(
            CONTRACTS.vault,
            wallet.provider
          );

          // Request reencrypted balance from contract
          const encBalance = await vaultContract.getEncryptedBalance(
            token.address,
            publicKey,
            signature
          );

          // Decrypt locally
          const decrypted = await decryptReencrypted(CONTRACTS.vault, encBalance);

          balances.push({
            token: { key, ...token, coingeckoId: "" },
            encryptedBalance: encBalance,
            decryptedBalance: Number(decrypted) / 10 ** token.decimals,
          });
        } catch {
          balances.push({
            token: { key, ...token, coingeckoId: "" },
            encryptedBalance: "0x",
            decryptedBalance: 0,
          });
        }
      }

      set({ balances });
    } catch (e) {
      console.error("Failed to fetch balances:", e);
    } finally {
      set({ loading: false });
    }
  },
}));
