import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { verifyJwt } from '../utils/jwt';
import { validateBody } from '../utils/validation';
import { VerificationPose } from '@prisma/client';

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

const router = Router();

// Tüm pozlar
const ALL_POSES: VerificationPose[] = [
  'THUMBS_UP',
  'PEACE_SIGN',
  'WAVE_HAND',
  'POINT_UP',
  'OK_SIGN',
];

// Poz açıklamaları (Türkçe)
const POSE_DESCRIPTIONS: Record<VerificationPose, string> = {
  THUMBS_UP: 'Başparmağınızı yukarı kaldırın 👍',
  PEACE_SIGN: 'V işareti yapın ✌️',
  WAVE_HAND: 'El sallayın 👋',
  POINT_UP: 'Yukarı işaret edin ☝️',
  OK_SIGN: 'OK işareti yapın 👌',
};

// ============ KULLANICI ENDPOINT'LERİ ============

// GET /api/verification/status - Doğrulama durumunu al
router.get('/status', authMiddleware, async (req: any, res) => {
  const userId = req.user.userId;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      verified: true,
      verificationStatus: true,
    },
  });

  if (!user) {
    return res.status(404).json({
      success: false,
      error: { code: 'USER_NOT_FOUND', message: 'Kullanıcı bulunamadı' },
    });
  }

  // En son doğrulama isteğini bul
  const latestRequest = await prisma.verificationRequest.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  return res.json({
    success: true,
    data: {
      verified: user.verified,
      verificationStatus: user.verificationStatus,
      latestRequest: latestRequest
        ? {
            id: latestRequest.id,
            pose: latestRequest.pose,
            poseDescription: POSE_DESCRIPTIONS[latestRequest.pose],
            status: latestRequest.status,
            reviewNote: latestRequest.reviewNote,
            createdAt: latestRequest.createdAt,
            reviewedAt: latestRequest.reviewedAt,
          }
        : null,
    },
  });
});

// POST /api/verification/start - Doğrulama başlat (rastgele poz al)
router.post('/start', authMiddleware, async (req: any, res) => {
  const userId = req.user.userId;

  // Kullanıcı zaten doğrulanmış mı?
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { verified: true, verificationStatus: true },
  });

  if (!user) {
    return res.status(404).json({
      success: false,
      error: { code: 'USER_NOT_FOUND', message: 'Kullanıcı bulunamadı' },
    });
  }

  if (user.verified) {
    return res.status(400).json({
      success: false,
      error: { code: 'ALREADY_VERIFIED', message: 'Zaten doğrulanmış bir profiliniz var' },
    });
  }

  // Bekleyen bir istek var mı?
  const pendingRequest = await prisma.verificationRequest.findFirst({
    where: { userId, status: 'PENDING' },
  });

  if (pendingRequest) {
    return res.json({
      success: true,
      data: {
        requestId: pendingRequest.id,
        pose: pendingRequest.pose,
        poseDescription: POSE_DESCRIPTIONS[pendingRequest.pose],
        message: 'Bekleyen bir doğrulama isteğiniz var',
      },
    });
  }

  // Rastgele poz seç
  const randomPose = ALL_POSES[Math.floor(Math.random() * ALL_POSES.length)];

  return res.json({
    success: true,
    data: {
      pose: randomPose,
      poseDescription: POSE_DESCRIPTIONS[randomPose],
      message: 'Lütfen belirtilen pozu yaparak bir selfie çekin',
    },
  });
});

// POST /api/verification/submit - Selfie gönder
router.post(
  '/submit',
  authMiddleware,
  validateBody(
    z.object({
      pose: z.enum(['THUMBS_UP', 'PEACE_SIGN', 'WAVE_HAND', 'POINT_UP', 'OK_SIGN']),
      selfieUrl: z.string().url(),
    }),
  ),
  async (req: any, res) => {
    const userId = req.user.userId;
    const { pose, selfieUrl } = req.body;

    // Kullanıcı zaten doğrulanmış mı?
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { verified: true },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'Kullanıcı bulunamadı' },
      });
    }

    if (user.verified) {
      return res.status(400).json({
        success: false,
        error: { code: 'ALREADY_VERIFIED', message: 'Zaten doğrulanmış bir profiliniz var' },
      });
    }

    // Bekleyen istek var mı? (aynı kullanıcı tekrar gönderemez)
    const pendingRequest = await prisma.verificationRequest.findFirst({
      where: { userId, status: 'PENDING' },
    });

    if (pendingRequest) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'REQUEST_PENDING',
          message: 'Zaten bekleyen bir doğrulama isteğiniz var. Lütfen sonucu bekleyin.',
        },
      });
    }

    // Doğrulama isteği oluştur
    const request = await prisma.verificationRequest.create({
      data: {
        userId,
        pose: pose as VerificationPose,
        selfieUrl,
        status: 'PENDING',
      },
    });

    // Kullanıcının verificationStatus'unu PENDING yap
    await prisma.user.update({
      where: { id: userId },
      data: { verificationStatus: 'PENDING' },
    });

    return res.json({
      success: true,
      data: {
        requestId: request.id,
        message: 'Doğrulama isteğiniz alındı. Moderatör incelemesinden sonra bilgilendirileceksiniz.',
      },
    });
  },
);

export default router;
