import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../prisma';
import { signJwt, verifyJwt } from '../utils/jwt';
import { validateBody } from '../utils/validation';

const router = Router();

function adminAuthMiddleware(req: any, res: any, next: any) {
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
    if (!payload.isAdmin) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Admin yetkisi gerekli' },
      });
    }
    req.admin = payload;
    next();
  } catch {
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Geçersiz token' },
    });
  }
}

// Login
router.post(
  '/login',
  validateBody(z.object({ email: z.string().email(), password: z.string() })),
  async (req, res) => {
    const { email, password } = req.body;

    const admin = await prisma.admin.findUnique({ where: { email } });
    if (!admin) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Geçersiz email veya şifre' },
      });
    }

    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Geçersiz email veya şifre' },
      });
    }

    const token = signJwt({
      userId: admin.id,
      phoneNumber: '',
      isAdmin: true,
    });

    return res.json({ success: true, token });
  },
);

// Dashboard stats
router.get('/stats', adminAuthMiddleware, async (req, res) => {
  const totalUsers = await prisma.user.count();
  const verifiedUsers = await prisma.user.count({ where: { verified: true } });
  const verifiedPercentage = totalUsers > 0 ? (verifiedUsers / totalUsers) * 100 : 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const matchesToday = await prisma.matchHistory.count({
    where: { matchedAt: { gte: today } },
  });

  const thisMonth = new Date();
  thisMonth.setDate(1);
  thisMonth.setHours(0, 0, 0, 0);
  const revenueThisMonth = await prisma.plusSubscription.count({
    where: { createdAt: { gte: thisMonth } },
  }) * 59.90; // Approximate revenue

  const pendingVerifications = await prisma.user.count({
    where: { verificationStatus: 'PENDING' },
  });

  const pendingReports = await prisma.report.count({
    where: { status: 'PENDING' },
  });

  const pendingRedeems = await prisma.redeemRequest.count({
    where: { status: 'PENDING' },
  });

  // Active sessions (simplified: count active chat sessions)
  const activeSessions = await prisma.chatSession.count({
    where: { endedAt: null },
  });

  // Daily active users (last 30 days)
  const dailyActiveUsers = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);

    const count = await prisma.user.count({
      where: {
        lastSeenAt: { gte: date, lt: nextDate },
      },
    });

    dailyActiveUsers.push({
      date: date.toISOString().split('T')[0],
      count,
    });
  }

  // New signups (last 30 days)
  const newSignups = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);

    const count = await prisma.user.count({
      where: {
        createdAt: { gte: date, lt: nextDate },
      },
    });

    newSignups.push({
      date: date.toISOString().split('T')[0],
      count,
    });
  }

  // Revenue over time (last 30 days)
  const revenueOverTime = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);

    const count = await prisma.plusSubscription.count({
      where: {
        createdAt: { gte: date, lt: nextDate },
      },
    });

    revenueOverTime.push({
      date: date.toISOString().split('T')[0],
      revenue: count * 59.90,
    });
  }

  return res.json({
    success: true,
    data: {
      totalUsers,
      verifiedUsers,
      verifiedPercentage: Math.round(verifiedPercentage * 100) / 100,
      activeSessions,
      matchesToday,
      revenueThisMonth,
      pendingVerifications,
      pendingReports,
      pendingRedeems,
      dailyActiveUsers,
      newSignups,
      revenueOverTime,
    },
  });
});

// Users
router.get('/users', adminAuthMiddleware, async (req, res) => {
  const { search, verified, isPlus, status } = req.query;

  const where: any = {};
  if (search) {
    where.nickname = { contains: search as string, mode: 'insensitive' };
  }
  if (verified === 'true') where.verified = true;
  if (verified === 'false') where.verified = false;
  if (isPlus === 'true') where.isPlus = true;
  if (isPlus === 'false') where.isPlus = false;
  if (status) where.status = status;

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      nickname: true,
      age: true,
      gender: true,
      verified: true,
      isPlus: true,
      status: true,
      tokenBalance: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return res.json({ success: true, data: users });
});

router.patch('/users/:id', adminAuthMiddleware, async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const user = await prisma.user.update({
    where: { id },
    data: updates,
  });

  return res.json({ success: true, data: user });
});

// Verifications
router.get('/verifications/pending', adminAuthMiddleware, async (req, res) => {
  const users = await prisma.user.findMany({
    where: { verificationStatus: 'PENDING' },
    include: {
      profilePhotos: true,
      verificationVideo: true,
    },
  });

  const verifications = users
    .filter((u) => u.VerificationVideo)
    .map((u) => ({
      id: u.id,
      userId: u.id,
      user: {
        nickname: u.nickname,
        age: u.age,
        profilePhotos: u.profilePhotos,
      },
      verificationVideoUrl: u.VerificationVideo!.url,
    }));

  return res.json({ success: true, data: verifications });
});

router.post('/verifications/:id/approve', adminAuthMiddleware, async (req, res) => {
  const { id } = req.params;

  await prisma.user.update({
    where: { id },
    data: {
      verified: true,
      verificationStatus: 'APPROVED',
    },
  });

  return res.json({ success: true });
});

router.post(
  '/verifications/:id/reject',
  adminAuthMiddleware,
  validateBody(z.object({ reason: z.string() })),
  async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;

    await prisma.user.update({
      where: { id },
      data: {
        verificationStatus: 'REJECTED',
      },
    });

    // TODO: Send push notification with reason

    return res.json({ success: true });
  },
);

// Reports
router.get('/reports', adminAuthMiddleware, async (req, res) => {
  const { status } = req.query;

  const where: any = {};
  if (status) where.status = status;

  const reports = await prisma.report.findMany({
    where,
    include: {
      reporter: { select: { nickname: true } },
      reported: { select: { nickname: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return res.json({ success: true, data: reports });
});

router.post(
  '/reports/:id/action',
  adminAuthMiddleware,
  validateBody(z.object({ action: z.enum(['unshadowban', 'ban', 'reviewed']) })),
  async (req, res) => {
    const { id } = req.params;
    const { action } = req.body;

    const report = await prisma.report.findUnique({
      where: { id },
      include: { reported: true },
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Report bulunamadı' },
      });
    }

    if (action === 'unshadowban') {
      await prisma.user.update({
        where: { id: report.reportedUserId },
        data: { status: 'ACTIVE' },
      });
    } else if (action === 'ban') {
      await prisma.user.update({
        where: { id: report.reportedUserId },
        data: { status: 'BANNED' },
      });
    }

    await prisma.report.update({
      where: { id },
      data: { status: action === 'reviewed' ? 'REVIEWED' : 'ACTIONED' },
    });

    return res.json({ success: true });
  },
);

// Redeems
router.get('/redeems', adminAuthMiddleware, async (req, res) => {
  const { status } = req.query;

  const where: any = {};
  if (status) where.status = status;

  const redeems = await prisma.redeemRequest.findMany({
    where,
    include: {
      user: { select: { nickname: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return res.json({ success: true, data: redeems });
});

router.post(
  '/redeems/:id/approve',
  adminAuthMiddleware,
  validateBody(z.object({ adminNote: z.string().optional() })),
  async (req, res) => {
    const { id } = req.params;
    const { adminNote } = req.body;

    const redeem = await prisma.redeemRequest.findUnique({ where: { id } });
    if (!redeem) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Redeem request bulunamadı' },
      });
    }

    await prisma.user.update({
      where: { id: redeem.userId },
      data: {
        tokenBalance: { decrement: redeem.requestedAmount },
      },
    });

    await prisma.redeemRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        adminNote,
        processedAt: new Date(),
      },
    });

    return res.json({ success: true });
  },
);

router.post(
  '/redeems/:id/reject',
  adminAuthMiddleware,
  validateBody(z.object({ reason: z.string() })),
  async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;

    await prisma.redeemRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        adminNote: reason,
        processedAt: new Date(),
      },
    });

    return res.json({ success: true });
  },
);

// Leaderboard
router.get('/leaderboard', adminAuthMiddleware, async (req, res) => {
  const top50 = await prisma.user.findMany({
    where: { verified: true },
    select: {
      id: true,
      nickname: true,
      profilePhotos: { where: { order: 1 }, take: 1 },
      monthlyTokensReceived: true,
    },
    orderBy: { monthlyTokensReceived: 'desc' },
    take: 50,
  });

  const formatted = top50.map((u) => ({
    id: u.id,
    nickname: u.nickname,
    profilePhoto: u.profilePhotos[0]?.url,
    monthlyTokensReceived: u.monthlyTokensReceived,
  }));

  return res.json({ success: true, data: formatted });
});

router.post('/leaderboard/reset', adminAuthMiddleware, async (req, res) => {
  await prisma.user.updateMany({
    data: { monthlyTokensReceived: 0 },
  });

  return res.json({ success: true });
});

export default router;
