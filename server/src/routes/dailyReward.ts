import { Router } from 'express';
import { prisma } from '../prisma';
import { verifyJwt } from '../utils/jwt';
import { emitToUser } from '../socket/io';

const router = Router();

// Auth middleware
function authMiddleware(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Yetkisiz erişim' },
    });
  }
  const token = authHeader.slice(7);
  try {
    const payload = verifyJwt(token);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Geçersiz token' },
    });
  }
}

// Streak bazlı ödül tablosu
// İlk 7 gün: artan ödüller
// 7. günden sonra: her gün 5 elmas + her hafta tamamlandığında 50 elmas bonus
const STREAK_REWARDS = [
  { day: 1, tokens: 5, label: '1. Gün' },
  { day: 2, tokens: 10, label: '2. Gün' },
  { day: 3, tokens: 15, label: '3. Gün' },
  { day: 4, tokens: 20, label: '4. Gün' },
  { day: 5, tokens: 25, label: '5. Gün' },
  { day: 6, tokens: 30, label: '6. Gün' },
  { day: 7, tokens: 50, label: '7. Gün 🎉' }, // İlk hafta bonusu
];

// Haftalık bonus (7. günden sonra her hafta tamamlandığında)
const WEEKLY_BONUS = 50;
// Günlük sabit ödül (7. günden sonra)
const DAILY_REWARD_AFTER_7 = 5;
// Streak süresi (30 gün = 1 ay)
const STREAK_DURATION_DAYS = 30;

// Bugünün başlangıcını al (Türkiye saati)
function getTodayStart(): Date {
  const now = new Date();
  // Türkiye UTC+3
  const turkeyOffset = 3 * 60 * 60 * 1000;
  const turkeyNow = new Date(now.getTime() + turkeyOffset);
  turkeyNow.setUTCHours(0, 0, 0, 0);
  return new Date(turkeyNow.getTime() - turkeyOffset);
}

// Dünün başlangıcını al
function getYesterdayStart(): Date {
  const today = getTodayStart();
  return new Date(today.getTime() - 24 * 60 * 60 * 1000);
}

// GET /api/daily-reward/status - Günlük ödül durumunu kontrol et
router.get('/status', authMiddleware, async (req: any, res) => {
  try {
    const userId = req.user.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        lastDailyRewardAt: true,
        currentStreak: true,
        longestStreak: true,
        tokenBalance: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'Kullanıcı bulunamadı' },
      });
    }

    const todayStart = getTodayStart();
    const lastReward = user.lastDailyRewardAt;
    
    // Bugün zaten ödül aldı mı?
    const canClaim = !lastReward || new Date(lastReward) < todayStart;
    
    // Streak hesapla
    let currentStreak = user.currentStreak || 0;
    
    // Eğer dün ödül almadıysa streak sıfırlanır
    if (lastReward) {
      const yesterdayStart = getYesterdayStart();
      if (new Date(lastReward) < yesterdayStart) {
        currentStreak = 0; // Streak kırıldı
      }
    }
    
    // Sonraki ödül hesapla
    const nextDay = currentStreak + 1;
    let nextTokens = 0;
    let nextLabel = '';
    let isNextWeeklyBonus = false;

    if (nextDay <= 7) {
      // İlk 7 gün
      const reward = STREAK_REWARDS[nextDay - 1];
      nextTokens = reward.tokens;
      nextLabel = reward.label;
    } else if (nextDay > STREAK_DURATION_DAYS) {
      // 30 günü geçtiyse yeniden başla
      nextTokens = STREAK_REWARDS[0].tokens;
      nextLabel = '1. Gün (Yeni Döngü)';
    } else {
      // 7. günden sonra
      nextTokens = DAILY_REWARD_AFTER_7;
      nextLabel = `${nextDay}. Gün`;
      
      // Haftalık bonus günleri
      if (nextDay % 7 === 0) {
        nextTokens += WEEKLY_BONUS;
        isNextWeeklyBonus = true;
        nextLabel = `${nextDay}. Gün 🎉`;
      }
    }

    // Haftalık bonuslu günleri ekle (UI için)
    const weeklyBonusDays = [14, 21, 28];

    return res.json({
      success: true,
      data: {
        canClaim,
        currentStreak,
        longestStreak: user.longestStreak || 0,
        nextReward: {
          day: nextDay > STREAK_DURATION_DAYS ? 1 : nextDay,
          tokens: nextTokens,
          label: nextLabel,
          isWeeklyBonus: isNextWeeklyBonus,
        },
        allRewards: STREAK_REWARDS,
        weeklyBonusDays,
        weeklyBonus: WEEKLY_BONUS,
        dailyRewardAfter7: DAILY_REWARD_AFTER_7,
        streakDuration: STREAK_DURATION_DAYS,
        tokenBalance: user.tokenBalance,
      },
    });
  } catch (error) {
    console.error('[DailyReward] Status error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Bir hata oluştu' },
    });
  }
});

// POST /api/daily-reward/claim - Günlük ödülü al
router.post('/claim', authMiddleware, async (req: any, res) => {
  try {
    const userId = req.user.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        lastDailyRewardAt: true,
        currentStreak: true,
        longestStreak: true,
        tokenBalance: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'Kullanıcı bulunamadı' },
      });
    }

    const todayStart = getTodayStart();
    const lastReward = user.lastDailyRewardAt;

    // Bugün zaten ödül aldı mı?
    if (lastReward && new Date(lastReward) >= todayStart) {
      return res.status(400).json({
        success: false,
        error: { code: 'ALREADY_CLAIMED', message: 'Bugünkü ödülünü zaten aldın!' },
      });
    }

    // Streak hesapla
    let currentStreak = user.currentStreak || 0;
    
    if (lastReward) {
      const yesterdayStart = getYesterdayStart();
      if (new Date(lastReward) >= yesterdayStart) {
        // Dün ödül almış, streak devam ediyor
        currentStreak += 1;
      } else {
        // Streak kırıldı, yeniden başla
        currentStreak = 1;
      }
    } else {
      // İlk kez ödül alıyor
      currentStreak = 1;
    }

    // Streak 30 günü geçerse sıfırla (1 aylık döngü)
    if (currentStreak > STREAK_DURATION_DAYS) {
      currentStreak = 1;
    }

    // Ödül hesapla
    let tokensEarned = 0;
    let rewardLabel = '';
    let isWeeklyBonus = false;

    if (currentStreak <= 7) {
      // İlk 7 gün: artan ödüller
      const reward = STREAK_REWARDS[currentStreak - 1];
      tokensEarned = reward.tokens;
      rewardLabel = reward.label;
    } else {
      // 7. günden sonra: günlük 5 elmas
      tokensEarned = DAILY_REWARD_AFTER_7;
      rewardLabel = `${currentStreak}. Gün`;
      
      // Her hafta tamamlandığında (14, 21, 28. günler) bonus
      if (currentStreak % 7 === 0) {
        tokensEarned += WEEKLY_BONUS;
        isWeeklyBonus = true;
        rewardLabel = `${currentStreak}. Gün 🎉 Haftalık Bonus!`;
      }
    }

    // En uzun streak güncelle
    const newLongestStreak = Math.max(user.longestStreak || 0, currentStreak);

    // Veritabanını güncelle
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        lastDailyRewardAt: new Date(),
        currentStreak,
        longestStreak: newLongestStreak,
        tokenBalance: { increment: tokensEarned },
      },
      select: {
        tokenBalance: true,
        currentStreak: true,
        longestStreak: true,
      },
    });

    console.log(`[DailyReward] User ${userId} claimed ${tokensEarned} tokens (Day ${currentStreak}, Streak: ${currentStreak}, WeeklyBonus: ${isWeeklyBonus})`);

    // 🔔 Anlık bakiye güncellemesi için socket emit
    emitToUser(userId, 'token:earned', {
      amount: tokensEarned,
      newBalance: updatedUser.tokenBalance,
      reason: 'daily_reward',
    });

    return res.json({
      success: true,
      data: {
        tokensEarned,
        rewardDay: currentStreak,
        rewardLabel,
        currentStreak,
        longestStreak: updatedUser.longestStreak,
        newTokenBalance: updatedUser.tokenBalance,
        isWeeklyBonus,
        message: isWeeklyBonus 
          ? `🎉 ${tokensEarned} elmas kazandın! (Haftalık bonus dahil!)`
          : `🎉 ${tokensEarned} elmas kazandın!`,
      },
    });
  } catch (error) {
    console.error('[DailyReward] Claim error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Bir hata oluştu' },
    });
  }
});

export default router;
