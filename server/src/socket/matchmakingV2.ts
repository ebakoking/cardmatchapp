/**
 * Yeni eşleşme sistemi v2 – 5 soru cevapla → kuyruk → ortak cevap + filtreler ile eşleşme.
 * 100k kullanıcı için: indexed sorgular, aday limiti (500), priority/match score.
 */
import { Server, Socket } from 'socket.io';
import { prisma } from '../prisma';
import { getIO } from './io';
import { MatchQueueStatus } from '@prisma/client';

const CANDIDATE_LIMIT = 500; // 100k ölçek: tek seferde en fazla 500 aday tara
const QUEUE_POLL_MS = 2000;  // Her 2 saniyede kuyruk taranır

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
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

/** Priority score: Boost + Prime + Verified + spark + hesap yaşı */
function computePriorityScore(user: {
  isBoostActive?: boolean;
  boostExpiresAt?: Date | null;
  isPrime?: boolean;
  primeExpiry?: Date | null;
  verified?: boolean;
  totalSparksEarned?: number;
  createdAt: Date;
}): number {
  let score = 0;
  const now = new Date();
  if (user.isBoostActive && user.boostExpiresAt && now < new Date(user.boostExpiresAt)) {
    score += 1000;
  }
  if (user.isPrime && (!user.primeExpiry || now < new Date(user.primeExpiry))) {
    score += 500;
  }
  if (user.verified) score += 250;
  score += Math.floor((user.totalSparksEarned ?? 0) / 100);
  const accountAgeDays = Math.floor(
    (now.getTime() - new Date(user.createdAt).getTime()) / (24 * 60 * 60 * 1000)
  );
  score += Math.min(accountAgeDays, 365); // max 365 gün bonus
  return score;
}

/** İki kullanıcının 5 sorudaki ortak cevap sayısı (aynı questionId + aynı optionId) */
async function countCommonAnswers(
  queueEntryA: string,
  queueEntryB: string
): Promise<number> {
  const answersA = await prisma.matchQueueAnswer.findMany({
    where: { matchQueueId: queueEntryA },
    select: { questionId: true, optionId: true },
  });
  const answersB = await prisma.matchQueueAnswer.findMany({
    where: { matchQueueId: queueEntryB },
    select: { questionId: true, optionId: true },
  });
  const setB = new Set(answersB.map((a) => `${a.questionId}:${a.optionId}`));
  let common = 0;
  for (const a of answersA) {
    if (setB.has(`${a.questionId}:${a.optionId}`)) common++;
  }
  return common;
}

/** Match score: ortak cevap, spark yakınlığı, prime/verified bonus, yaş/mesafe */
function computeMatchScore(
  commonAnswers: number,
  userA: { totalSparksEarned?: number; age?: number; isPrime?: boolean; verified?: boolean; latitude?: number | null; longitude?: number | null },
  userB: { totalSparksEarned?: number; age?: number; isPrime?: boolean; verified?: boolean; latitude?: number | null; longitude?: number | null }
): number {
  let score = commonAnswers * 200;
  const sparkA = userA.totalSparksEarned ?? 0;
  const sparkB = userB.totalSparksEarned ?? 0;
  const sparkDiff = Math.abs(sparkA - sparkB);
  score += Math.max(0, 1000 - sparkDiff);
  if (userA.isPrime && userB.isPrime) score += 300;
  if (userA.verified && userB.verified) score += 200;
  const ageA = userA.age ?? 0;
  const ageB = userB.age ?? 0;
  if (Math.abs(ageA - ageB) <= 5) score += 100;
  if (
    userA.latitude != null &&
    userA.longitude != null &&
    userB.latitude != null &&
    userB.longitude != null
  ) {
    const km = haversineKm(
      userA.latitude,
      userA.longitude,
      userB.latitude,
      userB.longitude
    );
    if (km < 10) score += 150;
  }
  return score;
}

/** A'nın B ile eşleşebilir mi? (cinsiyet + Prime yaş/mesafe) */
function passesFilters(
  userA: {
    gender: string;
    interestedIn: string;
    filterGenderActive?: boolean;
    filterGender?: string;
    filterGenderExpiresAt?: Date | null;
    isPrime?: boolean;
    primeExpiry?: Date | null;
    filterMinAge?: number;
    filterMaxAge?: number;
    filterMaxDistance?: number;
    latitude?: number | null;
    longitude?: number | null;
    age?: number | null;
  },
  userB: {
    gender: string;
    interestedIn: string;
    filterGenderActive?: boolean;
    filterGender?: string;
    filterGenderExpiresAt?: Date | null;
    isPrime?: boolean;
    primeExpiry?: Date | null;
    filterMinAge?: number;
    filterMaxAge?: number;
    filterMaxDistance?: number;
    latitude?: number | null;
    longitude?: number | null;
    age?: number | null;
  }
): boolean {
  const now = new Date();

  // Cinsiyet: A'nın tercihi
  const aWants = userA.filterGenderActive &&
    userA.filterGenderExpiresAt &&
    now < new Date(userA.filterGenderExpiresAt)
    ? userA.filterGender!
    : userA.interestedIn;
  const aAcceptsB =
    aWants === 'BOTH' ||
    !userB.gender ||
    aWants === userB.gender ||
    userB.gender === 'OTHER';
  if (!aAcceptsB) return false;

  const bWants =
    userB.filterGenderActive &&
    userB.filterGenderExpiresAt &&
    now < new Date(userB.filterGenderExpiresAt)
      ? userB.filterGender!
      : userB.interestedIn;
  const bAcceptsA =
    bWants === 'BOTH' ||
    !userA.gender ||
    bWants === userA.gender ||
    userA.gender === 'OTHER';
  if (!bAcceptsA) return false;

  // Prime: yaş
  if (userA.isPrime && userA.primeExpiry && now < new Date(userA.primeExpiry)) {
    const minA = userA.filterMinAge ?? 18;
    const maxA = userA.filterMaxAge ?? 99;
    if (userB.age != null && (userB.age < minA || (maxA !== 40 && userB.age > maxA)))
      return false;
  }
  if (userB.isPrime && userB.primeExpiry && now < new Date(userB.primeExpiry)) {
    const minB = userB.filterMinAge ?? 18;
    const maxB = userB.filterMaxAge ?? 99;
    if (userA.age != null && (userA.age < minB || (maxB !== 40 && userA.age > maxB)))
      return false;
  }

  // Prime: mesafe (160+ = Tüm Türkiye)
  const maxDistA = userA.filterMaxDistance ?? 160;
  if (
    maxDistA < 160 &&
    userA.latitude != null &&
    userA.longitude != null &&
    userB.latitude != null &&
    userB.longitude != null
  ) {
    const km = haversineKm(
      userA.latitude,
      userA.longitude,
      userB.latitude,
      userB.longitude
    );
    if (km > maxDistA) return false;
  }
  const maxDistB = userB.filterMaxDistance ?? 160;
  if (
    maxDistB < 160 &&
    userA.latitude != null &&
    userA.longitude != null &&
    userB.latitude != null &&
    userB.longitude != null
  ) {
    const km = haversineKm(
      userA.latitude,
      userA.longitude,
      userB.latitude,
      userB.longitude
    );
    if (km > maxDistB) return false;
  }
  return true;
}

/** Kullanıcı A için en iyi eşi bul; bulunursa Match + ChatSession oluştur, emit et. */
async function tryMatchForUser(io: Server, userId: string): Promise<boolean> {
  const queueA = await prisma.matchQueue.findFirst({
    where: { userId, status: MatchQueueStatus.WAITING },
    include: { answers: true },
  });
  if (!queueA) return false;

  const userA = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      nickname: true,
      avatarId: true,
      profilePhotoUrl: true,
      gender: true,
      interestedIn: true,
      filterGenderActive: true,
      filterGender: true,
      filterGenderExpiresAt: true,
      isPrime: true,
      primeExpiry: true,
      filterMinAge: true,
      filterMaxAge: true,
      filterMaxDistance: true,
      latitude: true,
      longitude: true,
      age: true,
      totalSparksEarned: true,
      verified: true,
    },
  });
  if (!userA) return false;

  const prefA = await prisma.userMatchPreference.findUnique({
    where: { userId },
  });
  const minCommonA = prefA?.minimumCommonAnswers ?? 1;

  // Blok + daha önce eşleştiği kişiler
  const blockedPairs = await prisma.block.findMany({
    where: {
      OR: [
        { blockerUserId: userId },
        { blockedUserId: userId },
      ],
    },
    select: { blockerUserId: true, blockedUserId: true },
  });
  const blockedIds = new Set<string>();
  for (const b of blockedPairs) {
    blockedIds.add(b.blockerUserId === userId ? b.blockedUserId : b.blockerUserId);
  }
  const historyPairs = await prisma.matchHistory.findMany({
    where: {
      OR: [{ user1Id: userId }, { user2Id: userId }],
    },
    select: { user1Id: true, user2Id: true },
  });
  for (const h of historyPairs) {
    const other = h.user1Id === userId ? h.user2Id : h.user1Id;
    blockedIds.add(other);
  }

  // Adaylar: WAITING, kendisi değil, blok/history'de yok. 100k için limit.
  const candidates = await prisma.matchQueue.findMany({
    where: {
      status: MatchQueueStatus.WAITING,
      userId: { not: userId, notIn: Array.from(blockedIds) },
    },
    orderBy: [{ priorityScore: 'desc' }, { enteredAt: 'asc' }],
    take: CANDIDATE_LIMIT,
    include: {
      user: {
        select: {
          id: true,
          nickname: true,
          avatarId: true,
          profilePhotoUrl: true,
          gender: true,
          interestedIn: true,
          filterGenderActive: true,
          filterGender: true,
          filterGenderExpiresAt: true,
          isPrime: true,
          primeExpiry: true,
          filterMinAge: true,
          filterMaxAge: true,
          filterMaxDistance: true,
          latitude: true,
          longitude: true,
          age: true,
          totalSparksEarned: true,
          verified: true,
        },
      },
    },
  });

  let best: { queueId: string; userId: string; common: number; score: number } | null = null;
  const prefCache = new Map<string, number>();

  for (const c of candidates) {
    const userB = c.user;
    if (!passesFilters(userA as any, userB as any)) continue;

    const prefB =
      prefCache.get(userB.id) ??
      (await prisma.userMatchPreference.findUnique({ where: { userId: userB.id } }))?.minimumCommonAnswers ?? 1;
    if (!prefCache.has(userB.id)) prefCache.set(userB.id, prefB);

    const common = await countCommonAnswers(queueA.id, c.id);
    const required = Math.max(minCommonA, prefB);
    if (common < required) continue;

    const score = computeMatchScore(common, userA as any, userB as any);
    if (!best || score > best.score) {
      best = { queueId: c.id, userId: userB.id, common, score };
    }
  }

  if (!best) return false;

  const queueB = await prisma.matchQueue.findUnique({
    where: { id: best.queueId },
  });
  if (!queueB || queueB.status !== MatchQueueStatus.WAITING) return false;

  const userB = await prisma.user.findUnique({
    where: { id: best.userId },
    select: { id: true, nickname: true, avatarId: true, profilePhotoUrl: true },
  });
  if (!userB) return false;

  const match = await prisma.match.create({
    data: { user1Id: userId, user2Id: best.userId },
  });
  await prisma.matchHistory.create({
    data: { user1Id: userId, user2Id: best.userId, matchedAt: new Date() },
  });
  const chat = await prisma.chatSession.create({
    data: {
      matchId: match.id,
      user1Id: userId,
      user2Id: best.userId,
    },
  });
  await prisma.user.updateMany({
    where: { id: { in: [userId, best.userId] } },
    data: { dailyChatsStarted: { increment: 1 } },
  });

  await prisma.matchQueue.updateMany({
    where: { id: { in: [queueA.id, queueB.id] } },
    data: {
      status: MatchQueueStatus.MATCHED,
      matchedWithUserId: userId === queueA.userId ? best.userId : userId,
      matchedAt: new Date(),
    },
  });

  const payloadA = {
    matchId: match.id,
    sessionId: chat.id,
    partnerId: userB.id,
    partnerNickname: userB.nickname,
    partnerAvatarId: userB.avatarId ?? 1,
    commonAnswers: best.common,
  };
  const payloadB = {
    matchId: match.id,
    sessionId: chat.id,
    partnerId: userA.id,
    partnerNickname: userA.nickname,
    partnerAvatarId: userA.avatarId ?? 1,
    commonAnswers: best.common,
  };
  io.to(userId).emit('match:found', payloadA);
  io.to(best.userId).emit('match:found', payloadB);
  console.log(`[MatchV2] Paired ${userId} <-> ${best.userId}, matchId=${match.id}, common=${best.common}`);
  return true;
}
/** Kuyruk tarayıcı: her QUEUE_POLL_MS ms en yüksek priority'li WAITING'lere tryMatchForUser. */
function startQueueProcessor(io: Server) {
  setInterval(async () => {
    try {
      const top = await prisma.matchQueue.findMany({
        where: { status: MatchQueueStatus.WAITING },
        orderBy: [{ priorityScore: 'desc' }, { enteredAt: 'asc' }],
        take: 20,
        select: { userId: true },
      });
      for (const row of top) {
        const paired = await tryMatchForUser(io, row.userId);
        if (paired) break; // Bir eşleşme yaptık, sonraki turda devam
      }
    } catch (e) {
      console.error('[MatchV2] Queue processor error:', e);
    }
  }, QUEUE_POLL_MS);
}

export function registerMatchmakingV2Handlers(io: Server, socket: Socket) {
  socket.join(socket.data?.userId ?? 'unknown');

  /** 5 soru cevaplarını gönder, kuyruğa gir. */
  socket.on(
    'match:submit_answers',
    async (payload: {
      userId: string;
      answers: { questionId: string; optionId: string }[];
      minimumCommonAnswers?: number;
    }) => {
      try {
        const { userId, answers, minimumCommonAnswers = 1 } = payload;
        const uid = (socket.data?.userId as string) || userId;
        if (uid !== userId) {
          socket.emit('match:error', { code: 'UNAUTHORIZED', message: 'Yetkisiz' });
          return;
        }

        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            isBoostActive: true,
            boostExpiresAt: true,
            isPrime: true,
            primeExpiry: true,
            verified: true,
            totalSparksEarned: true,
            createdAt: true,
            gender: true,
            interestedIn: true,
            filterGenderActive: true,
            filterGender: true,
            filterGenderExpiresAt: true,
            filterMinAge: true,
            filterMaxAge: true,
            filterMaxDistance: true,
            latitude: true,
            longitude: true,
            age: true,
          },
        });
        if (!user) {
          socket.emit('match:error', { code: 'USER_NOT_FOUND', message: 'Kullanıcı bulunamadı' });
          return;
        }

        if (answers.length !== 5) {
          socket.emit('match:error', { code: 'INVALID_ANSWERS', message: '5 cevap gönderin' });
          return;
        }

        await prisma.userMatchPreference.upsert({
          where: { userId },
          update: { minimumCommonAnswers: Math.min(5, Math.max(1, minimumCommonAnswers)) },
          create: {
            userId,
            minimumCommonAnswers: Math.min(5, Math.max(1, minimumCommonAnswers)),
          },
        });

        const priorityScore = computePriorityScore(user as any);
        const queue = await prisma.matchQueue.create({
          data: {
            userId,
            priorityScore,
            status: MatchQueueStatus.WAITING,
            filters: {
              gender: user.gender,
              interestedIn: user.interestedIn,
              minCommon: Math.min(5, Math.max(1, minimumCommonAnswers)),
            },
          },
        });
        for (const a of answers) {
          await prisma.matchQueueAnswer.create({
            data: {
              matchQueueId: queue.id,
              questionId: a.questionId,
              optionId: a.optionId,
            },
          });
        }

        socket.data = socket.data || {};
        socket.data.userId = userId;
        socket.join(userId);
        socket.emit('match:searching', { queueId: queue.id });
        const paired = await tryMatchForUser(io, userId);
        if (!paired) {
          // Kuyruk işleyici zaten 2 sn'de tarayacak
        }
      } catch (e) {
        console.error('[MatchV2] submit_answers error:', e);
        socket.emit('match:error', { code: 'SERVER_ERROR', message: 'Bir hata oluştu' });
      }
    }
  );

  socket.on(
    'match:leave',
    async (payload: { userId?: string }) => {
      const userId = (socket.data?.userId as string) || payload.userId;
      if (!userId) return;
      await prisma.matchQueue.updateMany({
        where: { userId, status: MatchQueueStatus.WAITING },
        data: { status: MatchQueueStatus.CANCELLED },
      });
      socket.emit('match:left');
    }
  );

  socket.on('disconnect', async () => {
    const userId = socket.data?.userId as string | undefined;
    if (!userId) return;
    await prisma.matchQueue.updateMany({
      where: { userId, status: MatchQueueStatus.WAITING },
      data: { status: MatchQueueStatus.CANCELLED },
    });
  });
}

let queueProcessorStarted = false;

export function startMatchmakingV2(io: Server) {
  if (queueProcessorStarted) return;
  queueProcessorStarted = true;
  startQueueProcessor(io);
  console.log('[MatchV2] Queue processor started (every 2s).');
}
