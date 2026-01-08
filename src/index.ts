import { ponder } from "ponder:registry";
import { eq, desc, asc, and } from "ponder";
import {
  brands,
  votes,
  users,
  walletAuthorizations,
  rewardClaims,
  brandRewardWithdrawals,
  brndPowerLevelUps,
  individualVotes,
  topBrands,
  allTimeUserLeaderboard,
  dailyBrandLeaderboard,
  weeklyBrandLeaderboard,
  monthlyBrandLeaderboard,
  allTimeBrandLeaderboard,
  userBrandRankings,
  brandDailyMetrics,
  userStaking,
} from "../ponder.schema";

// ===== UTILITY FUNCTIONS =====

// Helper function to calculate day number from timestamp
const calculateDayNumber = (timestamp: bigint): bigint => {
  return timestamp / 86400n;
};

// Helper function to calculate day, week, and month timestamps
const getTimePeriods = (timestamp: bigint) => {
  const timestampSeconds = Number(timestamp);
  const date = new Date(timestampSeconds * 1000);

  // Day: midnight UTC (using day number for consistency)
  const dayNumber = calculateDayNumber(timestamp);
  const dayStart = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      0,
      0,
      0,
      0
    )
  );
  const day = BigInt(Math.floor(dayStart.getTime() / 1000));

  // Week: Friday 13:13 UTC
  const weekStart = new Date(date);
  const dayOfWeek = weekStart.getUTCDay();
  let daysToSubtract = 0;

  if (dayOfWeek === 5) {
    if (
      weekStart.getUTCHours() < 13 ||
      (weekStart.getUTCHours() === 13 && weekStart.getUTCMinutes() < 13)
    ) {
      daysToSubtract = 7;
    }
  } else if (dayOfWeek < 5) {
    daysToSubtract = dayOfWeek + 2;
  } else {
    daysToSubtract = 1;
  }

  weekStart.setUTCDate(weekStart.getUTCDate() - daysToSubtract);
  weekStart.setUTCHours(13, 13, 0, 0);
  const week = BigInt(Math.floor(weekStart.getTime() / 1000));

  // Month: first day of month at midnight UTC
  const monthStart = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0)
  );
  const month = BigInt(Math.floor(monthStart.getTime() / 1000));

  return { day, week, month };
};

// ===== COMPLEX UPDATE FUNCTIONS =====

// Update user engagement metrics and streaks
const updateUserEngagement = async (
  context: any,
  fid: number,
  pointsToAdd: bigint,
  block: any,
  transaction: any,
  votedBrandIds: number[]
) => {
  const timestamp = block.timestamp;
  const currentDay = Number(calculateDayNumber(timestamp));
  const previousDay = currentDay - 1;

  const existingUser = await context.db.find(users, { fid });

  if (existingUser) {
    // Calculate streak
    let newStreak = 1;
    if (existingUser.lastVoteDay === previousDay) {
      newStreak = existingUser.currentStreak + 1;
    } else if (existingUser.lastVoteDay === currentDay) {
      newStreak = existingUser.currentStreak; // Already voted today
    }

    // Calculate favorite brand (most voted)
    const userBrandCounts = await context.db.sql
      .select({
        brandId: userBrandRankings.brandId,
        timesVoted: userBrandRankings.timesVoted,
      })
      .from(userBrandRankings)
      .where(eq(userBrandRankings.userFid, fid))
      .orderBy(desc(userBrandRankings.timesVoted))
      .limit(1)
      .execute();

    const favoriteBrandId = userBrandCounts[0]?.brandId || null;

    // Get unique voted brands count
    const uniqueBrandsCount = await context.db.sql
      .select({ count: "COUNT(DISTINCT brandId)" })
      .from(userBrandRankings)
      .where(eq(userBrandRankings.userFid, fid))
      .execute();

    const votedBrandsCount = uniqueBrandsCount[0]?.count || 0;

    await context.db.update(users, { fid }).set({
      points: existingUser.points + pointsToAdd,
      totalVotes: existingUser.totalVotes + 1,
      totalPodiums: existingUser.totalPodiums + 1,
      currentStreak: newStreak,
      maxStreak: Math.max(existingUser.maxStreak, newStreak),
      lastVoteDay: currentDay,
      hasVotedToday: true,
      favoriteBrandId,
      votedBrandsCount: Number(votedBrandsCount),
      blockNumber: block.number,
      transactionHash: transaction.hash,
      lastUpdated: timestamp,
    });
  } else {
    // New user
    await context.db.insert(users).values({
      fid,
      brndPowerLevel: 0,
      totalVotes: 1,
      points: pointsToAdd,
      currentStreak: 1,
      maxStreak: 1,
      totalPodiums: 1,
      votedBrandsCount: votedBrandIds.length,
      lastVoteDay: currentDay,
      hasVotedToday: true,
      blockNumber: block.number,
      transactionHash: transaction.hash,
      lastUpdated: timestamp,
    });
  }
};

// Update brand metrics and rankings
const updateBrandMetrics = async (
  context: any,
  brandIds: number[],
  cost: bigint,
  block: any,
  transaction: any
) => {
  const timestamp = block.timestamp;
  const { day, week, month } = getTimePeriods(timestamp);

  const goldPoints = (cost * 60n) / 100n;
  const silverPoints = (cost * 30n) / 100n;
  const bronzePoints = (cost * 10n) / 100n;
  const points = [goldPoints, silverPoints, bronzePoints];
  const positions = ["gold", "silver", "bronze"] as const;

  for (let i = 0; i < brandIds.length && i < 3; i++) {
    const brandId = brandIds[i];
    if (brandId === undefined) continue;

    const pointsToAdd = points[i];
    const position = positions[i];
    if (pointsToAdd === undefined || position === undefined) continue;

    // Update brand totals
    const existingBrand = await context.db.find(brands, { id: brandId });
    if (existingBrand) {
      await context.db.update(brands, { id: brandId }).set({
        totalVotesReceived: existingBrand.totalVotesReceived + 1,
        totalBrndAwarded: existingBrand.totalBrndAwarded + pointsToAdd,
        availableBrnd: existingBrand.availableBrnd + pointsToAdd,
        lastUpdated: timestamp,
      });
    }

    // Update daily metrics
    const dailyMetricId = `${brandId}-${day}`;
    const existingDailyMetric = await context.db.find(brandDailyMetrics, {
      id: dailyMetricId,
    });

    if (existingDailyMetric) {
      const updateData: any = {
        totalVotes: existingDailyMetric.totalVotes + 1,
        totalPoints: existingDailyMetric.totalPoints + pointsToAdd,
        blockNumber: block.number,
        updatedAt: timestamp,
      };

      if (position === "gold")
        updateData.goldVotes = existingDailyMetric.goldVotes + 1;
      else if (position === "silver")
        updateData.silverVotes = existingDailyMetric.silverVotes + 1;
      else if (position === "bronze")
        updateData.bronzeVotes = existingDailyMetric.bronzeVotes + 1;

      await context.db
        .update(brandDailyMetrics, { id: dailyMetricId })
        .set(updateData);
    } else {
      await context.db.insert(brandDailyMetrics).values({
        id: dailyMetricId,
        brandId,
        day,
        totalVotes: 1,
        goldVotes: position === "gold" ? 1 : 0,
        silverVotes: position === "silver" ? 1 : 0,
        bronzeVotes: position === "bronze" ? 1 : 0,
        uniqueVoters: 1,
        totalPoints: pointsToAdd,
        blockNumber: block.number,
        updatedAt: timestamp,
      });
    }

    // Update leaderboard tables
    await updateBrandLeaderboards(
      context,
      brandId,
      pointsToAdd,
      position,
      day,
      week,
      month,
      block,
      transaction
    );
  }
};

// Update all brand leaderboard tables
const updateBrandLeaderboards = async (
  context: any,
  brandId: number,
  pointsToAdd: bigint,
  position: "gold" | "silver" | "bronze",
  day: bigint,
  week: bigint,
  month: bigint,
  block: any,
  transaction: any
) => {
  const timestamp = block.timestamp;

  // Daily leaderboard
  const dailyId = `${brandId}-${day}`;
  const existingDaily = await context.db.find(dailyBrandLeaderboard, {
    id: dailyId,
  });

  if (existingDaily) {
    const updateData: any = {
      points: existingDaily.points + pointsToAdd,
      totalVotes: existingDaily.totalVotes + 1,
      blockNumber: block.number,
      updatedAt: timestamp,
    };
    if (position === "gold") updateData.goldCount = existingDaily.goldCount + 1;
    else if (position === "silver")
      updateData.silverCount = existingDaily.silverCount + 1;
    else if (position === "bronze")
      updateData.bronzeCount = existingDaily.bronzeCount + 1;

    await context.db
      .update(dailyBrandLeaderboard, { id: dailyId })
      .set(updateData);
  } else {
    await context.db.insert(dailyBrandLeaderboard).values({
      id: dailyId,
      brandId,
      day,
      points: pointsToAdd,
      goldCount: position === "gold" ? 1 : 0,
      silverCount: position === "silver" ? 1 : 0,
      bronzeCount: position === "bronze" ? 1 : 0,
      totalVotes: 1,
      uniqueVoters: 1,
      blockNumber: block.number,
      updatedAt: timestamp,
    });
  }

  // Weekly leaderboard
  const weeklyId = `${brandId}-${week}`;
  const existingWeekly = await context.db.find(weeklyBrandLeaderboard, {
    id: weeklyId,
  });

  if (existingWeekly) {
    const updateData: any = {
      points: existingWeekly.points + pointsToAdd,
      totalVotes: existingWeekly.totalVotes + 1,
      blockNumber: block.number,
      updatedAt: timestamp,
    };
    if (position === "gold")
      updateData.goldCount = existingWeekly.goldCount + 1;
    else if (position === "silver")
      updateData.silverCount = existingWeekly.silverCount + 1;
    else if (position === "bronze")
      updateData.bronzeCount = existingWeekly.bronzeCount + 1;

    await context.db
      .update(weeklyBrandLeaderboard, { id: weeklyId })
      .set(updateData);
  } else {
    await context.db.insert(weeklyBrandLeaderboard).values({
      id: weeklyId,
      brandId,
      week,
      points: pointsToAdd,
      goldCount: position === "gold" ? 1 : 0,
      silverCount: position === "silver" ? 1 : 0,
      bronzeCount: position === "bronze" ? 1 : 0,
      totalVotes: 1,
      uniqueVoters: 1,
      blockNumber: block.number,
      updatedAt: timestamp,
    });
  }

  // Monthly leaderboard
  const monthlyId = `${brandId}-${month}`;
  const existingMonthly = await context.db.find(monthlyBrandLeaderboard, {
    id: monthlyId,
  });

  if (existingMonthly) {
    const updateData: any = {
      points: existingMonthly.points + pointsToAdd,
      totalVotes: existingMonthly.totalVotes + 1,
      blockNumber: block.number,
      updatedAt: timestamp,
    };
    if (position === "gold")
      updateData.goldCount = existingMonthly.goldCount + 1;
    else if (position === "silver")
      updateData.silverCount = existingMonthly.silverCount + 1;
    else if (position === "bronze")
      updateData.bronzeCount = existingMonthly.bronzeCount + 1;

    await context.db
      .update(monthlyBrandLeaderboard, { id: monthlyId })
      .set(updateData);
  } else {
    await context.db.insert(monthlyBrandLeaderboard).values({
      id: monthlyId,
      brandId,
      month,
      points: pointsToAdd,
      goldCount: position === "gold" ? 1 : 0,
      silverCount: position === "silver" ? 1 : 0,
      bronzeCount: position === "bronze" ? 1 : 0,
      totalVotes: 1,
      uniqueVoters: 1,
      blockNumber: block.number,
      updatedAt: timestamp,
    });
  }

  // All-time leaderboard
  const existingAllTime = await context.db.find(allTimeBrandLeaderboard, {
    brandId,
  });

  if (existingAllTime) {
    const updateData: any = {
      points: existingAllTime.points + pointsToAdd,
      totalVotes: existingAllTime.totalVotes + 1,
      blockNumber: block.number,
      updatedAt: timestamp,
    };
    if (position === "gold")
      updateData.goldCount = existingAllTime.goldCount + 1;
    else if (position === "silver")
      updateData.silverCount = existingAllTime.silverCount + 1;
    else if (position === "bronze")
      updateData.bronzeCount = existingAllTime.bronzeCount + 1;

    await context.db
      .update(allTimeBrandLeaderboard, { brandId })
      .set(updateData);
  } else {
    await context.db.insert(allTimeBrandLeaderboard).values({
      brandId,
      points: pointsToAdd,
      goldCount: position === "gold" ? 1 : 0,
      silverCount: position === "silver" ? 1 : 0,
      bronzeCount: position === "bronze" ? 1 : 0,
      totalVotes: 1,
      uniqueVoters: 1,
      blockNumber: block.number,
      updatedAt: timestamp,
    });
  }
};

// Update user-brand relationships
const updateUserBrandRankings = async (
  context: any,
  userFid: number,
  brandIds: number[],
  points: bigint[],
  timestamp: bigint
) => {
  const positions = ["gold", "silver", "bronze"] as const;

  for (let i = 0; i < brandIds.length && i < 3; i++) {
    const brandId = brandIds[i];
    const pointsToAdd = points[i];
    const position = positions[i];

    const userBrandId = `${userFid}-${brandId}`;
    const existing = await context.db.find(userBrandRankings, {
      id: userBrandId,
    });

    if (existing) {
      const updateData: any = {
        timesVoted: existing.timesVoted + 1,
        lastVotedDay: calculateDayNumber(timestamp),
        totalPointsEarned: existing.totalPointsEarned + pointsToAdd,
        updatedAt: timestamp,
      };

      if (position === "gold")
        updateData.timesVotedGold = existing.timesVotedGold + 1;
      else if (position === "silver")
        updateData.timesVotedSilver = existing.timesVotedSilver + 1;
      else if (position === "bronze")
        updateData.timesVotedBronze = existing.timesVotedBronze + 1;

      await context.db
        .update(userBrandRankings, { id: userBrandId })
        .set(updateData);
    } else {
      await context.db.insert(userBrandRankings).values({
        id: userBrandId,
        userFid,
        brandId,
        timesVoted: 1,
        timesVotedGold: position === "gold" ? 1 : 0,
        timesVotedSilver: position === "silver" ? 1 : 0,
        timesVotedBronze: position === "bronze" ? 1 : 0,
        lastVotedDay: calculateDayNumber(timestamp),
        totalPointsEarned: pointsToAdd,
        updatedAt: timestamp,
      });
    }
  }
};

// Update topBrands cache for landing page
const updateTopBrandsCache = async (context: any, timestamp: bigint) => {
  const { day, week, month } = getTimePeriods(timestamp);

  // Get top 3 daily brands
  const topDaily = await context.db.sql
    .select({
      brandId: dailyBrandLeaderboard.brandId,
      points: dailyBrandLeaderboard.points,
      totalVotes: dailyBrandLeaderboard.totalVotes,
      goldCount: dailyBrandLeaderboard.goldCount,
      silverCount: dailyBrandLeaderboard.silverCount,
      bronzeCount: dailyBrandLeaderboard.bronzeCount,
    })
    .from(dailyBrandLeaderboard)
    .where(eq(dailyBrandLeaderboard.day, day))
    .orderBy(desc(dailyBrandLeaderboard.points))
    .limit(3)
    .execute();

  // Update topBrands cache for daily
  for (let i = 0; i < topDaily.length; i++) {
    const brand = topDaily[i];
    if (!brand) continue;
    const cacheId = `daily-${i + 1}`;

    await context.db
      .insert(topBrands)
      .values({
        id: cacheId,
        timeframe: "daily",
        rank: i + 1,
        brandId: brand.brandId,
        points: brand.points,
        totalVotes: brand.totalVotes,
        goldCount: brand.goldCount,
        silverCount: brand.silverCount,
        bronzeCount: brand.bronzeCount,
        periodValue: day,
        updatedAt: timestamp,
      })
      .onConflictDoUpdate((existing: typeof topBrands.$inferInsert) => ({
        brandId: brand.brandId,
        points: brand.points,
        totalVotes: brand.totalVotes,
        goldCount: brand.goldCount,
        silverCount: brand.silverCount,
        bronzeCount: brand.bronzeCount,
        periodValue: day,
        updatedAt: timestamp,
      }));
  }

  // Get top 3 weekly brands
  const topWeekly = await context.db.sql
    .select({
      brandId: weeklyBrandLeaderboard.brandId,
      points: weeklyBrandLeaderboard.points,
      totalVotes: weeklyBrandLeaderboard.totalVotes,
      goldCount: weeklyBrandLeaderboard.goldCount,
      silverCount: weeklyBrandLeaderboard.silverCount,
      bronzeCount: weeklyBrandLeaderboard.bronzeCount,
    })
    .from(weeklyBrandLeaderboard)
    .where(eq(weeklyBrandLeaderboard.week, week))
    .orderBy(desc(weeklyBrandLeaderboard.points))
    .limit(3)
    .execute();

  // Update topBrands cache for weekly
  for (let i = 0; i < topWeekly.length; i++) {
    const brand = topWeekly[i];
    if (!brand) continue;
    const cacheId = `weekly-${i + 1}`;

    await context.db
      .insert(topBrands)
      .values({
        id: cacheId,
        timeframe: "weekly",
        rank: i + 1,
        brandId: brand.brandId,
        points: brand.points,
        totalVotes: brand.totalVotes,
        goldCount: brand.goldCount,
        silverCount: brand.silverCount,
        bronzeCount: brand.bronzeCount,
        periodValue: week,
        updatedAt: timestamp,
      })
      .onConflictDoUpdate((existing: typeof topBrands.$inferInsert) => ({
        brandId: brand.brandId,
        points: brand.points,
        totalVotes: brand.totalVotes,
        goldCount: brand.goldCount,
        silverCount: brand.silverCount,
        bronzeCount: brand.bronzeCount,
        periodValue: week,
        updatedAt: timestamp,
      }));
  }

  // Get top 3 monthly brands
  const topMonthly = await context.db.sql
    .select({
      brandId: monthlyBrandLeaderboard.brandId,
      points: monthlyBrandLeaderboard.points,
      totalVotes: monthlyBrandLeaderboard.totalVotes,
      goldCount: monthlyBrandLeaderboard.goldCount,
      silverCount: monthlyBrandLeaderboard.silverCount,
      bronzeCount: monthlyBrandLeaderboard.bronzeCount,
    })
    .from(monthlyBrandLeaderboard)
    .where(eq(monthlyBrandLeaderboard.month, month))
    .orderBy(desc(monthlyBrandLeaderboard.points))
    .limit(3)
    .execute();

  // Update topBrands cache for monthly
  for (let i = 0; i < topMonthly.length; i++) {
    const brand = topMonthly[i];
    if (!brand) continue;
    const cacheId = `monthly-${i + 1}`;

    await context.db
      .insert(topBrands)
      .values({
        id: cacheId,
        timeframe: "monthly",
        rank: i + 1,
        brandId: brand.brandId,
        points: brand.points,
        totalVotes: brand.totalVotes,
        goldCount: brand.goldCount,
        silverCount: brand.silverCount,
        bronzeCount: brand.bronzeCount,
        periodValue: month,
        updatedAt: timestamp,
      })
      .onConflictDoUpdate((existing: typeof topBrands.$inferInsert) => ({
        brandId: brand.brandId,
        points: brand.points,
        totalVotes: brand.totalVotes,
        goldCount: brand.goldCount,
        silverCount: brand.silverCount,
        bronzeCount: brand.bronzeCount,
        periodValue: month,
        updatedAt: timestamp,
      }));
  }

  // Get top 3 all-time brands
  const topAllTime = await context.db.sql
    .select({
      brandId: allTimeBrandLeaderboard.brandId,
      points: allTimeBrandLeaderboard.points,
      totalVotes: allTimeBrandLeaderboard.totalVotes,
      goldCount: allTimeBrandLeaderboard.goldCount,
      silverCount: allTimeBrandLeaderboard.silverCount,
      bronzeCount: allTimeBrandLeaderboard.bronzeCount,
    })
    .from(allTimeBrandLeaderboard)
    .orderBy(desc(allTimeBrandLeaderboard.points))
    .limit(3)
    .execute();

  // Update topBrands cache for all-time
  for (let i = 0; i < topAllTime.length; i++) {
    const brand = topAllTime[i];
    if (!brand) continue;
    const cacheId = `alltime-${i + 1}`;

    await context.db
      .insert(topBrands)
      .values({
        id: cacheId,
        timeframe: "alltime",
        rank: i + 1,
        brandId: brand.brandId,
        points: brand.points,
        totalVotes: brand.totalVotes,
        goldCount: brand.goldCount,
        silverCount: brand.silverCount,
        bronzeCount: brand.bronzeCount,
        periodValue: null,
        updatedAt: timestamp,
      })
      .onConflictDoUpdate((existing: typeof topBrands.$inferInsert) => ({
        brandId: brand.brandId,
        points: brand.points,
        totalVotes: brand.totalVotes,
        goldCount: brand.goldCount,
        silverCount: brand.silverCount,
        bronzeCount: brand.bronzeCount,
        periodValue: null,
        updatedAt: timestamp,
      }));
  }
};

// Update user leaderboard
const updateUserLeaderboard = async (
  context: any,
  fid: number,
  pointsToAdd: bigint,
  block: any,
  timestamp: bigint
) => {
  const existingUserLeaderboard = await context.db.find(
    allTimeUserLeaderboard,
    { fid }
  );

  if (existingUserLeaderboard) {
    await context.db.update(allTimeUserLeaderboard, { fid }).set({
      points: existingUserLeaderboard.points + pointsToAdd,
      totalVotes: existingUserLeaderboard.totalVotes + 1,
      totalPodiums: existingUserLeaderboard.totalPodiums + 1,
      blockNumber: block.number,
      updatedAt: timestamp,
    });
  } else {
    await context.db.insert(allTimeUserLeaderboard).values({
      fid,
      points: pointsToAdd,
      totalVotes: 1,
      totalPodiums: 1,
      currentStreak: 1,
      maxStreak: 1,
      blockNumber: block.number,
      updatedAt: timestamp,
    });
  }
};

// ===== EVENT HANDLERS =====

ponder.on("BRNDSEASON1:PodiumCreated", async ({ event, context }) => {
  const { voter, fid, brandIds, cost } = event.args;
  const { block, transaction } = event;

  const day = calculateDayNumber(block.timestamp);
  const voteId = transaction.hash;
  const brandIdsArray = Array.from(brandIds).map(Number);

  // Create main vote record
  const goldBrandId = brandIdsArray[0] ?? 0;
  const silverBrandId = brandIdsArray[1] ?? 0;
  const bronzeBrandId = brandIdsArray[2] ?? 0;

  await context.db.insert(votes).values({
    id: voteId,
    voter: voter.toLowerCase(),
    voterFid: Number(fid),
    day,
    goldBrandId,
    silverBrandId,
    bronzeBrandId,
    brandIds: JSON.stringify(brandIdsArray),
    cost,
    blockNumber: block.number,
    transactionHash: transaction.hash,
    timestamp: block.timestamp,
  });

  // Create individual vote records
  const goldPoints = (cost * 60n) / 100n;
  const silverPoints = (cost * 30n) / 100n;
  const bronzePoints = (cost * 10n) / 100n;
  const points = [goldPoints, silverPoints, bronzePoints];

  for (let i = 0; i < brandIdsArray.length && i < 3; i++) {
    const brandId = brandIdsArray[i];
    const pointsForPosition = points[i];
    if (brandId === undefined || pointsForPosition === undefined) continue;

    await context.db.insert(individualVotes).values({
      id: `${voteId}-${i + 1}`,
      voteId,
      voterFid: Number(fid),
      brandId,
      position: i + 1,
      points: pointsForPosition,
      day,
      timestamp: block.timestamp,
      blockNumber: block.number,
      transactionHash: transaction.hash,
    });
  }

  // Update all related data
  const totalUserPoints = 3n; // 3 points per vote for user

  await updateUserEngagement(
    context,
    Number(fid),
    totalUserPoints,
    block,
    transaction,
    brandIdsArray
  );
  await updateBrandMetrics(context, brandIdsArray, cost, block, transaction);
  await updateUserBrandRankings(
    context,
    Number(fid),
    brandIdsArray,
    points,
    block.timestamp
  );
  await updateUserLeaderboard(
    context,
    Number(fid),
    totalUserPoints,
    block,
    block.timestamp
  );
  await updateTopBrandsCache(context, block.timestamp);
});

ponder.on("BRNDSEASON1:BrandCreated", async ({ event, context }) => {
  const { brandId, handle, fid, walletAddress, createdAt } = event.args;
  const { block, transaction } = event;

  await context.db.insert(brands).values({
    id: Number(brandId),
    fid: Number(fid),
    walletAddress: walletAddress.toLowerCase(),
    handle,
    metadataHash: "",
    totalBrndAwarded: 0n,
    availableBrnd: 0n,
    createdAt,
    blockNumber: block.number,
    transactionHash: transaction.hash,
    lastUpdated: block.timestamp,
  });
});

ponder.on("BRNDSEASON1:BrandsCreated", async ({ event, context }) => {
  const { brandIds, handles, fids, walletAddresses, createdAt } = event.args;
  const { block, transaction } = event;

  const brandsToInsert = brandIds.map((brandId: number, index: number) => ({
    id: Number(brandId),
    fid: Number(fids[index]),
    walletAddress: walletAddresses[index]!.toLowerCase(),
    handle: handles[index] || "",
    metadataHash: "",
    totalBrndAwarded: 0n,
    availableBrnd: 0n,
    createdAt,
    blockNumber: block.number,
    transactionHash: transaction.hash,
    lastUpdated: block.timestamp,
  }));

  await context.db.insert(brands).values(brandsToInsert);
});

ponder.on("BRNDSEASON1:WalletAuthorized", async ({ event, context }) => {
  const { fid, wallet } = event.args;
  const { block, transaction } = event;

  const authId = transaction.hash;

  await context.db.insert(walletAuthorizations).values({
    id: authId,
    fid: Number(fid),
    wallet: wallet.toLowerCase(),
    blockNumber: block.number,
    transactionHash: transaction.hash,
    timestamp: block.timestamp,
  });
});

ponder.on("BRNDSEASON1:RewardClaimed", async ({ event, context }) => {
  const { recipient, fid, amount, castHash, caller } = event.args;
  const { block, transaction } = event;

  const day = calculateDayNumber(block.timestamp);
  const claimId = transaction.hash;

  await context.db.insert(rewardClaims).values({
    id: claimId,
    recipient: recipient.toLowerCase(),
    fid: Number(fid),
    amount,
    day,
    castHash,
    caller: caller.toLowerCase(),
    blockNumber: block.number,
    transactionHash: transaction.hash,
    timestamp: block.timestamp,
  });

  // Update vote record with claim info
  const existingVote = await context.db.sql
    .select()
    .from(votes)
    .where(and(eq(votes.voterFid, Number(fid)), eq(votes.day, day)))
    .limit(1)
    .execute();

  if (existingVote.length > 0 && existingVote[0]) {
    await context.db.update(votes, { id: existingVote[0].id }).set({
      claimedAt: block.timestamp,
      claimAmount: amount,
    });
  }

  // Award additional points for claiming
  const user = await context.db.find(users, { fid: Number(fid) });
  if (user) {
    const pointsToAdd = BigInt(user.brndPowerLevel * 3);
    await updateUserEngagement(
      context,
      Number(fid),
      pointsToAdd,
      block,
      transaction,
      []
    );
    await updateUserLeaderboard(
      context,
      Number(fid),
      pointsToAdd,
      block,
      block.timestamp
    );
  }
});

ponder.on("BRNDSEASON1:BrandRewardWithdrawn", async ({ event, context }) => {
  const { brandId, fid, amount } = event.args;
  const { block, transaction } = event;

  const withdrawalId = transaction.hash;

  await context.db.insert(brandRewardWithdrawals).values({
    id: withdrawalId,
    brandId: Number(brandId),
    fid: Number(fid),
    amount,
    blockNumber: block.number,
    transactionHash: transaction.hash,
    timestamp: block.timestamp,
  });

  // Update brand available balance
  const existingBrand = await context.db.find(brands, { id: Number(brandId) });
  if (existingBrand) {
    await context.db.update(brands, { id: Number(brandId) }).set({
      availableBrnd: existingBrand.availableBrnd - amount,
      lastUpdated: block.timestamp,
    });
  }
});

ponder.on("BRNDSEASON1:BrndPowerLevelUp", async ({ event, context }) => {
  const { fid, newLevel, wallet } = event.args;
  const { block, transaction } = event;

  const levelUpId = transaction.hash;

  await context.db.insert(brndPowerLevelUps).values({
    id: levelUpId,
    fid: Number(fid),
    newLevel: Number(newLevel),
    wallet: wallet.toLowerCase(),
    blockNumber: block.number,
    transactionHash: transaction.hash,
    timestamp: block.timestamp,
  });

  // Update user power level
  await context.db
    .insert(users)
    .values({
      fid: Number(fid),
      brndPowerLevel: Number(newLevel),
      totalVotes: 0,
      points: 0n,
      blockNumber: block.number,
      transactionHash: transaction.hash,
      lastUpdated: block.timestamp,
    })
    .onConflictDoUpdate((existing) => ({
      brndPowerLevel: Number(newLevel),
      blockNumber: block.number,
      transactionHash: transaction.hash,
      lastUpdated: block.timestamp,
    }));
});

ponder.on("BRNDSEASON1:BrandUpdated", async ({ event, context }) => {
  const { brandId, newMetadataHash, newFid, newWalletAddress } = event.args;
  const { block, transaction } = event;

  await context.db.update(brands, { id: Number(brandId) }).set({
    metadataHash: newMetadataHash,
    fid: Number(newFid),
    walletAddress: newWalletAddress.toLowerCase(),
    blockNumber: block.number,
    transactionHash: transaction.hash,
    lastUpdated: block.timestamp,
  });
});
