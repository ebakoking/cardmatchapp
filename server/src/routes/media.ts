import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { verifyJwt } from '../utils/jwt';
import { getIO } from '../socket/io';

const router = Router();

// Auth middleware
interface AuthRequest extends Request {
  user?: { id: string; phoneNumber?: string };
}

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

// Elmas maliyetleri
const ELMAS_COSTS = {
  photo: 20,
  video: 50,
  voice: 5,
  audio: 5,
};

/**
 * POST /api/media/:messageId/unlock
 * Medya mesajını token ile aç
 */
router.post('/:messageId/unlock', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { messageId } = req.params;
    const userId = req.user!.id;

    console.log('[Media] Unlock request:', { messageId, userId });

    // 1. Mesajı bul
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        chatSession: true,
      },
    });

    if (!message) {
      console.log('[Media] Message not found:', messageId);
      return res.status(404).json({
        success: false,
        error: { code: 'MESSAGE_NOT_FOUND', message: 'Mesaj bulunamadı.' },
      });
    }

    // 2. Medya mesajı mı kontrol et
    if (!message.mediaUrl || !message.mediaType) {
      console.log('[Media] Not a media message:', messageId);
      return res.status(400).json({
        success: false,
        error: { code: 'NOT_MEDIA', message: 'Bu bir medya mesajı değil.' },
      });
    }

    // 3. Kendi mesajını açmaya çalışıyorsa (ücretsiz)
    if (message.senderId === userId) {
      console.log('[Media] Own message, free access');
      return res.json({
        success: true,
        data: {
          mediaUrl: message.mediaUrl,
          wasFree: true,
          newBalance: (await prisma.user.findUnique({ where: { id: userId } }))?.tokenBalance || 0,
        },
      });
    }

    // 4. Zaten açılmış mı kontrol et
    if (message.viewedBy === userId) {
      console.log('[Media] Already unlocked by this user');
      return res.json({
        success: true,
        data: {
          mediaUrl: message.mediaUrl,
          alreadyUnlocked: true,
          newBalance: (await prisma.user.findUnique({ where: { id: userId } }))?.tokenBalance || 0,
        },
      });
    }

    // 5. Tüm medya ÜCRETLİ - ilk ücretsiz hak kaldırıldı
    const mediaType = message.mediaType.toLowerCase();
    console.log('[Media] All media is PAID now, mediaType:', mediaType);

    // 6. Ücretli görüntüleme - maliyet hesapla
    const cost = ELMAS_COSTS[mediaType as keyof typeof ELMAS_COSTS] || ELMAS_COSTS.photo;
    
    // 7. Token kontrolü
    
    const viewer = await prisma.user.findUnique({ where: { id: userId } });
    
    if (!viewer || viewer.tokenBalance < cost) {
      console.log('[Media] Insufficient balance:', viewer?.tokenBalance, '<', cost);
      return res.status(400).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_ELMAS',
          message: `Yetersiz elmas. ${cost} elmas gerekiyor.`,
          required: cost,
          balance: viewer?.tokenBalance || 0,
        },
      });
    }

    // 8. Transaction: Token düş, Spark ekle, Mesajı işaretle
    console.log('[Media] Processing paid unlock:', { cost, viewerId: userId, senderId: message.senderId });

    const [updatedViewer, updatedSender] = await prisma.$transaction([
      // Görüntüleyenin bakiyesinden düş
      prisma.user.update({
        where: { id: userId },
        data: { tokenBalance: { decrement: cost } },
      }),
      // Gönderene SPARK ekle
      prisma.user.update({
        where: { id: message.senderId },
        data: {
          monthlySparksEarned: { increment: cost },
          totalSparksEarned: { increment: cost },
        },
      }),
      // Mesajı görüntülendi olarak işaretle
      prisma.message.update({
        where: { id: messageId },
        data: {
          viewedBy: userId,
          viewedAt: new Date(),
          viewTokenCost: cost,
          wasFreeView: false,
        },
      }),
      // SparkTransaction kaydet
      prisma.sparkTransaction.create({
        data: {
          fromUserId: userId,
          toUserId: message.senderId,
          amount: cost,
          reason: 'media_unlock',
        },
      }),
    ]);

    console.log('[Media] Unlock successful!', {
      viewerNewBalance: updatedViewer.tokenBalance,
      senderNewSparks: updatedSender.monthlySparksEarned,
    });

    // 9. Socket.IO ile bildirim gönder
    try {
      const io = getIO();
      
      // Görüntüleyene bakiye güncelleme
      io.to(userId).emit('token:spent', {
        amount: cost,
        newBalance: updatedViewer.tokenBalance,
        reason: 'media_unlock',
      });
      
      // Gönderene spark kazandı bildirimi
      io.to(message.senderId).emit('spark:earned', {
        amount: cost,
        monthlySparksEarned: updatedSender.monthlySparksEarned,
        totalSparksEarned: updatedSender.totalSparksEarned,
        reason: 'media_viewed',
        fromUserId: userId,
      });

      console.log('[Media] Socket notifications sent');
    } catch (socketError) {
      console.error('[Media] Socket notification error:', socketError);
      // Socket hatası response'u etkilemesin
    }

    // 10. Başarılı response
    return res.json({
      success: true,
      data: {
        mediaUrl: message.mediaUrl,
        wasFree: false,
        cost: cost,
        newBalance: updatedViewer.tokenBalance,
        senderSparkEarned: cost,
      },
    });

  } catch (error) {
    console.error('[Media] Unlock error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Bir hata oluştu.' },
    });
  }
});

/**
 * GET /api/media/:messageId/status
 * Mesaj durumunu kontrol et (açılmış mı, maliyet ne)
 */
router.get('/:messageId/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { messageId } = req.params;
    const userId = req.user!.id;

    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: { chatSession: true },
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        error: { code: 'MESSAGE_NOT_FOUND', message: 'Mesaj bulunamadı.' },
      });
    }

    const chatSession = message.chatSession;
    const isUser1 = chatSession.user1Id === userId;
    const mediaType = (message.mediaType || 'photo').toLowerCase();
    
    let isFreeAvailable = false;
    if (mediaType === 'photo') {
      isFreeAvailable = isUser1 ? !chatSession.user1FreePhotoUsed : !chatSession.user2FreePhotoUsed;
    } else if (mediaType === 'video') {
      isFreeAvailable = isUser1 ? !chatSession.user1FreeVideoUsed : !chatSession.user2FreeVideoUsed;
    } else if (mediaType === 'voice' || mediaType === 'audio') {
      isFreeAvailable = isUser1 ? !chatSession.user1FreeVoiceUsed : !chatSession.user2FreeVoiceUsed;
    }

    const cost = ELMAS_COSTS[mediaType as keyof typeof ELMAS_COSTS] || ELMAS_COSTS.photo;
    const isUnlocked = message.senderId === userId || message.viewedBy === userId;

    return res.json({
      success: true,
      data: {
        isUnlocked,
        isFreeAvailable,
        cost: isFreeAvailable ? 0 : cost,
        viewedAt: message.viewedAt,
        wasFreeView: message.wasFreeView,
      },
    });

  } catch (error) {
    console.error('[Media] Status error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Bir hata oluştu.' },
    });
  }
});

/**
 * POST /api/media/friend/:messageId/unlock
 * Arkadaş sohbetindeki medya mesajını token ile aç
 */
router.post('/friend/:messageId/unlock', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { messageId } = req.params;
    const userId = req.user!.id;

    console.log('[Media] Friend unlock request:', { messageId, userId });

    // 1. Mesajı bul
    const message = await prisma.friendChatMessage.findUnique({
      where: { id: messageId },
      include: {
        friendChat: {
          include: {
            friendship: true,
          },
        },
      },
    });

    if (!message) {
      console.log('[Media] Friend message not found:', messageId);
      return res.status(404).json({
        success: false,
        error: { code: 'MESSAGE_NOT_FOUND', message: 'Mesaj bulunamadı.' },
      });
    }

    // 2. Medya mesajı mı kontrol et
    if (!message.mediaUrl || !message.mediaType) {
      console.log('[Media] Not a media message:', messageId);
      return res.status(400).json({
        success: false,
        error: { code: 'NOT_MEDIA', message: 'Bu bir medya mesajı değil.' },
      });
    }

    // 3. Kendi mesajını açmaya çalışıyorsa (ücretsiz)
    if (message.senderId === userId) {
      console.log('[Media] Own message, free access');
      const user = await prisma.user.findUnique({ where: { id: userId } });
      return res.json({
        success: true,
        data: {
          mediaUrl: message.mediaUrl,
          wasFree: true,
          newBalance: user?.tokenBalance || 0,
        },
      });
    }

    // 4. Zaten okunmuş mu kontrol et (readAt varsa açılmış demek)
    if (message.readAt) {
      console.log('[Media] Already unlocked');
      const user = await prisma.user.findUnique({ where: { id: userId } });
      return res.json({
        success: true,
        data: {
          mediaUrl: message.mediaUrl,
          alreadyUnlocked: true,
          newBalance: user?.tokenBalance || 0,
        },
      });
    }

    // 5. Tüm medya ÜCRETLİ - ilk ücretsiz hak kaldırıldı
    const mediaType = message.mediaType.toLowerCase();
    console.log('[Media] All friend media is PAID now, mediaType:', mediaType);

    // 6. Medya maliyeti
    const cost = ELMAS_COSTS[mediaType as keyof typeof ELMAS_COSTS] || ELMAS_COSTS.photo;

    // 7. Ücretli görüntüleme - elmas kontrolü
    const viewer = await prisma.user.findUnique({ where: { id: userId } });
    
    if (!viewer || viewer.tokenBalance < cost) {
      console.log('[Media] Insufficient balance:', viewer?.tokenBalance, '<', cost);
      return res.status(400).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_ELMAS',
          message: `Yetersiz elmas. ${cost} elmas gerekiyor.`,
          required: cost,
          balance: viewer?.tokenBalance || 0,
        },
      });
    }

    // 9. Transaction: Token düş, Spark ekle, Mesajı işaretle
    console.log('[Media] Processing paid friend unlock:', { cost, viewerId: userId, senderId: message.senderId });

    // Arkadaş medyasında spark yarım (cost / 2)
    const sparkAmount = Math.floor(cost / 2);

    const [updatedViewer, updatedSender] = await prisma.$transaction([
      // Görüntüleyenin bakiyesinden düş
      prisma.user.update({
        where: { id: userId },
        data: { tokenBalance: { decrement: cost } },
      }),
      // Gönderene SPARK ekle (yarısı)
      prisma.user.update({
        where: { id: message.senderId },
        data: {
          monthlySparksEarned: { increment: sparkAmount },
          totalSparksEarned: { increment: sparkAmount },
        },
      }),
      // Mesajı okundu olarak işaretle
      prisma.friendChatMessage.update({
        where: { id: messageId },
        data: { readAt: new Date() },
      }),
      // SparkTransaction kaydet
      prisma.sparkTransaction.create({
        data: {
          fromUserId: userId,
          toUserId: message.senderId,
          amount: sparkAmount,
          reason: 'friend_media_unlock',
        },
      }),
    ]);

    console.log('[Media] Friend unlock successful!', {
      viewerNewBalance: updatedViewer.tokenBalance,
      senderNewSparks: updatedSender.monthlySparksEarned,
    });

    // 10. Socket.IO ile bildirim gönder
    try {
      const io = getIO();
      
      if (io) {
        // Görüntüleyene bakiye güncelleme
        io.to(userId).emit('token:spent', {
          amount: cost,
          newBalance: updatedViewer.tokenBalance,
          reason: 'friend_media_unlock',
        });
        
        // Gönderene spark kazandı bildirimi
        io.to(message.senderId).emit('spark:earned', {
          amount: sparkAmount,
          monthlySparksEarned: updatedSender.monthlySparksEarned,
          totalSparksEarned: updatedSender.totalSparksEarned,
          reason: 'friend_media_viewed',
          fromUserId: userId,
        });

        console.log('[Media] Socket notifications sent');
      }
    } catch (socketError) {
      console.error('[Media] Socket notification error:', socketError);
    }

    // 11. Başarılı response
    return res.json({
      success: true,
      data: {
        mediaUrl: message.mediaUrl,
        wasFree: false,
        cost: cost,
        newBalance: updatedViewer.tokenBalance,
        senderSparkEarned: sparkAmount,
      },
    });

  } catch (error) {
    console.error('[Media] Friend unlock error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Bir hata oluştu.' },
    });
  }
});

export default router;
