/**
 * Aylık Spark Sıfırlama Job
 * 
 * Her ayın son günü gece yarısında çalışır:
 * 1. Top 100 kullanıcıları belirle
 * 2. 10.000+ spark toplayan kullanıcıları belirle
 * 3. Ödül kazananlara etkinlik erişimi ver
 * 4. Leaderboard arşivini kaydet
 * 5. Tüm kullanıcıların monthlySparkCount'unu sıfırla
 */

import { prisma } from '../prisma';
import cron from 'node-cron';

// Ödül miktarları (TL cinsinden)
const REWARD_AMOUNTS: Record<number, number> = {
  1: 1000,  // 1. sıra: 1000 TL
  2: 500,   // 2. sıra: 500 TL
  3: 250,   // 3. sıra: 250 TL
};

// Etkinlik erişimi için minimum spark
const EVENT_ACCESS_MIN_SPARK = 10000;

// Top kaç kullanıcı etkinlik erişimi alacak
const TOP_N_EVENT_ACCESS = 100;

export async function runMonthlySparkReset(): Promise<{
  topUsers: number;
  highSparkUsers: number;
  eventAccessGranted: number;
  usersReset: number;
}> {
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-12
  const currentYear = now.getFullYear();

  console.log(`[MonthlyReset] Starting monthly spark reset for ${currentMonth}/${currentYear}`);

  try {
    // 1. Top 100 kullanıcıları al
    const topUsers = await prisma.user.findMany({
      where: {
        monthlySparksEarned: { gt: 0 },
      },
      select: {
        id: true,
        nickname: true,
        monthlySparksEarned: true,
      },
      orderBy: {
        monthlySparksEarned: 'desc',
      },
      take: TOP_N_EVENT_ACCESS,
    });

    console.log(`[MonthlyReset] Found ${topUsers.length} users in Top ${TOP_N_EVENT_ACCESS}`);

    // 2. 10.000+ spark toplayan kullanıcıları al (Top 100 dışında kalanlar)
    const highSparkUsers = await prisma.user.findMany({
      where: {
        monthlySparksEarned: { gte: EVENT_ACCESS_MIN_SPARK },
        id: { notIn: topUsers.map(u => u.id) },
      },
      select: {
        id: true,
        nickname: true,
        monthlySparksEarned: true,
      },
    });

    console.log(`[MonthlyReset] Found ${highSparkUsers.length} high spark users (${EVENT_ACCESS_MIN_SPARK}+)`);

    // 3. Leaderboard arşivini kaydet
    const leaderboardEntries = topUsers.map((user, index) => ({
      userId: user.id,
      month: currentMonth,
      year: currentYear,
      sparkCount: user.monthlySparksEarned,
      rank: index + 1,
      hasEventAccess: true,
    }));

    // High spark users da arşive ekle (rank 101+)
    highSparkUsers.forEach((user, index) => {
      leaderboardEntries.push({
        userId: user.id,
        month: currentMonth,
        year: currentYear,
        sparkCount: user.monthlySparksEarned,
        rank: TOP_N_EVENT_ACCESS + index + 1,
        hasEventAccess: true,
      });
    });

    // Arşivi kaydet (upsert)
    for (const entry of leaderboardEntries) {
      await prisma.monthlyLeaderboard.upsert({
        where: {
          userId_month_year: {
            userId: entry.userId,
            month: entry.month,
            year: entry.year,
          },
        },
        update: {
          sparkCount: entry.sparkCount,
          rank: entry.rank,
          hasEventAccess: entry.hasEventAccess,
        },
        create: entry,
      });
    }

    console.log(`[MonthlyReset] Saved ${leaderboardEntries.length} leaderboard entries`);

    // 4. Etkinlik erişimi ver
    const eligibleUserIds = [
      ...topUsers.map(u => u.id),
      ...highSparkUsers.map(u => u.id),
    ];

    const eventAccessExpiry = new Date();
    eventAccessExpiry.setMonth(eventAccessExpiry.getMonth() + 1); // 1 ay geçerli

    await prisma.user.updateMany({
      where: {
        id: { in: eligibleUserIds },
      },
      data: {
        hasEventAccess: true,
        eventAccessGrantedAt: now,
        eventAccessExpiresAt: eventAccessExpiry,
      },
    });

    console.log(`[MonthlyReset] Granted event access to ${eligibleUserIds.length} users`);

    // 5. Tüm kullanıcıların aylık spark'ını sıfırla
    const resetResult = await prisma.user.updateMany({
      where: {
        monthlySparksEarned: { gt: 0 },
      },
      data: {
        monthlySparksEarned: 0,
        monthlyResetAt: now,
      },
    });

    console.log(`[MonthlyReset] Reset monthly sparks for ${resetResult.count} users`);

    // Eski etkinlik erişimlerini kaldır (süresi dolanlar)
    await prisma.user.updateMany({
      where: {
        hasEventAccess: true,
        eventAccessExpiresAt: { lt: now },
      },
      data: {
        hasEventAccess: false,
      },
    });

    console.log(`[MonthlyReset] Monthly spark reset completed successfully`);

    return {
      topUsers: topUsers.length,
      highSparkUsers: highSparkUsers.length,
      eventAccessGranted: eligibleUserIds.length,
      usersReset: resetResult.count,
    };
  } catch (error) {
    console.error('[MonthlyReset] Error during monthly reset:', error);
    throw error;
  }
}

// Boost süresi dolan kullanıcıları temizle (saatlik)
export async function cleanupExpiredBoosts(): Promise<number> {
  const now = new Date();
  
  const result = await prisma.user.updateMany({
    where: {
      isBoostActive: true,
      boostExpiresAt: { lt: now },
    },
    data: {
      isBoostActive: false,
    },
  });

  if (result.count > 0) {
    console.log(`[BoostCleanup] Deactivated ${result.count} expired boosts`);
  }

  return result.count;
}

// Cron job'ları başlat
export function startCronJobs() {
  // Her ayın son günü gece yarısı (23:59)
  // Cron: "59 23 L * *" - L = last day of month (bazı cron kütüphaneleri desteklemiyor)
  // Alternatif: Her ayın 1'inde 00:01'de önceki ayı işle
  cron.schedule('1 0 1 * *', async () => {
    console.log('[Cron] Running monthly spark reset...');
    try {
      const result = await runMonthlySparkReset();
      console.log('[Cron] Monthly reset result:', result);
    } catch (error) {
      console.error('[Cron] Monthly reset failed:', error);
    }
  }, {
    timezone: 'Europe/Istanbul',
  });

  // Her saat başı expired boost'ları temizle
  cron.schedule('0 * * * *', async () => {
    await cleanupExpiredBoosts();
  }, {
    timezone: 'Europe/Istanbul',
  });

  console.log('[Cron] Cron jobs started:');
  console.log('  - Monthly spark reset: 1st of every month at 00:01 (Istanbul time)');
  console.log('  - Boost cleanup: Every hour');
}

export default {
  runMonthlySparkReset,
  cleanupExpiredBoosts,
  startCronJobs,
};
