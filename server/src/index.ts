import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { Server } from 'socket.io';
import { createRateLimiter } from './utils/rateLimit';
import authRouter from './routes/auth';
import userRouter from './routes/user';
import subscriptionRouter from './routes/subscription';
import tokensRouter from './routes/tokens';
import leaderboardRouter from './routes/leaderboard';
import messagesRouter from './routes/messages';
import adminRouter from './routes/admin';
import uploadRouter from './routes/upload';
import blockRouter from './routes/block';
import reportRouter from './routes/report';
import rewardsRouter from './routes/rewards';
import boostRouter from './routes/boost';
import mediaRouter from './routes/media';
import verificationRouter from './routes/verification';
import dailyRewardRouter from './routes/dailyReward';
import { startCronJobs, runMonthlySparkReset, cleanupExpiredBoosts } from './jobs/monthlySparkReset';
import { registerMatchmakingHandlers } from './socket/matchmaking';
import { registerChatHandlers } from './socket/chat';
import { registerFriendsHandlers } from './socket/friends';
import { setIO } from './socket/io';
import { FEATURES, METRICS } from './config/features';

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_ORIGIN || '*',
    methods: ['GET', 'POST'],
  },
});

// Socket.IO instance'ını global olarak paylaş
setIO(io);

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Global basic rate limit (development için devre dışı bırakıldı)
// Production'da aktifleştir
if (process.env.NODE_ENV === 'production') {
  app.use(
    createRateLimiter({
      windowMs: 60_000,
      max: 200,
      messageCode: 'GLOBAL_RATE_LIMIT',
    }),
  );
}

// Static files (uploads klasörü)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/user', userRouter);
app.use('/api/subscription', subscriptionRouter);
app.use('/api/tokens', tokensRouter);
app.use('/api/leaderboard', leaderboardRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/admin', adminRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/user', blockRouter);
app.use('/api/user', reportRouter);
app.use('/api/rewards', rewardsRouter);
app.use('/api/boost', boostRouter);
app.use('/api/media', mediaRouter);
app.use('/api/verification', verificationRouter);
app.use('/api/daily-reward', dailyRewardRouter);

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// Feature flags endpoint - Mobile bu endpoint'ten özelliklerin durumunu öğrenir
app.get('/api/features', (_req, res) => {
  res.json({
    success: true,
    data: {
      tokenGiftEnabled: FEATURES.TOKEN_GIFT_ENABLED,
      tokenGiftDisabledMessage: FEATURES.TOKEN_GIFT_DISABLED_MESSAGE,
      mediaViewEnabled: FEATURES.MEDIA_VIEW_ENABLED,
      primePurchaseEnabled: FEATURES.PRIME_PURCHASE_ENABLED,
      mockPurchaseEnabled: FEATURES.MOCK_PURCHASE_ENABLED,
    },
    metrics: {
      tokenGiftAttempts: METRICS.tokenGiftAttempts,
      tokenGiftBlocked: METRICS.tokenGiftBlocked,
    },
  });
});

// Socket.IO
io.on('connection', (socket) => {
  registerMatchmakingHandlers(io, socket);
  registerChatHandlers(io, socket);
  registerFriendsHandlers(io, socket);
});

// Admin endpoint: Manuel aylık spark reset (test için)
app.post('/api/admin/spark-reset', async (req, res) => {
  try {
    const result = await runMonthlySparkReset();
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Manual spark reset error:', error);
    res.status(500).json({ success: false, error: 'Spark reset failed' });
  }
});

// Admin endpoint: Boost cleanup (test için)
app.post('/api/admin/boost-cleanup', async (req, res) => {
  try {
    const count = await cleanupExpiredBoosts();
    res.json({ success: true, data: { expiredBoostsDeactivated: count } });
  } catch (error) {
    console.error('Boost cleanup error:', error);
    res.status(500).json({ success: false, error: 'Boost cleanup failed' });
  }
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on port ${PORT}`);
  
  // Cron job'ları başlat
  startCronJobs();
});

