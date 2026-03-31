# ⚡ ZKTrader — Privacy-Preserving Decentralized Trading Platform

> Built on Zama's fhEVM: trade assets with **fully encrypted** portfolios, order books, and execution.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js)                       │
│  Dashboard │ Trade Screen │ Vault Manager │ Transaction History  │
│─────────────────────────────────────────────────────────────────│
│  FHE Client SDK │ MetaMask │ Zustand State │ TradingView Charts │
└────────────────────────────┬────────────────────────────────────┘
                             │ JSON-RPC / REST
┌────────────────────────────┴────────────────────────────────────┐
│                     BACKEND (Node.js/Express)                    │
│  Event Indexer │ API Layer │ Price Feed │ Order Relay            │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────┴────────────────────────────────────┐
│                    ZAMA fhEVM BLOCKCHAIN                         │
│  ┌──────────┐  ┌────────────────┐  ┌───────────┐               │
│  │ Vault.sol│  │TradingEngine.sol│  │OrderBook.sol│              │
│  │          │  │                │  │           │               │
│  │ euint64  │  │ FHE compare   │  │ Encrypted │               │
│  │ balances │  │ FHE add/sub   │  │ orders    │               │
│  └──────────┘  └────────────────┘  └───────────┘               │
│  ┌──────────────────────────────────────────────┐               │
│  │          FHE Coprocessor (TFHE-rs)           │               │
│  │  Encryption │ Decryption │ Computation       │               │
│  └──────────────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────────┘
```

## 🔐 How FHE Is Used

### Encrypted Balances
All user balances are stored as `euint64` — Zama's encrypted unsigned 64-bit integer type.
No node operator, validator, or contract can read these values. Only the user holding
the private FHE key can decrypt their own balance.

### Encrypted Order Book
Orders contain encrypted prices and amounts. The matching engine uses:
- `TFHE.le(a, b)` — encrypted less-than-or-equal comparison
- `TFHE.sub(a, b)` — encrypted subtraction for fills
- `TFHE.add(a, b)` — encrypted addition for balance updates
- `TFHE.cmux(condition, a, b)` — conditional selection on encrypted values

### Trade Flow
```
1. User encrypts order (price, amount) client-side using FHE public key
2. Encrypted order submitted to OrderBook.sol
3. TradingEngine.sol matches orders using FHE comparisons
4. Balances updated via encrypted arithmetic in Vault.sol
5. User decrypts their updated balance locally
```

### Anti-Front-Running
Since order prices/amounts are encrypted, MEV bots cannot:
- See pending order details
- Sandwich attack trades
- Copy trading strategies

## 📦 Project Structure

```
zktrader/
├── contracts/          # fhEVM Solidity smart contracts
│   ├── src/
│   │   ├── Vault.sol
│   │   ├── TradingEngine.sol
│   │   ├── OrderBook.sol
│   │   ├── MockToken.sol
│   │   └── interfaces/
│   ├── test/
│   ├── scripts/
│   └── foundry.toml
├── frontend/           # Next.js application
│   ├── src/
│   │   ├── app/        # App router pages
│   │   ├── components/ # React components
│   │   ├── lib/        # FHE utilities, contract ABIs
│   │   ├── hooks/      # Custom React hooks
│   │   ├── store/      # Zustand state management
│   │   └── types/      # TypeScript types
├── backend/            # Express API server
│   ├── src/
│   │   ├── routes/
│   │   ├── services/
│   │   └── utils/
└── docs/               # Architecture diagrams
```

## 🚀 Quick Start

### Prerequisites
- Node.js >= 18
- pnpm
- MetaMask browser extension
- Foundry (for contracts)

### 1. Smart Contracts
```bash
cd contracts
forge install
forge build
forge test
# Deploy to Zama testnet
forge script scripts/Deploy.s.sol --rpc-url $ZAMA_RPC --broadcast
```

### 2. Backend
```bash
cd backend
pnpm install
cp .env.example .env  # Configure RPC URLs
pnpm dev
```

### 3. Frontend
```bash
cd frontend
pnpm install
cp .env.example .env.local  # Configure contract addresses
pnpm dev
# Open http://localhost:3000
```

## 🧪 Testing
```bash
# Contract tests (with FHE mocks)
cd contracts && forge test -vvv

# Frontend tests
cd frontend && pnpm test

# Backend tests
cd backend && pnpm test
```

## 🔑 Security Model
- **No plaintext on-chain**: All sensitive data uses `euint64`/`euint128`
- **Client-side encryption**: FHE keys generated in browser, never transmitted
- **Reencryption for viewing**: Users request reencryption to view their own data
- **Access control**: Only vault owners can request decryption of their balances
- **No admin backdoors**: Protocol cannot access encrypted user data

## 📄 License
MIT
