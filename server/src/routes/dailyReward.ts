import { Router } from 'express';
import { prisma } from '../prisma';
import { verifyJwt } from '../utils/jwt';

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
const STREAK_REWARDS = [
  { day: 1, tokens: 5, label: '1. Gün' },
  { day: 2, tokens: 10, label: '2. Gün' },
  { day: 3, tokens: 15, label: '3. Gün' },
  { day: 4, tokens: 20, label: '4. Gün' },
  { day: 5, tokens: 25, label: '5. Gün' },
  { day: 6, tokens: 30, label: '6. Gün' },
  { day: 7, tokens: 50, label: '7. Gün 🎉' }, // Haftalık bonus
];

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
    
    // Sonraki ödül (1-7 arası döngüsel)
    const nextRewardDay = (currentStreak % 7) + 1;
    const nextReward = STREAK_REWARDS[nextRewardDay - 1];

    return res.json({
      success: true,
      data: {
        canClaim,
        currentStreak,
        longestStreak: user.longestStreak || 0,
        nextReward: {
          day: nextRewardDay,
          tokens: nextReward.tokens,
          label: nextReward.label,
        },
        allRewards: STREAK_REWARDS,
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

    // 7 günden sonra döngü (1-7)
    const rewardDay = ((currentStreak - 1) % 7) + 1;
    const reward = STREAK_REWARDS[rewardDay - 1];
    const tokensEarned = reward.tokens;

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

    console.log(`[DailyReward] User ${userId} claimed ${tokensEarned} tokens (Day ${rewardDay}, Streak: ${currentStreak})`);

    return res.json({
      success: true,
      data: {
        tokensEarned,
        rewardDay,
        rewardLabel: reward.label,
        currentStreak,
        longestStreak: updatedUser.longestStreak,
        newTokenBalance: updatedUser.tokenBalance,
        message: `🎉 ${tokensEarned} elmas kazandın!`,
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
