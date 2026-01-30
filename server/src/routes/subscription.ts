import { Router } from 'express';
import { z } from 'zod';
import fetch from 'node-fetch';
import { prisma } from '../prisma';
import { validateBody } from '../utils/validation';
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

const validateSubscriptionSchema = z.object({
  receipt: z.string(),
  platform: z.enum(['ios', 'android']),
  productId: z.string(),
});

router.post(
  '/validate',
  authMiddleware,
  validateBody(validateSubscriptionSchema),
  async (req: any, res) => {
    const { receipt, platform, productId } =
      req.body as z.infer<typeof validateSubscriptionSchema>;

    // For production you should validate with Apple / Google or RevenueCat.
    // Here we assume a RevenueCat-style backend integration via webhook or direct API.

    const revenuecatApiKey = process.env.REVENUECAT_API_KEY;
    if (!revenuecatApiKey) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'REVENUECAT_CONFIG_MISSING',
          message: 'Abonelik doğrulama yapılandırılmamış.',
        },
      });
    }

    // Example call to RevenueCat / your validation service (pseudo, adjust to real endpoint)
    const response = await fetch(
      process.env.SUBSCRIPTION_VALIDATION_URL || '',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${revenuecatApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          receipt,
          platform,
          productId,
          userId: req.user.userId,
        }),
      },
    );

    if (!response.ok) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'SUBSCRIPTION_VALIDATION_FAILED',
          message: 'Abonelik doğrulanamadı.',
        },
      });
    }

    const body = (await response.json()) as {
      expiresAt: string;
      originalTransactionId: string;
      autoRenew: boolean;
    };

    const expiresAt = new Date(body.expiresAt);

    await prisma.plusSubscription.create({
      data: {
        userId: req.user.userId,
        productId,
        platform: platform === 'ios' ? 'IOS' : 'ANDROID',
        originalTransactionId: body.originalTransactionId,
        expiresAt,
        autoRenew: body.autoRenew,
      },
    });

    await prisma.user.update({
      where: { id: req.user.userId },
      data: {
        isPlus: true,
        plusExpiresAt: expiresAt,
      },
    });

    return res.json({ success: true });
  },
);

export default router;

