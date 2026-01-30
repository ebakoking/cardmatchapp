import { Router, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { verifyJwt } from '../utils/jwt';

const router = Router();
const prisma = new PrismaClient();

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

// Claim reward schema
const claimRewardSchema = z.object({
  contactInfo: z.string().min(10).max(200), // IBAN veya iletişim bilgisi
});

// GET /api/rewards/eligibility - Kullanıcı ödül hak ediyor mu?
router.get('/eligibility', authMiddleware, async (req: any, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.userId;

    // Bu ayın başını hesapla
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // Kullanıcının bu ayki spark kazancını al
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        monthlySparksEarned: true,
        totalSparksEarned: true,
        nickname: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    }

    // Top 50'yi al ve kullanıcının sıralamasını bul
    const topUsers = await prisma.user.findMany({
      where: {
        monthlySparksEarned: { gt: 0 },
      },
      orderBy: {
        monthlySparksEarned: 'desc',
      },
      take: 50,
      select: {
        id: true,
        monthlySparksEarned: true,
      },
    });

    const rank = topUsers.findIndex((u) => u.id === userId) + 1;
    const isEligible = rank >= 1 && rank <= 3; // İlk 3 ödül alabilir

    // Bu ay için zaten talep oluşturmuş mu?
    const existingClaim = await prisma.rewardClaim.findFirst({
      where: {
        userId: userId,
        month: {
          gte: monthStart,
          lt: monthEnd,
        },
      },
    });

    const alreadyClaimed = !!existingClaim;

    // Ödül miktarları (örnek)
    const rewardAmounts: { [key: number]: number } = {
      1: 500,  // 1. sıra: 500 TL
      2: 300,  // 2. sıra: 300 TL
      3: 150,  // 3. sıra: 150 TL
    };

    res.json({
      isEligible,
      rank: rank > 0 ? rank : null,
      sparksEarned: user.monthlySparksEarned,
      rewardAmount: isEligible ? rewardAmounts[rank] : null,
      alreadyClaimed,
      claimStatus: existingClaim?.status || null,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/rewards/claim - Ödül talebi oluştur
router.post('/claim', authMiddleware, async (req: any, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.userId;
    const { contactInfo } = claimRewardSchema.parse(req.body);

    // Bu ayın başını hesapla
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // Sıralamasını kontrol et
    const topUsers = await prisma.user.findMany({
      where: {
        monthlySparksEarned: { gt: 0 },
      },
      orderBy: {
        monthlySparksEarned: 'desc',
      },
      take: 50,
      select: {
        id: true,
      },
    });

    const rank = topUsers.findIndex((u) => u.id === userId) + 1;

    if (rank < 1 || rank > 3) {
      return res.status(403).json({
        error: 'Ödül hakkı kazanmak için ilk 3 sırada olmanız gerekiyor.',
      });
    }

    // Bu ay için zaten talep oluşturmuş mu?
    const existingClaim = await prisma.rewardClaim.findFirst({
      where: {
        userId: userId,
        month: {
          gte: monthStart,
          lt: monthEnd,
        },
      },
    });

    if (existingClaim) {
      return res.status(400).json({
        error: 'Bu ay için zaten bir ödül talebi oluşturdunuz.',
        claimId: existingClaim.id,
        status: existingClaim.status,
      });
    }

    // Talep oluştur
    const claim = await prisma.rewardClaim.create({
      data: {
        userId: userId,
        month: monthStart,
        rank: rank,
        contactInfo: contactInfo,
        status: 'PENDING',
      },
    });

    console.log(`[Rewards] Claim created: User ${userId}, Rank ${rank}`);

    res.json({
      success: true,
      claimId: claim.id,
      rank: rank,
      status: 'PENDING',
      message: 'Ödül talebiniz başarıyla oluşturuldu. En kısa sürede sizinle iletişime geçeceğiz.',
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/rewards/my-claims - Kullanıcının tüm talepleri
router.get('/my-claims', authMiddleware, async (req: any, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.userId;

    const claims = await prisma.rewardClaim.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      claims: claims.map((c) => ({
        id: c.id,
        month: c.month,
        rank: c.rank,
        status: c.status,
        createdAt: c.createdAt,
        processedAt: c.processedAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
