import { Server, Socket } from 'socket.io';
import { prisma } from '../prisma';
import { FEATURES, logTokenGiftAttempt } from '../config/features';

// ============ SNAPCHAT-STYLE ARCHITECTURE ============
// - Tek event yolu: friendchat room
// - Anında UI güncelleme
// - Bağlantı yönetimi
// - 100K+ kullanıcı için optimize

// Sohbet ekranında olan kullanıcıları takip et
const chatPresence: Map<string, Set<string>> = new Map(); // friendshipId -> Set<userId>

// Socket -> User mapping (reconnect için)
const socketToUser: Map<string, { odaId: string; friendshipId: string }> = new Map();

export function registerFriendsHandlers(io: Server, socket: Socket) {
  
  // ============ ARKADAŞLIK İSTEĞİ GÖNDER ============
  socket.on(
    'friend:request',
    async (payload: { fromUserId: string; toUserId: string; sessionId?: string }) => {
      try {
        const { fromUserId, toUserId } = payload;
        console.log(`[Friends] Request: ${fromUserId} -> ${toUserId}`);

        // Kendine istek gönderemez
        if (fromUserId === toUserId) {
          socket.emit('friend:request:error', { code: 'SELF_REQUEST', message: 'Kendinize istek gönderemezsiniz' });
          return;
        }

        // Kullanıcılar var mı?
        const [fromUser, toUser] = await Promise.all([
          prisma.user.findUnique({ where: { id: fromUserId }, select: { id: true, nickname: true } }),
          prisma.user.findUnique({ where: { id: toUserId }, select: { id: true, nickname: true } }),
        ]);

        if (!fromUser || !toUser) {
          socket.emit('friend:request:error', { code: 'USER_NOT_FOUND', message: 'Kullanıcı bulunamadı' });
          return;
        }

        // Zaten arkadaş mı?
        const existingFriendship = await prisma.friendship.findFirst({
          where: {
            OR: [
              { user1Id: fromUserId, user2Id: toUserId },
              { user1Id: toUserId, user2Id: fromUserId },
            ],
          },
        });

        if (existingFriendship) {
          socket.emit('friend:request:error', { code: 'ALREADY_FRIENDS', message: 'Zaten arkadaşsınız' });
          return;
        }

        // Bekleyen istek var mı?
        const existingRequest = await prisma.friendRequest.findFirst({
          where: {
            OR: [
              { fromUserId, toUserId, status: 'PENDING' },
              { fromUserId: toUserId, toUserId: fromUserId, status: 'PENDING' },
            ],
          },
        });

        if (existingRequest) {
          // Karşı taraftan gelen bekleyen istek varsa, otomatik kabul et
          if (existingRequest.fromUserId === toUserId) {
            // Otomatik kabul
            await prisma.friendRequest.update({
              where: { id: existingRequest.id },
              data: { status: 'ACCEPTED', respondedAt: new Date() },
            });

            // Arkadaşlık oluştur
            const friendship = await prisma.friendship.create({
              data: { user1Id: fromUserId, user2Id: toUserId },
            });

            // Her iki tarafa da bildir
            io.to(fromUserId).emit('friend:accepted', {
              friendshipId: friendship.id,
              user1Id: fromUserId,
              user2Id: toUserId,
            });
            io.to(toUserId).emit('friend:accepted', {
              friendshipId: friendship.id,
              user1Id: fromUserId,
              user2Id: toUserId,
            });

            console.log(`[Friends] Auto-accepted: ${fromUserId} <-> ${toUserId}`);
            return;
          }

          // Kendi gönderdiğim istek zaten var
          socket.emit('friend:request:error', { code: 'ALREADY_SENT', message: 'Zaten istek gönderilmiş' });
          return;
        }

        // Yeni istek oluştur
        const request = await prisma.friendRequest.create({
          data: { fromUserId, toUserId, status: 'PENDING' },
        });

        // Gönderene onay
        socket.emit('friend:request:sent', { requestId: request.id, toUserId });

        // Alıcıya bildirim
        io.to(toUserId).emit('friend:request:received', {
          requestId: request.id,
          fromUserId,
          toUserId,
          fromNickname: fromUser.nickname,
        });

        console.log(`[Friends] Request sent: ${request.id}`);
      } catch (error) {
        console.error('[Friends] Request error:', error);
        socket.emit('friend:request:error', { code: 'REQUEST_ERROR', message: 'İstek gönderilemedi' });
      }
    },
  );

  // ============ ARKADAŞ CHAT ODASINA KATIL ============
  socket.on(
    'friend:join',
    async (payload: { friendshipId: string; userId?: string }) => {
      const { friendshipId, userId } = payload;

      const friendship = await prisma.friendship.findUnique({
        where: { id: friendshipId },
      });
      if (!friendship) {
        socket.emit('friend:error', { code: 'FRIENDSHIP_NOT_FOUND', message: 'Arkadaşlık bulunamadı' });
        return;
      }

      const room = `friendchat:${friendshipId}`;
      
      // 🚀 Socket'i hem friendchat room'una hem userId room'una katıl
      socket.join(room);
      if (userId) {
        socket.join(userId);
        socketToUser.set(socket.id, { odaId: userId, friendshipId });
      }
      
      console.log(`[Friends] Socket ${socket.id} joined rooms: ${room}, ${userId || 'no-user'}`);

      // Presence tracking
      if (userId) {
        if (!chatPresence.has(friendshipId)) {
          chatPresence.set(friendshipId, new Set());
        }
        
        // Mevcut online kullanıcıları al (benim dışımda)
        const existingUsers = Array.from(chatPresence.get(friendshipId) || []);
        
        chatPresence.get(friendshipId)?.add(userId);
        
        // Diğer kullanıcıya bildir - SADECE room'a
        io.to(room).emit('friend:presence', {
          friendshipId,
          userId,
          isOnline: true,
        });
        
        // Bana mevcut online kullanıcıları bildir
        existingUsers.forEach(existingUserId => {
          if (existingUserId !== userId) {
            socket.emit('friend:presence', {
              friendshipId,
              userId: existingUserId,
              isOnline: true,
            });
          }
        });
        
        console.log(`[Friends] User ${userId} online in ${friendshipId}, users:`, Array.from(chatPresence.get(friendshipId) || []));
      }
      
      // Başarılı katılım onayı
      socket.emit('friend:joined', { friendshipId, success: true });
    },
  );

  // ============ ARKADAŞ CHAT ODASINDAN AYRIL ============
  socket.on(
    'friend:leave',
    async (payload: { friendshipId: string; userId?: string }) => {
      const { friendshipId, userId } = payload;
      
      if (userId && chatPresence.has(friendshipId)) {
        chatPresence.get(friendshipId)?.delete(userId);
        
        const room = `friendchat:${friendshipId}`;
        socket.leave(room);
        
        io.to(room).emit('friend:presence', {
          friendshipId,
          userId,
          isOnline: false,
        });
        
        socketToUser.delete(socket.id);
        console.log(`[Friends] User ${userId} left ${friendshipId}`);
      }
    },
  );

  // ============ SOCKET DISCONNECT - Cleanup ============
  socket.on('disconnect', () => {
    const userData = socketToUser.get(socket.id);
    if (userData) {
      const { odaId, friendshipId } = userData;
      if (chatPresence.has(friendshipId)) {
        chatPresence.get(friendshipId)?.delete(odaId);
        
        const room = `friendchat:${friendshipId}`;
        io.to(room).emit('friend:presence', {
          friendshipId,
          odaId,
          isOnline: false,
        });
      }
      socketToUser.delete(socket.id);
      console.log(`[Friends] Socket ${socket.id} disconnected, user ${odaId} removed from ${friendshipId}`);
    }
  });

  // ============ METİN MESAJI GÖNDER ============
  socket.on(
    'friend:message',
    async (payload: {
      friendshipId: string;
      senderId: string;
      content: string;
    }) => {
      const { friendshipId, senderId, content } = payload;
      if (!content.trim()) return;

      const friendship = await prisma.friendship.findUnique({
        where: { id: friendshipId },
      });
      if (!friendship) return;
      if (senderId !== friendship.user1Id && senderId !== friendship.user2Id) return;

      // FriendChat bul/oluştur
      let chat = await prisma.friendChat.findFirst({
        where: { friendshipId },
      });
      if (!chat) {
        chat = await prisma.friendChat.create({
          data: { friendshipId },
        });
      }

      // Alıcıyı belirle
      const receiverId = friendship.user1Id === senderId ? friendship.user2Id : friendship.user1Id;

      const message = await prisma.friendChatMessage.create({
        data: {
          friendChatId: chat.id,
          senderId,
          content,
        },
      });

      // Gönderen bilgisini al (bildirim için)
      const sender = await prisma.user.findUnique({
        where: { id: senderId },
        select: { nickname: true },
      });

      const messagePayload = {
        id: message.id,
        friendChatId: friendshipId,
        senderId: message.senderId,
        senderNickname: sender?.nickname || 'Birisi',
        content: message.content,
        mediaUrl: null,
        mediaType: null,
        createdAt: message.createdAt,
      };

      // 🚀 Room'a gönder (sohbet ekranındakiler için)
      const room = `friendchat:${friendshipId}`;
      io.to(room).emit('friend:message', messagePayload);
      
      // 🔔 Alıcının userId room'una bildirim gönder (sohbet dışındayken)
      io.to(receiverId).emit('friend:notification', {
        type: 'message',
        friendshipId,
        senderId,
        senderNickname: sender?.nickname || 'Birisi',
        preview: content.substring(0, 50),
        timestamp: message.createdAt,
      });
      
      console.log(`[Friends] Message sent to room ${room} and notification to ${receiverId}`);
    },
  );

  // ============ MEDYA MESAJI GÖNDER ============
  socket.on(
    'friend:media',
    async (payload: {
      friendshipId: string;
      senderId: string;
      mediaType: 'audio' | 'photo' | 'video';
      mediaUrl: string;
      thumbnailUrl?: string; // 🎬 Video thumbnail URL
      isInstant?: boolean;
      duration?: number;
    }) => {
      try {
        const { friendshipId, senderId, mediaType, mediaUrl, thumbnailUrl, isInstant, duration } = payload;
        console.log(`[Friends] Media: ${mediaType} from ${senderId}`);

        const friendship = await prisma.friendship.findUnique({
          where: { id: friendshipId },
        });
        if (!friendship) return;
        if (senderId !== friendship.user1Id && senderId !== friendship.user2Id) return;

        let chat = await prisma.friendChat.findFirst({
          where: { friendshipId },
        });
        if (!chat) {
          chat = await prisma.friendChat.create({
            data: { friendshipId },
          });
        }

        const receiverId = friendship.user1Id === senderId ? friendship.user2Id : friendship.user1Id;

        // İLK MEDYA KONTROLÜ
        const counter = await prisma.friendMediaCounter.findUnique({
          where: {
            friendChatId_senderId_mediaType: {
              friendChatId: chat.id,
              senderId,
              mediaType,
            },
          },
        });

        const previousMediaCount = counter?.count || 0;
        const isFirstFree = previousMediaCount === 0;
        const locked = !isFirstFree;
        
        const MEDIA_COSTS = { audio: 5, photo: 20, video: 50 };
        const mediaPrice = MEDIA_COSTS[mediaType] || 20;

        // Sayacı artır
        await prisma.friendMediaCounter.upsert({
          where: {
            friendChatId_senderId_mediaType: {
              friendChatId: chat.id,
              senderId,
              mediaType,
            },
          },
          update: { count: { increment: 1 } },
          create: {
            friendChatId: chat.id,
            senderId,
            receiverId,
            mediaType,
            count: 1,
          },
        });

        const message = await prisma.friendChatMessage.create({
          data: {
            friendChatId: chat.id,
            senderId,
            mediaUrl,
            thumbnailUrl, // 🎬 Thumbnail URL
            mediaType,
            locked,
            isFirstFree,
            mediaPrice,
          },
        });

        // Gönderen bilgisini al
        const sender = await prisma.user.findUnique({
          where: { id: senderId },
          select: { nickname: true },
        });

        const messagePayload = {
          id: message.id,
          friendChatId: friendshipId,
          senderId: message.senderId,
          senderNickname: sender?.nickname || 'Birisi',
          content: null,
          mediaUrl: message.mediaUrl,
          thumbnailUrl: message.thumbnailUrl, // 🎬 Thumbnail URL
          mediaType: message.mediaType,
          locked: message.locked,
          isFirstFree: message.isFirstFree,
          mediaPrice: message.mediaPrice,
          isInstant,
          duration,
          createdAt: message.createdAt,
        };

        // 🚀 Room'a gönder
        const room = `friendchat:${friendshipId}`;
        
        console.log(`[Friends] 📸 MEDIA PAYLOAD:`, JSON.stringify(messagePayload, null, 2));
        
        io.to(room).emit('friend:message', messagePayload);
        
        // 🔔 Alıcının userId room'una bildirim gönder
        const mediaTypeText = mediaType === 'photo' ? 'Fotoğraf' : mediaType === 'video' ? 'Video' : 'Ses';
        const mediaEmoji = mediaType === 'photo' ? '📷' : mediaType === 'video' ? '🎬' : '🎤';
        io.to(receiverId).emit('friend:notification', {
          type: 'media',
          friendshipId,
          senderId,
          senderNickname: sender?.nickname || 'Birisi',
          preview: `${mediaEmoji} ${mediaTypeText} gönderdi`,
          timestamp: message.createdAt,
        });
        
        console.log(`[Friends] Media sent to room ${room} and notification to ${receiverId}`);
      } catch (error) {
        console.error('[Friends] Media error:', error);
        socket.emit('friend:error', { code: 'MEDIA_ERROR', message: 'Medya gönderilemedi' });
      }
    },
  );

  // ============ 🚀 ELMAS GÖNDERİMİ - SNAPCHAT STYLE ============
  socket.on(
    'friend:gift',
    async (payload: {
      fromUserId: string;
      toUserId: string;
      friendshipId: string;
      amount: number;
    }) => {
      const startTime = Date.now();
      
      try {
        // KILL SWITCH
        logTokenGiftAttempt(!FEATURES.TOKEN_GIFT_ENABLED);
        if (!FEATURES.TOKEN_GIFT_ENABLED) {
          socket.emit('friend:gift:error', { 
            code: 'FEATURE_DISABLED', 
            message: FEATURES.TOKEN_GIFT_DISABLED_MESSAGE,
            disabled: true,
          });
          return;
        }

        const { fromUserId, toUserId, friendshipId, amount } = payload;
        console.log(`[Friends] 🎁 Gift: ${amount} from ${fromUserId} to ${toUserId}`);

        // Validasyonlar paralel
        const [friendship, sender, receiver] = await Promise.all([
          prisma.friendship.findUnique({ where: { id: friendshipId } }),
          prisma.user.findUnique({ where: { id: fromUserId }, select: { id: true, nickname: true, tokenBalance: true } }),
          prisma.user.findUnique({ where: { id: toUserId }, select: { id: true, tokenBalance: true } }),
        ]);

        if (!friendship) {
          socket.emit('friend:gift:error', { code: 'FRIENDSHIP_NOT_FOUND', message: 'Arkadaşlık bulunamadı' });
          return;
        }
        if (!sender || !receiver) {
          socket.emit('friend:gift:error', { code: 'USER_NOT_FOUND', message: 'Kullanıcı bulunamadı' });
          return;
        }
        if (sender.tokenBalance < amount) {
          socket.emit('friend:gift:error', { code: 'INSUFFICIENT_BALANCE', message: 'Yetersiz bakiye' });
          return;
        }

        // 🚀 Transaction ile bakiye güncelleme
        const [updatedSender, updatedReceiver] = await prisma.$transaction([
          prisma.user.update({
            where: { id: fromUserId },
            data: { tokenBalance: { decrement: amount } },
            select: { tokenBalance: true },
          }),
          prisma.user.update({
            where: { id: toUserId },
            data: { tokenBalance: { increment: amount } },
            select: { tokenBalance: true },
          }),
        ]);

        console.log(`[Friends] 💰 Balances: sender=${updatedSender.tokenBalance}, receiver=${updatedReceiver.tokenBalance}`);

        // 🚀 TEK EVENT - Room'a gönder
        const room = `friendchat:${friendshipId}`;
        const giftEvent = {
          fromUserId,
          toUserId,
          amount,
          fromNickname: sender.nickname,
          senderNewBalance: updatedSender.tokenBalance,
          receiverNewBalance: updatedReceiver.tokenBalance,
          timestamp: Date.now(),
        };
        
        io.to(room).emit('friend:gift:update', giftEvent);
        
        const elapsed = Date.now() - startTime;
        console.log(`[Friends] ✅ Gift complete in ${elapsed}ms`);
        
      } catch (error) {
        console.error('[Friends] Gift error:', error);
        socket.emit('friend:gift:error', { code: 'GIFT_ERROR', message: 'Hediye gönderilemedi' });
      }
    },
  );

  // ============ MEDYA SİLME (Snapchat tarzı) ============
  socket.on(
    'friend:media:delete',
    async (payload: { messageId: string; friendshipId: string; deletedBy: string }) => {
      try {
        const { messageId, friendshipId, deletedBy } = payload;
        
        await prisma.friendChatMessage.delete({
          where: { id: messageId },
        });

        const room = `friendchat:${friendshipId}`;
        io.to(room).emit('friend:media:deleted', { messageId, friendshipId, deletedBy });
        
        console.log(`[Friends] Media ${messageId} deleted by ${deletedBy}`);
      } catch (error) {
        console.error('[Friends] Media delete error:', error);
      }
    },
  );

  // ============ MEDYA GÖRÜNTÜLEME (Elmas ile açma) ============
  socket.on(
    'friend:media:view',
    async (payload: { messageId: string; viewerId: string; friendshipId: string }) => {
      try {
        const { messageId, viewerId, friendshipId } = payload;
        console.log(`[Friends] Media view: ${messageId} by ${viewerId}`);
        
        const message = await prisma.friendChatMessage.findUnique({
          where: { id: messageId },
        });
        
        if (!message) {
          console.log('[Friends] Message not found');
          socket.emit('friend:media:viewed', { 
            messageId, 
            success: false, 
            error: 'MESSAGE_NOT_FOUND' 
          });
          return;
        }
        
        // Zaten açık (ilk ücretsiz dahil)
        if (!message.locked) {
          console.log('[Friends] Media already unlocked, marking as viewed');
          await prisma.friendChatMessage.update({
            where: { id: messageId },
            data: { readAt: new Date() },
          });
          
          // Direkt socket'e cevap ver (Match sistemiyle aynı)
          socket.emit('friend:media:viewed', { 
            messageId, 
            success: true, 
            free: true,
            cost: 0,
          });
          return;
        }
        
        // Kilitli medya - bakiye kontrolü
        const viewer = await prisma.user.findUnique({
          where: { id: viewerId },
          select: { tokenBalance: true },
        });
        
        const cost = message.mediaPrice || 0;
        
        if (!viewer || viewer.tokenBalance < cost) {
          console.log('[Friends] Insufficient balance');
          socket.emit('friend:media:viewed', { 
            messageId, 
            success: false, 
            error: 'INSUFFICIENT_BALANCE',
            required: cost,
            balance: viewer?.tokenBalance || 0,
          });
          return;
        }
        
        // Transaction: Token düş, Spark ekle, Mesaj aç (Match sistemiyle aynı)
        console.log(`[Friends] 📸 MEDYA AÇ BAŞLADI - viewer: ${viewerId}, cost: ${cost}`);
        
        const result = await prisma.$transaction(async (tx) => {
          // Görüntüleyenin bakiyesini düşür
          const updatedViewer = await tx.user.update({
            where: { id: viewerId },
            data: { tokenBalance: { decrement: cost } },
            select: { tokenBalance: true },
          });
          
          // Gönderene SPARK kazandır (tokenBalance DEĞİL!)
          const updatedSender = await tx.user.update({
            where: { id: message.senderId },
            data: { 
              monthlySparksEarned: { increment: cost },
              totalSparksEarned: { increment: cost },
            },
            select: { monthlySparksEarned: true, totalSparksEarned: true },
          });
          
          // Mesajı aç
          await tx.friendChatMessage.update({
            where: { id: messageId },
            data: { locked: false, readAt: new Date() },
          });
          
          // SparkTransaction kaydet
          await tx.sparkTransaction.create({
            data: {
              fromUserId: viewerId,
              toUserId: message.senderId,
              amount: cost,
              reason: 'media_unlock',
            },
          });
          
          return { updatedViewer, updatedSender };
        });
        
        console.log(`[Friends] ✅ MEDYA AÇ TAMAMLANDI - viewerNewBalance: ${result.updatedViewer.tokenBalance}, senderSparks: ${result.updatedSender.monthlySparksEarned}`);
        
        // Socket bildirimleri - Match sistemiyle aynı
        // token:spent - AuthContext bu eventi dinliyor
        io.to(viewerId).emit('token:spent', {
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
          fromUserId: viewerId,
        });
        
        // Direkt socket'e cevap ver (Match sistemiyle aynı)
        socket.emit('friend:media:viewed', { 
          messageId, 
          success: true, 
          cost,
          newBalance: result.updatedViewer.tokenBalance,
        });
        
      } catch (error) {
        console.error('[Friends] Media view error:', error);
        socket.emit('friend:media:viewed', { 
          messageId: payload.messageId, 
          success: false, 
          error: 'VIEW_ERROR' 
        });
      }
    },
  );

}
