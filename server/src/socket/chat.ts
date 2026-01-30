import { Server, Socket } from 'socket.io';
import { prisma } from '../prisma';

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
    // Stage 1: Sadece text + jeton gönderimi (TEST: 10 saniye)
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
    }
  });

  // Kullanıcı room'dan ayrıl
  socket.on('user:leave', async (payload: { userId: string }) => {
    const { userId } = payload;
    if (userId) {
      console.log('[Chat] user:leave - leaving user room:', userId);
      socket.leave(userId);
      
      // Kullanıcıyı offline yap ve son görülme zamanını güncelle
      await prisma.user.update({
        where: { id: userId },
        data: { 
          isOnline: false,
          lastSeenAt: new Date(),
        },
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
      await prisma.user.update({
        where: { id: userIdToUpdate },
        data: { 
          isOnline: false,
          lastSeenAt: new Date(),
        },
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

        const usage =
          freeMediaUsage.get(session.id) ||
          {
            freePhotosUsed: new Map<string, number>(),
            freeVideosUsed: new Map<string, number>(),
          };

        const isUser1 = payload.senderId === session.user1Id;
        const key = isUser1 ? 'user1' : 'user2';
        const freeUsed =
          usage.freePhotosUsed.get(key) === undefined
            ? 0
            : usage.freePhotosUsed.get(key)!;

        let cost = 0;
        if (freeUsed === 0) {
          usage.freePhotosUsed.set(key, 1);
        } else {
          cost = STAGE_CONFIG[session.currentStage].photoCost || 5;
          await prisma.user.update({
            where: { id: payload.senderId },
            data: {
              tokenBalance: {
                decrement: cost,
              },
            },
          });
        }

        freeMediaUsage.set(session.id, usage);

        const message = await prisma.message.create({
          data: {
            chatSessionId: session.id,
            senderId: payload.senderId,
            mediaUrl: payload.url,
            mediaType: 'photo',
          },
        });

        console.log('[Chat] Photo message created:', message.id);
        
        // chat:message olarak emit et (mobile'da bu dinleniyor)
        io.to(session.id).emit('chat:message', {
          ...message,
          chatSessionId: session.id,
          isInstant: payload.isInstant || false,
        });
        
        // Maliyet bilgisi için ayrıca emit
        if (cost > 0) {
          socket.emit('media:cost', { cost, type: 'photo' });
        }
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

        const usage =
          freeMediaUsage.get(session.id) ||
          {
            freePhotosUsed: new Map<string, number>(),
            freeVideosUsed: new Map<string, number>(),
          };

        const isUser1 = payload.senderId === session.user1Id;
        const key = isUser1 ? 'user1' : 'user2';
        const freeUsed =
          usage.freeVideosUsed.get(key) === undefined
            ? 0
            : usage.freeVideosUsed.get(key)!;

        let cost = 0;
        if (freeUsed === 0) {
          usage.freeVideosUsed.set(key, 1);
        } else {
          cost = STAGE_CONFIG[session.currentStage].videoCost || 10;
          await prisma.user.update({
            where: { id: payload.senderId },
            data: {
              tokenBalance: {
                decrement: cost,
              },
            },
          });
        }

        freeMediaUsage.set(session.id, usage);

        const message = await prisma.message.create({
          data: {
            chatSessionId: session.id,
            senderId: payload.senderId,
            mediaUrl: payload.url,
            mediaType: 'video',
          },
        });

        console.log('[Chat] Video message created:', message.id);
        
        // chat:message olarak emit et (mobile'da bu dinleniyor)
        io.to(session.id).emit('chat:message', {
          ...message,
          chatSessionId: session.id,
        });
        
        // Maliyet bilgisi için ayrıca emit
        if (cost > 0) {
          socket.emit('media:cost', { cost, type: 'video' });
        }
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

        const message = await prisma.message.create({
          data: {
            chatSessionId: session.id,
            senderId: payload.senderId,
            mediaUrl: payload.url,
            mediaType: 'audio',
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

  // Jeton gönder - YENİ SİSTEM
  socket.on(
    'gift:send',
    async (payload: {
      fromUserId: string;
      toUserId: string;
      sessionId: string;
      amount: number;
    }) => {
      try {
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
            message: 'Yetersiz jeton bakiyesi.',
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
        console.log('[Gift] Executing transaction...');
        const [updatedSender, updatedReceiver, gift, message] = await prisma.$transaction([
          // 1. Gönderenin bakiyesini düşür
          prisma.user.update({
            where: { id: fromUserId },
            data: { tokenBalance: { decrement: amount } },
          }),
          // 2. Alıcının bakiyesini artır
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

        // 2. Gönderene bakiye güncellemesi
        console.log(`[Gift] Emitting gift:sent to sender: ${fromUserId}`);
        io.to(fromUserId).emit('gift:sent', {
          messageId: message.id,
          toUserId,
          amount,
          newBalance: updatedSender.tokenBalance,
        });

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
          message: 'Jeton gönderilemedi.',
        });
      }
    },
  );

  // Medya görüntüleme (token harcama + gönderene SPARK)
  socket.on(
    'media:view',
    async (payload: {
      messageId: string;
      userId: string;
      cost?: number; // Client'tan gelen cost kullanılmaz, server belirler
    }) => {
      console.log('[Chat] media:view received:', payload);
      try {
        const { messageId, userId } = payload;

        // Mesajı ve göndereni bul
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

        // Kendi mesajını görüntülüyorsa ücretsiz
        if (message.senderId === userId) {
          socket.emit('media:viewed', {
            messageId,
            success: true,
            cost: 0,
            wasFree: true,
          });
          return;
        }

        // Medya türüne göre maliyet belirle (SERVER'DA BELİRLENİR!)
        const mediaType = message.mediaType?.toLowerCase() || 'audio';
        let cost: number;
        if (mediaType === 'video') {
          cost = MEDIA_COSTS.video; // 50 token
        } else if (mediaType === 'photo') {
          cost = MEDIA_COSTS.photo; // 20 token
        } else {
          cost = MEDIA_COSTS.audio; // 5 token (ses)
        }

        console.log(`[Chat] media:view - type: ${mediaType}, cost: ${cost}`);

        // Kullanıcı bakiyesini kontrol et
        const viewer = await prisma.user.findUnique({
          where: { id: userId },
        });

        if (!viewer || viewer.tokenBalance < cost) {
          socket.emit('error', {
            message: 'Yetersiz jeton bakiyesi.',
            code: 'INSUFFICIENT_BALANCE',
            required: cost,
            balance: viewer?.tokenBalance || 0,
          });
          return;
        }

        // Transaction: Token harcanır, gönderene SPARK kazandırılır (token gitmez!)
        await prisma.$transaction([
          // Görüntüleyenin bakiyesini düşür (token harcanır)
          prisma.user.update({
            where: { id: userId },
            data: { tokenBalance: { decrement: cost } },
          }),
          // Gönderene SPARK kazandır (tokenBalance DEĞİŞMEZ!)
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
              viewedBy: userId,
              viewedAt: new Date(),
              viewTokenCost: cost,
            },
          }),
        ]);

        // Güncellenmiş bakiyeleri al
        const updatedViewer = await prisma.user.findUnique({ where: { id: userId } });
        const sender = await prisma.user.findUnique({ where: { id: message.senderId } });

        // Room kontrolü
        const viewerRoom = io.sockets.adapter.rooms.get(userId);
        const senderRoom = io.sockets.adapter.rooms.get(message.senderId);
        console.log(`[Chat] Room check - Viewer (${userId}): ${viewerRoom?.size || 0} sockets`);
        console.log(`[Chat] Room check - Sender (${message.senderId}): ${senderRoom?.size || 0} sockets`);

        // Görüntüleyene bildir (token harcandı)
        console.log(`[Chat] Emitting token:spent to viewer: ${userId}`);
        io.to(userId).emit('token:spent', {
          amount: cost,
          newBalance: updatedViewer?.tokenBalance || 0,
          reason: 'media_view',
        });

        // Gönderene bildir (SPARK kazandı - token değil!)
        console.log(`[Chat] Emitting spark:earned to sender: ${message.senderId}, amount: ${cost}, total: ${sender?.totalSparksEarned}`);
        io.to(message.senderId).emit('spark:earned', {
          amount: cost,
          monthlySparksEarned: sender?.monthlySparksEarned || 0,
          totalSparksEarned: sender?.totalSparksEarned || 0,
          reason: 'media_viewed',
        });

        // Görüntüleme onayı
        socket.emit('media:viewed', {
          messageId,
          success: true,
          cost,
          newBalance: updatedViewer?.tokenBalance || 0,
        });

        console.log(`[Chat] Media viewed: ${messageId} by ${userId}, cost: ${cost} token, sender ${message.senderId} earned ${cost} spark`);
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

