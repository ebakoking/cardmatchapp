import { Server, Socket } from 'socket.io';
import { prisma } from '../prisma';

interface QueueEntry {
  userId: string;
  socketId: string;
  joinedAt: number;
  // Prime filtreleri
  isPrime?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  filterMinAge?: number;
  filterMaxAge?: number;
  filterMaxDistance?: number;
  filterGender?: string; // MALE, FEMALE, BOTH
  age?: number;
  gender?: string; // Kullanıcının kendi cinsiyeti
  filters?: {
    minAge?: number;
    maxAge?: number;
    country?: string;
    city?: string;
  };
}

// Haversine formülü - iki koordinat arası mesafeyi km cinsinden hesaplar
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Dünya'nın yarıçapı (km)
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}

// Prime filtre kontrolü - iki kullanıcı eşleşebilir mi?
function canMatchWithFilters(
  user1: QueueEntry,
  user2: QueueEntry
): boolean {
  console.log(`[Filter] Checking filters between users:`);
  console.log(`[Filter] User1: isPrime=${user1.isPrime}, age=${user1.age}, gender=${user1.gender}, filters: minAge=${user1.filterMinAge}, maxAge=${user1.filterMaxAge}, maxDist=${user1.filterMaxDistance}, filterGender=${user1.filterGender}`);
  console.log(`[Filter] User2: isPrime=${user2.isPrime}, age=${user2.age}, gender=${user2.gender}, filters: minAge=${user2.filterMinAge}, maxAge=${user2.filterMaxAge}, maxDist=${user2.filterMaxDistance}, filterGender=${user2.filterGender}`);

  // User1 Prime ise kendi filtreleriyle kontrol et
  if (user1.isPrime) {
    // Yaş kontrolü
    const minAge = user1.filterMinAge ?? 18;
    const maxAge = user1.filterMaxAge ?? 99;
    
    if (user2.age) {
      if (user2.age < minAge || user2.age > maxAge) {
        console.log(`[Filter] BLOCKED - Age mismatch: user2.age=${user2.age} not in range ${minAge}-${maxAge}`);
        return false;
      }
    }
    
    // Cinsiyet kontrolü
    const genderFilter = user1.filterGender || 'BOTH';
    if (genderFilter !== 'BOTH' && user2.gender) {
      if (genderFilter !== user2.gender) {
        console.log(`[Filter] BLOCKED - Gender mismatch: user1 wants ${genderFilter}, user2 is ${user2.gender}`);
        return false;
      }
    }
    
    // Mesafe kontrolü - 160 km veya üstü "Tüm Türkiye" demek, mesafe kontrolü yapma
    const maxDist = user1.filterMaxDistance ?? 160;
    if (maxDist < 160 && user1.latitude && user1.longitude && user2.latitude && user2.longitude) {
      const distance = calculateDistance(
        user1.latitude,
        user1.longitude,
        user2.latitude,
        user2.longitude
      );
      console.log(`[Filter] Distance check: ${distance.toFixed(1)} km, max allowed: ${maxDist} km`);
      if (distance > maxDist) {
        console.log(`[Filter] BLOCKED - Distance too far`);
        return false;
      }
    }
  }

  // User2 Prime ise kendi filtreleriyle kontrol et
  if (user2.isPrime) {
    // Yaş kontrolü
    const minAge = user2.filterMinAge ?? 18;
    const maxAge = user2.filterMaxAge ?? 99;
    
    if (user1.age) {
      if (user1.age < minAge || user1.age > maxAge) {
        console.log(`[Filter] BLOCKED - Age mismatch: user1.age=${user1.age} not in range ${minAge}-${maxAge}`);
        return false;
      }
    }
    
    // Cinsiyet kontrolü
    const genderFilter = user2.filterGender || 'BOTH';
    if (genderFilter !== 'BOTH' && user1.gender) {
      if (genderFilter !== user1.gender) {
        console.log(`[Filter] BLOCKED - Gender mismatch: user2 wants ${genderFilter}, user1 is ${user1.gender}`);
        return false;
      }
    }
    
    // Mesafe kontrolü - 160 km veya üstü "Tüm Türkiye" demek, mesafe kontrolü yapma
    const maxDist = user2.filterMaxDistance ?? 160;
    if (maxDist < 160 && user1.latitude && user1.longitude && user2.latitude && user2.longitude) {
      const distance = calculateDistance(
        user1.latitude,
        user1.longitude,
        user2.latitude,
        user2.longitude
      );
      console.log(`[Filter] Distance check: ${distance.toFixed(1)} km, max allowed: ${maxDist} km`);
      if (distance > maxDist) {
        console.log(`[Filter] BLOCKED - Distance too far`);
        return false;
      }
    }
  }

  console.log(`[Filter] PASSED - Users can match`);
  return true;
}

interface CardPayload {
  id: string;
  questionTR: string;
  options: string[];
}

interface CardGameState {
  matchId: string;
  user1Id: string;
  user2Id: string;
  user1SocketId: string;
  user2SocketId: string;
  cards: CardPayload[];
  answers: Record<string, Record<string, number>>; // userId -> { cardId -> optionIndex }
}

const matchmakingQueue: QueueEntry[] = [];
const lastMatchAttempt: Map<string, number[]> = new Map();
const cardGames = new Map<string, CardGameState>();

export function registerMatchmakingHandlers(io: Server, socket: Socket) {
  console.log('[Matchmaking] Handler registered for socket:', socket.id);
  
  // Kuyruğa katıl
  socket.on(
    'match:join',
    async (payload: { userId: string; filters?: QueueEntry['filters'] }) => {
      console.log('[Matchmaking] match:join received:', payload);
      try {
        const { userId } = payload;

        const now = Date.now();
        const attempts = lastMatchAttempt.get(userId) || [];
        const filtered = attempts.filter((t) => now - t < 60_000);
        if (filtered.length >= 3) {
          socket.emit('error', {
            message: 'Çok hızlı! Lütfen biraz bekleyin.',
            code: 'MATCH_RATE_LIMIT',
          });
          return;
        }
        filtered.push(now);
        lastMatchAttempt.set(userId, filtered);

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return;
        
        // GELİŞTİRME AŞAMASI: verified kontrolünü devre dışı bırak
        // Prod'da bu kontrolleri tekrar aç!
        // if (!user.verified) {
        //   socket.emit('match:blocked', {
        //     reason: 'UNVERIFIED',
        //     message: 'Profiliniz henüz onaylanmadı. Lütfen bekleyin.',
        //   });
        //   return;
        // }
        // if (user.status !== 'ACTIVE') {
        //   socket.emit('match:blocked', {
        //     reason: 'INACTIVE_STATUS',
        //     message: 'Hesabınız eşleşmeye uygun değil.',
        //   });
        //   return;
        // }

        // GÜNLÜK SOHBET SINIRI - GELİŞTİRME AŞAMASINDA DEVRE DIŞI
        // TODO: Production'da aç ve reklam izleme özelliği ekle
        // const DAILY_CHAT_LIMIT = 10;
        // const today = new Date();
        // today.setHours(0, 0, 0, 0);
        // 
        // const lastReset = new Date(user.dailyChatsResetAt);
        // lastReset.setHours(0, 0, 0, 0);
        // 
        // if (today.getTime() > lastReset.getTime()) {
        //   await prisma.user.update({
        //     where: { id: userId },
        //     data: { dailyChatsStarted: 0, dailyChatsResetAt: new Date() },
        //   });
        // } else if (!user.isPrime && user.dailyChatsStarted >= DAILY_CHAT_LIMIT) {
        //   socket.emit('match:blocked', {
        //     reason: 'DAILY_LIMIT',
        //     message: `Günlük ${DAILY_CHAT_LIMIT} sohbet limitine ulaştınız. Prime ile sınırsız sohbet başlatabilirsiniz!`,
        //   });
        //   return;
        // }

        // Kullanıcıyı kendi userId'si ile bir odaya alıyoruz
        // Böylece socketId değişse bile io.to(userId) ile emit edebileceğiz.
        socket.join(userId);

        // Kullanıcı zaten kuyrukta mı kontrol et - duplicate önleme
        const existingIdx = matchmakingQueue.findIndex((q) => q.userId === userId);
        if (existingIdx >= 0) {
          console.log('[Matchmaking] User already in queue, updating socket:', { userId, oldSocketId: matchmakingQueue[existingIdx].socketId, newSocketId: socket.id });
          // Eski entry'yi güncelle (yeni socket ID ile)
          matchmakingQueue[existingIdx].socketId = socket.id;
          matchmakingQueue[existingIdx].joinedAt = now;
          socket.emit('match:searching');
          await tryMatch(io);
          return;
        }

        // Queue entry oluştur - filtre değerlerini logla
        const queueEntry: QueueEntry = {
          userId,
          socketId: socket.id,
          joinedAt: now,
          // Prime filtreleri
          isPrime: user.isPrime,
          latitude: user.latitude,
          longitude: user.longitude,
          filterMinAge: user.filterMinAge,
          filterMaxAge: user.filterMaxAge,
          filterMaxDistance: user.filterMaxDistance,
          filterGender: (user as any).filterGender || 'BOTH', // Prisma tipi henüz güncellenmemiş olabilir
          age: user.age,
          gender: user.gender,
          filters: user.isPlus
            ? {
                minAge: user.age - 5,
                maxAge: user.age + 5,
                country: user.country,
                city: user.city,
              }
            : undefined,
        };
        
        matchmakingQueue.push(queueEntry);
        
        console.log(`[Matchmaking] User added to queue:`, {
          id: userId,
          nickname: user.nickname,
          isPrime: user.isPrime,
          age: user.age,
          gender: user.gender,
          queueSize: matchmakingQueue.length,
          filters: {
            minAge: queueEntry.filterMinAge,
            maxAge: queueEntry.filterMaxAge,
            maxDistance: queueEntry.filterMaxDistance,
            gender: queueEntry.filterGender,
          }
        });

        socket.emit('match:searching');
        console.log('[Matchmaking] match:searching emitted to user:', userId);
        
        await tryMatch(io);
      } catch {
        socket.emit('error', {
          message: 'Bir hata oluştu. Lütfen tekrar deneyin.',
          code: 'MATCH_JOIN_ERROR',
        });
      }
    },
  );

  // Kart cevaplama
  socket.on(
    'card:answer',
    async (payload: {
      matchId: string;
      userId: string;
      cardId: string;
      selectedOptionIndex: number;
    }) => {
      const { matchId, userId, cardId, selectedOptionIndex } = payload;
      const game = cardGames.get(matchId);
      if (!game) return;
      if (userId !== game.user1Id && userId !== game.user2Id) return;

      if (!game.answers[userId]) {
        game.answers[userId] = {};
      }
      game.answers[userId][cardId] = selectedOptionIndex;

      const user1Done =
        Object.keys(game.answers[game.user1Id] || {}).length ===
        game.cards.length;
      const user2Done =
        Object.keys(game.answers[game.user2Id] || {}).length ===
        game.cards.length;

      if (!user1Done || !user2Done) return;

      // Her iki taraf da tüm kartları cevapladı, sonucu hesapla
      let matchScore = 0;
      for (const card of game.cards) {
        const a = game.answers[game.user1Id][card.id];
        const b = game.answers[game.user2Id][card.id];
        if (a === b) matchScore += 1;
      }

      const success = matchScore >= 2;

      const socketA = io.sockets.sockets.get(game.user1SocketId);
      const socketB = io.sockets.sockets.get(game.user2SocketId);

      if (success) {
        const chat = await prisma.chatSession.create({
          data: {
            matchId: game.matchId,
            user1Id: game.user1Id,
            user2Id: game.user2Id,
          },
        });

        const users = await prisma.user.findMany({
          where: { id: { in: [game.user1Id, game.user2Id] } },
        });
        const user1 = users.find((u) => u.id === game.user1Id);
        const user2 = users.find((u) => u.id === game.user2Id);

        socketA?.emit('chat:unlocked', {
          sessionId: chat.id,
          partnerId: user2?.id ?? game.user2Id,
          partnerNickname: user2?.nickname ?? '',
        });
        socketB?.emit('chat:unlocked', {
          sessionId: chat.id,
          partnerId: user1?.id ?? game.user1Id,
          partnerNickname: user1?.nickname ?? '',
        });
      } else {
        socketA?.emit('match:ended', {
          reason: 'Uyum yakalanmadı 😔',
        });
        socketB?.emit('match:ended', {
          reason: 'Uyum yakalanmadı 😔',
        });
      }

      cardGames.delete(matchId);
    },
  );

  // Kartları yeniden isteme (kartlar ekranda yükleniyor'da kalmasın diye)
  socket.on(
    'cards:request',
    (payload: { matchId: string; userId: string }) => {
      const { matchId, userId } = payload;
      console.log('[Matchmaking] cards:request received:', { matchId, userId, socketId: socket.id });
      console.log('[Matchmaking] Active card games:', Array.from(cardGames.keys()));
      
      const game = cardGames.get(matchId);
      if (!game) {
        console.log('[Matchmaking] Game not found for matchId:', matchId);
        return;
      }
      if (userId !== game.user1Id && userId !== game.user2Id) {
        console.log('[Matchmaking] User not in game:', { userId, game_user1: game.user1Id, game_user2: game.user2Id });
        return;
      }

      console.log('[Matchmaking] Sending cards:init to socket:', socket.id, 'cards count:', game.cards.length);
      socket.emit('cards:init', { cards: game.cards });
    },
  );

  // Kuyruktan çık (kullanıcı iptal etti)
  socket.on('match:leave', (payload: { userId: string; matchId?: string }) => {
    const { userId, matchId } = payload;
    console.log('[Matchmaking] match:leave received:', { userId, matchId, socketId: socket.id });
    
    // 1. Kuyruktan çıkar
    const idx = matchmakingQueue.findIndex((q) => q.userId === userId);
    if (idx >= 0) {
      matchmakingQueue.splice(idx, 1);
      console.log('[Matchmaking] User removed from queue:', { userId, newQueueSize: matchmakingQueue.length });
    }
    
    // 2. Aktif kart oyununda mı kontrol et
    for (const [gameMatchId, game] of cardGames.entries()) {
      if (matchId && gameMatchId !== matchId) continue;
      
      let isInGame = false;
      let peerId: string | null = null;
      
      if (game.user1Id === userId) {
        isInGame = true;
        peerId = game.user2Id;
      } else if (game.user2Id === userId) {
        isInGame = true;
        peerId = game.user1Id;
      }
      
      if (isInGame && peerId) {
        console.log('[Matchmaking] User left during card game:', { gameMatchId, userId, peerId });
        
        // Peer'a bildir
        io.to(peerId).emit('match:ended', {
          matchId: gameMatchId,
          reason: 'peer_left',
          message: 'Karşı taraf ayrıldı.',
        });
        
        // Oyunu temizle
        cardGames.delete(gameMatchId);
        
        // Match'i DB'de sonlandır
        prisma.match.update({
          where: { id: gameMatchId },
          data: { 
            endedAt: new Date(),
            endReason: 'USER_ENDED',
          },
        }).catch(err => {
          console.error('[Matchmaking] Failed to update match end status:', err);
        });
        
        break;
      }
    }
    
    // Odadan da çık
    socket.leave(userId);
  });

  socket.on('disconnect', () => {
    console.log('[Matchmaking] Socket disconnected:', socket.id);
    
    // 1. Kuyruktan çıkar
    const idx = matchmakingQueue.findIndex((q) => q.socketId === socket.id);
    if (idx >= 0) {
      const removed = matchmakingQueue.splice(idx, 1)[0];
      console.log('[Matchmaking] User removed from queue on disconnect:', { 
        userId: removed.userId, 
        newQueueSize: matchmakingQueue.length 
      });
    }
    
    // 2. Aktif kart oyununda mı kontrol et ve peer'a bildir
    for (const [matchId, game] of cardGames.entries()) {
      let disconnectedUserId: string | null = null;
      let peerSocketId: string | null = null;
      let peerId: string | null = null;
      
      if (game.user1SocketId === socket.id) {
        disconnectedUserId = game.user1Id;
        peerSocketId = game.user2SocketId;
        peerId = game.user2Id;
      } else if (game.user2SocketId === socket.id) {
        disconnectedUserId = game.user2Id;
        peerSocketId = game.user1SocketId;
        peerId = game.user1Id;
      }
      
      if (disconnectedUserId && peerId) {
        console.log('[Matchmaking] User disconnected during card game:', {
          matchId,
          disconnectedUserId,
          peerId,
        });
        
        // Peer'a bildir
        io.to(peerId).emit('match:ended', {
          matchId,
          reason: 'peer_disconnected',
          message: 'Karşı taraf bağlantısını kaybetti.',
        });
        
        console.log('[Matchmaking] match:ended emitted to peer:', peerId);
        
        // Oyunu temizle
        cardGames.delete(matchId);
        
        // Match'i DB'de sonlandır
        prisma.match.update({
          where: { id: matchId },
          data: { 
            endedAt: new Date(),
            endReason: 'DISCONNECTED',
          },
        }).catch(err => {
          console.error('[Matchmaking] Failed to update match end status:', err);
        });
        
        break; // Bir kullanıcı sadece bir oyunda olabilir
      }
    }
  });
}

async function pickCards(): Promise<CardPayload[]> {
  const cards = await prisma.card.findMany();
  if (cards.length === 0) return [];

  // Basit random seçim, 5 kart
  const shuffled = [...cards].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, 5);
  return selected.map((c) => ({
    id: c.id,
    questionTR: c.questionTR,
    options: JSON.parse(c.optionsJson) as string[],
  }));
}

async function tryMatch(io: Server) {
  console.log('[Matchmaking] tryMatch called, queue size:', matchmakingQueue.length);
  
  if (matchmakingQueue.length < 2) {
    console.log('[Matchmaking] Not enough users in queue, waiting...');
    return;
  }

  console.log('[Matchmaking] Queue users:', matchmakingQueue.map(q => q.userId));

  for (let i = 0; i < matchmakingQueue.length; i++) {
    for (let j = i + 1; j < matchmakingQueue.length; j++) {
      const a = matchmakingQueue[i];
      const b = matchmakingQueue[j];

      console.log(`[Matchmaking] Checking pair: ${a.userId} <-> ${b.userId}`);

      const userA = await prisma.user.findUnique({ where: { id: a.userId } });
      const userB = await prisma.user.findUnique({ where: { id: b.userId } });
      if (!userA || !userB) {
        console.log('[Matchmaking] User not found in DB, skipping pair');
        continue;
      }

      // Geliştirme aşaması için eşleştirme kurallarını MINIMUM'a indiriyoruz.
      // Prod'da: verified, status, block, 7 gün history, gender match, plus filtreleri tekrar açılmalı.
      if (userA.id === userB.id) continue;

      // Block kontrolü - engellenen kullanıcılarla eşleşme
      const blockExists = await prisma.block.findFirst({
        where: {
          OR: [
            { blockerUserId: userA.id, blockedUserId: userB.id },
            { blockerUserId: userB.id, blockedUserId: userA.id },
          ],
        },
      });
      if (blockExists) {
        console.log(`[Matchmaking] Block exists between ${userA.nickname} and ${userB.nickname}`);
        continue;
      }

      // Prime filtre kontrolü
      if (!canMatchWithFilters(a, b)) {
        console.log(`[Matchmaking] Filter mismatch: ${userA.nickname} <-> ${userB.nickname}`);
        continue;
      }

      const match = await prisma.match.create({
        data: {
          user1Id: userA.id,
          user2Id: userB.id,
        },
      });

      await prisma.matchHistory.create({
        data: {
          user1Id: userA.id,
          user2Id: userB.id,
          matchedAt: new Date(),
        },
      });

      // Günlük sohbet sayacını artır (her iki kullanıcı için)
      await prisma.user.updateMany({
        where: { id: { in: [userA.id, userB.id] } },
        data: { dailyChatsStarted: { increment: 1 } },
      });

      const cards = await pickCards();

      // Card game state kaydet
      cardGames.set(match.id, {
        matchId: match.id,
        user1Id: userA.id,
        user2Id: userB.id,
        user1SocketId: a.socketId,
        user2SocketId: b.socketId,
        cards,
        answers: {},
      });

      console.log(`[Matchmaking] MATCH FOUND! ${userA.nickname} <-> ${userB.nickname}`, {
        matchId: match.id,
        user1: { id: userA.id, nickname: userA.nickname },
        user2: { id: userB.id, nickname: userB.nickname },
      });

      // Daha güvenilir: userId odalarına emit et
      io.to(userA.id).emit('match:found', {
        matchId: match.id,
        partnerNickname: userB.nickname,
      });
      io.to(userB.id).emit('match:found', {
        matchId: match.id,
        partnerNickname: userA.nickname,
      });

      console.log('[Matchmaking] match:found emitted to both users');

      // Kısa gecikme ile cards:init gönder - client'ın CardGateScreen'e navigate etmesi için zaman ver
      setTimeout(() => {
        console.log('[Matchmaking] Sending cards:init after delay...');
        io.to(userA.id).emit('cards:init', { cards });
        io.to(userB.id).emit('cards:init', { cards });
        console.log('[Matchmaking] cards:init emitted to both users');
      }, 500);

      matchmakingQueue.splice(j, 1);
      matchmakingQueue.splice(i, 1);
      
      console.log('[Matchmaking] Users removed from queue, new size:', matchmakingQueue.length);
      return;
    }
  }
  
  console.log('[Matchmaking] No match found in this round');
}
