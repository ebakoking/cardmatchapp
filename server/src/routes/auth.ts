import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { validateBody } from '../utils/validation';
import { 
  signAccessToken, 
  signRefreshToken, 
  verifyRefreshToken,
  verifyAccessToken,
} from '../utils/jwt';
import { prisma } from '../prisma';
import { sendOtpSms, verifyOtpCode } from '../services/sms';
import { sendVerificationEmail, sendWelcomeEmail } from '../services/email';

// Google OAuth Client (token doğrulama için)
// Client ID'ler .env'den alınacak - production'da doldurulmalı
const googleClient = new OAuth2Client();
const GOOGLE_CLIENT_IDS = [
  process.env.GOOGLE_WEB_CLIENT_ID,
  process.env.GOOGLE_IOS_CLIENT_ID,
  process.env.GOOGLE_ANDROID_CLIENT_ID,
].filter(Boolean) as string[];

const router = Router();

// ============ IN-MEMORY OTP STORE (MVP) ============
// Production'da Redis veya database kullanılmalı
const otpStore = new Map<string, { code: string; expiresAt: number }>();

// Email doğrulama için OTP store
const emailOtpStore = new Map<string, { 
  code: string; 
  expiresAt: number; 
  password: string;
  nickname?: string;
}>();

// ============ VALIDATION SCHEMAS ============

const requestOtpSchema = z.object({
  phoneNumber: z.string().min(8).max(20),
});

const verifyOtpSchema = z.object({
  phoneNumber: z.string().min(8).max(20),
  code: z.string().length(6),
});

const emailRegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(100),
  nickname: z.string().min(2).max(30).optional(),
});

const emailLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const socialAuthSchema = z.object({
  provider: z.enum(['google', 'apple']),
  idToken: z.string(),
  email: z.string().email().optional(),
  name: z.string().optional(),
  providerId: z.string().optional(), // Google/Apple'dan gelen benzersiz ID
});

const refreshTokenSchema = z.object({
  refreshToken: z.string(),
});

// ============ HELPER FUNCTIONS ============

/**
 * Yeni kullanıcı için token çifti oluştur ve DB'ye kaydet
 */
async function createTokensForUser(userId: string) {
  const accessToken = signAccessToken(userId);
  const { token: refreshToken, expiresAt } = signRefreshToken(userId);
  
  // Refresh token'ı DB'ye kaydet
  await prisma.user.update({
    where: { id: userId },
    data: {
      refreshToken,
      refreshTokenExp: expiresAt,
    },
  });
  
  return { accessToken, refreshToken };
}

/**
 * Kullanıcıyı response formatına dönüştür (hassas alanları çıkar)
 */
function sanitizeUser(user: any) {
  const { passwordHash, refreshToken, refreshTokenExp, ...safeUser } = user;
  return safeUser;
}

/**
 * Kullanıcının profil kurulumunu tamamlayıp tamamlamadığını kontrol et
 */
function isProfileComplete(user: any): boolean {
  const hasDefaultNickname = 
    user.nickname?.startsWith('user_') || 
    user.nickname?.startsWith('apple_') || 
    user.nickname?.startsWith('google_') ||
    user.nickname?.startsWith('email_');
  
  return !!(
    user.nickname &&
    !hasDefaultNickname &&
    user.birthDate &&
    user.city &&
    user.age &&
    user.gender &&
    user.interestedIn
  );
}

// ============ PHONE OTP AUTH ============

/**
 * POST /api/auth/request-otp
 * Telefon numarasına OTP gönder
 */
router.post('/request-otp', validateBody(requestOtpSchema), async (req, res) => {
  const { phoneNumber } = req.body as z.infer<typeof requestOtpSchema>;

  // Twilio yapılandırılmış mı kontrol et
  const isTwilioConfigured = !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_VERIFY_SERVICE_SID;
  const isTestMode = !isTwilioConfigured;

  if (isTwilioConfigured) {
    // Twilio Verify ile SMS gönder
    const smsResult = await sendOtpSms(phoneNumber);
    
    if (!smsResult.success) {
      console.error(`[Auth] Twilio SMS failed for ${phoneNumber}:`, smsResult.error);
      return res.status(500).json({
        success: false,
        error: { code: 'SMS_FAILED', message: 'SMS gönderilemedi. Lütfen tekrar deneyin.' },
      });
    }

    console.log(`[Auth] OTP sent via Twilio to ${phoneNumber}`);
    return res.json({ 
      success: true,
      message: 'Doğrulama kodu gönderildi.',
      useTwilioVerify: true, // Mobil uygulamaya Twilio kullanıldığını bildir
    });
  } else {
    // Test modu: Lokal OTP oluştur
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 60 * 1000;
    otpStore.set(phoneNumber, { code, expiresAt });

    console.log(`[Auth] OTP for ${phoneNumber}: ${code} (TEST MODE)`);
    return res.json({ 
      success: true,
      message: 'Test modu: OTP aşağıda gösterildi.',
      testOtp: code,
    });
  }
});

/**
 * POST /api/auth/verify-otp
 * OTP doğrula ve giriş yap
 */
router.post('/verify-otp', validateBody(verifyOtpSchema), async (req, res) => {
  const { phoneNumber, code } = req.body as z.infer<typeof verifyOtpSchema>;

  // Twilio yapılandırılmış mı kontrol et
  const isTwilioConfigured = !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_VERIFY_SERVICE_SID;

  if (isTwilioConfigured) {
    // Twilio Verify ile doğrula
    const verifyResult = await verifyOtpCode(phoneNumber, code);
    if (!verifyResult.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_OTP', message: verifyResult.error || 'OTP geçersiz veya süresi dolmuş.' },
      });
    }
  } else {
    // Test modu: Lokal OTP kontrolü
    const record = otpStore.get(phoneNumber);
    if (!record || record.code !== code || record.expiresAt < Date.now()) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_OTP', message: 'OTP geçersiz veya süresi dolmuş.' },
      });
    }
    otpStore.delete(phoneNumber);
  }

  // Kullanıcıyı bul veya oluştur
  let user = await prisma.user.findUnique({ where: { phoneNumber } });
  let isNewUser = false;
  let wasReactivated = false;
  
  if (!user) {
    isNewUser = true;
    user = await prisma.user.create({
      data: {
        phoneNumber,
        nickname: `user_${Date.now()}`,
        age: 18,
        gender: 'OTHER',
        interestedIn: 'BOTH',
        city: 'Istanbul',
        country: 'TR',
        authProvider: 'phone',
        profileComplete: false,
        onboardingStep: 1,
      },
    });
    console.log(`[Auth] New phone user created: ${user.id}`);
  } else {
    // Dondurulmuş hesap kontrolü - otomatik aktifleştir
    if (user.status === 'FROZEN') {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          status: 'ACTIVE',
          frozenAt: null,
        },
      });
      wasReactivated = true;
      console.log(`[Auth] Frozen account reactivated: ${user.id}`);
    }
    
    // Banned hesap kontrolü
    if (user.status === 'BANNED') {
      return res.status(403).json({
        success: false,
        error: { code: 'ACCOUNT_BANNED', message: 'Bu hesap askıya alınmış.' },
      });
    }
  }

  // Token çifti oluştur
  const { accessToken, refreshToken } = await createTokensForUser(user.id);

  return res.json({
    success: true,
    data: {
      accessToken,
      refreshToken,
      user: sanitizeUser(user),
      isNewUser,
      wasReactivated,
      isProfileComplete: isProfileComplete(user),
      onboardingStep: user.onboardingStep || 1,
    },
  });
});

// ============ EMAIL AUTH ============

/**
 * POST /api/auth/email/register
 * E-posta ile kayıt - Doğrulama kodu gönderir
 */
router.post('/email/register', validateBody(emailRegisterSchema), async (req, res) => {
  const { email, password, nickname } = req.body as z.infer<typeof emailRegisterSchema>;

  // E-posta zaten kayıtlı mı?
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return res.status(400).json({
      success: false,
      error: { code: 'EMAIL_EXISTS', message: 'Bu e-posta adresi zaten kayıtlı.' },
    });
  }

  // Nickname kontrolü
  if (nickname) {
    const existingNickname = await prisma.user.findUnique({ where: { nickname } });
    if (existingNickname) {
      return res.status(400).json({
        success: false,
        error: { code: 'NICKNAME_EXISTS', message: 'Bu kullanıcı adı zaten kullanılıyor.' },
      });
    }
  }

  // 6 haneli doğrulama kodu oluştur
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 dakika

  // Şifreyi hashle ve store'a kaydet
  const passwordHash = await bcrypt.hash(password, 12);
  emailOtpStore.set(email, {
    code,
    expiresAt,
    password: passwordHash,
    nickname,
  });

  // Email gönder
  const emailResult = await sendVerificationEmail(email, code);
  
  console.log(`[Auth] Email verification code sent to: ${email}, success: ${emailResult.success}`);

  // Test modunda kodu döndür
  const response: any = {
    success: true,
    message: 'Doğrulama kodu e-posta adresinize gönderildi.',
    expiresIn: 300, // 5 dakika
  };

  // Test modu - Resend yapılandırılmamışsa kodu döndür
  if (!process.env.RESEND_API_KEY || process.env.ENABLE_TEST_OTP === 'true') {
    response.testOtp = code;
    console.log(`[Auth] Test mode - Email OTP: ${code}`);
  }

  return res.json(response);
});

/**
 * POST /api/auth/email/verify
 * E-posta doğrulama kodunu kontrol et ve hesap oluştur
 */
const emailVerifySchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

router.post('/email/verify', validateBody(emailVerifySchema), async (req, res) => {
  const { email, code } = req.body as z.infer<typeof emailVerifySchema>;

  // Store'dan bilgileri al
  const stored = emailOtpStore.get(email);
  if (!stored) {
    return res.status(400).json({
      success: false,
      error: { code: 'NO_PENDING_VERIFICATION', message: 'Doğrulama beklemiyor. Lütfen tekrar kayıt olun.' },
    });
  }

  // Süre kontrolü
  if (Date.now() > stored.expiresAt) {
    emailOtpStore.delete(email);
    return res.status(400).json({
      success: false,
      error: { code: 'CODE_EXPIRED', message: 'Doğrulama kodu süresi dolmuş. Lütfen tekrar kayıt olun.' },
    });
  }

  // Kod kontrolü
  if (stored.code !== code) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_CODE', message: 'Doğrulama kodu hatalı.' },
    });
  }

  // Kullanıcı oluştur
  const finalNickname = stored.nickname || `email_${Date.now()}`;
  
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: stored.password,
      nickname: finalNickname,
      age: 18,
      gender: 'OTHER',
      interestedIn: 'BOTH',
      city: 'Istanbul',
      country: 'TR',
      authProvider: 'email',
      emailVerified: true,
    },
  });

  // Store'dan sil
  emailOtpStore.delete(email);

  console.log(`[Auth] New email user created after verification: ${user.id}`);

  // Token çifti oluştur
  const { accessToken, refreshToken } = await createTokensForUser(user.id);

  // Hoşgeldin emaili gönder
  sendWelcomeEmail(email, finalNickname).catch(err => {
    console.error('[Auth] Welcome email failed:', err);
  });

  return res.json({
    success: true,
    data: {
      accessToken,
      refreshToken,
      user: sanitizeUser(user),
      isNewUser: true,
      isProfileComplete: false,
    },
  });
});

/**
 * POST /api/auth/email/login
 * E-posta ile giriş
 */
router.post('/email/login', validateBody(emailLoginSchema), async (req, res) => {
  const { email, password } = req.body as z.infer<typeof emailLoginSchema>;

  // Kullanıcıyı bul
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_CREDENTIALS', message: 'E-posta veya şifre hatalı.' },
    });
  }

  // Şifreyi doğrula
  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_CREDENTIALS', message: 'E-posta veya şifre hatalı.' },
    });
  }

  console.log(`[Auth] Email user logged in: ${user.id}`);

  // Token çifti oluştur
  const { accessToken, refreshToken } = await createTokensForUser(user.id);

  return res.json({
    success: true,
    data: {
      accessToken,
      refreshToken,
      user: sanitizeUser(user),
      isNewUser: false,
      isProfileComplete: isProfileComplete(user),
    },
  });
});

// ============ SOCIAL AUTH ============

/**
 * Google ID Token'ı doğrula
 * @returns Doğrulanmış kullanıcı bilgileri veya null
 */
async function verifyGoogleToken(idToken: string): Promise<{
  email: string;
  name?: string;
  providerId: string;
} | null> {
  try {
    // Client ID'ler yapılandırılmamışsa development mode
    if (GOOGLE_CLIENT_IDS.length === 0) {
      console.warn('[Auth] Google Client ID\'ler yapılandırılmamış - development mode');
      return null;
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_IDS,
    });
    
    const payload = ticket.getPayload();
    if (!payload) {
      console.error('[Auth] Google token payload boş');
      return null;
    }

    // Token geçerliliğini kontrol et
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      console.error('[Auth] Google token süresi dolmuş');
      return null;
    }

    return {
      email: payload.email!,
      name: payload.name,
      providerId: payload.sub, // Google'ın benzersiz user ID'si
    };
  } catch (error) {
    console.error('[Auth] Google token doğrulama hatası:', error);
    return null;
  }
}

/**
 * POST /api/auth/social
 * Google veya Apple ile giriş
 */
router.post('/social', validateBody(socialAuthSchema), async (req, res) => {
  try {
    const { provider, idToken, email, name, providerId } = req.body as z.infer<typeof socialAuthSchema>;
    
    let verifiedEmail = email;
    let verifiedName = name;
    let verifiedProviderId = providerId;

    // ============ GOOGLE TOKEN DOĞRULAMA ============
    if (provider === 'google') {
      // Production'da mutlaka token doğrula
      if (GOOGLE_CLIENT_IDS.length > 0) {
        const googleUser = await verifyGoogleToken(idToken);
        
        if (!googleUser) {
          return res.status(401).json({
            success: false,
            error: { 
              code: 'INVALID_GOOGLE_TOKEN', 
              message: 'Google token doğrulanamadı. Lütfen tekrar deneyin.' 
            },
          });
        }

        // Doğrulanmış bilgileri kullan
        verifiedEmail = googleUser.email;
        verifiedName = googleUser.name || name;
        verifiedProviderId = googleUser.providerId;
        
        console.log(`[Auth] Google token doğrulandı: ${verifiedEmail}`);
      } else {
        // Development mode - frontend'den gelen bilgilere güven
        console.warn('[Auth] Google token doğrulaması atlandı (development mode)');
        verifiedProviderId = providerId || `google_${Date.now()}`;
      }
    }
    
    // ============ APPLE TOKEN DOĞRULAMA ============
    if (provider === 'apple') {
      // Apple token doğrulama daha karmaşık - şimdilik providerId'ye güven
      // Production'da apple-signin-auth paketi kullanılmalı
      verifiedProviderId = providerId || `apple_${idToken.slice(0, 20)}`;
      console.log(`[Auth] Apple auth: ${verifiedEmail || 'email yok'}`);
    }

    // ============ KULLANICI İŞLEMLERİ ============
    
    // Provider ID ile kullanıcı ara
    let user = null;
    
    if (provider === 'google' && verifiedProviderId) {
      user = await prisma.user.findUnique({ where: { googleId: verifiedProviderId } });
    } else if (provider === 'apple' && verifiedProviderId) {
      user = await prisma.user.findUnique({ where: { appleId: verifiedProviderId } });
    }
    
    // E-posta ile de kontrol et
    if (!user && verifiedEmail) {
      user = await prisma.user.findUnique({ where: { email: verifiedEmail } });
      
      // Kullanıcı varsa provider ID'yi ekle
      if (user && verifiedProviderId) {
        const updateData = provider === 'google' 
          ? { googleId: verifiedProviderId, authProvider: 'google' }
          : { appleId: verifiedProviderId, authProvider: 'apple' };
        
        user = await prisma.user.update({
          where: { id: user.id },
          data: updateData,
        });
      }
    }
    
    let isNewUser = false;
    
    if (!user) {
      // Yeni kullanıcı oluştur
      isNewUser = true;
      const nickname = verifiedName 
        ? verifiedName.replace(/\s+/g, '_').toLowerCase().slice(0, 15) + '_' + Date.now().toString().slice(-4)
        : `${provider}_${Date.now()}`;
      
      user = await prisma.user.create({
        data: {
          email: verifiedEmail || null,
          googleId: provider === 'google' ? verifiedProviderId : null,
          appleId: provider === 'apple' ? verifiedProviderId : null,
          nickname,
          age: 18,
          gender: 'OTHER',
          interestedIn: 'BOTH',
          city: 'Istanbul',
          country: 'TR',
          authProvider: provider,
        },
      });
      
      console.log(`[Auth] New ${provider} user created: ${user.id}`);
    } else {
      console.log(`[Auth] Existing ${provider} user logged in: ${user.id}`);
    }

    // Token çifti oluştur
    const { accessToken, refreshToken } = await createTokensForUser(user.id);

    return res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: sanitizeUser(user),
        isNewUser,
        isProfileComplete: isProfileComplete(user),
      },
    });
  } catch (error) {
    console.error('[Auth] Social auth error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SOCIAL_AUTH_ERROR', message: 'Sosyal giriş sırasında bir hata oluştu.' },
    });
  }
});

// ============ TOKEN MANAGEMENT ============

/**
 * POST /api/auth/refresh
 * Access token yenile
 */
router.post('/refresh', validateBody(refreshTokenSchema), async (req, res) => {
  const { refreshToken } = req.body as z.infer<typeof refreshTokenSchema>;

  try {
    // Refresh token'ı doğrula
    const decoded = verifyRefreshToken(refreshToken);
    
    // Kullanıcıyı bul ve refresh token'ı kontrol et
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    
    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_REFRESH_TOKEN', message: 'Geçersiz refresh token.' },
      });
    }
    
    // Refresh token süresi dolmuş mu?
    if (user.refreshTokenExp && user.refreshTokenExp < new Date()) {
      return res.status(401).json({
        success: false,
        error: { code: 'REFRESH_TOKEN_EXPIRED', message: 'Oturum süresi doldu. Lütfen tekrar giriş yapın.' },
      });
    }
    
    // Yeni token çifti oluştur (token rotation)
    const tokens = await createTokensForUser(user.id);
    
    console.log(`[Auth] Token refreshed for user: ${user.id}`);
    
    return res.json({
      success: true,
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    });
  } catch (error: any) {
    console.error('[Auth] Token refresh error:', error.message);
    return res.status(401).json({
      success: false,
      error: { code: 'TOKEN_REFRESH_FAILED', message: 'Token yenileme başarısız.' },
    });
  }
});

/**
 * POST /api/auth/logout
 * Çıkış yap (refresh token'ı iptal et)
 */
router.post('/logout', async (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const decoded = verifyAccessToken(token);
      
      // Refresh token'ı temizle
      await prisma.user.update({
        where: { id: decoded.userId },
        data: {
          refreshToken: null,
          refreshTokenExp: null,
          isOnline: false,
          lastSeenAt: new Date(),
        },
      });
      
      console.log(`[Auth] User logged out: ${decoded.userId}`);
    } catch {
      // Token geçersiz olsa bile logout başarılı say
    }
  }
  
  return res.json({ success: true, message: 'Çıkış yapıldı.' });
});

// ============ /me RATE LIMITING ============
// User başına son istek zamanını tut
const meRateLimitMap = new Map<string, number>();
const ME_RATE_LIMIT_MS = 2000; // 2 saniye - aynı user 2 saniyede 1'den fazla istek yapamaz

/**
 * GET /api/auth/me
 * Mevcut kullanıcı bilgisi
 */
router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Yetkilendirme gerekli.' },
    });
  }
  
  const token = authHeader.slice(7);
  
  try {
    const decoded = verifyAccessToken(token);
    
    // 🚨 RATE LIMIT CHECK - Aşırı istek spam'ini engelle
    const userId = decoded.userId;
    const now = Date.now();
    const lastRequest = meRateLimitMap.get(userId) || 0;
    
    if (now - lastRequest < ME_RATE_LIMIT_MS) {
      // Çok sık istek - 304 döndür (değişmedi)
      // Log'u kaldırdık çünkü spam yapıyor
      return res.status(304).end();
    }
    
    meRateLimitMap.set(userId, now);
    console.log(`[Auth] /me request processed for user ${userId}`);
    
    const user = await prisma.user.findUnique({ 
      where: { id: decoded.userId },
      include: {
        profilePhotos: {
          orderBy: { order: 'asc' },
        },
      },
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'Kullanıcı bulunamadı.' },
      });
    }

    // Frozen hesap kontrolü
    if (user.status === 'FROZEN') {
      return res.status(403).json({
        success: false,
        error: { code: 'ACCOUNT_FROZEN', message: 'Hesabın dondurulmuş. Tekrar giriş yaparak aktifleştirebilirsin.' },
      });
    }

    // Banned hesap kontrolü
    if (user.status === 'BANNED') {
      return res.status(403).json({
        success: false,
        error: { code: 'ACCOUNT_BANNED', message: 'Bu hesap askıya alınmış.' },
      });
    }

    // Kadın/Erkek tercihi süresi dolmuşsa BOTH yap (ilk girişte Herkes kalır)
    const u = user as any;
    if ((u.filterGender === 'MALE' || u.filterGender === 'FEMALE') && (!u.filterGenderExpiresAt || new Date(u.filterGenderExpiresAt) <= new Date())) {
      const updated = await prisma.user.update({
        where: { id: decoded.userId },
        data: { filterGender: 'BOTH', filterGenderExpiresAt: null },
        include: {
          profilePhotos: { orderBy: { order: 'asc' } },
        },
      });
      return res.json({
        success: true,
        data: {
          user: sanitizeUser(updated),
          isProfileComplete: updated.profileComplete || isProfileComplete(updated),
          onboardingStep: updated.onboardingStep || 1,
          status: updated.status,
        },
      });
    }
    
    return res.json({
      success: true,
      data: {
        user: sanitizeUser(user),
        isProfileComplete: user.profileComplete || isProfileComplete(user),
        onboardingStep: user.onboardingStep || 1,
        status: user.status,
      },
    });
  } catch (error: any) {
    if (error.message === 'TOKEN_EXPIRED') {
      return res.status(401).json({
        success: false,
        error: { code: 'TOKEN_EXPIRED', message: 'Oturum süresi doldu.' },
      });
    }
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Geçersiz token.' },
    });
  }
});

export default router;
