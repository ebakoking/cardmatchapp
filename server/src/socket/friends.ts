import { Server, Socket } from 'socket.io';
import { prisma } from '../prisma';

export function registerFriendsHandlers(io: Server, socket: Socket) {
  // Arkadaş chat odasına katıl
  socket.on(
    'friend:join',
    async (payload: { friendshipId: string }) => {
      const { friendshipId } = payload;

      const friendship = await prisma.friendship.findUnique({
        where: { id: friendshipId },
      });
      if (!friendship) return;

      const room = `friendchat:${friendshipId}`;
      socket.join(room);
      console.log(`[Friends] Socket joined room: ${room}`);
    },
  );

  // Arkadaş mesajı gönder (metin)
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
      if (
        senderId !== friendship.user1Id &&
        senderId !== friendship.user2Id
      )
        return;

      // İlgili FriendChat'i bul/yoksa oluştur
      let chat = await prisma.friendChat.findFirst({
        where: { friendshipId },
      });
      if (!chat) {
        chat = await prisma.friendChat.create({
          data: { friendshipId },
        });
      }

      const message = await prisma.friendChatMessage.create({
        data: {
          friendChatId: chat.id,
          senderId,
          content,
        },
      });

      const room = `friendchat:${friendshipId}`;
      io.to(room).emit('friend:message', {
        id: message.id,
        friendChatId: friendshipId, // friendshipId olarak gönder, client bunu bekliyor
        senderId: message.senderId,
        content: message.content,
        mediaUrl: message.mediaUrl,
        mediaType: null,
        createdAt: message.createdAt,
      });
    },
  );

  // Arkadaş medya gönder (ses/fotoğraf/video)
  socket.on(
    'friend:media',
    async (payload: {
      friendshipId: string;
      senderId: string;
      mediaType: 'audio' | 'photo' | 'video';
      mediaUrl: string;
      isInstant?: boolean;
      duration?: number;
    }) => {
      try {
        const { friendshipId, senderId, mediaType, mediaUrl, isInstant, duration } = payload;
        console.log(`[Friends] Media message: ${mediaType} from ${senderId}`);

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

        const message = await prisma.friendChatMessage.create({
          data: {
            friendChatId: chat.id,
            senderId,
            mediaUrl,
            mediaType,
          },
        });

        const room = `friendchat:${friendshipId}`;
        io.to(room).emit('friend:message', {
          id: message.id,
          friendChatId: friendshipId,
          senderId: message.senderId,
          content: null,
          mediaUrl: message.mediaUrl,
          mediaType: message.mediaType,
          isInstant,
          duration,
          createdAt: message.createdAt,
        });
      } catch (error) {
        console.error('[Friends] Media message error:', error);
      }
    },
  );

  // ============ ARKADAŞ HEDİYE ELMAS (SPARK'A YANSIR!) ============
  socket.on(
    'friend:gift',
    async (payload: {
      fromUserId: string;
      toUserId: string;
      friendshipId: string;
      amount: number;
    }) => {
      try {
        const { fromUserId, toUserId, friendshipId, amount } = payload;
        console.log('[Friends] ========== FRIEND GIFT (SPARK!) ==========');
        console.log('[Friends] Gift payload:', JSON.stringify(payload));

        // Arkadaşlık kontrolü
        console.log('[Friends] Checking friendship...');
        const friendship = await prisma.friendship.findUnique({
          where: { id: friendshipId },
        });
        if (!friendship) {
          console.log('[Friends] ERROR: Friendship not found!');
          socket.emit('error', { message: 'Arkadaşlık bulunamadı.', code: 'FRIENDSHIP_NOT_FOUND' });
          return;
        }
        console.log('[Friends] Friendship found:', friendship.id);

        // Gönderen ve alıcı kontrolü
        console.log('[Friends] Checking sender and receiver...');
        const sender = await prisma.user.findUnique({ where: { id: fromUserId } });
        const receiver = await prisma.user.findUnique({ where: { id: toUserId } });

        console.log('[Friends] Sender:', sender?.nickname, 'Balance:', sender?.tokenBalance);
        console.log('[Friends] Receiver:', receiver?.nickname);

        if (!sender) {
          console.log('[Friends] ERROR: Sender not found!');
          socket.emit('error', { message: 'Gönderen bulunamadı.', code: 'SENDER_NOT_FOUND' });
          return;
        }
        
        if (sender.tokenBalance < amount) {
          console.log('[Friends] ERROR: Insufficient balance! Has:', sender.tokenBalance, 'Needs:', amount);
          socket.emit('error', { message: 'Yetersiz elmas bakiyesi.', code: 'INSUFFICIENT_BALANCE' });
          return;
        }
        
        if (!receiver) {
          console.log('[Friends] ERROR: Receiver not found!');
          socket.emit('error', { message: 'Alıcı bulunamadı.', code: 'RECEIVER_NOT_FOUND' });
          return;
        }

        console.log(`[Friends] BEFORE - Sender: ${sender.nickname} balance: ${sender.tokenBalance}`);
        console.log(`[Friends] BEFORE - Receiver: ${receiver.nickname} balance: ${receiver.tokenBalance}, sparks: ${receiver.monthlySparksEarned}`);

        // Transaction: Gönderenden düş, alana ekle + SPARK GÜNCELLE!
        await prisma.$transaction([
          prisma.user.update({
            where: { id: fromUserId },
            data: { tokenBalance: { decrement: amount } },
          }),
          prisma.user.update({
            where: { id: toUserId },
            data: { 
              tokenBalance: { increment: amount },
              monthlyTokensReceived: { increment: amount },
              // ARKADAŞ HEDİYELERİ SPARK'A YANSIR!
              monthlySparksEarned: { increment: amount },
              totalSparksEarned: { increment: amount },
            },
          }),
          prisma.gift.create({
            data: {
              fromUserId,
              toUserId,
              sessionId: friendshipId, // friendshipId'yi sessionId olarak kullan
              amount,
            },
          }),
        ]);

        // Güncellenmiş bakiyeleri al
        const updatedSender = await prisma.user.findUnique({ where: { id: fromUserId } });
        const updatedReceiver = await prisma.user.findUnique({ where: { id: toUserId } });

        console.log(`[Friends] AFTER - Sender: ${updatedSender?.nickname} balance: ${updatedSender?.tokenBalance}`);
        console.log(`[Friends] AFTER - Receiver: ${updatedReceiver?.nickname} balance: ${updatedReceiver?.tokenBalance}, sparks: ${updatedReceiver?.monthlySparksEarned}`);

        // Hediye mesajını veritabanına kaydet (kalıcı olsun)
        const friendChat = await prisma.friendChat.findFirst({
          where: { friendshipId },
        });
        
        if (friendChat) {
          // Gönderen için mesaj
          await prisma.friendChatMessage.create({
            data: {
              friendChatId: friendChat.id,
              senderId: fromUserId,
              content: `💎 ${amount} elmas gönderdin!`,
              mediaType: null,
            },
          });
          
          // Alıcı için mesaj (sistem mesajı olarak)
          await prisma.friendChatMessage.create({
            data: {
              friendChatId: friendChat.id,
              senderId: 'system',
              content: `🎁 ${sender.nickname} sana ${amount} elmas gönderdi!`,
              mediaType: null,
            },
          });
          console.log('[Friends] Gift messages saved to database');
        }

        // Gönderene bildir
        console.log(`[Friends] Emitting friend:gift:sent to ${fromUserId}`);
        io.to(fromUserId).emit('friend:gift:sent', {
          toUserId,
          amount,
          newBalance: updatedSender?.tokenBalance || 0,
        });

        // Alana bildir
        console.log(`[Friends] Emitting friend:gift:received to ${toUserId}`);
        io.to(toUserId).emit('friend:gift:received', {
          fromUserId,
          amount,
          fromNickname: sender.nickname,
          newBalance: updatedReceiver?.tokenBalance || 0,
          newSparks: updatedReceiver?.monthlySparksEarned || 0,
        });

        // Chat odasına da bildir (FriendChatScreen için)
        const room = `friendchat:${friendshipId}`;
        console.log(`[Friends] Emitting friend:gift:notification to room ${room}`);
        io.to(room).emit('friend:gift:notification', {
          fromUserId,
          toUserId,
          amount,
          fromNickname: sender.nickname,
        });

        console.log('[Friends] ========== FRIEND GIFT COMPLETE ==========');
      } catch (error) {
        console.error('[Friends] Gift error:', error);
        socket.emit('error', { message: 'Hediye gönderilemedi.', code: 'GIFT_ERROR' });
      }
    },
  );

  // ============ ARAMA BAŞLAT ============
  socket.on(
    'friend:call:start',
    async (payload: {
      fromUserId: string;
      toUserId: string;
      friendshipId: string;
      callType: 'voice' | 'video';
    }) => {
      try {
        const { fromUserId, toUserId, friendshipId, callType } = payload;
        console.log(`[Friends] Call start: ${callType} from ${fromUserId} to ${toUserId}`);

        const caller = await prisma.user.findUnique({ where: { id: fromUserId } });
        if (!caller) return;

        // Alıcıya gelen arama bildirimi gönder
        io.to(toUserId).emit('friend:call:incoming', {
          fromUserId,
          fromNickname: caller.nickname,
          fromPhoto: null, // TODO: profil fotoğrafı ekle
          friendshipId,
          callType,
        });

        console.log(`[Friends] Incoming call notification sent to ${toUserId}`);
      } catch (error) {
        console.error('[Friends] Call start error:', error);
      }
    },
  );

  // Arama cevapla
  socket.on(
    'friend:call:answer',
    async (payload: {
      fromUserId: string;
      toUserId: string;
      friendshipId: string;
      accept: boolean;
    }) => {
      const { fromUserId, toUserId, friendshipId, accept } = payload;
      console.log(`[Friends] Call answer: ${accept ? 'accepted' : 'rejected'}`);

      if (accept) {
        // Her iki kullanıcıya da kabul edildi bildirimi
        io.to(fromUserId).emit('friend:call:accepted', { friendshipId });
        io.to(toUserId).emit('friend:call:accepted', { friendshipId });
      } else {
        // Arayan kişiye (fromUserId) reddedildi bildirimi gönder
        // NOT: fromUserId = aramayı başlatan kişi, toUserId = aranan kişi
        io.to(fromUserId).emit('friend:call:rejected', { friendshipId });
        console.log(`[Friends] Call rejected - notification sent to caller: ${fromUserId}`);
      }
    },
  );

  // Arama bitir
  socket.on(
    'friend:call:end',
    async (payload: { friendshipId: string; userId: string }) => {
      const { friendshipId, userId } = payload;
      console.log(`[Friends] Call ended by ${userId}`);

      // Arama odasındaki herkese bildir
      io.to(`friendchat:${friendshipId}`).emit('friend:call:ended', { 
        endedBy: userId 
      });
    },
  );

  // Arkadaşlık isteği gönder
  socket.on(
    'friend:request',
    async (payload: {
      fromUserId: string;
      toUserId: string;
      sessionId: string;
    }) => {
      try {
        const { fromUserId, toUserId, sessionId } = payload;

        // Zaten arkadaş mı kontrol et
        const existingFriendship = await prisma.friendship.findFirst({
          where: {
            OR: [
              { user1Id: fromUserId, user2Id: toUserId },
              { user1Id: toUserId, user2Id: fromUserId },
            ],
          },
        });
        if (existingFriendship) {
          socket.emit('friend:info', { message: 'Zaten arkadaşsınız!' });
          return;
        }

        // Ben zaten bu kişiye istek gönderdim mi?
        const myExistingRequest = await prisma.friendRequest.findFirst({
          where: { fromUserId, toUserId, status: 'PENDING' },
        });
        if (myExistingRequest) {
          socket.emit('friend:info', {
            message: 'Arkadaşlık isteği zaten gönderildi',
          });
          return;
        }

        // Karşı taraf bana istek göndermiş mi? (KARŞILIKLI İSTEK)
        const reverseRequest = await prisma.friendRequest.findFirst({
          where: { fromUserId: toUserId, toUserId: fromUserId, status: 'PENDING' },
        });

        if (reverseRequest) {
          // KARŞILIKLI İSTEK - Otomatik arkadaş ol!
          console.log('[Friends] Mutual friend request detected! Auto-accepting...');
          
          // Her iki isteği de kabul edilmiş olarak işaretle
          await prisma.friendRequest.update({
            where: { id: reverseRequest.id },
            data: { status: 'ACCEPTED', respondedAt: new Date() },
          });

          // Yeni isteği de kabul edilmiş olarak oluştur
          await prisma.friendRequest.create({
            data: { fromUserId, toUserId, sessionId, status: 'ACCEPTED', respondedAt: new Date() },
          });

          // Arkadaşlık oluştur
          const [user1Id, user2Id] = fromUserId < toUserId 
            ? [fromUserId, toUserId] 
            : [toUserId, fromUserId];

          const friendship = await prisma.friendship.create({
            data: { user1Id, user2Id },
          });

          await prisma.friendChat.create({
            data: { friendshipId: friendship.id },
          });

          console.log(`[Friends] Auto-friendship created: ${friendship.id}`);

          // Her iki kullanıcıya da bildir
          io.emit('friend:accepted', {
            friendshipId: friendship.id,
            user1Id: friendship.user1Id,
            user2Id: friendship.user2Id,
          });

          socket.emit('friend:info', { message: 'Karşılıklı istek! Artık arkadaşsınız! 🎉' });
          return;
        }

        // Normal tek taraflı istek
        const request = await prisma.friendRequest.create({
          data: { fromUserId, toUserId, sessionId, status: 'PENDING' },
        });

        console.log(`[Friends] Friend request sent: ${fromUserId} -> ${toUserId}`);

        io.emit('friend:request:received', {
          requestId: request.id,
          fromUserId,
          toUserId,
        });

        socket.emit('friend:info', { message: 'Arkadaşlık isteği gönderildi!' });
      } catch (err) {
        console.error('[Friends] Error sending friend request:', err);
        socket.emit('error', {
          message: 'Arkadaşlık isteği gönderilemedi.',
          code: 'FRIEND_REQUEST_ERROR',
        });
      }
    },
  );

  // Arkadaşlık isteğine cevap
  socket.on(
    'friend:respond',
    async (payload: { requestId: string; accept: boolean }) => {
      try {
        const { requestId, accept } = payload;
        const request = await prisma.friendRequest.findUnique({
          where: { id: requestId },
        });
        if (!request || request.status !== 'PENDING') return;

        const status = accept ? 'ACCEPTED' : 'REJECTED';
        await prisma.friendRequest.update({
          where: { id: requestId },
          data: { status, respondedAt: new Date() },
        });

        if (accept) {
          const [user1Id, user2Id] =
            request.fromUserId < request.toUserId
              ? [request.fromUserId, request.toUserId]
              : [request.toUserId, request.fromUserId];

          // Mevcut arkadaşlık var mı kontrol et (mükerrer engelleme)
          const existingFriendship = await prisma.friendship.findFirst({
            where: {
              OR: [
                { user1Id: request.fromUserId, user2Id: request.toUserId },
                { user1Id: request.toUserId, user2Id: request.fromUserId },
              ],
            },
          });

          let friendship = existingFriendship;

          if (!existingFriendship) {
            friendship = await prisma.friendship.create({
              data: { user1Id, user2Id },
            });

            await prisma.friendChat.create({
              data: { friendshipId: friendship.id },
            });
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

          io.emit('friend:accepted', {
            friendshipId: friendship!.id,
            user1Id: friendship!.user1Id,
            user2Id: friendship!.user2Id,
          });
        } else {
          io.emit('friend:rejected', { requestId });
        }
      } catch {
        socket.emit('error', {
          message: 'Arkadaşlık isteği yanıtlanamadı.',
          code: 'FRIEND_RESPOND_ERROR',
        });
      }
    },
  );
}
