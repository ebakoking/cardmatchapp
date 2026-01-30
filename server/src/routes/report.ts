import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient, ReportCategory } from '@prisma/client';
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

// Report user schema
const reportUserSchema = z.object({
  reportedUserId: z.string().uuid(),
  category: z.enum(['SPAM', 'HARASSMENT', 'FAKE_PROFILE', 'INAPPROPRIATE_CONTENT', 'OTHER']),
  description: z.string().max(500).optional(),
  sessionId: z.string().optional(),
});

// POST /api/user/report - Report a user
router.post('/report', authMiddleware, async (req: any, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.userId;
    const { reportedUserId, category, description, sessionId } = reportUserSchema.parse(req.body);

    // Kendini raporlayamaz
    if (userId === reportedUserId) {
      return res.status(400).json({ error: 'Kendinizi raporlayamazsınız.' });
    }

    // 24 saat içinde aynı kullanıcıyı raporlamış mı kontrol et
    const recentReport = await prisma.report.findFirst({
      where: {
        reporterUserId: userId,
        reportedUserId: reportedUserId,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Son 24 saat
        },
      },
    });

    if (recentReport) {
      return res.status(400).json({ error: 'Bu kullanıcıyı son 24 saat içinde zaten raporladınız.' });
    }

    // Rapor oluştur
    const report = await prisma.report.create({
      data: {
        reporterUserId: userId,
        reportedUserId: reportedUserId,
        category: category as ReportCategory,
        description: description,
        sessionId: sessionId,
      },
    });

    // Raporlanan kullanıcının rapor sayısını artır
    await prisma.user.update({
      where: { id: reportedUserId },
      data: {
        reportCount: { increment: 1 },
      },
    });

    // Eğer rapor sayısı 5'i geçtiyse shadowban yap
    const reportedUser = await prisma.user.findUnique({
      where: { id: reportedUserId },
      select: { reportCount: true },
    });

    if (reportedUser && reportedUser.reportCount >= 5) {
      await prisma.user.update({
        where: { id: reportedUserId },
        data: { status: 'SHADOWBANNED' },
      });
      console.log(`User ${reportedUserId} shadowbanned due to report count: ${reportedUser.reportCount}`);
    }

    console.log(`Report: ${userId} -> ${reportedUserId} (${category})`);
    res.json({ success: true, reportId: report.id });
  } catch (error) {
    next(error);
  }
});

// GET /api/user/my-reports - Get user's submitted reports (optional)
router.get('/my-reports', authMiddleware, async (req: any, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.userId;

    const reports = await prisma.report.findMany({
      where: {
        reporterUserId: userId,
      },
      include: {
        reported: {
          select: {
            id: true,
            nickname: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20,
    });

    res.json({
      reports: reports.map((r) => ({
        id: r.id,
        reportedUser: r.reported.nickname,
        category: r.category,
        status: r.status,
        createdAt: r.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
