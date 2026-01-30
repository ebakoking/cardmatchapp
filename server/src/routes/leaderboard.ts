import { Router } from 'express';
import { prisma } from '../prisma';
import { verifyJwt } from '../utils/jwt';

const router = Router();

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

// Aylık liderlik tablosu - medya açılmasından kazanılan SPARKLAR
router.get('/', authMiddleware, async (req: any, res) => {
  const top50 = await prisma.user.findMany({
    where: {
      // Sadece en az 1 spark kazanmış kullanıcılar
      monthlySparksEarned: { gt: 0 },
    },
    select: {
      id: true,
      nickname: true,
      profilePhotos: {
        where: { order: 1 },
        take: 1,
      },
      monthlySparksEarned: true,
      totalSparksEarned: true,
      monthlyTokensReceived: true,
    },
    orderBy: {
      monthlySparksEarned: 'desc',
    },
    take: 50,
  });

  const formatted = top50.map((u) => ({
    id: u.id,
    nickname: u.nickname,
    profilePhoto: u.profilePhotos[0]?.url,
    monthlySparksEarned: u.monthlySparksEarned,
    totalSparksEarned: u.totalSparksEarned,
    monthlyTokensReceived: u.monthlyTokensReceived,
  }));

  return res.json({ success: true, data: formatted });
});

// Test için: Tüm kullanıcıları (spark kazanmamış olanlar dahil) göster
router.get('/all', authMiddleware, async (req: any, res) => {
  const all = await prisma.user.findMany({
    select: {
      id: true,
      nickname: true,
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
    profilePhoto: u.profilePhotos[0]?.url,
    monthlySparksEarned: u.monthlySparksEarned,
    totalSparksEarned: u.totalSparksEarned,
    tokenBalance: u.tokenBalance,
  }));

  return res.json({ success: true, data: formatted });
});

export default router;
