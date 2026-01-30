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
import { registerMatchmakingHandlers } from './socket/matchmaking';
import { registerChatHandlers } from './socket/chat';
import { registerFriendsHandlers } from './socket/friends';
import { FEATURES, METRICS } from './config/features';

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_ORIGIN || '*',
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Global basic rate limit
app.use(
  createRateLimiter({
    windowMs: 60_000,
    max: 120,
    messageCode: 'GLOBAL_RATE_LIMIT',
  }),
);

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

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on port ${PORT}`);
});

