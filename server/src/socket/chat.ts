import { Server, Socket } from 'socket.io';
import { prisma } from '../prisma';
import { FEATURES, logTokenGiftAttempt } from '../config/features';

interface StageConfig {
  name: string;
  duration: number;
  minMessages: number;
  features: string[];
  photoCost?: number;
  videoCost?: number;
}

// Track active chat sessions per user (userId -> sessionId)
const activeUserSessions = new Map<string, string>();

// TEST İÇİN KISALTILMIŞ SÜRELER (Production'da artır)
// NOT: Stage geçişi SADECE SÜRE ile olur, mesaj şartı YOK
// YENİ SİSTEM: Sabit token maliyetleri
const MEDIA_COSTS = {
  audio: 5,   // Ses açma: 5 token
  photo: 20,  // Fotoğraf açma: 20 token
  video: 50,  // Video açma: 50 token
};

const STAGE_CONFIG: Record<number, StageConfig> = {
  1: {
    name: 'TEXT_GIFT',
    // Stage 1: Sadece text + elmas gönderimi (TEST: 10 saniye)
    duration: 10, // TEST İÇİN 10 SANİYE
    minMessages: 0, // Mesaj şartı YOK
    features: ['text_message', 'gift'],
  },
  2: {
    name: 'AUDIO',
    // Stage 2: Ses kaydı (TEST: 10 saniye)
    duration: 10,
    minMessages: 0,
    features: ['text_message', 'gift', 'audio_send'],
  },
  3: {
    name: 'PHOTO',
    // Stage 3: Fotoğraf (TEST: 10 saniye)
    duration: 10,
    minMessages: 0,
    features: ['text_message', 'gift', 'audio_send', 'photo_send'],
    photoCost: 20, // Görüntüleme maliyeti: 20 token
  },
  4: {
    name: 'VIDEO',
    // Stage 4: Video (TEST: 10 saniye)
    duration: 10,
    minMessages: 0,
    features: ['text_message', 'gift', 'audio_send', 'photo_send', 'video_send'],
    videoCost: 50, // Görüntüleme maliyeti: 50 token
  },
  5: {
    name: 'FRIEND',
    // Stage 5 (8+ dk): Arkadaş ekleme
    duration: Number.MAX_SAFE_INTEGER,
    minMessages: 0,
    features: ['all', 'friend_request'],
  },
};

// Track free media per session in-memory
const freeMediaUsage = new Map<
  string,
  {
    freePhotosUsed: Map<string, number>;
    freeVideosUsed: Map<string, number>;
  }
>();

export function registerChatHandlers(io: Server, socket: Socket) {
  // DEBUG: Tüm gelen eventleri logla
  socket.onAny((eventName, ...args) => {
    if (eventName !== 'user:join' && !eventName.startsWith('chat:typing')) {
      console.log(`[Socket DEBUG] Event received: ${eventName}`, JSON.stringify(args).substring(0, 200));
    }
  });

  // Kullanıcıyı kendi room'una katıl (gift:received vb. için gerekli)
  socket.on('user:join', async (payload: { userId: string }) => {
    const { userId } = payload;
    if (userId) {
      console.log('[Chat] user:join - joining user room:', userId);
      socket.join(userId);
      (socket as any).userId = userId;
      
      // Kullanıcıyı online yap
      await prisma.user.update({
        where: { id: userId },
        data: { isOnline: true },
      });
      
      // Tüm aktif session'lara online durumu bildir
      io.emit('user:status', {
        userId,
        isOnline: true,
      });
    }
  });

  // Typing event - karşı tarafa yazıyor bilgisi gönder
  socket.on('chat:typing', async (payload: { sessionId: string; userId: string; isTyping: boolean }) => {
    const { sessionId, userId, isTyping } = payload;
    console.log('[Chat] chat:typing received:', { sessionId, userId, isTyping });
    
    // Session'daki diğer kullanıcıya bildir
    socket.to(sessionId).emit('chat:typing', {
      userId,
      isTyping,
    });
  });

  // Kullanıcıyı beğen (iyi kullanıcı geri bildirimi)
  socket.on('user:like', async (payload: { fromUserId: string; toUserId: string; sessionId: string }) => {
    const { fromUserId, toUserId, sessionId } = payload;
    console.log('[Chat] user:like received:', payload);
    
    try {
      // Kullanıcının pozitif geri bildirim sayısını artır
      await prisma.user.update({
        where: { id: toUserId },
        data: {
          positiveRatings: { increment: 1 },
        },
      });
      
      console.log(`[Chat] User ${toUserId} received positive rating from ${fromUserId}`);
    } catch (error) {
      console.error('[Chat] user:like error:', error);
    }
  });

  // Kullanıcı room'dan ayrıl
  socket.on('user:leave', async (payload: { userId: string }) => {
    const { userId } = payload;
    if (userId) {
      console.log('[Chat] user:leave - leaving user room:', userId);
      socket.leave(userId);
      
      const now = new Date();
      
      // Kullanıcıyı offline yap ve son görülme zamanını güncelle
      await prisma.user.update({
        where: { id: userId },
        data: { 
          isOnline: false,
          lastSeenAt: now,
        },
      });
      
      // Tüm aktif session'lara offline durumu bildir
      io.emit('user:status', {
        userId,
        isOnline: false,
        lastSeenAt: now.toISOString(),
      });
    }
  });
  

  socket.on(
    'chat:message',
    async (payload: {
      sessionId: string;
      senderId: string;
      content?: string;
    }) => {
      try {
        const { sessionId, senderId, content } = payload;
        const session = await prisma.chatSession.findUnique({
          where: { id: sessionId },
        });
        if (!session || session.endedAt) return;

        const message = await prisma.message.create({
          data: {
            chatSessionId: sessionId,
            senderId,
            content,
          },
        });

        io.to(sessionId).emit('chat:message', message);

        await handleStageProgress(io, sessionId, senderId);
      } catch (error) {
        socket.emit('error', {
          message: 'Mesaj gönderilemedi.',
          code: 'CHAT_MESSAGE_ERROR',
        });
      }
    },
  );

  socket.on(
    'chat:join',
    async (payload: { sessionId: string; userId: string }) => {
      const { sessionId, userId } = payload;
      console.log('[Chat] chat:join received:', { sessionId, userId });
      socket.join(sessionId);
      // Kullanıcıyı kendi odasına da ekle (bireysel mesajlar için)
      socket.join(userId);
      // Socket'e userId'yi attach et (disconnect için)
      (socket as any).chatUserId = userId;
      (socket as any).chatSessionId = sessionId;
      // Aktif session'ı kaydet
      activeUserSessions.set(userId, sessionId);
      console.log('[Chat] User joined rooms:', { sessionId, userId, rooms: Array.from(socket.rooms) });
    },
  );

  // Kullanıcı sohbetten çıktığında
  socket.on(
    'chat:leave',
    async (payload: { sessionId: string; userId: string }) => {
      console.log('[Chat] chat:leave received:', payload);
      // Socket'ten userId/sessionId'yi temizle
      (socket as any).chatUserId = null;
      (socket as any).chatSessionId = null;
      await endChatSession(io, payload.sessionId, payload.userId, 'left');
    },
  );

  // Socket bağlantısı koptuğunda
  socket.on('disconnect', async () => {
    const chatUserId = (socket as any).chatUserId;
    const sessionId = (socket as any).chatSessionId;
    const userId = (socket as any).userId;
    
    // Chat session'ı sonlandır
    if (chatUserId && sessionId && activeUserSessions.has(chatUserId)) {
      await endChatSession(io, sessionId, chatUserId, 'disconnected');
    }
    
    // Kullanıcıyı offline yap
    const userIdToUpdate = userId || chatUserId;
    if (userIdToUpdate) {
      console.log('[Chat] disconnect - setting user offline:', userIdToUpdate);
      const now = new Date();
      await prisma.user.update({
        where: { id: userIdToUpdate },
        data: { 
          isOnline: false,
          lastSeenAt: now,
        },
      }).then(() => {
        // Tüm aktif session'lara offline durumu bildir
        io.emit('user:status', {
          userId: userIdToUpdate,
          isOnline: false,
          lastSeenAt: now.toISOString(),
        });
      }).catch(() => {
        // Kullanıcı bulunamadıysa sessizce geç
      });
    }
  });

  // Client tarafından stage geçişi bildirimi
  socket.on(
    'stage:advance',
    async (payload: { sessionId: string; stage: number }) => {
      const { sessionId, stage } = payload;
      console.log('[Chat] stage:advance from client:', { sessionId, stage });
      
      try {
        const session = await prisma.chatSession.findUnique({
          where: { id: sessionId },
        });
        if (!session || session.endedAt) return;
        
        // Sadece ileri stage'e geçişe izin ver
        if (stage > session.currentStage && stage <= 5) {
          await prisma.chatSession.update({
            where: { id: sessionId },
            data: {
              currentStage: stage,
              stageStartedAt: new Date(),
            },
          });
          
          console.log(`[Chat] Stage updated to ${stage} for session ${sessionId}`);
          
          // İki kullanıcıya da bildir
          io.to(sessionId).emit('stage:advanced', {
            newStage: stage,
            features: STAGE_CONFIG[stage].features,
            animation: 'confetti',
          });
        }
      } catch (error) {
        console.error('[Chat] stage:advance error:', error);
      }
    },
  );

  socket.on(
    'media:photo',
    async (payload: {
      sessionId: string;
      senderId: string;
      url: string;
      isInstant?: boolean;
    }) => {
      console.log('[Chat] media:photo received:', payload);
      try {
        const session = await prisma.chatSession.findUnique({
          where: { id: payload.sessionId },
        });
        if (!session || session.endedAt) {
          console.log('[Chat] Session not found or ended');
          return;
        }
        if (session.currentStage < 2) {
          console.log('[Chat] Stage too low for photo:', session.currentStage);
          socket.emit('error', {
            message: 'Bu seviyede fotoğraf gönderemezsiniz.',
            code: 'PHOTO_NOT_ALLOWED',
          });
          return;
        }

        // Alıcıyı belirle (session'daki diğer kullanıcı)
        const receiverId = session.user1Id === payload.senderId ? session.user2Id : session.user1Id;

        // İLK MEDYA KONTROLÜ: Bu gönderenin bu alıcıya daha önce gönderdiği FOTO sayısı
        const previousPhotoCount = await prisma.message.count({
          where: {
            chatSessionId: session.id,
            senderId: payload.senderId,
            mediaType: 'photo',
          },
        });

        // İlk foto ise: locked=false, isFirstFree=true
        // Sonrakiler: locked=true, isFirstFree=false
        const isFirstFree = previousPhotoCount === 0;
        const locked = !isFirstFree;
        const mediaPrice = MEDIA_COSTS.photo; // 20 token

        console.log(`[Chat] Photo - previousCount: ${previousPhotoCount}, isFirstFree: ${isFirstFree}, locked: ${locked}`);

        const message = await prisma.message.create({
          data: {
            chatSessionId: session.id,
            senderId: payload.senderId,
            mediaUrl: payload.url,
            mediaType: 'photo',
            locked,
            isFirstFree,
            mediaPrice,
          },
        });

        console.log('[Chat] Photo message created:', message.id);
        
        // chat:message olarak emit et (mobile'da bu dinleniyor)
        io.to(session.id).emit('chat:message', {
          ...message,
          chatSessionId: session.id,
          isInstant: payload.isInstant || false,
        });
      } catch (error) {
        console.error('[Chat] Photo error:', error);
        socket.emit('error', {
          message: 'Fotoğraf gönderilemedi.',
          code: 'PHOTO_SEND_ERROR',
        });
      }
    },
  );

  socket.on(
    'media:video',
    async (payload: {
      sessionId: string;
      senderId: string;
      url: string;
    }) => {
      console.log('[Chat] media:video received:', payload);
      try {
        const session = await prisma.chatSession.findUnique({
          where: { id: payload.sessionId },
        });
        if (!session || session.endedAt) {
          console.log('[Chat] Session not found or ended');
          return;
        }
        if (session.currentStage < 3) {
          console.log('[Chat] Stage too low for video:', session.currentStage);
          socket.emit('error', {
            message: 'Bu seviyede video gönderemezsiniz.',
            code: 'VIDEO_NOT_ALLOWED',
          });
          return;
        }

        // İLK MEDYA KONTROLÜ: Bu gönderenin bu session'a daha önce gönderdiği VİDEO sayısı
        const previousVideoCount = await prisma.message.count({
          where: {
            chatSessionId: session.id,
            senderId: payload.senderId,
            mediaType: 'video',
          },
        });

        const isFirstFree = previousVideoCount === 0;
        const locked = !isFirstFree;
        const mediaPrice = MEDIA_COSTS.video; // 50 token

        console.log(`[Chat] Video - previousCount: ${previousVideoCount}, isFirstFree: ${isFirstFree}, locked: ${locked}`);

        const message = await prisma.message.create({
          data: {
            chatSessionId: session.id,
            senderId: payload.senderId,
            mediaUrl: payload.url,
            mediaType: 'video',
            locked,
            isFirstFree,
            mediaPrice,
          },
        });

        console.log('[Chat] Video message created:', message.id);
        
        // chat:message olarak emit et (mobile'da bu dinleniyor)
        io.to(session.id).emit('chat:message', {
          ...message,
          chatSessionId: session.id,
        });
      } catch (error) {
        console.error('[Chat] Video error:', error);
        socket.emit('error', {
          message: 'Video gönderilemedi.',
          code: 'VIDEO_SEND_ERROR',
        });
      }
    },
  );

  // Ses mesajı gönder
  socket.on(
    'media:audio',
    async (payload: {
      sessionId: string;
      senderId: string;
      url: string;
      duration?: number;
    }) => {
      console.log('[Chat] media:audio received:', payload);
      try {
        const session = await prisma.chatSession.findUnique({
          where: { id: payload.sessionId },
        });
        if (!session || session.endedAt) {
          console.log('[Chat] Session not found or ended');
          return;
        }
        // Stage 2'den itibaren ses gönderebilir
        if (session.currentStage < 2) {
          console.log('[Chat] Stage too low for audio:', session.currentStage);
          socket.emit('error', {
            message: 'Bu seviyede ses mesajı gönderemezsiniz.',
            code: 'AUDIO_NOT_ALLOWED',
          });
          return;
        }

        // İLK MEDYA KONTROLÜ: Bu gönderenin bu session'a daha önce gönderdiği SES sayısı
        const previousAudioCount = await prisma.message.count({
          where: {
            chatSessionId: session.id,
            senderId: payload.senderId,
            mediaType: 'audio',
          },
        });

        const isFirstFree = previousAudioCount === 0;
        const locked = !isFirstFree;
        const mediaPrice = MEDIA_COSTS.audio; // 5 token

        console.log(`[Chat] Audio - previousCount: ${previousAudioCount}, isFirstFree: ${isFirstFree}, locked: ${locked}`);

        const message = await prisma.message.create({
          data: {
            chatSessionId: session.id,
            senderId: payload.senderId,
            mediaUrl: payload.url,
            mediaType: 'audio',
            locked,
            isFirstFree,
            mediaPrice,
          },
        });

        console.log('[Chat] Audio message created:', message.id);
        
        // chat:message olarak emit et
        io.to(session.id).emit('chat:message', {
          ...message,
          chatSessionId: session.id,
          duration: payload.duration || 0,
        });
      } catch (error) {
        console.error('[Chat] Audio error:', error);
        socket.emit('error', {
          message: 'Ses mesajı gönderilemedi.',
          code: 'AUDIO_SEND_ERROR',
        });
      }
    },
  );

  // Elmas gönder - YENİ SİSTEM
  socket.on(
    'gift:send',
    async (payload: {
      fromUserId: string;
      toUserId: string;
      sessionId: string;
      amount: number;
    }) => {
      try {
        // 🔴 KILL SWITCH: Elmas sistemi kapalıysa işlemi reddet
        logTokenGiftAttempt(!FEATURES.TOKEN_GIFT_ENABLED);
        if (!FEATURES.TOKEN_GIFT_ENABLED) {
          console.log('[Gift] ⛔ TOKEN GIFT DISABLED - Request blocked');
          socket.emit('gift:error', { 
            code: 'FEATURE_DISABLED', 
            message: FEATURES.TOKEN_GIFT_DISABLED_MESSAGE,
            disabled: true,
          });
          return;
        }

        const { fromUserId, toUserId, sessionId, amount } = payload;
        console.log('[Gift] ========== TOKEN GIFT START ==========');
        console.log('[Gift] Payload:', JSON.stringify(payload));

        // Validasyon
        if (!amount || amount <= 0 || amount > 10000) {
          socket.emit('gift:error', { code: 'INVALID_AMOUNT', message: 'Geçersiz miktar.' });
          return;
        }

        // Session kontrolü
        const session = await prisma.chatSession.findUnique({ where: { id: sessionId } });
        if (!session || session.endedAt) {
          socket.emit('gift:error', { code: 'INVALID_SESSION', message: 'Geçersiz sohbet.' });
          return;
        }

        // Gönderen ve alıcı kontrolü
        const sender = await prisma.user.findUnique({ where: { id: fromUserId } });
        const receiver = await prisma.user.findUnique({ where: { id: toUserId } });
        
        console.log('[Gift] Sender:', sender?.nickname, 'balance:', sender?.tokenBalance);
        console.log('[Gift] Receiver:', receiver?.nickname, 'balance:', receiver?.tokenBalance);

        if (!sender) {
          socket.emit('gift:error', { code: 'SENDER_NOT_FOUND', message: 'Gönderen bulunamadı.' });
          return;
        }

        if (sender.tokenBalance < amount) {
          console.log('[Gift] ERROR: Insufficient balance. Has:', sender.tokenBalance, 'Needs:', amount);
          socket.emit('gift:error', { 
            code: 'INSUFFICIENT_BALANCE', 
            message: 'Yetersiz elmas bakiyesi.',
            balance: sender.tokenBalance,
            required: amount,
          });
          return;
        }

        if (!receiver) {
          socket.emit('gift:error', { code: 'RECEIVER_NOT_FOUND', message: 'Alıcı bulunamadı.' });
          return;
        }

        // Transaction: Token transfer + Gift kaydı + Message kaydı
        // NOT: Gift gönderene SPARK YAZILMAZ (kötü niyetli kullanım riski)
        console.log('[Gift] Executing transaction...');
        const [updatedSender, updatedReceiver, gift, message] = await prisma.$transaction([
          // 1. Gönderenin bakiyesini düşür (SPARK YOK - kaldırıldı)
          prisma.user.update({
            where: { id: fromUserId },
            data: { 
              tokenBalance: { decrement: amount },
              // Spark KALDIRILDI - kötü niyetli kullanım riski
            },
          }),
          // 2. Alıcının bakiyesini artır (spark YOK)
          prisma.user.update({
            where: { id: toUserId },
            data: { 
              tokenBalance: { increment: amount },
              monthlyTokensReceived: { increment: amount },
            },
          }),
          // 3. Gift kaydı oluştur
          prisma.gift.create({
            data: {
              fromUserId,
              toUserId,
              sessionId,
              amount,
            },
          }),
          // 4. Mesaj olarak kaydet (chat geçmişinde görünsün)
          prisma.message.create({
            data: {
              chatSessionId: sessionId,
              senderId: fromUserId,
              content: null, // Token gift için content yok
              messageType: 'TOKEN_GIFT',
              tokenAmount: amount,
            },
          }),
        ]);
        
        console.log('[Gift] Transaction completed!');
        console.log('[Gift] AFTER - Sender balance:', updatedSender.tokenBalance);
        console.log('[Gift] AFTER - Receiver balance:', updatedReceiver.tokenBalance);
        console.log('[Gift] Message ID:', message.id);

        // Mesaj payload'ı oluştur
        const giftMessage = {
          id: message.id,
          chatSessionId: sessionId,
          senderId: fromUserId,
          senderNickname: sender.nickname,
          receiverId: toUserId,
          receiverNickname: receiver.nickname,
          content: null,
          messageType: 'TOKEN_GIFT',
          tokenAmount: amount,
          createdAt: message.createdAt.toISOString(),
        };

        // 1. Chat odasına mesaj olarak gönder (her iki kullanıcı görür)
        console.log(`[Gift] Emitting chat:message (TOKEN_GIFT) to session: ${sessionId}`);
        io.to(sessionId).emit('chat:message', giftMessage);

        // 2. Gönderene bakiye güncellemesi (SPARK YOK - kaldırıldı)
        console.log(`[Gift] Emitting gift:sent to sender: ${fromUserId}`);
        io.to(fromUserId).emit('gift:sent', {
          messageId: message.id,
          toUserId,
          amount,
          newBalance: updatedSender.tokenBalance,
        });
        // NOT: Spark emission kaldırıldı (kötü niyetli kullanım riski)

        // 3. Alana bakiye güncellemesi
        console.log(`[Gift] Emitting gift:received to receiver: ${toUserId}`);
        io.to(toUserId).emit('gift:received', {
          messageId: message.id,
          fromUserId,
          fromNickname: sender.nickname,
          amount,
          newBalance: updatedReceiver.tokenBalance,
        });

        console.log('[Gift] ========== TOKEN GIFT COMPLETE ==========');
        console.log(`[Gift] ${sender.nickname} -> ${receiver.nickname}: ${amount} tokens`);
      } catch (error) {
        console.error('[Gift] Error:', error);
        socket.emit('gift:error', {
          code: 'GIFT_FAILED',
          message: 'Elmas gönderilemedi.',
        });
      }
    },
  );

  // Medya görüntüleme - BASİT SİSTEM: locked field'ına bak
  socket.on(
    'media:view',
    async (payload: {
      messageId: string;
      userId: string;
    }) => {
      console.log('[Chat] media:view received:', payload);
      try {
        const { messageId, userId } = payload;

        // 1. Mesajı bul
        const message = await prisma.message.findUnique({
          where: { id: messageId },
        });

        if (!message) {
          socket.emit('error', {
            message: 'Mesaj bulunamadı.',
            code: 'MESSAGE_NOT_FOUND',
          });
          return;
        }

        // 2. Kendi mesajını görüntülüyorsa her zaman ücretsiz
        if (message.senderId === userId) {
          socket.emit('media:viewed', {
            messageId,
            success: true,
            cost: 0,
            free: true,
            mediaUrl: message.mediaUrl,
          });
          return;
        }

        // 3. Zaten görüntülenmişse (unlocked) tekrar açılmasın
        if (message.viewedBy === userId) {
          socket.emit('media:viewed', {
            messageId,
            success: true,
            cost: 0,
            alreadyViewed: true,
            mediaUrl: message.mediaUrl,
          });
          return;
        }

        // 4. LOCKED DEĞİLSE (ilk medya = ücretsiz)
        if (!message.locked) {
          console.log(`[Chat] FREE media view - isFirstFree: ${message.isFirstFree}`);
          
          // Mesajı görüntülendi olarak işaretle
          await prisma.message.update({
            where: { id: messageId },
            data: {
              viewedBy: userId,
              viewedAt: new Date(),
            },
          });

          const viewer = await prisma.user.findUnique({ where: { id: userId } });

          socket.emit('media:viewed', {
            messageId,
            success: true,
            cost: 0,
            free: true,
            isFirstFree: message.isFirstFree,
            mediaUrl: message.mediaUrl,
            newBalance: viewer?.tokenBalance || 0,
          });

          console.log(`[Chat] FREE media viewed: ${messageId} by ${userId}`);
          return;
        }

        // 5. LOCKED İSE - ücretli açma
        const cost = message.mediaPrice || MEDIA_COSTS.photo;
        
        console.log(`[Chat] PAID media view - cost: ${cost}`);

        // 6. Bakiye kontrolü
        const viewer = await prisma.user.findUnique({
          where: { id: userId },
        });

        if (!viewer || viewer.tokenBalance < cost) {
          socket.emit('error', {
            message: `Yetersiz elmas bakiyesi. ${cost} elmas gerekiyor.`,
            code: 'INSUFFICIENT_BALANCE',
            required: cost,
            balance: viewer?.tokenBalance || 0,
          });
          return;
        }

        // 7. Transaction: Token düş, Spark ekle, Mesaj aç - GÜNCEL BAKİYELERİ DÖN
        console.log(`[Chat] 📸 MEDYA AÇ BAŞLADI - viewer: ${userId}, viewerBalance: ${viewer.tokenBalance}, cost: ${cost}`);
        
        const result = await prisma.$transaction(async (tx) => {
          // Görüntüleyenin bakiyesini düşür VE güncel değeri al
          const updatedViewer = await tx.user.update({
            where: { id: userId },
            data: { tokenBalance: { decrement: cost } },
            select: { tokenBalance: true },
          });
          
          // Gönderene SPARK kazandır VE güncel değeri al
          const updatedSender = await tx.user.update({
            where: { id: message.senderId },
            data: { 
              monthlySparksEarned: { increment: cost },
              totalSparksEarned: { increment: cost },
            },
            select: { monthlySparksEarned: true, totalSparksEarned: true },
          });
          
          // Mesajı aç (locked = false)
          await tx.message.update({
            where: { id: messageId },
            data: {
              locked: false,
              viewedBy: userId,
              viewedAt: new Date(),
            },
          });
          
          // SparkTransaction kaydet
          await tx.sparkTransaction.create({
            data: {
              fromUserId: userId,
              toUserId: message.senderId,
              amount: cost,
              reason: 'media_unlock',
            },
          });
          
          return { updatedViewer, updatedSender };
        });

        console.log(`[Chat] ✅ MEDYA AÇ TAMAMLANDI - viewerNewBalance: ${result.updatedViewer.tokenBalance}, senderSparks: ${result.updatedSender.monthlySparksEarned}`);

        // 8. Socket bildirimleri - TEK KAYNAK: Transaction sonucu
        // token:spent - AuthContext bu eventi dinliyor
        io.to(userId).emit('token:spent', {
          amount: cost,
          newBalance: result.updatedViewer.tokenBalance,
          reason: 'media_view',
        });

        // spark:earned - gönderene bildir
        io.to(message.senderId).emit('spark:earned', {
          amount: cost,
          monthlySparksEarned: result.updatedSender.monthlySparksEarned,
          totalSparksEarned: result.updatedSender.totalSparksEarned,
          reason: 'media_viewed',
          fromUserId: userId,
        });

        // 9. Görüntüleme onayı - aynı newBalance
        socket.emit('media:viewed', {
          messageId,
          success: true,
          cost,
          free: false,
          mediaUrl: message.mediaUrl,
          newBalance: result.updatedViewer.tokenBalance,
        });

        console.log(`[Chat] 📤 Events emitted - newBalance: ${result.updatedViewer.tokenBalance}`);
      } catch (error) {
        console.error('[Chat] Media view error:', error);
        socket.emit('error', {
          message: 'Görüntüleme işlemi başarısız.',
          code: 'VIEW_ERROR',
        });
      }
    },
  );

  // Mock token satın alma (test için)
  socket.on(
    'tokens:mock_purchase',
    async (payload: { userId: string; amount: number }) => {
      console.log('[Chat] tokens:mock_purchase received:', payload);
      try {
        const { userId, amount } = payload;

        if (!amount || amount <= 0 || amount > 10000) {
          socket.emit('error', {
            message: 'Geçersiz miktar.',
            code: 'INVALID_AMOUNT',
          });
          return;
        }

        // Kullanıcının bakiyesini artır
        const user = await prisma.user.update({
          where: { id: userId },
          data: { tokenBalance: { increment: amount } },
        });

        console.log(`[Chat] Mock purchase: ${user.nickname} +${amount} tokens, new balance: ${user.tokenBalance}`);

        // Kullanıcıya yeni bakiyeyi bildir
        io.to(userId).emit('token:balance_updated', {
          userId,
          newBalance: user.tokenBalance,
        });

        socket.emit('tokens:purchased', {
          success: true,
          amount,
          newBalance: user.tokenBalance,
        });
      } catch (error) {
        console.error('[Chat] Mock purchase error:', error);
        socket.emit('error', {
          message: 'Satın alma başarısız.',
          code: 'PURCHASE_FAILED',
        });
      }
    },
  );

  // Prime abonelik satın alma (mock)
  socket.on(
    'prime:purchase',
    async (payload: { userId: string; packageId: string }) => {
      console.log('[Chat] prime:purchase received:', payload);
      try {
        const { userId, packageId } = payload;

        // Abonelik süresini hesapla
        const now = new Date();
        let primeExpiry: Date;
        if (packageId === 'yearly') {
          primeExpiry = new Date(now.setFullYear(now.getFullYear() + 1));
        } else {
          primeExpiry = new Date(now.setMonth(now.getMonth() + 1));
        }

        // Kullanıcıyı Prime yap
        const user = await prisma.user.update({
          where: { id: userId },
          data: {
            isPrime: true,
            primeExpiry,
          },
        });

        console.log(`[Chat] Prime purchase: ${user.nickname} -> ${packageId}, expires: ${primeExpiry}`);

        // Kullanıcıya bildir
        io.to(userId).emit('prime:updated', {
          isPrime: true,
          primeExpiry: primeExpiry.toISOString(),
        });

        socket.emit('prime:purchased', {
          success: true,
          packageId,
          primeExpiry: primeExpiry.toISOString(),
        });
      } catch (error) {
        console.error('[Chat] Prime purchase error:', error);
        socket.emit('error', {
          message: 'Prime satın alma başarısız.',
          code: 'PRIME_PURCHASE_FAILED',
        });
      }
    },
  );

  // Token isteme
  socket.on(
    'token:request',
    async (payload: {
      fromUserId: string;
      toUserId: string;
      sessionId: string;
    }) => {
      console.log('[Chat] token:request received:', payload);
      try {
        const { fromUserId, toUserId, sessionId } = payload;

        // İsteyen kullanıcının bilgilerini al
        const requester = await prisma.user.findUnique({
          where: { id: fromUserId },
          select: { nickname: true },
        });

        // Karşı tarafa bildirim gönder
        io.to(toUserId).emit('token:requested', {
          fromUserId,
          fromNickname: requester?.nickname || 'Kullanıcı',
          sessionId,
          message: `${requester?.nickname || 'Kullanıcı'} fotoğrafı görmek için token istiyor.`,
        });

        console.log(`[Chat] Token requested from ${fromUserId} to ${toUserId}`);
      } catch (error) {
        console.error('[Chat] Token request error:', error);
      }
    },
  );
}

// Stage geçişi kontrolü - SADECE SÜRE BAZLI
async function handleStageProgress(
  io: Server,
  sessionId: string,
  senderId: string,
) {
  const session = await prisma.chatSession.findUnique({
    where: { id: sessionId },
  });
  if (!session || session.endedAt) return;

  // Geçen süreyi hesapla
  const elapsed = Math.floor(
    (Date.now() - session.stageStartedAt.getTime()) / 1000,
  );
  const stage = STAGE_CONFIG[session.currentStage];

  // Süre dolmuş mu? (Mesaj şartı YOK - sadece süre)
  if (elapsed >= stage.duration && session.currentStage < 5) {
    const newStage = session.currentStage + 1;
    if (!STAGE_CONFIG[newStage]) return;

    const advanced = await prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        currentStage: newStage,
        stageStartedAt: new Date(),
      },
    });

    console.log(`[Chat] Stage advanced: ${session.currentStage} -> ${newStage} for session ${sessionId}`);

    io.to(sessionId).emit('stage:advanced', {
      newStage: advanced.currentStage,
      features: STAGE_CONFIG[advanced.currentStage].features,
      animation: 'confetti',
    });
  }
}

// Sohbeti sonlandır ve diğer kullanıcıya bildir
async function endChatSession(
  io: Server,
  sessionId: string,
  leavingUserId: string,
  reason: 'left' | 'disconnected',
) {
  console.log('[Chat] endChatSession called:', { sessionId, leavingUserId, reason });
  
  try {
    // Session'ı al (relation olmadan)
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      console.log('[Chat] Session not found:', sessionId);
      return;
    }
    
    if (session.endedAt) {
      console.log('[Chat] Session already ended:', sessionId);
      return;
    }

    // Session'ı bitir
    await prisma.chatSession.update({
      where: { id: sessionId },
      data: { endedAt: new Date() },
    });
    console.log('[Chat] Session marked as ended in DB');

    // Diğer kullanıcıyı bul
    const otherUserId =
      leavingUserId === session.user1Id ? session.user2Id : session.user1Id;

    // Çıkan kullanıcının bilgilerini al
    const leavingUser = await prisma.user.findUnique({
      where: { id: leavingUserId },
      select: { nickname: true },
    });

    console.log('[Chat] Other user to notify:', otherUserId);

    // Free media usage'ı temizle
    freeMediaUsage.delete(sessionId);

    // Aktif session'ları temizle
    activeUserSessions.delete(session.user1Id);
    activeUserSessions.delete(session.user2Id);

    // Diğer kullanıcıya bildir
    const endedPayload = {
      sessionId,
      reason,
      message:
        reason === 'left'
          ? `${leavingUser?.nickname || 'Kullanıcı'} sohbetten ayrıldı.`
          : `${leavingUser?.nickname || 'Kullanıcı'} bağlantısı koptu.`,
    };
    
    console.log('[Chat] Emitting chat:ended to other user:', otherUserId, endedPayload);
    io.to(otherUserId).emit('chat:ended', endedPayload);

    // Çıkan kullanıcıya da onay gönder
    console.log('[Chat] Emitting chat:ended to leaving user:', leavingUserId);
    io.to(leavingUserId).emit('chat:ended', {
      sessionId,
      reason: 'self',
      message: 'Sohbetten ayrıldınız.',
    });

    console.log(`[Chat] Session ${sessionId} ended successfully. User ${leavingUserId} ${reason}.`);
  } catch (error) {
    console.error('[Chat] Error ending session:', error);
  }
}

// Export for use in other modules if needed
export { activeUserSessions, endChatSession };

