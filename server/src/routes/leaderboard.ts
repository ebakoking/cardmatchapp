import { Router } from 'express';
import { prisma } from '../prisma';
import { verifyJwt } from '../utils/jwt';

const router = Router();

// Ödül miktarları (TL cinsinden)
const REWARD_AMOUNTS: Record<number, number> = {
  1: 1000,  // 1. sıra: 1000 TL
  2: 500,   // 2. sıra: 500 TL
  3: 250,   // 3. sıra: 250 TL
};

// Etkinlik erişimi için minimum spark (100.000 spark = yaklaşık 90.000 TL gelir)
const EVENT_ACCESS_MIN_SPARK = 100000;

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

// Aylık liderlik tablosu - Top 100 + Kullanıcı sırası
router.get('/', authMiddleware, async (req: any, res) => {
  try {
    const currentUserId = req.user.userId;

    // Top 100 kullanıcıyı çek
    const top100 = await prisma.user.findMany({
      where: {
        monthlySparksEarned: { gt: 0 },
      },
      select: {
        id: true,
        nickname: true,
        avatarId: true,
        isPrime: true,
        isPlus: true,
        profilePhotoUrl: true,
        profilePhotos: {
          where: { order: 1 },
          take: 1,
        },
        monthlySparksEarned: true,
        totalSparksEarned: true,
        isBoostActive: true,
      },
      orderBy: {
        monthlySparksEarned: 'desc',
      },
      take: 100,
    });

    const formatted = top100.map((u, index) => ({
      id: u.id,
      nickname: u.nickname,
      avatarId: u.avatarId,
      isPrime: u.isPrime,
      isPlus: u.isPlus,
      isBoostActive: u.isBoostActive,
      // SADECE Prime kullanıcılar için profilePhotoUrl kullan, yoksa avatar gösterilir
      profilePhoto: u.isPrime && u.profilePhotoUrl 
        ? u.profilePhotoUrl 
        : null,
      monthlySparksEarned: u.monthlySparksEarned,
      totalSparksEarned: u.totalSparksEarned,
      rank: index + 1,
      reward: REWARD_AMOUNTS[index + 1] || null,
    }));

    // Mevcut kullanıcının bilgileri
    const currentUser = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: {
        id: true,
        nickname: true,
        avatarId: true,
        monthlySparksEarned: true,
        totalSparksEarned: true,
        hasEventAccess: true,
        eventAccessGrantedAt: true,
      },
    });

    // Kullanıcının sırasını bul (tüm spark sahipleri arasında)
    let userRank = null;
    if (currentUser && currentUser.monthlySparksEarned > 0) {
      const usersAbove = await prisma.user.count({
        where: {
          monthlySparksEarned: { gt: currentUser.monthlySparksEarned },
        },
      });
      userRank = usersAbove + 1;
    }

    // Top 3'e girmek için gereken spark
    const sparkForTop3 = top100.length >= 3 
      ? top100[2].monthlySparksEarned - (currentUser?.monthlySparksEarned || 0) + 1 
      : 0;

    // Etkinlik erişimi için gereken spark
    const sparkForEventAccess = Math.max(0, EVENT_ACCESS_MIN_SPARK - (currentUser?.monthlySparksEarned || 0));

    return res.json({ 
      success: true, 
      data: {
        topUsers: formatted,
        currentUser: currentUser ? {
          id: currentUser.id,
          nickname: currentUser.nickname,
          avatarId: currentUser.avatarId,
          monthlySparksEarned: currentUser.monthlySparksEarned,
          totalSparksEarned: currentUser.totalSparksEarned,
          rank: userRank,
          hasEventAccess: currentUser.hasEventAccess,
          eventAccessGrantedAt: currentUser.eventAccessGrantedAt,
        } : null,
        goals: {
          sparkForTop3: Math.max(0, sparkForTop3),
          sparkForEventAccess,
          eventAccessMinSpark: EVENT_ACCESS_MIN_SPARK,
        },
        totalParticipants: await prisma.user.count({
          where: { monthlySparksEarned: { gt: 0 } },
        }),
      },
    });
  } catch (error) {
    console.error('Leaderboard error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Sunucu hatası' },
    });
  }
});

// Test için: Tüm kullanıcıları (spark kazanmamış olanlar dahil) göster
router.get('/all', authMiddleware, async (req: any, res) => {
  const all = await prisma.user.findMany({
    select: {
      id: true,
      nickname: true,
      avatarId: true,
      isPrime: true,
      profilePhotoUrl: true,
      profilePhotos: {
        where: { order: 1 },
        take: 1,
      },
      monthlySparksEarned: true,
      totalSparksEarned: true,
      tokenBalance: true,
    },
    orderBy: {
      monthlySparksEarned: 'desc',
    },
    take: 50,
  });

  const formatted = all.map((u) => ({
    id: u.id,
    nickname: u.nickname,
    avatarId: u.avatarId,
    profilePhoto: u.isPrime && u.profilePhotoUrl 
      ? u.profilePhotoUrl 
      : u.profilePhotos[0]?.url || null,
    monthlySparksEarned: u.monthlySparksEarned,
    totalSparksEarned: u.totalSparksEarned,
    tokenBalance: u.tokenBalance,
  }));

  return res.json({ success: true, data: formatted });
});

export default router;
