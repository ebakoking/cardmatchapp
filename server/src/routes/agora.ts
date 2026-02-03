/**
 * Agora Secure Mode: RTC token üretimi.
 * .env: AGORA_APP_ID, AGORA_APP_CERTIFICATE (Agora Console > Proje > App Certificate)
 */
import { Router, Request, Response } from 'express';
import { RtcTokenBuilder, RtcRole } from 'agora-token';
import { verifyJwt } from '../utils/jwt';

const router = Router();

const AGORA_APP_ID = process.env.AGORA_APP_ID || '';
const AGORA_APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE || '';

/** JWT ile korunan endpoint'ler için middleware */
function authMiddleware(req: any, res: Response, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Yetkisiz erişim' },
    });
  }
  const token = authHeader.slice(7);
  try {
    const payload = verifyJwt(token);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Geçersiz token' },
    });
  }
}

/**
 * GET /api/agora/token?channelName=xxx&uid=xxx
 * Giriş yapmış kullanıcı için Agora RTC token döner (Secure Mode).
 * channelName: arama kanalı (örn. friendshipId)
 * uid: Agora uid (sayı, mobil tarafta uidFromUserId(user.id) ile aynı olmalı)
 */
router.get('/token', authMiddleware, (req: Request, res: Response) => {
  if (!AGORA_APP_ID || !AGORA_APP_CERTIFICATE) {
    return res.status(503).json({
      success: false,
      error: {
        code: 'AGORA_NOT_CONFIGURED',
        message: 'Agora App ID veya App Certificate tanımlı değil.',
      },
    });
  }

  const channelName = String(req.query.channelName || '').trim();
  const uidParam = req.query.uid;

  if (!channelName || channelName.length >= 64) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_CHANNEL',
        message: 'channelName gerekli ve 64 karakterden kısa olmalı.',
      },
    });
  }

  const uid = typeof uidParam === 'string' ? parseInt(uidParam, 10) : Number(uidParam);
  if (Number.isNaN(uid) || uid < 1 || uid > 0xffffffff) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_UID',
        message: 'uid 1–4294967295 arası sayı olmalı.',
      },
    });
  }

  try {
    const tokenExpire = 3600; // 1 saat (saniye)
    const privilegeExpire = 3600;
    const token = RtcTokenBuilder.buildTokenWithUid(
      AGORA_APP_ID,
      AGORA_APP_CERTIFICATE,
      channelName,
      uid,
      RtcRole.PUBLISHER,
      tokenExpire,
      privilegeExpire
    );

    return res.json({ token });
  } catch (e) {
    console.error('Agora token error', e);
    return res.status(500).json({
      success: false,
      error: {
        code: 'TOKEN_GENERATION_FAILED',
        message: 'Token oluşturulamadı.',
      },
    });
  }
});

export default router;
