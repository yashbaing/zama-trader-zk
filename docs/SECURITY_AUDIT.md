# ZKTrader Security Audit Checklist & Threat Model

## Executive Summary

ZKTrader is a privacy-preserving DEX where ALL sensitive user data (balances,
order prices, order amounts, strategies) is stored and processed as encrypted
ciphertexts using Zama's Fully Homomorphic Encryption (fhEVM). This document
covers the security model, known risks, and audit checklist.

---

## 1. FHE Security Model

### 1.1 What Is Encrypted
| Data                  | Storage Type | Who Can Read It |
|-----------------------|-------------|-----------------|
| User balances         | `euint64`   | Only the user (via reencryption) |
| Order prices          | `euint64`   | Only the order owner |
| Order amounts         | `euint64`   | Only the order owner |
| Order filled amounts  | `euint64`   | Only the order owner |
| Auto-invest strategies| `euint64`   | Only the strategy owner |
| Copy trading allocations| `euint64` | Only the leader |
| Follower budgets      | `euint64`   | Only the follower |

### 1.2 What Is NOT Encrypted (Public Data)
| Data                  | Reason |
|-----------------------|--------|
| Order side (BUY/SELL) | Required for matching indexing |
| Order type (MARKET/LIMIT) | Required for matching logic |
| Order status          | Required for UI state |
| Trading pair (tokens) | Required for pair matching |
| Order timestamp       | Required for time-priority |
| Deposit amounts       | Visible in the deposit tx (plaintext ERC20 transfer) |
| Withdrawal amounts    | Revealed during Gateway decryption for actual transfer |
| Market prices         | Public data from external feeds |

### 1.3 FHE Computation Security
- All arithmetic on encrypted values uses TFHE operations
- Only boolean comparison results are ever decrypted on-chain
- The FHE public key is shared (network key); individual balances
  use reencryption to user-specific keys
- The TFHE security parameter is 128 bits (equivalent to AES-128)

---

## 2. Threat Model

### 2.1 Front-Running / MEV Protection
**Status: MITIGATED by design**

Since order prices and amounts are encrypted:
- MEV bots cannot read pending order details in the mempool
- Sandwich attacks are impossible (attacker can't see the target price)
- Copy trading strategies cannot be front-run
- Limit order prices cannot be sniped

**Residual risk**: Order SIDE (BUY/SELL) is visible. An attacker knows
"someone placed a buy order for BTC/USDC" but NOT the price or size.
This leaks directional intent. Mitigation: use encrypted order sides
in future versions (requires more complex matching).

### 2.2 Deposit Amount Visibility
**Status: KNOWN LIMITATION**

Deposits involve a plaintext ERC20 `transferFrom` call, so deposit
amounts are visible on-chain. Attacker can see "Alice deposited
100,000 USDC".

**Mitigation options**:
- Use a mixer/relayer (e.g., Tornado Cash model) before depositing
- Batch deposits from a shared pool
- Future: native encrypted ERC20 tokens

### 2.3 Withdrawal Amount Visibility
**Status: PARTIAL MITIGATION**

Withdrawals are requested with encrypted amounts. However, the Gateway
must decrypt the amount to execute the actual ERC20 transfer, making
the withdrawn amount visible at that point.

**Mitigation**: Time-lock withdrawals to make timing analysis harder.

### 2.4 Access Control Attacks
**Status: MITIGATED**

- `ENGINE_ROLE` restricts balance mutations to TradingEngine only
- `DEFAULT_ADMIN_ROLE` for configuration changes
- `onlySignedPublicKey` for reencryption requests
- `onlyGateway` for decryption callbacks
- Order cancellation restricted to order owner

**Audit items**:
- [ ] Verify no function allows arbitrary balance manipulation
- [ ] Verify no admin function can access encrypted data
- [ ] Verify reencryption uses EIP-712 signature verification
- [ ] Verify Gateway callback validation

### 2.5 Reentrancy
**Status: MITIGATED**

- Vault.sol uses OpenZeppelin's `ReentrancyGuard`
- External calls (ERC20 transfers) happen after state changes
- FHE operations don't involve external calls

### 2.6 Integer Overflow / Underflow
**Status: MITIGATED**

- Solidity 0.8.24 has built-in overflow checks for plaintext values
- `euint64` operations in TFHE handle overflow internally
- No unchecked blocks used

### 2.7 Key Management
**Status: REQUIRES USER EDUCATION**

- FHE private keys are generated in the browser
- Keys are never transmitted to any server
- If the user loses their key, they cannot decrypt their balances
- There is NO admin recovery mechanism (by design)

**Recommendation**: Add key export/backup functionality to the frontend.

### 2.8 Oracle Manipulation (Fear & Greed)
**Status: LOW RISK**

- Fear & Greed Index comes from alternative.me (centralized)
- Auto-invest strategies use it as a signal, not a price feed
- Manipulation would only affect auto-rebalancing timing

---

## 3. Smart Contract Audit Checklist

### 3.1 Vault.sol
- [ ] Deposit correctly encrypts plaintext amount to euint64
- [ ] TFHE.add on encrypted balance doesn't overflow
- [ ] TFHE.allow grants correct permissions (contract + user only)
- [ ] Withdrawal checks encrypted balance >= withdrawal amount
- [ ] Gateway callback correctly processes decrypted withdrawal
- [ ] No path exists to drain funds without encrypted authorization
- [ ] Unsupported tokens correctly rejected
- [ ] Zero amount deposits rejected
- [ ] ENGINE_ROLE properly restricted to TradingEngine

### 3.2 OrderBook.sol
- [ ] einput + proof correctly verified by TFHE.asEuint64
- [ ] Order metadata accessible to anyone; encrypted data only to owner
- [ ] Cancel restricted to order owner
- [ ] Cancelled orders cannot be matched
- [ ] Pair hash is deterministic and collision-free
- [ ] Order IDs are sequential and non-reusable

### 3.3 TradingEngine.sol
- [ ] Price comparison only decrypts the boolean result
- [ ] Fill amount correctly computed as min(buyRemaining, sellRemaining)
- [ ] Settlement correctly debits/credits both parties
- [ ] Partial fills update order status correctly
- [ ] Same-side matching correctly rejected
- [ ] Cross-pair matching correctly rejected
- [ ] Batch matching doesn't revert on individual failures
- [ ] Match counter accurately tracks successful matches

### 3.4 CopyTrading.sol
- [ ] Leader allocations encrypted and inaccessible to followers
- [ ] Follow/unfollow correctly updates follower count
- [ ] Cannot follow self
- [ ] Cannot follow non-existent leader
- [ ] Budget encryption correct
- [ ] Copy execution uses encrypted multiplication/division

### 3.5 AutoInvestVault.sol
- [ ] Strategy allocations encrypted per sentiment level
- [ ] Only admin can update sentiment (oracle)
- [ ] User can view own strategy via reencryption

---

## 4. Frontend Security Checklist

- [ ] FHE private keys never leave the browser
- [ ] No sensitive data in URL parameters or localStorage
- [ ] API calls never transmit decrypted balances
- [ ] MetaMask signature validation before reencryption requests
- [ ] No console.log of decrypted values in production
- [ ] Content Security Policy headers set
- [ ] CORS restricted to known frontend origin
- [ ] All user inputs validated before encryption

---

## 5. Backend Security Checklist

- [ ] Event indexer only stores public metadata
- [ ] No endpoint returns encrypted data as plaintext
- [ ] Relayer private key stored securely (not in code)
- [ ] Rate limiting on API endpoints
- [ ] Helmet.js security headers enabled
- [ ] WebSocket only broadcasts public data
- [ ] No logging of encrypted transaction data

---

## 6. Infrastructure Security

- [ ] RPC endpoint uses HTTPS
- [ ] Contract addresses verified after deployment
- [ ] Deployment scripts don't hardcode private keys
- [ ] Docker containers run as non-root
- [ ] Environment variables not committed to git
- [ ] Dependencies audited (npm audit, snyk)

---

## 7. Known Limitations

1. **FHE computation cost**: Operations are 100-1000x more expensive than
   plaintext. Gas costs are significant.

2. **Decryption latency**: Gateway decryption for withdrawals adds ~10-30s
   of additional wait time.

3. **Order book depth opacity**: Since order prices are encrypted, there's
   no traditional order book depth chart. Users can see order COUNT but not
   price distribution.

4. **Matching efficiency**: The keeper uses a naive O(n²) matching strategy
   since it can't sort by price. More efficient matching requires protocol-
   level price buckets (encrypted range proofs).

5. **Deposit privacy**: Initial deposits are plaintext. Full privacy requires
   encrypted ERC20 tokens or a deposit mixer.

---

## 8. Recommended Improvements

1. **Encrypted order sides**: Hide BUY/SELL to eliminate directional leakage
2. **Encrypted ERC20 tokens**: Native fhEVM tokens for fully private deposits
3. **Key recovery**: Social recovery or threshold decryption for lost keys
4. **Formal verification**: Verify FHE computation correctness with Certora or similar
5. **Circuit breakers**: Emergency pause functionality with timelock governance
6. **Insurance fund**: Protocol reserve for handling edge cases in encrypted settlement
