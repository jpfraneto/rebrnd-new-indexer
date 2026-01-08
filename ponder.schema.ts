import { onchainTable } from "ponder";

// ===== CORE ENTITIES =====

export const brands = onchainTable("brands", (t) => ({
  id: t.integer().primaryKey(),
  fid: t.integer().notNull(),
  walletAddress: t.text().notNull(),
  handle: t.text().notNull(),
  metadataHash: t.text().notNull(),

  // Enhanced brand data for frontend
  name: t.text(),
  description: t.text(),
  imageUrl: t.text(),
  warpcastUrl: t.text(),
  channel: t.text(),
  category: t.text(),
  guardianFid: t.integer(), // User in charge of brand
  ticker: t.text(),
  contractAddress: t.text(),

  // Real-time metrics (updated on each vote)
  totalFans: t.integer().notNull().default(0), // Unique voters count
  totalVotesReceived: t.integer().notNull().default(0),
  totalBrndAwarded: t.bigint().notNull().default(0n),
  availableBrnd: t.bigint().notNull().default(0n),

  // Current rankings (updated real-time for frontend efficiency)
  currentDailyRank: t.integer(),
  currentWeeklyRank: t.integer(),
  currentMonthlyRank: t.integer(),
  currentAllTimeRank: t.integer(),
  currentCategoryRank: t.integer(),

  // Timestamps
  createdAt: t.bigint().notNull(),
  blockNumber: t.bigint().notNull(),
  transactionHash: t.text().notNull(),
  lastUpdated: t.bigint().notNull(),
}));

export const users = onchainTable("users", (t) => ({
  fid: t.integer().primaryKey(),

  // Profile data
  username: t.text(),
  photoUrl: t.text(),
  verified: t.boolean().notNull().default(false),
  neynarScore: t.integer().notNull().default(0),

  // Power and engagement
  brndPowerLevel: t.integer().notNull().default(0),
  totalVotes: t.integer().notNull().default(0),
  points: t.bigint().notNull().default(0n),

  // Streak tracking
  currentStreak: t.integer().notNull().default(0),
  maxStreak: t.integer().notNull().default(0),

  // Engagement metrics
  totalPodiums: t.integer().notNull().default(0),
  votedBrandsCount: t.integer().notNull().default(0), // Count of unique brands voted for
  favoriteBrandId: t.integer(), // Most voted brand ID

  // Current standings
  currentLeaderboardRank: t.integer(),

  // Vote tracking
  lastVoteDay: t.integer(),
  hasVotedToday: t.boolean().notNull().default(false),

  // Blockchain data
  blockNumber: t.bigint().notNull(),
  transactionHash: t.text().notNull(),
  lastUpdated: t.bigint().notNull(),
}));

// ===== VOTE TRACKING =====

export const votes = onchainTable("votes", (t) => ({
  id: t.text().primaryKey(),
  voter: t.text().notNull(),
  voterFid: t.integer().notNull(),
  day: t.bigint().notNull(),

  // Individual brand positions for easy querying
  goldBrandId: t.integer().notNull(),
  silverBrandId: t.integer().notNull(),
  bronzeBrandId: t.integer().notNull(),

  // Legacy field for backward compatibility
  brandIds: t.text().notNull(), // JSON array "[1,2,3]"

  // Vote economics
  cost: t.bigint().notNull(),

  // Reward tracking
  expectedReward: t.bigint(),
  castHash: t.text(),
  shared: t.boolean().notNull().default(false),
  shareVerified: t.boolean().notNull().default(false),
  claimedAt: t.bigint(),
  claimAmount: t.bigint(),

  // Blockchain data
  blockNumber: t.bigint().notNull(),
  transactionHash: t.text().notNull(),
  timestamp: t.bigint().notNull(),
}));

// Individual vote records for efficient brand analytics
export const individualVotes = onchainTable("individual_votes", (t) => ({
  id: t.text().primaryKey(), // "voteId-position"
  voteId: t.text().notNull(),
  voterFid: t.integer().notNull(),
  brandId: t.integer().notNull(),
  position: t.integer().notNull(), // 1=gold, 2=silver, 3=bronze
  points: t.bigint().notNull(), // Points awarded for this position
  day: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
  blockNumber: t.bigint().notNull(),
  transactionHash: t.text().notNull(),
}));

// ===== WALLET AND REWARDS =====

export const walletAuthorizations = onchainTable(
  "wallet_authorizations",
  (t) => ({
    id: t.text().primaryKey(),
    fid: t.integer().notNull(),
    wallet: t.text().notNull(),
    blockNumber: t.bigint().notNull(),
    transactionHash: t.text().notNull(),
    timestamp: t.bigint().notNull(),
  })
);

export const rewardClaims = onchainTable("reward_claims", (t) => ({
  id: t.text().primaryKey(),
  recipient: t.text().notNull(),
  fid: t.integer().notNull(),
  amount: t.bigint().notNull(),
  day: t.bigint().notNull(),
  castHash: t.text().notNull(),
  caller: t.text().notNull(),
  blockNumber: t.bigint().notNull(),
  transactionHash: t.text().notNull(),
  timestamp: t.bigint().notNull(),
}));

export const brandRewardWithdrawals = onchainTable(
  "brand_reward_withdrawals",
  (t) => ({
    id: t.text().primaryKey(),
    brandId: t.integer().notNull(),
    fid: t.integer().notNull(),
    amount: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    transactionHash: t.text().notNull(),
    timestamp: t.bigint().notNull(),
  })
);

export const brndPowerLevelUps = onchainTable("brnd_power_level_ups", (t) => ({
  id: t.text().primaryKey(),
  fid: t.integer().notNull(),
  newLevel: t.integer().notNull(),
  wallet: t.text().notNull(),
  blockNumber: t.bigint().notNull(),
  transactionHash: t.text().notNull(),
  timestamp: t.bigint().notNull(),
}));

// ===== OPTIMIZED LEADERBOARDS =====

// Landing page cache - Top brand today + top 3 per timeframe
export const topBrands = onchainTable("top_brands", (t) => ({
  id: t.text().primaryKey(), // "timeframe-rank" e.g., "daily-1", "weekly-2"
  timeframe: t.text().notNull(), // 'daily', 'weekly', 'monthly', 'alltime'
  rank: t.integer().notNull(),
  brandId: t.integer().notNull(),
  points: t.bigint().notNull(),
  totalVotes: t.integer().notNull(),
  goldCount: t.integer().notNull().default(0),
  silverCount: t.integer().notNull().default(0),
  bronzeCount: t.integer().notNull().default(0),
  periodValue: t.bigint(), // Day/week/month timestamp for filtering
  updatedAt: t.bigint().notNull(),
}));

// Enhanced brand leaderboards
export const dailyBrandLeaderboard = onchainTable(
  "daily_brand_leaderboard",
  (t) => ({
    id: t.text().primaryKey(), // "brandId-day"
    brandId: t.integer().notNull(),
    day: t.bigint().notNull(),
    points: t.bigint().notNull().default(0n),
    goldCount: t.integer().notNull().default(0),
    silverCount: t.integer().notNull().default(0),
    bronzeCount: t.integer().notNull().default(0),
    totalVotes: t.integer().notNull().default(0),
    uniqueVoters: t.integer().notNull().default(0),
    rank: t.integer(),
    previousRank: t.integer(), // Track rank changes
    rankChange: t.integer(), // +/- rank movement
    blockNumber: t.bigint().notNull(),
    updatedAt: t.bigint().notNull(),
  })
);

export const weeklyBrandLeaderboard = onchainTable(
  "weekly_brand_leaderboard",
  (t) => ({
    id: t.text().primaryKey(), // "brandId-week"
    brandId: t.integer().notNull(),
    week: t.bigint().notNull(),
    points: t.bigint().notNull().default(0n),
    goldCount: t.integer().notNull().default(0),
    silverCount: t.integer().notNull().default(0),
    bronzeCount: t.integer().notNull().default(0),
    totalVotes: t.integer().notNull().default(0),
    uniqueVoters: t.integer().notNull().default(0),
    rank: t.integer(),
    previousRank: t.integer(),
    rankChange: t.integer(),
    blockNumber: t.bigint().notNull(),
    updatedAt: t.bigint().notNull(),
  })
);

export const monthlyBrandLeaderboard = onchainTable(
  "monthly_brand_leaderboard",
  (t) => ({
    id: t.text().primaryKey(), // "brandId-month"
    brandId: t.integer().notNull(),
    month: t.bigint().notNull(),
    points: t.bigint().notNull().default(0n),
    goldCount: t.integer().notNull().default(0),
    silverCount: t.integer().notNull().default(0),
    bronzeCount: t.integer().notNull().default(0),
    totalVotes: t.integer().notNull().default(0),
    uniqueVoters: t.integer().notNull().default(0),
    rank: t.integer(),
    previousRank: t.integer(),
    rankChange: t.integer(),
    blockNumber: t.bigint().notNull(),
    updatedAt: t.bigint().notNull(),
  })
);

export const allTimeBrandLeaderboard = onchainTable(
  "all_time_brand_leaderboard",
  (t) => ({
    brandId: t.integer().primaryKey(),
    points: t.bigint().notNull().default(0n),
    goldCount: t.integer().notNull().default(0),
    silverCount: t.integer().notNull().default(0),
    bronzeCount: t.integer().notNull().default(0),
    totalVotes: t.integer().notNull().default(0),
    uniqueVoters: t.integer().notNull().default(0),
    rank: t.integer(),
    previousRank: t.integer(),
    rankChange: t.integer(),
    blockNumber: t.bigint().notNull(),
    updatedAt: t.bigint().notNull(),
  })
);

// User leaderboard
export const allTimeUserLeaderboard = onchainTable(
  "all_time_user_leaderboard",
  (t) => ({
    fid: t.integer().primaryKey(),
    points: t.bigint().notNull().default(0n),
    totalVotes: t.integer().notNull().default(0),
    totalPodiums: t.integer().notNull().default(0),
    currentStreak: t.integer().notNull().default(0),
    maxStreak: t.integer().notNull().default(0),
    rank: t.integer(),
    previousRank: t.integer(),
    rankChange: t.integer(),
    blockNumber: t.bigint().notNull(),
    updatedAt: t.bigint().notNull(),
  })
);

// ===== USER-SPECIFIC VIEWS =====

// User's voted brands rankings (for Profile > RANK tab)
export const userBrandRankings = onchainTable("user_brand_rankings", (t) => ({
  id: t.text().primaryKey(), // "fid-brandId"
  userFid: t.integer().notNull(),
  brandId: t.integer().notNull(),
  timesVoted: t.integer().notNull().default(1),
  timesVotedGold: t.integer().notNull().default(0),
  timesVotedSilver: t.integer().notNull().default(0),
  timesVotedBronze: t.integer().notNull().default(0),
  lastVotedDay: t.bigint(),
  totalPointsEarned: t.bigint().notNull().default(0n),
  updatedAt: t.bigint().notNull(),
}));

// ===== BRAND METRICS =====

// Brand daily performance metrics
export const brandDailyMetrics = onchainTable("brand_daily_metrics", (t) => ({
  id: t.text().primaryKey(), // "brandId-day"
  brandId: t.integer().notNull(),
  day: t.bigint().notNull(),
  totalVotes: t.integer().notNull().default(0),
  goldVotes: t.integer().notNull().default(0),
  silverVotes: t.integer().notNull().default(0),
  bronzeVotes: t.integer().notNull().default(0),
  uniqueVoters: t.integer().notNull().default(0),
  totalPoints: t.bigint().notNull().default(0n),
  averagePosition: t.integer(), // Weighted average: 1*gold + 2*silver + 3*bronze / totalVotes
  blockNumber: t.bigint().notNull(),
  updatedAt: t.bigint().notNull(),
}));

// ===== STAKING DATA (Optional for future use) =====

export const userStaking = onchainTable("user_staking", (t) => ({
  userFid: t.integer().primaryKey(),
  brndBalance: t.bigint().notNull().default(0n),
  stakedAmount: t.bigint().notNull().default(0n),
  lastUpdated: t.bigint().notNull(),
}));
