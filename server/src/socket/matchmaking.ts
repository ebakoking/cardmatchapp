import { Server, Socket } from 'socket.io';
import { prisma } from '../prisma';

interface QueueEntry {
  userId: string;
  socketId: string;
  joinedAt: number;
  // Prime filtreleri
  isPrime?: boolean;
  isPlus?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  filterMinAge?: number;
  filterMaxAge?: number;
  filterMaxDistance?: number;
  filterGender?: string; // MALE, FEMALE, BOTH
  preferHighSpark?: boolean; // Prime: en yüksek sparklı kişilerle eşleş
  age?: number;
  gender?: string; // Kullanıcının kendi cinsiyeti
  // Boost sistemi
  isBoostActive?: boolean;
  boostExpiresAt?: Date | null;
  // Spark ve aktivite
  totalSparksEarned?: number;
  lastSeenAt?: Date | null;
  // Interest tags
  interests?: string[];
  filters?: {
    minAge?: number;
    maxAge?: number;
    country?: string;
    city?: string;
  };
}

// Ortak interestleri bul
function findCommonInterests(interests1: string[], interests2: string[]): string[] {
  if (!interests1 || !interests2) return [];
  const set1 = new Set(interests1.map(i => i.toLowerCase().trim()));
  return interests2.filter(i => set1.has(i.toLowerCase().trim()));
}

// Interest eşleşme skoru (0-100)
function calculateInterestScore(interests1: string[], interests2: string[]): number {
  const common = findCommonInterests(interests1, interests2);
  if (common.length === 0) return 0;
  // Her ortak interest için 20 puan, max 100
  return Math.min(common.length * 20, 100);
}

// Kullanıcı kalite skoru hesaplama (boost eşleştirme için)
function calculateUserQualityScore(user: {
  isPrime?: boolean;
  totalSparksEarned?: number;
  verified?: boolean;
  interests?: string[];
}, matcherInterests?: string[]): number {
  let score = 0;
  
  // Prime kullanıcılar yüksek puan
  if (user.isPrime) score += 100;
  
  // Yüksek spark'lı kullanıcılar (aktif ve kaliteli kullanıcı göstergesi)
  const sparks = user.totalSparksEarned || 0;
  if (sparks >= 10000) score += 80;
  else if (sparks >= 5000) score += 60;
  else if (sparks >= 1000) score += 40;
  else if (sparks >= 100) score += 20;
  
  // Doğrulanmış kullanıcılar - fake değil gerçek kişi
  if (user.verified) score += 50;
  
  // Interest eşleşme skoru (0-100 arası ek puan)
  if (matcherInterests && user.interests) {
    score += calculateInterestScore(matcherInterests, user.interests);
  }
  
  return score;
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
    // Yaş kontrolü (maxAge 40 = "40+", üst sınır yok)
    const minAge = user1.filterMinAge ?? 18;
    const maxAge = user1.filterMaxAge ?? 99;
    
    if (user2.age != null) {
      if (user2.age < minAge) {
        console.log(`[Filter] BLOCKED - Age mismatch: user2.age=${user2.age} < minAge ${minAge}`);
        return false;
      }
      if (maxAge !== 40 && user2.age > maxAge) {
        console.log(`[Filter] BLOCKED - Age mismatch: user2.age=${user2.age} > maxAge ${maxAge}`);
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
    // Yaş kontrolü (maxAge 40 = "40+", üst sınır yok)
    const minAge = user2.filterMinAge ?? 18;
    const maxAge = user2.filterMaxAge ?? 99;
    
    if (user1.age != null) {
      if (user1.age < minAge) {
        console.log(`[Filter] BLOCKED - Age mismatch: user1.age=${user1.age} < minAge ${minAge}`);
        return false;
      }
      if (maxAge !== 40 && user1.age > maxAge) {
        console.log(`[Filter] BLOCKED - Age mismatch: user1.age=${user1.age} > maxAge ${maxAge}`);
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

        // Rate limit - Development için artırıldı (dakikada 20 deneme)
        const now = Date.now();
        const attempts = lastMatchAttempt.get(userId) || [];
        const filtered = attempts.filter((t) => now - t < 60_000);
        if (filtered.length >= 20) {
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
        
        // Store userId on socket.data for authoritative identification
        socket.data = socket.data || {};
        socket.data.userId = userId;
        console.log('[Matchmaking] socket.data.userId set:', userId);

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

        // Boost durumunu kontrol et - süresi dolmuşsa deaktif et
        let isBoostActive = (user as any).isBoostActive || false;
        const boostExpiresAt = (user as any).boostExpiresAt;
        if (isBoostActive && boostExpiresAt && new Date() > new Date(boostExpiresAt)) {
          isBoostActive = false;
          // DB'de de güncelle
          await prisma.user.update({
            where: { id: userId },
            data: { isBoostActive: false },
          });
        }

        // Kadın/Erkek tercihi 30 dk geçerli; süre dolmuşsa efektif BOTH
        const rawGender = (user as any).filterGender || 'BOTH';
        const genderExpiresAt = (user as any).filterGenderExpiresAt;
        const effectiveFilterGender =
          (rawGender === 'MALE' || rawGender === 'FEMALE') &&
          genderExpiresAt &&
          new Date(genderExpiresAt) > new Date()
            ? rawGender
            : 'BOTH';

        // Queue entry oluştur - filtre değerlerini logla
        const queueEntry: QueueEntry = {
          userId,
          socketId: socket.id,
          joinedAt: now,
          // Prime filtreleri
          isPrime: user.isPrime,
          isPlus: user.isPlus,
          latitude: user.latitude,
          longitude: user.longitude,
          filterMinAge: user.filterMinAge,
          filterMaxAge: user.filterMaxAge,
          filterMaxDistance: user.filterMaxDistance,
          filterGender: effectiveFilterGender,
          preferHighSpark: (user as any).preferHighSpark ?? false,
          age: user.age,
          gender: user.gender,
          // Boost sistemi
          isBoostActive,
          boostExpiresAt: boostExpiresAt ? new Date(boostExpiresAt) : null,
          // Spark ve aktivite
          totalSparksEarned: user.totalSparksEarned || 0,
          lastSeenAt: user.lastSeenAt,
          // Interest tags
          interests: user.interests || [],
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

      // Calculate progress for both users
      const user1Progress = Object.keys(game.answers[game.user1Id] || {}).length;
      const user2Progress = Object.keys(game.answers[game.user2Id] || {}).length;
      const totalCards = game.cards.length;

      // Notify partner about progress
      const partnerId = userId === game.user1Id ? game.user2Id : game.user1Id;
      const userProgress = userId === game.user1Id ? user1Progress : user2Progress;
      
      // Get user nickname for the progress update
      const answeringUser = await prisma.user.findUnique({ 
        where: { id: userId },
        select: { nickname: true, avatarId: true }
      });
      
      io.to(partnerId).emit('partner:progress', {
        matchId,
        partnerId: userId,
        partnerNickname: answeringUser?.nickname || '',
        partnerAvatarId: answeringUser?.avatarId || 1,
        progress: userProgress,
        total: totalCards,
      });
      
      console.log(`[Cards] Progress update: ${userId} answered ${userProgress}/${totalCards}, notifying ${partnerId}`);

      const user1Done = user1Progress === totalCards;
      const user2Done = user2Progress === totalCards;

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

  // ========== PULL-BASED CARDS HANDSHAKE ==========
  // Client navigates to CardGateScreen, then requests cards
  // Server responds with cards:deliver or cards:error
  socket.on(
    'cards:request',
    (payload: { matchId: string; userId?: string }) => {
      const { matchId } = payload;
      
      // Authoritative userId - socket.data'dan al, yoksa client payload'ından
      const userId = socket.data?.userId || payload.userId;
      
      console.log('[Cards] ========== CARDS REQUEST ==========');
      console.log('[Cards] matchId:', matchId);
      console.log('[Cards] socket.data.userId:', socket.data?.userId);
      console.log('[Cards] payload.userId:', payload.userId);
      console.log('[Cards] resolved userId:', userId);
      console.log('[Cards] socketId:', socket.id);
      console.log('[Cards] Active games count:', cardGames.size);
      console.log('[Cards] Active game IDs:', Array.from(cardGames.keys()));
      
      // userId yoksa hata
      if (!userId) {
        console.log('[Cards] ERROR: No userId available');
        socket.emit('cards:error', { 
          matchId, 
          reason: 'unauthenticated',
          message: 'Oturum hatası. Lütfen yeniden giriş yapın.' 
        });
        return;
      }
      
      // Game'i bul
      const game = cardGames.get(matchId);
      if (!game) {
        console.log('[Cards] ERROR: Game not found for matchId:', matchId);
        socket.emit('cards:error', { 
          matchId, 
          reason: 'no_active_match',
          message: 'Oyun bulunamadı. Lütfen yeniden eşleşme arayın.' 
        });
        return;
      }
      
      console.log('[Cards] Game found:', {
        gameMatchId: game.matchId,
        user1Id: game.user1Id,
        user2Id: game.user2Id,
        cardsCount: game.cards.length,
      });
      
      // User authorized mı?
      if (userId !== game.user1Id && userId !== game.user2Id) {
        console.log('[Cards] ERROR: User not authorized. userId:', userId, 'game users:', game.user1Id, game.user2Id);
        socket.emit('cards:error', { 
          matchId, 
          reason: 'unauthorized',
          message: 'Bu oyunda değilsiniz.' 
        });
        return;
      }

      // Kartları gönder
      console.log('[Cards] SUCCESS: Delivering', game.cards.length, 'cards to user:', userId);
      socket.emit('cards:deliver', { 
        matchId, 
        cards: game.cards 
      });
      console.log('[Cards] cards:deliver sent successfully');
    },
  );

  // Kuyruktan/oyundan çık (kullanıcı iptal etti veya ekrandan ayrıldı)
  socket.on('match:leave', (payload: { matchId?: string; userId?: string }) => {
    // Authoritative userId - socket.data'dan al
    const leavingUserId = socket.data?.userId || payload.userId;
    const { matchId } = payload;
    
    console.log('[Matchmaking] ========== MATCH LEAVE ==========');
    console.log('[Matchmaking] leavingUserId:', leavingUserId);
    console.log('[Matchmaking] matchId:', matchId);
    console.log('[Matchmaking] socket.data.userId:', socket.data?.userId);
    console.log('[Matchmaking] socketId:', socket.id);
    
    if (!leavingUserId) {
      console.log('[Matchmaking] WARNING: No userId available for match:leave');
      return;
    }
    
    // 1. Kuyruktan çıkar
    const idx = matchmakingQueue.findIndex((q) => q.userId === leavingUserId);
    if (idx >= 0) {
      matchmakingQueue.splice(idx, 1);
      console.log('[Matchmaking] User removed from queue:', { leavingUserId, newQueueSize: matchmakingQueue.length });
    }
    
    // 2. Aktif kart oyununda mı kontrol et
    // matchId verilmişse sadece o oyunu kontrol et, yoksa tüm oyunları tara
    const targetGame = matchId ? cardGames.get(matchId) : null;
    
    if (targetGame) {
      // Direkt matchId ile oyunu bulduk
      let peerId: string | null = null;
      
      if (targetGame.user1Id === leavingUserId) {
        peerId = targetGame.user2Id;
      } else if (targetGame.user2Id === leavingUserId) {
        peerId = targetGame.user1Id;
      }
      
      if (peerId) {
        console.log('[Matchmaking] User left card game:', { matchId, leavingUserId, peerId });
        
        // Peer'a bildir
        io.to(peerId).emit('match:ended', {
          matchId,
          reason: 'peer_left',
          message: 'Karşı taraf ayrıldı.',
        });
        console.log('[Matchmaking] match:ended emitted to peer:', peerId);
        
        // Oyunu temizle
        cardGames.delete(matchId);
        console.log('[Matchmaking] Game deleted:', matchId);
        
        // Match'i DB'de sonlandır
        prisma.match.update({
          where: { id: matchId },
          data: { 
            endedAt: new Date(),
            endReason: 'USER_ENDED',
          },
        }).catch(err => {
          console.error('[Matchmaking] Failed to update match end status:', err);
        });
      }
    } else {
      // matchId verilmediyse veya bulunamadıysa, tüm oyunları tara
      for (const [gameMatchId, game] of cardGames.entries()) {
        let peerId: string | null = null;
        
        if (game.user1Id === leavingUserId) {
          peerId = game.user2Id;
        } else if (game.user2Id === leavingUserId) {
          peerId = game.user1Id;
        }
        
        if (peerId) {
          console.log('[Matchmaking] User left card game (scan):', { gameMatchId, leavingUserId, peerId });
          
          // Peer'a bildir
          io.to(peerId).emit('match:ended', {
            matchId: gameMatchId,
            reason: 'peer_left',
            message: 'Karşı taraf ayrıldı.',
          });
          console.log('[Matchmaking] match:ended emitted to peer:', peerId);
          
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
    }
    
    // Odadan da çık
    socket.leave(leavingUserId);
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

// Match oluşturma helper fonksiyonu
async function createMatch(
  io: Server,
  a: QueueEntry,
  b: QueueEntry,
  userA: any,
  userB: any
): Promise<void> {
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

  console.log(`[Matchmaking] ========== MATCH FOUND ==========`);
  console.log(`[Matchmaking] Match ID: ${match.id}`);
  console.log(`[Matchmaking] User1: ${userA.nickname} (${userA.id}), socket: ${a.socketId}, boost: ${a.isBoostActive}`);
  console.log(`[Matchmaking] User2: ${userB.nickname} (${userB.id}), socket: ${b.socketId}, boost: ${b.isBoostActive}`);
  console.log(`[Matchmaking] Cards count: ${cards.length}`);

  // Socket'leri userId odalarına join et (güvenlik için tekrar)
  const socketA = io.sockets.sockets.get(a.socketId);
  const socketB = io.sockets.sockets.get(b.socketId);
  
  if (socketA) {
    socketA.join(userA.id);
    console.log(`[Matchmaking] Socket A (${a.socketId}) joined room ${userA.id}`);
  } else {
    console.log(`[Matchmaking] WARNING: Socket A not found for ${a.socketId}`);
  }
  
  if (socketB) {
    socketB.join(userB.id);
    console.log(`[Matchmaking] Socket B (${b.socketId}) joined room ${userB.id}`);
  } else {
    console.log(`[Matchmaking] WARNING: Socket B not found for ${b.socketId}`);
  }

  // Ortak interestleri bul
  const commonInterests = findCommonInterests(a.interests || [], b.interests || []);
  console.log(`[Matchmaking] Common interests: ${commonInterests.length > 0 ? commonInterests.join(', ') : 'none'}`);

  // match:found emit - hem room'a hem direkt socket'e
  const matchFoundPayloadA = { 
    matchId: match.id, 
    partnerNickname: userB.nickname,
    partnerAvatarId: userB.avatarId || 1,
    isBoostMatch: a.isBoostActive || b.isBoostActive,
    commonInterests, // Ortak ilgi alanları
  };
  const matchFoundPayloadB = { 
    matchId: match.id, 
    partnerNickname: userA.nickname,
    partnerAvatarId: userA.avatarId || 1,
    isBoostMatch: a.isBoostActive || b.isBoostActive,
    commonInterests, // Ortak ilgi alanları
  };
  
  // Room'a emit
  io.to(userA.id).emit('match:found', matchFoundPayloadA);
  io.to(userB.id).emit('match:found', matchFoundPayloadB);
  
  // Direkt socket'e de emit (backup)
  socketA?.emit('match:found', matchFoundPayloadA);
  socketB?.emit('match:found', matchFoundPayloadB);

  console.log('[Matchmaking] match:found emitted to both users');
  console.log('[Matchmaking] Cards will be delivered via cards:request handshake (pull-based)');

  // Kuyruktan çıkar
  const idxA = matchmakingQueue.findIndex(q => q.userId === a.userId);
  const idxB = matchmakingQueue.findIndex(q => q.userId === b.userId);
  
  // Büyük index'i önce sil (index kayması önleme)
  if (idxA > idxB) {
    if (idxA >= 0) matchmakingQueue.splice(idxA, 1);
    if (idxB >= 0) matchmakingQueue.splice(idxB, 1);
  } else {
    if (idxB >= 0) matchmakingQueue.splice(idxB, 1);
    if (idxA >= 0) matchmakingQueue.splice(idxA, 1);
  }
  
  console.log('[Matchmaking] Users removed from queue, new size:', matchmakingQueue.length);
}

async function tryMatch(io: Server) {
  console.log('[Matchmaking] tryMatch called, queue size:', matchmakingQueue.length);
  
  if (matchmakingQueue.length < 2) {
    console.log('[Matchmaking] Not enough users in queue, waiting...');
    return;
  }

  console.log('[Matchmaking] Queue users:', matchmakingQueue.map(q => ({ 
    userId: q.userId, 
    isBoostActive: q.isBoostActive,
    totalSparks: q.totalSparksEarned 
  })));

  // Boost aktif kullanıcıları önceliklendir
  const boostUsers = matchmakingQueue.filter(q => q.isBoostActive);
  const normalUsers = matchmakingQueue.filter(q => !q.isBoostActive);
  
  console.log(`[Matchmaking] Boost users: ${boostUsers.length}, Normal users: ${normalUsers.length}`);

  // Boost kullanıcıları için özel eşleştirme
  for (const boostUser of boostUsers) {
    // Potansiyel eşleşmeleri kalite skoruna göre sırala
    const candidates: Array<{ entry: QueueEntry; score: number }> = [];
    
    for (const candidate of matchmakingQueue) {
      if (candidate.userId === boostUser.userId) continue;
      
      const userA = await prisma.user.findUnique({ where: { id: boostUser.userId } });
      const userB = await prisma.user.findUnique({ where: { id: candidate.userId } });
      if (!userA || !userB) continue;
      
      // Block kontrolü
      const blockExists = await prisma.block.findFirst({
        where: {
          OR: [
            { blockerUserId: userA.id, blockedUserId: userB.id },
            { blockerUserId: userB.id, blockedUserId: userA.id },
          ],
        },
      });
      if (blockExists) continue;
      
      // Prime filtre kontrolü
      if (!canMatchWithFilters(boostUser, candidate)) continue;
      
      // Kalite skoru hesapla (interest eşleşmesi dahil)
      const score = calculateUserQualityScore({
        isPrime: candidate.isPrime,
        totalSparksEarned: candidate.totalSparksEarned,
        verified: userB.verified,
        interests: candidate.interests,
      }, boostUser.interests);
      
      candidates.push({ entry: candidate, score });
    }
    
    // En yüksek skorlu adayı seç
    if (candidates.length > 0) {
      candidates.sort((a, b) => b.score - a.score);
      
      // Weighted random: top 3'ten rastgele seç (daha çeşitli eşleşme için)
      const topCandidates = candidates.slice(0, Math.min(3, candidates.length));
      const selectedCandidate = topCandidates[Math.floor(Math.random() * topCandidates.length)];
      
      console.log(`[Matchmaking] Boost match found! ${boostUser.userId} <-> ${selectedCandidate.entry.userId} (score: ${selectedCandidate.score})`);
      
      // Eşleşmeyi gerçekleştir
      const userA = await prisma.user.findUnique({ where: { id: boostUser.userId } });
      const userB = await prisma.user.findUnique({ where: { id: selectedCandidate.entry.userId } });
      
      if (userA && userB) {
        await createMatch(io, boostUser, selectedCandidate.entry, userA, userB);
        return;
      }
    }
  }

  // Normal eşleştirme algoritması
  for (let i = 0; i < matchmakingQueue.length; i++) {
    const a = matchmakingQueue[i];
    const candidates: { entry: QueueEntry; user: any }[] = [];

    for (let j = i + 1; j < matchmakingQueue.length; j++) {
      const b = matchmakingQueue[j];
      const userA = await prisma.user.findUnique({ where: { id: a.userId } });
      const userB = await prisma.user.findUnique({ where: { id: b.userId } });
      if (!userA || !userB || userA.id === userB.id) continue;

      const blockExists = await prisma.block.findFirst({
        where: {
          OR: [
            { blockerUserId: userA.id, blockedUserId: userB.id },
            { blockerUserId: userB.id, blockedUserId: userA.id },
          ],
        },
      });
      if (blockExists) continue;
      if (!canMatchWithFilters(a, b)) continue;

      candidates.push({ entry: b, user: userB });
    }

    if (candidates.length === 0) continue;

    // Prime "en yüksek sparklı eşleş" açıksa adayları spark'a göre sırala
    let chosen = candidates[0];
    if (a.preferHighSpark && candidates.length > 1) {
      candidates.sort((x, y) => (y.entry.totalSparksEarned ?? 0) - (x.entry.totalSparksEarned ?? 0));
      chosen = candidates[0];
      console.log(`[Matchmaking] preferHighSpark: ${a.userId} matched with highest-spark candidate ${chosen.entry.userId} (${chosen.entry.totalSparksEarned ?? 0} spark)`);
    }

    const userA = await prisma.user.findUnique({ where: { id: a.userId } });
    if (!userA) continue;
    await createMatch(io, a, chosen.entry, userA, chosen.user);
    return;
  }
  
  console.log('[Matchmaking] No match found in this round');
}
