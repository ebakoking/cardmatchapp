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

const purchaseSchema = z.object({
  receipt: z.string(),
  platform: z.enum(['ios', 'android']),
  productId: z.string(),
});

const giftSchema = z.object({
  toUserId: z.string(),
  amount: z.number().min(1).max(1000),
});

// Token hediye etme
router.post(
  '/gift',
  authMiddleware,
  validateBody(giftSchema),
  async (req: any, res) => {
    const { toUserId, amount } = req.body as z.infer<typeof giftSchema>;
    const fromUserId = req.user.userId;

    if (fromUserId === toUserId) {
      return res.status(400).json({
        success: false,
        error: { code: 'SELF_GIFT', message: 'Kendinize token gönderemezsiniz.' },
      });
    }

    try {
      // Transaction ile güvenli transfer
      const result = await prisma.$transaction(async (tx) => {
        // Gönderen kullanıcıyı kontrol et
        const sender = await tx.user.findUnique({
          where: { id: fromUserId },
        });

        if (!sender || sender.tokenBalance < amount) {
          throw new Error('INSUFFICIENT_BALANCE');
        }

        // Alıcı kullanıcıyı kontrol et
        const receiver = await tx.user.findUnique({
          where: { id: toUserId },
        });

        if (!receiver) {
          throw new Error('USER_NOT_FOUND');
        }

        // Gönderenin bakiyesini düşür
        await tx.user.update({
          where: { id: fromUserId },
          data: { tokenBalance: { decrement: amount } },
        });

        // Alıcının bakiyesini artır
        await tx.user.update({
          where: { id: toUserId },
          data: {
            tokenBalance: { increment: amount },
            monthlyTokensReceived: { increment: amount },
          },
        });

        // Gift kaydı oluştur
        const gift = await tx.gift.create({
          data: {
            fromUserId,
            toUserId,
            amount,
          },
        });

        return { gift, newBalance: sender.tokenBalance - amount };
      });

      return res.json({
        success: true,
        data: {
          giftId: result.gift.id,
          newBalance: result.newBalance,
        },
      });
    } catch (error: any) {
      if (error.message === 'INSUFFICIENT_BALANCE') {
        return res.status(400).json({
          success: false,
          error: { code: 'INSUFFICIENT_BALANCE', message: 'Yetersiz token bakiyesi.' },
        });
      }
      if (error.message === 'USER_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'Alıcı bulunamadı.' },
        });
      }
      console.error('[Tokens] Gift error:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'GIFT_FAILED', message: 'Token gönderilemedi.' },
      });
    }
  },
);

router.post(
  '/purchase',
  authMiddleware,
  validateBody(purchaseSchema),
  async (req: any, res) => {
    const { receipt, platform, productId } =
      req.body as z.infer<typeof purchaseSchema>;

    const validationUrl = process.env.TOKEN_PURCHASE_VALIDATION_URL || '';
    const apiKey = process.env.REVENUECAT_API_KEY;
    if (!validationUrl || !apiKey) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'TOKEN_VALIDATION_CONFIG_MISSING',
          message: 'Elmas satın alma doğrulama yapılandırılmamış.',
        },
      });
    }

    const response = await fetch(validationUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        receipt,
        platform,
        productId,
        userId: req.user.userId,
      }),
    });

    if (!response.ok) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'TOKEN_PURCHASE_VALIDATION_FAILED',
          message: 'Elmas satın alma doğrulanamadı.',
        },
      });
    }

    const body = (await response.json()) as {
      tokensGranted: number;
    };

    await prisma.tokenPurchase.create({
      data: {
        userId: req.user.userId,
        productId,
        platform: platform === 'ios' ? 'IOS' : 'ANDROID',
        receipt,
        tokensGranted: body.tokensGranted,
      },
    });

    await prisma.user.update({
      where: { id: req.user.userId },
      data: {
        tokenBalance: {
          increment: body.tokensGranted,
        },
      },
    });

    return res.json({ success: true });
  },
);

// TEST: Mock satın alma (development only)
router.post('/mock-purchase', authMiddleware, async (req: any, res) => {
  const { amount } = req.body;
  const userId = req.user.userId;

  if (!amount || amount <= 0 || amount > 10000) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_AMOUNT', message: 'Geçersiz miktar.' },
    });
  }

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { tokenBalance: { increment: amount } },
    });

    console.log(`[Tokens] Mock purchase: ${user.nickname} +${amount} tokens, new balance: ${user.tokenBalance}`);

    return res.json({
      success: true,
      data: {
        newBalance: user.tokenBalance,
        amount,
      },
    });
  } catch (error) {
    console.error('[Tokens] Mock purchase error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'PURCHASE_FAILED', message: 'Satın alma başarısız.' },
    });
  }
});

export default router;

