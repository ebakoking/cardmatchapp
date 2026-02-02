import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { prisma } from '../prisma';
import { validateBody } from '../utils/validation';
import { verifyJwt } from '../utils/jwt';
import { saveVerificationVideo } from '../services/verification';
import { emitToUser } from '../socket/io';
import { sendVerificationEmail } from '../services/email';
import { uploadImage, isCloudinaryConfigured } from '../services/cloudinary';

// Geçici email doğrulama kodları (production'da Redis kullanılmalı)
const emailVerificationCodes: Map<string, { code: string; newEmail: string; expiresAt: Date }> = new Map();

const router = Router();

// Uploads klasörünü oluştur (fallback için)
const uploadsDir = path.join(__dirname, '../../uploads/profile-photos');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer disk storage config
const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const uniqueName = `${uuidv4()}${ext}`;
    cb(null, uniqueName);
  },
});

// Multer memory storage (Cloudinary için)
const memoryStorage = multer.memoryStorage();

const upload = multer({
  storage: isCloudinaryConfigured() ? memoryStorage : diskStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Sadece görsel dosyalar kabul edilir'));
    }
  },
});

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
  // Avatar ve ilgi alanları
  avatarId: z.number().int().min(1).max(8).optional(),
  interests: z.array(z.string().max(30)).max(10).optional(),
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

// ============ KULLANICI ADI MÜSAİTLİK KONTROLÜ ============
router.get('/check-nickname', authMiddleware, async (req: any, res) => {
  try {
    const { nickname } = req.query;
    const currentUserId = req.user.userId;
    
    if (!nickname || typeof nickname !== 'string') {
      return res.json({ available: false, message: 'Kullanıcı adı gerekli.' });
    }
    
    // Türkçe karakter kontrolü
    if (/[çğıöşüÇĞİÖŞÜ]/.test(nickname)) {
      return res.json({ available: false, message: 'Türkçe karakter kullanılamaz.' });
    }
    
    // Minimum uzunluk
    if (nickname.length < 3) {
      return res.json({ available: false, message: 'En az 3 karakter gerekli.' });
    }
    
    // Mevcut kullanıcı adı kontrolü
    const existing = await prisma.user.findFirst({
      where: {
        nickname: { equals: nickname, mode: 'insensitive' },
        id: { not: currentUserId },
      },
    });
    
    return res.json({
      available: !existing,
      message: existing ? 'Bu kullanıcı adı zaten alınmış.' : 'Kullanılabilir.',
    });
  } catch (error) {
    console.error('[CheckNickname] Error:', error);
    return res.json({ available: false, message: 'Kontrol edilemedi.' });
  }
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

// ============ FOTOĞRAF YÖNETİMİ ============
// Limitler
const MAX_CORE_PHOTOS = 6;
const MAX_DAILY_PHOTOS_PER_DAY = 4; // Günde 4 adet
const CORE_UNLOCK_COST = 5;
const DAILY_UNLOCK_COST = 3;

// Profile photo upload (core veya daily)
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
    const photoType = req.body.type === 'DAILY' ? 'DAILY' : 'CORE';
    
    console.log('[PhotoUpload] Request received:', {
      userId,
      photoType,
      bodyType: req.body.type,
      hasFile: !!req.file,
      caption: req.body.caption?.substring(0, 20),
    });
    
    // Core photos için max 6 kontrolü
    if (photoType === 'CORE') {
      const coreCount = await prisma.photo.count({ 
        where: { userId, type: 'CORE' } 
      });
      if (coreCount >= MAX_CORE_PHOTOS) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MAX_CORE_PHOTOS',
            message: `En fazla ${MAX_CORE_PHOTOS} profil fotoğrafı yükleyebilirsiniz.`,
          },
        });
      }
    }
    
    // Daily photos için günde max 3 kontrolü
    if (photoType === 'DAILY') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const dailyCount = await prisma.photo.count({
        where: {
          userId,
          type: 'DAILY',
          createdAt: {
            gte: today,
            lt: tomorrow,
          },
        },
      });
      
      if (dailyCount >= MAX_DAILY_PHOTOS_PER_DAY) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MAX_DAILY_PHOTOS',
            message: `Bugün için ${MAX_DAILY_PHOTOS_PER_DAY} günlük fotoğraf limitine ulaştınız.`,
          },
        });
      }
    }

    // Get count for order (type bazlı)
    const count = await prisma.photo.count({ 
      where: { userId, type: photoType } 
    });

    // Fotoğrafı yükle (Cloudinary veya local)
    let url: string;
    
    if (isCloudinaryConfigured() && req.file.buffer) {
      // Cloudinary'e yükle
      const uploadResult = await uploadImage(req.file.buffer, `cardmatch/profiles/${userId}`);
      if (!uploadResult.success) {
        return res.status(500).json({
          success: false,
          error: { code: 'UPLOAD_FAILED', message: uploadResult.error || 'Fotoğraf yüklenemedi' },
        });
      }
      url = uploadResult.url!;
      console.log('[PhotoUpload] Cloudinary upload:', { url });
    } else {
      // Local dosya
      url = `/uploads/profile-photos/${(req.file as any).filename}`;
      console.log('[PhotoUpload] Local file saved:', {
        filename: (req.file as any).filename,
        path: (req.file as any).path,
        url,
      });
    }
    
    // Caption from form data (optional, max 80 chars)
    const caption = req.body.caption?.slice(0, 80) || null;

    const photo = await prisma.photo.create({
      data: {
        userId,
        url,
        order: count + 1,
        type: photoType,
        caption,
      },
    });

    console.log('[PhotoUpload] Photo created:', {
      photoId: photo.id,
      userId,
      photoType: photo.type,
      order: photo.order,
    });

    return res.json({ 
      success: true, 
      data: photo,
      limits: {
        type: photoType,
        current: count + 1,
        max: photoType === 'CORE' ? MAX_CORE_PHOTOS : MAX_DAILY_PHOTOS_PER_DAY,
      },
    });
  },
);

// ============ FOTOĞRAF CAPTION GÜNCELLEME ============
router.patch('/me/photos/:photoId/caption', authMiddleware, async (req: any, res) => {
  const userId = req.user.userId;
  const { photoId } = req.params;
  const { caption } = req.body;
  
  // Validate caption length
  if (caption && caption.length > 80) {
    return res.status(400).json({
      success: false,
      error: { code: 'CAPTION_TOO_LONG', message: 'Açıklama en fazla 80 karakter olabilir.' },
    });
  }
  
  // Check photo ownership
  const photo = await prisma.photo.findFirst({
    where: { id: photoId, userId },
  });
  
  if (!photo) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Fotoğraf bulunamadı.' },
    });
  }
  
  // Update caption
  const updatedPhoto = await prisma.photo.update({
    where: { id: photoId },
    data: { caption: caption || null },
  });
  
  return res.json({
    success: true,
    data: updatedPhoto,
  });
});

// ============ PROFİL FOTOĞRAFI (Prime) ============
// Prime kullanıcılar için özel profil fotoğrafı yükleme
router.post(
  '/me/profile-photo',
  authMiddleware,
  upload.single('photo'),
  async (req: any, res) => {
    const userId = req.user.userId;
    
    // Prime kontrolü
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.isPrime) {
      return res.status(403).json({
        success: false,
        error: { code: 'NOT_PRIME', message: 'Bu özellik sadece Prime üyelere açıktır.' },
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_FILE', message: 'Fotoğraf yüklenmedi.' },
      });
    }

    // Dosya URL'i
    const profilePhotoUrl = `/uploads/profile-photos/${req.file.filename}`;

    // Kullanıcının profil fotoğrafını güncelle
    await prisma.user.update({
      where: { id: userId },
      data: { profilePhotoUrl },
    });

    console.log('[ProfilePhoto] Uploaded for Prime user:', { userId, profilePhotoUrl });

    return res.json({
      success: true,
      data: { profilePhotoUrl },
    });
  }
);

// Prime profil fotoğrafını kaldır
router.delete('/me/profile-photo', authMiddleware, async (req: any, res) => {
  const userId = req.user.userId;

  await prisma.user.update({
    where: { id: userId },
    data: { profilePhotoUrl: null },
  });

  console.log('[ProfilePhoto] Removed for user:', userId);

  return res.json({
    success: true,
    message: 'Profil fotoğrafı kaldırıldı.',
  });
});

// ============ FOTOĞRAF SİLME ============
router.delete('/me/photos/:photoId', authMiddleware, async (req: any, res) => {
  const userId = req.user.userId;
  const { photoId } = req.params;
  
  // Check photo ownership
  const photo = await prisma.photo.findFirst({
    where: { id: photoId, userId },
  });
  
  if (!photo) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Fotoğraf bulunamadı.' },
    });
  }
  
  // Delete photo (PhotoUnlock cascade olarak silinir)
  // SparkTransaction silinmez (audit kaydı)
  await prisma.photo.delete({
    where: { id: photoId },
  });
  
  // Re-order remaining photos
  await prisma.photo.updateMany({
    where: {
      userId,
      type: photo.type,
      order: { gt: photo.order },
    },
    data: {
      order: { decrement: 1 },
    },
  });
  
  return res.json({
    success: true,
    message: 'Fotoğraf silindi.',
  });
});

// ============ FOTOĞRAF DEĞİŞTİRME (Replace) ============
router.put(
  '/me/photos/:photoId',
  authMiddleware,
  upload.single('photo'),
  async (req: any, res) => {
    const userId = req.user.userId;
    const { photoId } = req.params;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_FILE', message: 'Fotoğraf yüklenmedi' },
      });
    }
    
    // Check photo ownership
    const existingPhoto = await prisma.photo.findFirst({
      where: { id: photoId, userId },
    });
    
    if (!existingPhoto) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Fotoğraf bulunamadı.' },
      });
    }
    
    // Gerçek dosya URL'i (multer disk storage'dan)
    const newUrl = `/uploads/profile-photos/${req.file.filename}`;
    
    console.log('[PhotoReplace] Replacing photo:', {
      photoId,
      oldUrl: existingPhoto.url,
      newUrl,
      filename: req.file.filename,
    });
    
    // Fotoğraf değiştirildiğinde unlock kayıtlarını SİL
    // Böylece arkadaşlar yeni fotoğrafı tekrar açmak zorunda kalır
    await prisma.photoUnlock.deleteMany({
      where: { photoId },
    });
    
    // Update photo URL
    const updatedPhoto = await prisma.photo.update({
      where: { id: photoId },
      data: {
        url: newUrl,
        // Caption korunur
      },
    });
    
    console.log('[PhotoReplace] Photo replaced, unlock records deleted');
    
    return res.json({
      success: true,
      data: updatedPhoto,
      message: 'Fotoğraf değiştirildi.',
    });
  }
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
// Check-nickname - Auth opsiyonel (onboarding için)
router.get('/check-nickname', async (req: any, res) => {
  const { nickname } = req.query;
  if (!nickname || typeof nickname !== 'string') {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'Nickname gerekli' },
    });
  }

  // Auth header varsa userId'yi al, yoksa null
  let excludeUserId: string | null = null;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.slice(7);
      const payload = verifyJwt(token);
      excludeUserId = payload.userId;
    } catch {
      // Token geçersiz olsa da devam et
    }
  }

  const existing = await prisma.user.findFirst({
    where: {
      nickname,
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
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

    // SADECE Prime kullanıcılar için profilePhotoUrl kullan, yoksa null (avatar gösterilir)
    const profilePhoto = friend.isPrime && friend.profilePhotoUrl 
      ? friend.profilePhotoUrl 
      : null;

    friendsMap.set(friend.id, {
      friendshipId: f.id,
      id: friend.id,
      nickname: friend.nickname,
      avatarId: friend.avatarId,
      profilePhoto,
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
          profilePhotoUrl: true,
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
    // SADECE Prime kullanıcılar için profilePhotoUrl kullan
    profilePhoto: r.fromUser.isPrime && r.fromUser.profilePhotoUrl 
      ? r.fromUser.profilePhotoUrl 
      : null,
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
    locked: m.locked,
    isFirstFree: m.isFirstFree,
    mediaPrice: m.mediaPrice,
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

  // Hangi fotoğraflar bu kullanıcı tarafından açılmış?
  const unlockedPhotos = await prisma.photoUnlock.findMany({
    where: {
      viewerId: userId,
      ownerId: friendId,
    },
    select: { photoId: true },
  });
  const unlockedPhotoIds = new Set(unlockedPhotos.map((u) => u.photoId));

  // Fotoğrafları type'a göre grupla
  const corePhotos = friend.profilePhotos.filter((p) => p.type === 'CORE');
  const dailyPhotos = friend.profilePhotos.filter((p) => p.type === 'DAILY');

  // Helper function for photo mapping
  const mapPhoto = (p: typeof friend.profilePhotos[0]) => {
    const isUnlocked = unlockedPhotoIds.has(p.id);
    const unlockCost = p.type === 'CORE' ? CORE_UNLOCK_COST : DAILY_UNLOCK_COST;
    return {
      id: p.id,
      url: p.url,
      order: p.order,
      type: p.type,
      // Caption sadece unlock edilmişse görünür
      caption: isUnlocked ? p.caption : null,
      hasCaption: !!p.caption,
      isUnlocked,
      unlockCost,
      createdAt: p.createdAt,
    };
  };

  // Arkadaş olduğu için detayları göster
  return res.json({
    success: true,
    data: {
      id: friend.id,
      nickname: friend.nickname,
      bio: friend.bio,
      avatarId: friend.avatarId,
      // Prime profil fotoğrafı (Prime üyeler için)
      profilePhotoUrl: friend.isPrime ? friend.profilePhotoUrl : null,
      isPrime: friend.isPrime,
      isOnline: friend.isOnline,
      verified: friend.verified,
      lastSeenAt: friend.lastSeenAt,
      isFriend: true,
      // Core ve Daily fotoğraflar ayrı ayrı
      corePhotos: corePhotos.map(mapPhoto),
      dailyPhotos: dailyPhotos.map(mapPhoto),
      // Geriye uyumluluk için tüm fotoğraflar
      profilePhotos: friend.profilePhotos.map(mapPhoto),
      friendshipId: friendship.id,
      friendsSince: friendship.createdAt,
      // Spark bilgileri
      monthlySparksEarned: friend.monthlySparksEarned,
      totalSparksEarned: friend.totalSparksEarned,
      // Unlock maliyetleri
      unlockCosts: {
        core: CORE_UNLOCK_COST,
        daily: DAILY_UNLOCK_COST,
      },
    },
  });
});

// ============ FOTOĞRAF AÇMA (UNLOCK) ============
const SPARK_REWARD_RATIO = 1.0; // Harcanan elmasın %100'ü spark olarak sahibine gider

// Helper: Fotoğraf tipine göre unlock maliyeti
function getUnlockCost(photoType: 'CORE' | 'DAILY'): number {
  return photoType === 'CORE' ? CORE_UNLOCK_COST : DAILY_UNLOCK_COST;
}

router.post('/photos/:photoId/unlock', authMiddleware, async (req: any, res) => {
  const viewerId = req.user.userId;
  const { photoId } = req.params;

  console.log('[PhotoUnlock] Request received:', { viewerId, photoId });

  try {
    // 1. Fotoğrafı bul
    const photo = await prisma.photo.findUnique({
      where: { id: photoId },
      include: { user: true },
    });

    if (!photo) {
      console.log('[PhotoUnlock] Photo not found:', photoId);
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Fotoğraf bulunamadı.' },
      });
    }

    const ownerId = photo.userId;
    const unlockCost = getUnlockCost(photo.type);
    
    console.log('[PhotoUnlock] Roles identified:', { 
      viewerId, 
      ownerId, 
      viewerIsOwner: viewerId === ownerId,
      photoType: photo.type,
      unlockCost,
    });

    // 2. Kendi fotoğrafını açmaya çalışıyorsa izin ver (ücretsiz)
    if (ownerId === viewerId) {
      return res.json({
        success: true,
        data: {
          photo: {
            id: photo.id,
            url: photo.url,
            caption: photo.caption,
            isUnlocked: true,
          },
          cost: 0,
          message: 'Kendi fotoğrafın.',
        },
      });
    }

    // 3. Arkadaşlık kontrolü
    const friendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { user1Id: viewerId, user2Id: ownerId },
          { user1Id: ownerId, user2Id: viewerId },
        ],
      },
    });

    if (!friendship) {
      return res.status(403).json({
        success: false,
        error: { code: 'NOT_FRIEND', message: 'Profili görmek için arkadaş olmalısın.' },
      });
    }

    // 4. Daha önce açılmış mı?
    const existingUnlock = await prisma.photoUnlock.findUnique({
      where: {
        photoId_viewerId: {
          photoId,
          viewerId,
        },
      },
    });

    if (existingUnlock) {
      console.log('[PhotoUnlock] Already unlocked:', { viewerId, photoId });
      // Zaten açılmış - idempotent success
      const responseData: any = {
        photo: {
          id: photo.id,
          url: photo.url,
          caption: photo.caption,
          isUnlocked: true,
        },
        cost: 0,
        message: 'Bu fotoğrafı daha önce açtın.',
        alreadyUnlocked: true,
      };

      // Dev ortamında debug bilgisi ekle
      if (process.env.NODE_ENV !== 'production') {
        responseData._debug = {
          chargedUserId: viewerId,
          ownerUserId: ownerId,
          amount: 0,
          alreadyUnlocked: true,
          previousUnlockId: existingUnlock.id,
        };
      }

      return res.json({
        success: true,
        data: responseData,
      });
    }

    // 5. Bakiye kontrolü
    const viewer = await prisma.user.findUnique({
      where: { id: viewerId },
      select: { tokenBalance: true },
    });

    if (!viewer || viewer.tokenBalance < unlockCost) {
      return res.status(402).json({
        success: false,
        error: { 
          code: 'INSUFFICIENT_BALANCE', 
          message: 'Yeterli elmasın yok.',
          required: unlockCost,
          current: viewer?.tokenBalance || 0,
        },
      });
    }

    // 6. Transaction: Elmas düş, spark ekle, unlock kaydet
    const sparkAmount = Math.floor(unlockCost * SPARK_REWARD_RATIO);

    console.log('[PhotoUnlock] Executing transaction:', {
      chargedUserId: viewerId,
      ownerUserId: ownerId,
      cost: unlockCost,
      photoType: photo.type,
      sparkAmount,
    });

    await prisma.$transaction([
      // Görüntüleyenin bakiyesini düşür
      prisma.user.update({
        where: { id: viewerId },
        data: { tokenBalance: { decrement: unlockCost } },
      }),
      // Fotoğraf sahibine spark ekle
      prisma.user.update({
        where: { id: ownerId },
        data: { 
          monthlySparksEarned: { increment: sparkAmount },
          totalSparksEarned: { increment: sparkAmount },
        },
      }),
      // Unlock kaydı oluştur
      prisma.photoUnlock.create({
        data: {
          photoId,
          viewerId,
          ownerId,
          tokenCost: unlockCost,
          sparkAmount,
        },
      }),
      // Spark transaction log
      prisma.sparkTransaction.create({
        data: {
          fromUserId: viewerId,
          toUserId: ownerId,
          photoId,
          amount: sparkAmount,
          reason: 'photo_unlock',
        },
      }),
    ]);

    console.log('[PhotoUnlock] Transaction completed successfully');

    // Fotoğraf sahibinin güncel spark bilgilerini al
    const updatedOwner = await prisma.user.findUnique({
      where: { id: ownerId },
      select: { monthlySparksEarned: true, totalSparksEarned: true },
    });

    // Güncel bakiyeyi al (önce al, sonra emit et)
    const updatedViewer = await prisma.user.findUnique({
      where: { id: viewerId },
      select: { tokenBalance: true },
    });

    // Fotoğraf sahibine real-time spark bildirimi gönder
    emitToUser(ownerId, 'spark:earned', {
      amount: sparkAmount,
      monthlySparksEarned: updatedOwner?.monthlySparksEarned || 0,
      totalSparksEarned: updatedOwner?.totalSparksEarned || 0,
      reason: 'photo_unlock',
      photoId,
      fromUserId: viewerId,
    });
    
    // 🔔 Görüntüleyene token:spent bildirimi gönder (anlık güncelleme için)
    emitToUser(viewerId, 'token:spent', {
      amount: unlockCost,
      newBalance: updatedViewer?.tokenBalance || 0,
      reason: 'photo_unlock',
      photoId,
    });

    const responseData: any = {
      photo: {
        id: photo.id,
        url: photo.url,
        caption: photo.caption,
        type: photo.type,
        isUnlocked: true,
      },
      cost: unlockCost,
      sparkAwarded: sparkAmount,
      newBalance: updatedViewer?.tokenBalance || 0,
      message: 'Fotoğraf açıldı!',
    };

    // Dev ortamında debug bilgisi ekle
    if (process.env.NODE_ENV !== 'production') {
      responseData._debug = {
        chargedUserId: viewerId,
        ownerUserId: ownerId,
        amount: unlockCost,
        photoType: photo.type,
        alreadyUnlocked: false,
      };
    }

    return res.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error('[PhotoUnlock] Error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Bir hata oluştu.' },
    });
  }
});

// ============ FOTOĞRAF AÇMA MALİYETLERİ ============
router.get('/photos/unlock-cost', authMiddleware, async (req: any, res) => {
  return res.json({
    success: true,
    data: {
      core: CORE_UNLOCK_COST,
      daily: DAILY_UNLOCK_COST,
    },
  });
});

// ============ HESAP DONDURMA / SİLME ============
/**
 * POST /api/user/me/freeze-account
 * Hesabı dondurur - veriler silinmez, sadece görünmez olur
 * Aynı telefon numarası ile tekrar giriş yapınca hesap aktifleşir
 */
router.post('/me/freeze-account', authMiddleware, async (req: any, res) => {
  const userId = req.user.userId;
  
  console.log('[Account] Freezing account for user:', userId);
  
  try {
    // Hesabı dondur
    await prisma.user.update({
      where: { id: userId },
      data: {
        status: 'FROZEN',
        frozenAt: new Date(),
        isOnline: false,
        refreshToken: null,
        refreshTokenExp: null,
      },
    });
    
    // Tüm arkadaşlıklardaki görünürlüğü kaldır (arkadaşlar listesinden gizle)
    // Not: Arkadaşlıklar silinmez, hesap aktifleşince geri gelir
    
    console.log('[Account] Account frozen successfully:', userId);
    
    return res.json({
      success: true,
      message: 'Hesabın donduruldu. Aynı telefon numarası ile tekrar giriş yaparak hesabını aktifleştirebilirsin.',
    });
  } catch (error) {
    console.error('[Account] Freeze error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Bir hata oluştu.' },
    });
  }
});

/**
 * POST /api/user/me/reactivate-account
 * Dondurulmuş hesabı tekrar aktifleştirir (login sırasında otomatik çağrılır)
 */
router.post('/me/reactivate-account', authMiddleware, async (req: any, res) => {
  const userId = req.user.userId;
  
  console.log('[Account] Reactivating account for user:', userId);
  
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Kullanıcı bulunamadı.' },
      });
    }
    
    if (user.status !== 'FROZEN') {
      return res.json({
        success: true,
        message: 'Hesap zaten aktif.',
        wasReactivated: false,
      });
    }
    
    // Hesabı aktifleştir
    await prisma.user.update({
      where: { id: userId },
      data: {
        status: 'ACTIVE',
        frozenAt: null,
      },
    });
    
    console.log('[Account] Account reactivated successfully:', userId);
    
    return res.json({
      success: true,
      message: 'Hesabın tekrar aktifleştirildi! Hoş geldin.',
      wasReactivated: true,
    });
  } catch (error) {
    console.error('[Account] Reactivate error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Bir hata oluştu.' },
    });
  }
});

// ============ E-POSTA DEĞİŞTİRME - DOĞRULAMA KODU GÖNDER ============
router.post('/me/email/request-change', authMiddleware, async (req: any, res) => {
  try {
    const userId = req.user.userId;
    const { newEmail } = req.body;
    
    if (!newEmail || !newEmail.includes('@')) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_EMAIL', message: 'Geçerli bir e-posta adresi girin.' },
      });
    }
    
    // E-posta zaten kullanılıyor mu?
    const existingUser = await prisma.user.findFirst({
      where: { email: newEmail, id: { not: userId } },
    });
    
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: { code: 'EMAIL_IN_USE', message: 'Bu e-posta adresi zaten kullanılıyor.' },
      });
    }
    
    // 6 haneli doğrulama kodu oluştur
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 dakika
    
    // Kodu kaydet
    emailVerificationCodes.set(userId, { code, newEmail, expiresAt });
    
    // E-posta gönder
    const result = await sendVerificationEmail(newEmail, code);
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: { code: 'EMAIL_SEND_FAILED', message: 'E-posta gönderilemedi.' },
      });
    }
    
    console.log(`[Email] Verification code sent to ${newEmail} for user ${userId}`);
    
    return res.json({
      success: true,
      message: 'Doğrulama kodu e-posta adresine gönderildi.',
      // Development'ta kodu döndür (test için)
      ...(process.env.NODE_ENV !== 'production' && { testCode: code }),
    });
  } catch (error) {
    console.error('[Email] Request change error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Bir hata oluştu.' },
    });
  }
});

// ============ E-POSTA DEĞİŞTİRME - DOĞRULAMA ============
router.post('/me/email/verify', authMiddleware, async (req: any, res) => {
  try {
    const userId = req.user.userId;
    const { code } = req.body;
    
    const pending = emailVerificationCodes.get(userId);
    
    if (!pending) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_PENDING_CHANGE', message: 'Bekleyen e-posta değişikliği bulunamadı.' },
      });
    }
    
    if (new Date() > pending.expiresAt) {
      emailVerificationCodes.delete(userId);
      return res.status(400).json({
        success: false,
        error: { code: 'CODE_EXPIRED', message: 'Doğrulama kodunun süresi doldu. Yeniden deneyin.' },
      });
    }
    
    if (pending.code !== code) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_CODE', message: 'Geçersiz doğrulama kodu.' },
      });
    }
    
    // E-postayı güncelle
    await prisma.user.update({
      where: { id: userId },
      data: { email: pending.newEmail },
    });
    
    // Kodu temizle
    emailVerificationCodes.delete(userId);
    
    console.log(`[Email] Email changed for user ${userId} to ${pending.newEmail}`);
    
    return res.json({
      success: true,
      message: 'E-posta adresin başarıyla güncellendi.',
      newEmail: pending.newEmail,
    });
  } catch (error) {
    console.error('[Email] Verify error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Bir hata oluştu.' },
    });
  }
});

// ============ ŞİFRE DEĞİŞTİR ============
router.put('/me/password', authMiddleware, async (req: any, res) => {
  try {
    const userId = req.user.userId;
    const { currentPassword, newPassword } = req.body;
    
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PASSWORD', message: 'Şifre en az 6 karakter olmalı.' },
      });
    }
    
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'Kullanıcı bulunamadı.' },
      });
    }
    
    // Mevcut şifre kontrolü (eğer şifre varsa)
    if (user.passwordHash && currentPassword) {
      const bcrypt = require('bcryptjs');
      const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isMatch) {
        return res.status(400).json({
          success: false,
          error: { code: 'WRONG_PASSWORD', message: 'Mevcut şifre yanlış.' },
        });
      }
    }
    
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashedPassword },
    });
    
    return res.json({ success: true, message: 'Şifre güncellendi.' });
  } catch (error) {
    console.error('[Password] Update error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Bir hata oluştu.' },
    });
  }
});

// ============ ENGELLİ KULLANICILAR LİSTESİ ============
router.get('/blocked', authMiddleware, async (req: any, res) => {
  try {
    const userId = req.user.userId;
    
    const blocks = await prisma.block.findMany({
      where: { blockerUserId: userId },
      include: {
        blocked: {
          select: { id: true, nickname: true, avatarId: true },
        },
      },
    });
    
    const blockedUsers = blocks.map((b: any) => ({
      id: b.blocked.id,
      nickname: b.blocked.nickname,
      avatarId: b.blocked.avatarId,
    }));
    
    return res.json({ success: true, data: blockedUsers });
  } catch (error) {
    console.error('[Block] List error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Bir hata oluştu.' },
    });
  }
});

// ============ KULLANICI ENGELLE ============
router.post('/block', authMiddleware, async (req: any, res) => {
  try {
    const blockerId = req.user.userId;
    const { blockedId } = req.body;
    
    if (!blockedId) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_ID', message: 'Engellenecek kullanıcı ID gerekli.' },
      });
    }
    
    // Zaten engellenmiş mi kontrol et
    const existing = await prisma.block.findFirst({
      where: { blockerUserId: blockerId, blockedUserId: blockedId },
    });
    
    if (existing) {
      return res.status(400).json({
        success: false,
        error: { code: 'ALREADY_BLOCKED', message: 'Bu kullanıcı zaten engelli.' },
      });
    }
    
    await prisma.block.create({
      data: { blockerUserId: blockerId, blockedUserId: blockedId },
    });
    
    console.log(`[Block] User ${blockerId} blocked ${blockedId}`);
    
    return res.json({ success: true, message: 'Kullanıcı engellendi.' });
  } catch (error) {
    console.error('[Block] Create error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Bir hata oluştu.' },
    });
  }
});

// ============ ENGEL KALDIR ============
router.delete('/block/:userId', authMiddleware, async (req: any, res) => {
  try {
    const blockerId = req.user.userId;
    const blockedId = req.params.userId;
    
    await prisma.block.deleteMany({
      where: { blockerUserId: blockerId, blockedUserId: blockedId },
    });
    
    return res.json({ success: true, message: 'Engel kaldırıldı.' });
  } catch (error) {
    console.error('[Block] Remove error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Bir hata oluştu.' },
    });
  }
});

// ============ TÜM KONUŞMALARI SİL ============
router.delete('/conversations', authMiddleware, async (req: any, res) => {
  try {
    const userId = req.user.userId;
    
    // Friend chat'leri bul (Friendship üzerinden)
    const friendChats = await prisma.friendChat.findMany({
      where: {
        friendship: {
          OR: [{ user1Id: userId }, { user2Id: userId }],
        },
      },
      select: { id: true },
    });
    const friendChatIds = friendChats.map((fc: any) => fc.id);
    
    // Friend chat mesajlarını sil
    if (friendChatIds.length > 0) {
      await prisma.friendChatMessage.deleteMany({
        where: {
          friendChatId: { in: friendChatIds },
        },
      });
    }
    
    // Match mesajlarını sil (Message tablosu kullanılıyor)
    await prisma.message.deleteMany({
      where: { senderId: userId },
    });
    
    return res.json({ success: true, message: 'Tüm konuşmalar silindi.' });
  } catch (error) {
    console.error('[Conversations] Delete error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Bir hata oluştu.' },
    });
  }
});

// ============ GERİ BİLDİRİM GÖNDER ============
router.post('/feedback', authMiddleware, async (req: any, res) => {
  try {
    const userId = req.user.userId;
    const { message } = req.body;
    
    if (!message || message.length < 10) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_MESSAGE', message: 'Mesaj en az 10 karakter olmalı.' },
      });
    }
    
    // Feedback'i kaydet (Feedback modeli yoksa log'a yaz)
    console.log('[Feedback] New feedback from user:', userId, message);
    
    // Feedback modeliniz varsa:
    // await prisma.feedback.create({
    //   data: { userId, message },
    // });
    
    return res.json({ success: true, message: 'Geri bildirim alındı.' });
  } catch (error) {
    console.error('[Feedback] Submit error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Bir hata oluştu.' },
    });
  }
});

export default router;

