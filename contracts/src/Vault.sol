// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ═══════════════════════════════════════════════════════════════════
// Vault.sol — Encrypted balance storage using Zama fhEVM
//
// CORE FHE USAGE:
// • All user balances stored as euint64 (encrypted uint64)
// • Deposits convert plaintext → encrypted via TFHE.asEuint64()
// • Withdrawals require encrypted comparison to prevent overdraft
// • Only the user can decrypt their own balance via reencryption
// • The protocol itself CANNOT read any user balance
// ═══════════════════════════════════════════════════════════════════

import "fhevm/lib/TFHE.sol";
import "fhevm/gateway/GatewayCaller.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Vault is AccessControl, ReentrancyGuard, GatewayCaller {
    using SafeERC20 for IERC20;

    // ─── Roles ───────────────────────────────────────────────────
    bytes32 public constant ENGINE_ROLE = keccak256("ENGINE_ROLE");

    // ─── State ───────────────────────────────────────────────────
    // Mapping: user => token => encrypted balance
    // This is the CORE privacy primitive: balances are NEVER stored in plaintext.
    // euint64 is Zama's encrypted unsigned 64-bit integer type.
    mapping(address => mapping(address => euint64)) private _encryptedBalances;

    // Supported token whitelist
    mapping(address => bool) public supportedTokens;
    address[] public tokenList;

    // Withdrawal request tracking for async decryption
    struct WithdrawalRequest {
        address user;
        address token;
        euint64 encryptedAmount;
        bool fulfilled;
    }
    mapping(uint256 => WithdrawalRequest) public withdrawalRequests;
    uint256 public nextWithdrawalId;

    // ─── Events ──────────────────────────────────────────────────
    event Deposited(address indexed user, address indexed token, uint256 amount);
    event WithdrawalRequested(uint256 indexed requestId, address indexed user, address indexed token);
    event WithdrawalFulfilled(uint256 indexed requestId, address indexed user, uint256 amount);
    event TokenAdded(address indexed token);
    event TokenRemoved(address indexed token);

    // ─── Errors ──────────────────────────────────────────────────
    error TokenNotSupported(address token);
    error ZeroAmount();
    error InsufficientEncryptedBalance();
    error WithdrawalAlreadyFulfilled();
    error OnlyEngineOrAdmin();

    // ─── Constructor ─────────────────────────────────────────────
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // ─── Admin Functions ─────────────────────────────────────────

    /// @notice Add a token to the supported list
    function addSupportedToken(address token) external onlyRole(DEFAULT_ADMIN_ROLE) {
        supportedTokens[token] = true;
        tokenList.push(token);
        emit TokenAdded(token);
    }

    /// @notice Grant engine role to TradingEngine contract
    function setTradingEngine(address engine) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(ENGINE_ROLE, engine);
    }

    // ─── Deposit ─────────────────────────────────────────────────

    /// @notice Deposit plaintext tokens. The amount is immediately encrypted
    ///         and added to the user's encrypted balance.
    ///
    /// FHE FLOW:
    ///   1. User sends plaintext ERC20 tokens to the vault
    ///   2. Amount is converted to encrypted form: TFHE.asEuint64(amount)
    ///   3. Added to existing encrypted balance: TFHE.add(balance, deposit)
    ///   4. Plaintext amount is ONLY visible during the deposit tx itself
    ///   5. After storage, the balance is fully encrypted — no one can read it
    ///
    /// NOTE: The deposit amount is visible on-chain in this tx. For full privacy
    ///       on deposits, users can use a mixer/relayer before depositing.
    function deposit(address token, uint256 amount) external nonReentrant {
        if (!supportedTokens[token]) revert TokenNotSupported(token);
        if (amount == 0) revert ZeroAmount();

        // Transfer tokens from user to vault
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        // ╔═══════════════════════════════════════════════════════╗
        // ║  FHE ENCRYPTION: Convert plaintext to encrypted      ║
        // ║  TFHE.asEuint64() creates an encrypted value that    ║
        // ║  can only be operated on via FHE operations           ║
        // ╚═══════════════════════════════════════════════════════╝
        euint64 encryptedDeposit = TFHE.asEuint64(amount);

        // ╔═══════════════════════════════════════════════════════╗
        // ║  FHE ADDITION: Add encrypted deposit to balance      ║
        // ║  TFHE.add() performs addition on ciphertexts          ║
        // ║  Neither operand is ever decrypted during this op     ║
        // ╚═══════════════════════════════════════════════════════╝
        _encryptedBalances[msg.sender][token] = TFHE.add(
            _encryptedBalances[msg.sender][token],
            encryptedDeposit
        );

        // Allow the vault contract to manipulate the encrypted value
        TFHE.allow(_encryptedBalances[msg.sender][token], address(this));
        // Allow the user to request reencryption (to view their balance)
        TFHE.allow(_encryptedBalances[msg.sender][token], msg.sender);

        emit Deposited(msg.sender, token, amount);
    }

    // ─── Withdrawal ──────────────────────────────────────────────

    /// @notice Request a withdrawal with an encrypted amount.
    ///         The user encrypts the amount client-side before submitting.
    ///
    /// FHE FLOW:
    ///   1. User encrypts desired withdrawal amount in their browser
    ///   2. Encrypted amount is submitted as `einput` + proof
    ///   3. Contract verifies encrypted amount ≤ encrypted balance
    ///      using TFHE.le() — comparison on ciphertexts
    ///   4. If valid, encrypted balance is decremented via TFHE.sub()
    ///   5. Async decryption request sent to the Gateway for actual transfer
    ///
    /// SECURITY: The withdrawal amount is NEVER visible on-chain until
    ///           the Gateway decrypts it for the actual ERC20 transfer.
    function requestWithdrawal(
        address token,
        einput encryptedAmount,
        bytes calldata inputProof
    ) external nonReentrant returns (uint256 requestId) {
        if (!supportedTokens[token]) revert TokenNotSupported(token);

        // ╔═══════════════════════════════════════════════════════╗
        // ║  FHE INPUT VERIFICATION: Convert user input to       ║
        // ║  on-chain encrypted value with proof verification     ║
        // ╚═══════════════════════════════════════════════════════╝
        euint64 amount = TFHE.asEuint64(encryptedAmount, inputProof);

        // ╔═══════════════════════════════════════════════════════╗
        // ║  FHE COMPARISON: Check balance ≥ withdrawal amount   ║
        // ║  TFHE.le() returns ebool — an ENCRYPTED boolean      ║
        // ║  We use TFHE.decrypt() on the ebool only (not the    ║
        // ║  amounts) to get the comparison result                ║
        // ╚═══════════════════════════════════════════════════════╝
        ebool hasEnough = TFHE.le(amount, _encryptedBalances[msg.sender][token]);
        TFHE.allow(hasEnough, address(this));

        // NOTE: In production fhEVM, you'd use Gateway for async decryption
        // of the boolean. For simplicity, we show the synchronous pattern.
        require(TFHE.decrypt(hasEnough), "Insufficient encrypted balance");

        // ╔═══════════════════════════════════════════════════════╗
        // ║  FHE SUBTRACTION: Deduct from encrypted balance      ║
        // ║  TFHE.sub() operates purely on ciphertexts           ║
        // ╚═══════════════════════════════════════════════════════╝
        _encryptedBalances[msg.sender][token] = TFHE.sub(
            _encryptedBalances[msg.sender][token],
            amount
        );
        TFHE.allow(_encryptedBalances[msg.sender][token], address(this));
        TFHE.allow(_encryptedBalances[msg.sender][token], msg.sender);

        // Store withdrawal request for async fulfillment
        requestId = nextWithdrawalId++;
        withdrawalRequests[requestId] = WithdrawalRequest({
            user: msg.sender,
            token: token,
            encryptedAmount: amount,
            fulfilled: false
        });

        // Request async decryption via Gateway for the actual transfer
        TFHE.allow(amount, address(this));
        uint256[] memory cts = new uint256[](1);
        cts[0] = Gateway.toUint256(amount);
        Gateway.requestDecryption(cts, this.fulfillWithdrawal.selector, 0, block.timestamp + 100, false);

        emit WithdrawalRequested(requestId, msg.sender, token);
    }

    /// @notice Callback from Gateway after decryption — sends actual tokens
    function fulfillWithdrawal(uint256 requestId, uint256 decryptedAmount) external onlyGateway {
        WithdrawalRequest storage req = withdrawalRequests[requestId];
        if (req.fulfilled) revert WithdrawalAlreadyFulfilled();
        req.fulfilled = true;

        IERC20(req.token).safeTransfer(req.user, decryptedAmount);

        emit WithdrawalFulfilled(requestId, req.user, decryptedAmount);
    }

    // ─── Engine-Only Balance Mutations ───────────────────────────
    // These are called by TradingEngine.sol during trade settlement

    /// @notice Add encrypted amount to a user's balance (called after trade fill)
    function addEncryptedBalance(
        address user,
        address token,
        euint64 amount
    ) external onlyRole(ENGINE_ROLE) {
        _encryptedBalances[user][token] = TFHE.add(
            _encryptedBalances[user][token],
            amount
        );
        TFHE.allow(_encryptedBalances[user][token], address(this));
        TFHE.allow(_encryptedBalances[user][token], user);
    }

    /// @notice Subtract encrypted amount from a user's balance (called for trade debit)
    function subEncryptedBalance(
        address user,
        address token,
        euint64 amount
    ) external onlyRole(ENGINE_ROLE) {
        _encryptedBalances[user][token] = TFHE.sub(
            _encryptedBalances[user][token],
            amount
        );
        TFHE.allow(_encryptedBalances[user][token], address(this));
        TFHE.allow(_encryptedBalances[user][token], user);
    }

    // ─── View Functions ──────────────────────────────────────────

    /// @notice Get the encrypted balance — only the user can reencrypt & read it
    ///
    /// FHE REENCRYPTION:
    ///   The user provides their public key + signature to prove ownership.
    ///   The contract then re-encrypts the balance under the user's key,
    ///   so only they can decrypt it in their browser. The contract itself
    ///   never sees the plaintext.
    function getEncryptedBalance(
        address token,
        bytes32 publicKey,
        bytes calldata signature
    ) external view onlySignedPublicKey(publicKey, signature) returns (bytes memory) {
        return TFHE.reencrypt(
            _encryptedBalances[msg.sender][token],
            publicKey,
            0 // default value if balance doesn't exist
        );
    }

    /// @notice Get raw encrypted handle (for internal contract-to-contract use)
    function getRawEncryptedBalance(
        address user,
        address token
    ) external view onlyRole(ENGINE_ROLE) returns (euint64) {
        return _encryptedBalances[user][token];
    }

    /// @notice Number of supported tokens
    function getTokenCount() external view returns (uint256) {
        return tokenList.length;
    }

    // ─── Modifiers ───────────────────────────────────────────────

    modifier onlySignedPublicKey(bytes32 publicKey, bytes calldata signature) {
        // In production: verify EIP-712 signature proving the caller owns the key
        require(msg.sender != address(0), "Invalid caller");
        _;
    }

    modifier onlyGateway() {
        // In production: verify msg.sender is the Gateway contract
        _;
    }
}
