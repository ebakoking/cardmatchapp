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

// Token maliyetleri - YENİ SİSTEM
const TOKEN_COSTS = {
  audio: 5,   // Ses açma: 5 token
  voice: 5,   // Ses açma: 5 token
  photo: 20,  // Fotoğraf açma: 20 token
  video: 50,  // Video açma: 50 token
};

// Medya görüntüleme endpoint'i
// POST /api/messages/:messageId/view
router.post('/:messageId/view', authMiddleware, async (req: any, res) => {
  const { messageId } = req.params;
  const viewerId = req.user.userId;

  try {
    // Mesajı bul
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        chatSession: true,
      },
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        error: { code: 'MESSAGE_NOT_FOUND', message: 'Mesaj bulunamadı.' },
      });
    }

    // Medya mesajı değilse hata
    if (!message.mediaType || !message.mediaUrl) {
      return res.status(400).json({
        success: false,
        error: { code: 'NOT_MEDIA', message: 'Bu bir medya mesajı değil.' },
      });
    }

    // Kendi mesajını görüntülüyorsa ücretsiz
    if (message.senderId === viewerId) {
      return res.json({
        success: true,
        data: {
          mediaUrl: message.mediaUrl,
          cost: 0,
          wasFree: true,
        },
      });
    }

    // Zaten görüntülenmiş mi?
    if (message.viewedBy === viewerId) {
      return res.json({
        success: true,
        data: {
          mediaUrl: message.mediaUrl,
          cost: 0,
          wasFree: true,
          alreadyViewed: true,
        },
      });
    }

    const session = message.chatSession;
    const isUser1 = viewerId === session.user1Id;
    const mediaType = message.mediaType as 'photo' | 'video' | 'voice';
    const cost = TOKEN_COSTS[mediaType] || 5;

    // Ücretsiz hak kontrolü
    let freeFieldName: string;
    if (mediaType === 'photo') {
      freeFieldName = isUser1 ? 'user1FreePhotoUsed' : 'user2FreePhotoUsed';
    } else if (mediaType === 'video') {
      freeFieldName = isUser1 ? 'user1FreeVideoUsed' : 'user2FreeVideoUsed';
    } else {
      freeFieldName = isUser1 ? 'user1FreeVoiceUsed' : 'user2FreeVoiceUsed';
    }

    const isFreeAvailable = !(session as any)[freeFieldName];

    if (isFreeAvailable) {
      // Ücretsiz hakkı kullan
      await prisma.$transaction([
        prisma.chatSession.update({
          where: { id: session.id },
          data: { [freeFieldName]: true },
        }),
        prisma.message.update({
          where: { id: messageId },
          data: {
            viewedBy: viewerId,
            viewedAt: new Date(),
            wasFreeView: true,
          },
        }),
      ]);

      return res.json({
        success: true,
        data: {
          mediaUrl: message.mediaUrl,
          cost: 0,
          wasFree: true,
          message: 'Ücretsiz hakkınız kullanıldı!',
        },
      });
    }

    // Token gerekli - bakiye kontrolü
    const viewer = await prisma.user.findUnique({
      where: { id: viewerId },
    });

    if (!viewer || viewer.tokenBalance < cost) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_BALANCE',
          message: `Bu medyayı görmek için ${cost} token gerekli.`,
          required: cost,
          balance: viewer?.tokenBalance || 0,
        },
      });
    }

    // Token harcanır, gönderene SPARK kazandırılır (token gitmez!)
    await prisma.$transaction([
      // Görüntüleyenin bakiyesini düşür (token harcanır)
      prisma.user.update({
        where: { id: viewerId },
        data: { tokenBalance: { decrement: cost } },
      }),
      // Gönderene SPARK kazandır (tokenBalance değişmez!)
      prisma.user.update({
        where: { id: message.senderId },
        data: { 
          // tokenBalance: DEĞİŞMEZ - token gönderene gitmez
          monthlySparksEarned: { increment: cost },  // Spark kazanır (leaderboard için)
          totalSparksEarned: { increment: cost },    // Lifetime spark
        },
      }),
      // Mesajı görüntülendi olarak işaretle
      prisma.message.update({
        where: { id: messageId },
        data: {
          viewedBy: viewerId,
          viewedAt: new Date(),
          viewTokenCost: cost,
          wasFreeView: false,
        },
      }),
    ]);

    console.log(`[Messages] Media viewed: viewer=${viewerId} (-${cost} token), sender=${message.senderId} (+${cost} spark)`);

    return res.json({
      success: true,
      data: {
        mediaUrl: message.mediaUrl,
        cost,
        wasFree: false,
        newBalance: viewer.tokenBalance - cost,
      },
    });
  } catch (error) {
    console.error('[Messages] View error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'VIEW_FAILED', message: 'Medya görüntülenemedi.' },
    });
  }
});

// Mesajın ücretsiz hak durumunu kontrol et
router.get('/:messageId/view-status', authMiddleware, async (req: any, res) => {
  const { messageId } = req.params;
  const viewerId = req.user.userId;

  try {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: { chatSession: true },
    });

    if (!message || !message.mediaType) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Medya mesajı bulunamadı.' },
      });
    }

    // Kendi mesajı
    if (message.senderId === viewerId) {
      return res.json({
        success: true,
        data: { isFree: true, cost: 0, reason: 'own_message' },
      });
    }

    // Zaten görüntülenmiş
    if (message.viewedBy === viewerId) {
      return res.json({
        success: true,
        data: { isFree: true, cost: 0, reason: 'already_viewed' },
      });
    }

    const session = message.chatSession;
    const isUser1 = viewerId === session.user1Id;
    const mediaType = message.mediaType as 'photo' | 'video' | 'voice';
    const cost = TOKEN_COSTS[mediaType] || 5;

    let freeFieldName: string;
    if (mediaType === 'photo') {
      freeFieldName = isUser1 ? 'user1FreePhotoUsed' : 'user2FreePhotoUsed';
    } else if (mediaType === 'video') {
      freeFieldName = isUser1 ? 'user1FreeVideoUsed' : 'user2FreeVideoUsed';
    } else {
      freeFieldName = isUser1 ? 'user1FreeVoiceUsed' : 'user2FreeVoiceUsed';
    }

    const isFreeAvailable = !(session as any)[freeFieldName];

    return res.json({
      success: true,
      data: {
        isFree: isFreeAvailable,
        cost: isFreeAvailable ? 0 : cost,
        reason: isFreeAvailable ? 'free_view_available' : 'requires_tokens',
      },
    });
  } catch (error) {
    console.error('[Messages] View status error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'CHECK_FAILED', message: 'Durum kontrol edilemedi.' },
    });
  }
});

export default router;
