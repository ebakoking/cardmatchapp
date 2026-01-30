import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '../prisma';
import { validateBody } from '../utils/validation';
import { verifyJwt } from '../utils/jwt';
import { saveVerificationVideo } from '../services/verification';

const router = Router();
const upload = multer();

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

const updateProfileSchema = z.object({
  nickname: z.string().min(3).max(20).optional(),
  age: z.number().int().min(18).max(99).optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  interestedIn: z.enum(['MALE', 'FEMALE', 'BOTH']).optional(),
  bio: z.string().max(150).optional().nullable(),
  city: z.string().min(1).optional(),
  country: z.string().min(1).optional(),
  // Prime filtre ayarları
  filterMinAge: z.number().int().min(18).max(99).optional(),
  filterMaxAge: z.number().int().min(18).max(99).optional(),
  filterMaxDistance: z.number().int().min(0).max(500).optional(),
  filterGender: z.enum(['MALE', 'FEMALE', 'OTHER', 'BOTH']).optional(),
  // Profil kurulum alanları
  birthDate: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

router.get('/me', authMiddleware, async (req: any, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    include: { profilePhotos: true },
  });

  return res.json({ success: true, data: user });
});

router.put(
  '/me',
  authMiddleware,
  validateBody(updateProfileSchema),
  async (req: any, res) => {
    const data = req.body as z.infer<typeof updateProfileSchema>;
    
    // DEBUG: Gelen verileri logla
    console.log('[User Update] Received data:', JSON.stringify(data, null, 2));
    console.log('[User Update] Gender value:', data.gender);

    // Check nickname uniqueness (only if nickname is being updated)
    if (data.nickname) {
      const existing = await prisma.user.findFirst({
        where: {
          nickname: data.nickname,
          id: { not: req.user.userId },
        },
      });
      if (existing) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'NICKNAME_TAKEN',
            message: 'Bu kullanıcı adı zaten kullanılıyor.',
          },
        });
      }
    }

    // birthDate string'i Date'e çevir
    const updateData: any = { ...data };
    if (data.birthDate) {
      updateData.birthDate = new Date(data.birthDate);
    }

    const user = await prisma.user.update({
      where: { id: req.user.userId },
      data: updateData,
    });

    return res.json({ success: true, data: user });
  },
);

// Token satın alma (simülasyon - gerçek IAP entegrasyonu için güncellenmeli)
router.post('/purchase-tokens', authMiddleware, async (req: any, res) => {
  try {
    const userId = req.user.userId;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_AMOUNT', message: 'Geçersiz miktar' },
      });
    }

    // Kullanıcının bakiyesini güncelle
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        tokenBalance: { increment: amount },
      },
    });

    console.log(`[User] User ${userId} purchased ${amount} tokens. New balance: ${updatedUser.tokenBalance}`);
    
    return res.json({
      success: true,
      data: {
        newBalance: updatedUser.tokenBalance,
        purchasedAmount: amount,
      },
    });
  } catch (error) {
    console.error('[User] Token purchase error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'PURCHASE_ERROR', message: 'Satın alma başarısız' },
    });
  }
});

// Logout - kullanıcıyı offline yap
router.post('/logout', authMiddleware, async (req: any, res) => {
  try {
    const userId = req.user.userId;
    
    await prisma.user.update({
      where: { id: userId },
      data: {
        isOnline: false,
        lastSeenAt: new Date(),
      },
    });

    console.log(`[User] User ${userId} logged out and marked offline`);
    return res.json({ success: true });
  } catch (error) {
    console.error('[User] Logout error:', error);
    return res.status(500).json({ 
      success: false, 
      error: { code: 'LOGOUT_ERROR', message: 'Çıkış yapılamadı' } 
    });
  }
});

// Profile photo upload (simple local/S3 URL)
router.post(
  '/me/photos',
  authMiddleware,
  upload.single('photo'),
  async (req: any, res) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_FILE', message: 'Fotoğraf yüklenmedi' },
      });
    }

    const userId = req.user.userId as string;

    const count = await prisma.photo.count({ where: { userId } });
    if (count >= 6) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MAX_PHOTOS',
          message: 'En fazla 6 fotoğraf yükleyebilirsiniz.',
        },
      });
    }

    // For MVP, we store a local path; S3 integration can reuse verification service as needed.
    const key = `profile-photos/${userId}-${Date.now()}.jpg`;
    const url = `/uploads/${key}`;

    const photo = await prisma.photo.create({
      data: {
        userId,
        url,
        order: count + 1,
      },
    });

    return res.json({ success: true, data: photo });
  },
);

// Verification video upload
router.post(
  '/me/verification-video',
  authMiddleware,
  upload.single('video'),
  async (req: any, res) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_FILE', message: 'Video yüklenmedi' },
      });
    }

    const userId = req.user.userId as string;
    const url = await saveVerificationVideo(
      userId,
      req.file.buffer,
      req.file.mimetype,
    );

    return res.json({
      success: true,
      data: { url },
    });
  },
);

// Check nickname availability
router.get('/check-nickname', authMiddleware, async (req: any, res) => {
  const { nickname } = req.query;
  if (!nickname || typeof nickname !== 'string') {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'Nickname gerekli' },
    });
  }

  const existing = await prisma.user.findFirst({
    where: {
      nickname,
      id: { not: req.user.userId },
    },
  });

  return res.json({ success: true, available: !existing });
});

// Get friends list
router.get('/friends', authMiddleware, async (req: any, res) => {
  const userId = req.user.userId;

  const friendships = await prisma.friendship.findMany({
    where: {
      OR: [{ user1Id: userId }, { user2Id: userId }],
    },
    include: {
      user1: {
        include: { profilePhotos: true },
      },
      user2: {
        include: { profilePhotos: true },
      },
      friendChats: true, // Çoğul - array döner
    },
  });

  const friendsMap = new Map<string, any>();
  
  // Her arkadaşlık için okunmamış mesaj sayısını hesapla
  for (const f of friendships) {
    const friend = f.user1Id === userId ? f.user2 : f.user1;
    
    // Mükerrer engelleme - aynı kullanıcı id'si varsa atla
    if (friendsMap.has(friend.id)) continue;

    // Okunmamış mesaj sayısını hesapla (benim göndermediğim ve okunmamış mesajlar)
    let unreadCount = 0;
    let lastMessage = null;
    let hasIncomingCall = false;

    // friendChats array'inin ilk elemanını al (normalde tek eleman olmalı)
    const friendChat = f.friendChats[0];
    
    if (friendChat) {
      // Okunmamış mesajları say
      unreadCount = await prisma.friendChatMessage.count({
        where: {
          friendChatId: friendChat.id,
          senderId: { not: userId }, // Benim göndermediğim mesajlar
          readAt: null, // Okunmamış
        },
      });

      // Son mesajı al
      const lastMsg = await prisma.friendChatMessage.findFirst({
        where: { friendChatId: friendChat.id },
        orderBy: { createdAt: 'desc' },
      });
      
      if (lastMsg) {
        lastMessage = {
          content: lastMsg.content,
          mediaType: lastMsg.mediaType,
          senderId: lastMsg.senderId,
          createdAt: lastMsg.createdAt,
        };
      }
    }

    friendsMap.set(friend.id, {
      friendshipId: f.id,
      id: friend.id,
      nickname: friend.nickname,
      avatarId: friend.avatarId,
      profilePhoto: friend.profilePhotos[0]?.url,
      isOnline: friend.isOnline,
      isPrime: friend.isPrime,
      lastSeenAt: friend.lastSeenAt,
      unreadCount,
      lastMessage,
      hasIncomingCall,
    });
  }

  const friends = Array.from(friendsMap.values());

  // Sıralama: Çevrimiçi olanlar üstte, çevrimdışı olanlar son görülme zamanına göre
  friends.sort((a, b) => {
    // Önce online durumuna göre sırala
    if (a.isOnline && !b.isOnline) return -1;
    if (!a.isOnline && b.isOnline) return 1;
    
    // İkisi de online veya ikisi de offline ise lastSeenAt'e göre sırala
    const aTime = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0;
    const bTime = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0;
    return bTime - aTime; // En son görülen önce
  });

  return res.json({ success: true, data: friends });
});

// Get pending friend requests (received)
router.get('/friend-requests', authMiddleware, async (req: any, res) => {
  const userId = req.user.userId;

  const requests = await prisma.friendRequest.findMany({
    where: {
      toUserId: userId,
      status: 'PENDING',
    },
    include: {
      fromUser: {
        select: {
          id: true,
          nickname: true,
          avatarId: true,
          profilePhotos: true,
          isPrime: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const data = requests.map((r) => ({
    id: r.id,
    fromUserId: r.fromUserId,
    nickname: r.fromUser.nickname,
    avatarId: r.fromUser.avatarId,
    profilePhoto: r.fromUser.profilePhotos[0]?.url,
    isPrime: r.fromUser.isPrime,
    createdAt: r.createdAt,
  }));

  return res.json({ success: true, data });
});

// Get sent friend requests
router.get('/friend-requests/sent', authMiddleware, async (req: any, res) => {
  const userId = req.user.userId;

  const requests = await prisma.friendRequest.findMany({
    where: {
      fromUserId: userId,
      status: 'PENDING',
    },
    include: {
      toUser: {
        select: {
          id: true,
          nickname: true,
          avatarId: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const data = requests.map((r) => ({
    id: r.id,
    toUserId: r.toUserId,
    nickname: r.toUser.nickname,
    avatarId: r.toUser.avatarId,
    createdAt: r.createdAt,
  }));

  return res.json({ success: true, data });
});

// Respond to friend request (accept or reject)
router.post(
  '/friend-requests/:id/respond',
  authMiddleware,
  validateBody(z.object({ accept: z.boolean() })),
  async (req: any, res) => {
    const userId = req.user.userId;
    const requestId = req.params.id;
    const { accept } = req.body;

    const request = await prisma.friendRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'İstek bulunamadı.' },
      });
    }

    if (request.toUserId !== userId) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Bu istek size ait değil.' },
      });
    }

    if (request.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        error: { code: 'ALREADY_RESPONDED', message: 'Bu isteğe zaten yanıt verilmiş.' },
      });
    }

    // Update request status
    await prisma.friendRequest.update({
      where: { id: requestId },
      data: {
        status: accept ? 'ACCEPTED' : 'REJECTED',
        respondedAt: new Date(),
      },
    });

    // If accepted, create friendship (if not already exists)
    if (accept) {
      // Mevcut arkadaşlık var mı kontrol et (mükerrer engelleme)
      const existingFriendship = await prisma.friendship.findFirst({
        where: {
          OR: [
            { user1Id: request.fromUserId, user2Id: request.toUserId },
            { user1Id: request.toUserId, user2Id: request.fromUserId },
          ],
        },
      });

      if (!existingFriendship) {
        await prisma.friendship.create({
          data: {
            user1Id: request.fromUserId,
            user2Id: request.toUserId,
          },
        });
        console.log(`[Friends] Friendship created between ${request.fromUserId} and ${request.toUserId}`);
      } else {
        console.log(`[Friends] Friendship already exists, skipping creation`);
      }

      // Karşı taraftan gelen pending isteği de kabul edilmiş olarak işaretle
      await prisma.friendRequest.updateMany({
        where: {
          fromUserId: request.toUserId,
          toUserId: request.fromUserId,
          status: 'PENDING',
        },
        data: {
          status: 'ACCEPTED',
          respondedAt: new Date(),
        },
      });
    }

    console.log(`[Friends] Request ${requestId}: ${accept ? 'ACCEPTED' : 'REJECTED'}`);

    return res.json({ success: true, accepted: accept });
  }
);

// Remove friendship
router.delete('/friends/:friendshipId', authMiddleware, async (req: any, res) => {
  const userId = req.user.userId;
  const { friendshipId } = req.params;

  const friendship = await prisma.friendship.findUnique({
    where: { id: friendshipId },
  });

  if (!friendship) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Arkadaşlık bulunamadı.' },
    });
  }

  if (friendship.user1Id !== userId && friendship.user2Id !== userId) {
    return res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Bu arkadaşlık size ait değil.' },
    });
  }

  await prisma.friendship.delete({
    where: { id: friendshipId },
  });

  console.log(`[Friends] Friendship ${friendshipId} removed by ${userId}`);

  return res.json({ success: true });
});

// Get user profile (for viewing other users)
router.get('/profile/:userId', authMiddleware, async (req: any, res) => {
  const currentUserId = req.user.userId;
  const targetUserId = req.params.userId;

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    include: { profilePhotos: true },
  });

  if (!targetUser) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Kullanıcı bulunamadı.' },
    });
  }

  // Check if they are friends
  const friendship = await prisma.friendship.findFirst({
    where: {
      OR: [
        { user1Id: currentUserId, user2Id: targetUserId },
        { user1Id: targetUserId, user2Id: currentUserId },
      ],
    },
  });

  const isFriend = !!friendship;

  // Profil görünürlüğü: Arkadaş değilse sadece avatar ve nickname göster
  if (!isFriend) {
    return res.json({
      success: true,
      data: {
        id: targetUser.id,
        nickname: targetUser.nickname,
        avatarId: targetUser.avatarId,
        isPrime: targetUser.isPrime,
        isFriend: false,
        // Diğer bilgiler gizli
      },
    });
  }

  // Arkadaşsa detaylı profil göster
  return res.json({
    success: true,
    data: {
      id: targetUser.id,
      nickname: targetUser.nickname,
      avatarId: targetUser.avatarId,
      age: targetUser.age,
      bio: targetUser.bio,
      city: targetUser.city,
      isPrime: targetUser.isPrime,
      profilePhoto: targetUser.isPrime ? targetUser.profilePhotos[0]?.url : null,
      interests: targetUser.interests,
      isFriend: true,
      isOnline: targetUser.isOnline,
    },
  });
});

// Update push token
router.post(
  '/push-token',
  authMiddleware,
  validateBody(z.object({ token: z.string() })),
  async (req: any, res) => {
    const { token } = req.body;
    await prisma.user.update({
      where: { id: req.user.userId },
      data: { expoPushToken: token },
    });
    return res.json({ success: true });
  },
);

// ============ ARKADAŞ SOHBET MESAJLARI ============
router.get('/friends/:friendshipId/messages', authMiddleware, async (req: any, res) => {
  const userId = req.user.userId;
  const { friendshipId } = req.params;

  // Arkadaşlık kontrolü
  const friendship = await prisma.friendship.findUnique({
    where: { id: friendshipId },
  });

  if (!friendship) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Arkadaşlık bulunamadı.' },
    });
  }

  // Kullanıcı bu arkadaşlığa dahil mi?
  if (friendship.user1Id !== userId && friendship.user2Id !== userId) {
    return res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Bu sohbete erişim yetkiniz yok.' },
    });
  }

  // FriendChat'i bul
  const friendChat = await prisma.friendChat.findFirst({
    where: { friendshipId },
  });

  if (!friendChat) {
    return res.json({ success: true, data: [] });
  }

  // Mesajları getir
  const messages = await prisma.friendChatMessage.findMany({
    where: { friendChatId: friendChat.id },
    orderBy: { createdAt: 'asc' },
    take: 100, // Son 100 mesaj
  });

  // Okunmamış mesajları okundu olarak işaretle (benim göndermediğim mesajlar)
  await prisma.friendChatMessage.updateMany({
    where: {
      friendChatId: friendChat.id,
      senderId: { not: userId },
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  });

  const data = messages.map((m) => ({
    id: m.id,
    senderId: m.senderId,
    content: m.content,
    mediaUrl: m.mediaUrl,
    mediaType: m.mediaType,
    createdAt: m.createdAt,
  }));

  return res.json({ success: true, data });
});

// Mesajları okundu olarak işaretle
router.post('/friends/:friendshipId/mark-read', authMiddleware, async (req: any, res) => {
  const userId = req.user.userId;
  const { friendshipId } = req.params;

  const friendship = await prisma.friendship.findUnique({
    where: { id: friendshipId },
  });

  if (!friendship) {
    return res.status(404).json({ success: false, error: { message: 'Arkadaşlık bulunamadı.' } });
  }

  if (friendship.user1Id !== userId && friendship.user2Id !== userId) {
    return res.status(403).json({ success: false, error: { message: 'Yetkisiz erişim.' } });
  }

  const friendChat = await prisma.friendChat.findFirst({
    where: { friendshipId },
  });

  if (friendChat) {
    await prisma.friendChatMessage.updateMany({
      where: {
        friendChatId: friendChat.id,
        senderId: { not: userId },
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });
  }

  return res.json({ success: true });
});

// ============ ARKADAŞ PROFİLİ (DETAYLI) ============
router.get('/friends/:friendId/profile', authMiddleware, async (req: any, res) => {
  const userId = req.user.userId;
  const { friendId } = req.params;

  // Arkadaşlık kontrolü
  const friendship = await prisma.friendship.findFirst({
    where: {
      OR: [
        { user1Id: userId, user2Id: friendId },
        { user1Id: friendId, user2Id: userId },
      ],
    },
  });

  if (!friendship) {
    return res.status(403).json({
      success: false,
      error: { code: 'NOT_FRIEND', message: 'Bu kullanıcı arkadaşınız değil.' },
    });
  }

  // Kullanıcı bilgilerini getir
  const friend = await prisma.user.findUnique({
    where: { id: friendId },
    include: {
      profilePhotos: {
        orderBy: { order: 'asc' },
      },
    },
  });

  if (!friend) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Kullanıcı bulunamadı.' },
    });
  }

  // Arkadaş olduğu için detayları göster
  return res.json({
    success: true,
    data: {
      id: friend.id,
      nickname: friend.nickname,
      bio: friend.bio,
      avatarId: friend.avatarId,
      isPrime: friend.isPrime,
      isOnline: friend.isOnline,
      verified: friend.verified,
      lastSeenAt: friend.lastSeenAt,
      profilePhotos: friend.profilePhotos.map((p) => ({
        id: p.id,
        url: p.url,
        order: p.order,
      })),
      friendshipId: friendship.id,
      friendsSince: friendship.createdAt,
      // Spark bilgileri
      monthlySparksEarned: friend.monthlySparksEarned,
      totalSparksEarned: friend.totalSparksEarned,
    },
  });
});

export default router;

