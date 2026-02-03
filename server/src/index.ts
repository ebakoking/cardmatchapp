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
import agoraRouter from './routes/agora';
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
app.use('/api/agora', agoraRouter);

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// Privacy Policy sayfası
app.get('/privacy', (_req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gizlilik Politikası - CardMatch</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; background: #0B1020; color: #fff; }
    h1 { color: #8B5CF6; }
    h2 { color: #A78BFA; margin-top: 30px; }
    p { margin: 15px 0; }
  </style>
</head>
<body>
  <h1>Gizlilik Politikası</h1>
  <p><strong>Son güncelleme:</strong> 2 Şubat 2026</p>
  
  <h2>1. Toplanan Veriler</h2>
  <p>CardMatch uygulaması aşağıdaki verileri toplar:</p>
  <ul>
    <li><strong>Hesap Bilgileri:</strong> Ad, e-posta adresi, telefon numarası</li>
    <li><strong>Profil Bilgileri:</strong> Yaş, cinsiyet, biyografi, şehir</li>
    <li><strong>Konum:</strong> Yakındaki kullanıcıları bulmak için konum bilgisi</li>
    <li><strong>İçerik:</strong> Fotoğraflar, mesajlar, sesli mesajlar</li>
    <li><strong>Kullanım Verileri:</strong> Uygulama içi etkileşimler</li>
  </ul>
  
  <h2>2. Verilerin Kullanımı</h2>
  <p>Topladığımız veriler şu amaçlarla kullanılır:</p>
  <ul>
    <li>Hesabınızı oluşturmak ve yönetmek</li>
    <li>Size yakın kullanıcıları göstermek</li>
    <li>Eşleşme ve sohbet özelliklerini sağlamak</li>
    <li>Uygulama deneyimini iyileştirmek</li>
  </ul>
  
  <h2>3. Veri Paylaşımı</h2>
  <p>Verileriniz üçüncü taraflarla satılmaz. Sadece şu durumlarda paylaşılabilir:</p>
  <ul>
    <li>Yasal zorunluluk halinde</li>
    <li>Hizmet sağlayıcılarımızla (sunucu, depolama)</li>
  </ul>
  
  <h2>4. Veri Güvenliği</h2>
  <p>Verileriniz şifreli bağlantılar (HTTPS) ile korunur ve güvenli sunucularda saklanır.</p>
  
  <h2>5. Haklarınız</h2>
  <p>İstediğiniz zaman hesabınızı silebilir ve verilerinizin silinmesini talep edebilirsiniz.</p>
  
  <h2>6. İletişim</h2>
  <p>Sorularınız için: <a href="mailto:destek@cardmatchapp.com" style="color: #8B5CF6;">destek@cardmatchapp.com</a></p>
</body>
</html>
  `);
});

// Terms of Service sayfası
app.get('/terms', (_req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kullanım Koşulları - CardMatch</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; background: #0B1020; color: #fff; }
    h1 { color: #8B5CF6; }
    h2 { color: #A78BFA; margin-top: 30px; }
    p { margin: 15px 0; }
  </style>
</head>
<body>
  <h1>Kullanım Koşulları</h1>
  <p><strong>Son güncelleme:</strong> 2 Şubat 2026</p>
  
  <h2>1. Hizmet Tanımı</h2>
  <p>CardMatch, kullanıcıların eğlenceli sorularla eşleşip sohbet edebileceği bir sosyal tanışma uygulamasıdır.</p>
  
  <h2>2. Kullanıcı Şartları</h2>
  <ul>
    <li>18 yaşından büyük olmalısınız</li>
    <li>Gerçek bilgilerle kayıt olmalısınız</li>
    <li>Başkalarına saygılı davranmalısınız</li>
    <li>Yasadışı içerik paylaşmamalısınız</li>
  </ul>
  
  <h2>3. Yasaklanan Davranışlar</h2>
  <ul>
    <li>Sahte profil oluşturmak</li>
    <li>Taciz veya zorbalık</li>
    <li>Spam veya reklam</li>
    <li>Uygunsuz içerik paylaşmak</li>
  </ul>
  
  <h2>4. Hesap Sonlandırma</h2>
  <p>Kuralları ihlal eden hesaplar uyarı verilmeden kapatılabilir.</p>
  
  <h2>5. Sorumluluk Reddi</h2>
  <p>CardMatch, kullanıcılar arası etkileşimlerden sorumlu değildir. Güvenliğiniz için dikkatli olun.</p>
  
  <h2>6. İletişim</h2>
  <p>Sorularınız için: <a href="mailto:destek@cardmatchapp.com" style="color: #8B5CF6;">destek@cardmatchapp.com</a></p>
</body>
</html>
  `);
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

