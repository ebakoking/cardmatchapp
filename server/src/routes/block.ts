import { Router, Request, Response, NextFunction } from 'express';
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

// Block user schema
const blockUserSchema = z.object({
  blockedUserId: z.string().uuid(),
  reason: z.string().optional(),
});

// POST /api/user/block - Block a user
router.post('/block', authMiddleware, async (req: any, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.userId;
    const { blockedUserId, reason } = blockUserSchema.parse(req.body);

    // Kendini engelleyemez
    if (userId === blockedUserId) {
      return res.status(400).json({ error: 'Kendinizi engelleyemezsiniz.' });
    }

    // Zaten engellenmiş mi kontrol et
    const existingBlock = await prisma.block.findUnique({
      where: {
        blockerUserId_blockedUserId: {
          blockerUserId: userId,
          blockedUserId: blockedUserId,
        },
      },
    });

    if (existingBlock) {
      return res.status(400).json({ error: 'Bu kullanıcı zaten engellenmiş.' });
    }

    // Block kaydı oluştur
    const block = await prisma.block.create({
      data: {
        blockerUserId: userId,
        blockedUserId: blockedUserId,
        reason: reason,
      },
    });

    // Arkadaşlık varsa sil
    await prisma.friendship.deleteMany({
      where: {
        OR: [
          { user1Id: userId, user2Id: blockedUserId },
          { user1Id: blockedUserId, user2Id: userId },
        ],
      },
    });

    // Bekleyen arkadaşlık isteklerini sil
    await prisma.friendRequest.deleteMany({
      where: {
        OR: [
          { fromUserId: userId, toUserId: blockedUserId },
          { fromUserId: blockedUserId, toUserId: userId },
        ],
      },
    });

    console.log(`Block: ${userId} -> ${blockedUserId}`);
    res.json({ success: true, blockId: block.id });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/user/block/:userId - Unblock a user
router.delete('/block/:userId', authMiddleware, async (req: any, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.userId;
    const blockedUserId = req.params.userId;

    const block = await prisma.block.findUnique({
      where: {
        blockerUserId_blockedUserId: {
          blockerUserId: userId,
          blockedUserId: blockedUserId,
        },
      },
    });

    if (!block) {
      return res.status(404).json({ error: 'Engelleme kaydı bulunamadı.' });
    }

    await prisma.block.delete({
      where: {
        id: block.id,
      },
    });

    console.log(`Unblock: ${userId} -> ${blockedUserId}`);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// GET /api/user/blocked - Get blocked users list
router.get('/blocked', authMiddleware, async (req: any, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.userId;

    const blockedUsers = await prisma.block.findMany({
      where: {
        blockerUserId: userId,
      },
      include: {
        blocked: {
          select: {
            id: true,
            nickname: true,
            avatarId: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json({
      blockedUsers: blockedUsers.map((b) => ({
        id: b.blockedUserId,
        nickname: b.blocked.nickname,
        avatarId: b.blocked.avatarId,
        blockedAt: b.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
