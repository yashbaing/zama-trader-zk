// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ═══════════════════════════════════════════════════════════════════
// CopyTrading.sol — Encrypted copy trading with privacy
//
// CORE FHE USAGE:
// • Leader strategies are stored as encrypted allocation percentages
// • Followers copy strategies WITHOUT seeing the actual allocations
// • The leader's strategy remains encrypted even from followers
// • Only trade OUTCOMES (aggregate volume) are visible; positions are not
//
// HOW IT WORKS:
//   1. Leader sets encrypted allocation percentages for each asset
//   2. Followers subscribe (on-chain, visible) but strategies are encrypted
//   3. When leader rebalances, follower balances update proportionally
//   4. All arithmetic uses FHE — no plaintext strategies on-chain
// ═══════════════════════════════════════════════════════════════════

import "fhevm/lib/TFHE.sol";
import "./Vault.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract CopyTrading is AccessControl {

    Vault public vault;

    struct Leader {
        address addr;
        string name;           // Public display name
        uint256 followerCount; // Public metric
        bool active;
        address[] allocTokens; // Which tokens the strategy covers
    }

    // Leader's encrypted allocations: token => encrypted percentage (0-100)
    // Even followers cannot see these values
    mapping(address => mapping(address => euint64)) private _leaderAllocations;

    // Follower subscription: follower => leader
    mapping(address => address) public followedLeader;

    // Follower's copy amount: follower => encrypted total USD to allocate
    mapping(address => euint64) private _followerBudget;

    // Leader registry
    mapping(address => Leader) public leaders;
    address[] public leaderList;

    // ─── Events ──────────────────────────────────────────────────
    event LeaderRegistered(address indexed leader, string name);
    event StrategyUpdated(address indexed leader, uint256 timestamp);
    event FollowerSubscribed(address indexed follower, address indexed leader);
    event FollowerUnsubscribed(address indexed follower, address indexed leader);
    event CopyExecuted(address indexed follower, address indexed leader, uint256 timestamp);

    // ─── Errors ──────────────────────────────────────────────────
    error NotALeader();
    error AlreadyFollowing();
    error NotFollowing();
    error CannotFollowSelf();

    constructor(address _vault) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        vault = Vault(_vault);
    }

    // ─── Leader Functions ────────────────────────────────────────

    /// @notice Register as a copy trading leader
    function registerAsLeader(string calldata name) external {
        require(!leaders[msg.sender].active, "Already registered");

        leaders[msg.sender] = Leader({
            addr: msg.sender,
            name: name,
            followerCount: 0,
            active: true,
            allocTokens: new address[](0)
        });
        leaderList.push(msg.sender);

        emit LeaderRegistered(msg.sender, name);
    }

    /// @notice Set encrypted allocation for a token
    ///
    /// FHE: The leader encrypts their percentage allocation client-side.
    ///      On-chain, the allocation is stored as euint64.
    ///      Followers CANNOT decrypt or view these percentages.
    ///      Only the leader can view their own strategy via reencryption.
    function setAllocation(
        address token,
        einput encryptedPct,
        bytes calldata inputProof
    ) external {
        if (!leaders[msg.sender].active) revert NotALeader();

        euint64 pct = TFHE.asEuint64(encryptedPct, inputProof);
        TFHE.allow(pct, address(this));
        TFHE.allow(pct, msg.sender);

        _leaderAllocations[msg.sender][token] = pct;

        // Track token in leader's allocation list
        Leader storage leader = leaders[msg.sender];
        bool found = false;
        for (uint i = 0; i < leader.allocTokens.length; i++) {
            if (leader.allocTokens[i] == token) { found = true; break; }
        }
        if (!found) leader.allocTokens.push(token);

        emit StrategyUpdated(msg.sender, block.timestamp);
    }

    // ─── Follower Functions ──────────────────────────────────────

    /// @notice Subscribe to a leader's strategy
    function follow(address leader) external {
        if (!leaders[leader].active) revert NotALeader();
        if (followedLeader[msg.sender] != address(0)) revert AlreadyFollowing();
        if (leader == msg.sender) revert CannotFollowSelf();

        followedLeader[msg.sender] = leader;
        leaders[leader].followerCount++;

        emit FollowerSubscribed(msg.sender, leader);
    }

    /// @notice Unsubscribe from a leader
    function unfollow() external {
        address leader = followedLeader[msg.sender];
        if (leader == address(0)) revert NotFollowing();

        followedLeader[msg.sender] = address(0);
        leaders[leader].followerCount--;

        emit FollowerUnsubscribed(msg.sender, leader);
    }

    /// @notice Set encrypted budget for copy trading
    ///
    /// FHE: The follower encrypts how much USD they want to allocate.
    ///      Neither the leader nor other users can see this amount.
    function setBudget(
        einput encryptedBudget,
        bytes calldata inputProof
    ) external {
        euint64 budget = TFHE.asEuint64(encryptedBudget, inputProof);
        TFHE.allow(budget, address(this));
        TFHE.allow(budget, msg.sender);

        _followerBudget[msg.sender] = budget;
    }

    /// @notice Execute copy trade — applies leader's encrypted allocations
    ///         to follower's encrypted budget
    ///
    /// FHE FLOW:
    ///   For each token in the leader's strategy:
    ///     allocation = leaderPct[token] * followerBudget / 100
    ///   This is computed ENTIRELY on encrypted values.
    ///   Neither the leader's percentages nor the follower's budget
    ///   are ever revealed.
    function executeCopy(address follower) external {
        address leader = followedLeader[follower];
        if (leader == address(0)) revert NotFollowing();

        Leader storage leaderData = leaders[leader];
        euint64 budget = _followerBudget[follower];
        euint64 hundred = TFHE.asEuint64(100);

        for (uint i = 0; i < leaderData.allocTokens.length; i++) {
            address token = leaderData.allocTokens[i];
            euint64 pct = _leaderAllocations[leader][token];

            // ╔═══════════════════════════════════════════════════╗
            // ║  ENCRYPTED CALCULATION:                           ║
            // ║  tokenAlloc = (budget * pct) / 100               ║
            // ║  Both budget and pct are encrypted                ║
            // ║  Result is encrypted — no one sees the amount     ║
            // ╚═══════════════════════════════════════════════════╝
            euint64 tokenAlloc = TFHE.div(TFHE.mul(budget, pct), hundred);

            // Add to follower's vault balance
            TFHE.allow(tokenAlloc, address(vault));
            vault.addEncryptedBalance(follower, token, tokenAlloc);
        }

        emit CopyExecuted(follower, leader, block.timestamp);
    }

    // ─── View Functions ──────────────────────────────────────────

    function getLeaderCount() external view returns (uint256) {
        return leaderList.length;
    }

    function getLeaderInfo(address leader) external view returns (
        string memory name,
        uint256 followerCount,
        bool active,
        uint256 tokenCount
    ) {
        Leader storage l = leaders[leader];
        return (l.name, l.followerCount, l.active, l.allocTokens.length);
    }

    /// @notice Leader views their own encrypted allocation via reencryption
    function getMyAllocation(
        address token,
        bytes32 publicKey,
        bytes calldata signature
    ) external view returns (bytes memory) {
        require(leaders[msg.sender].active, "Not a leader");
        return TFHE.reencrypt(
            _leaderAllocations[msg.sender][token],
            publicKey,
            0
        );
    }
}
