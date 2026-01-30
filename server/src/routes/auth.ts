import { Router } from 'express';
import { z } from 'zod';
import { validateBody } from '../utils/validation';
import { signJwt } from '../utils/jwt';
import { prisma } from '../prisma';

const router = Router();

// In-memory OTP store for MVP
const otpStore = new Map<
  string,
  {
    code: string;
    expiresAt: number;
  }
>();

const requestOtpSchema = z.object({
  phoneNumber: z.string().min(8).max(20),
});

const verifyOtpSchema = z.object({
  phoneNumber: z.string().min(8).max(20),
  code: z.string().length(6),
});

const socialAuthSchema = z.object({
  provider: z.enum(['google', 'apple']),
  idToken: z.string(),
  email: z.string().email().optional(),
  name: z.string().optional(),
});

router.post(
  '/request-otp',
  validateBody(requestOtpSchema),
  async (req, res) => {
    const { phoneNumber } = req.body as z.infer<typeof requestOtpSchema>;

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000;

    otpStore.set(phoneNumber, { code, expiresAt });

    // TODO: Integrate real SMS provider or Firebase
    // For now we just log to server console.
    // eslint-disable-next-line no-console
    console.log(`OTP for ${phoneNumber}: ${code}`);

    return res.json({ success: true });
  },
);

router.post(
  '/verify-otp',
  validateBody(verifyOtpSchema),
  async (req, res) => {
    const { phoneNumber, code } = req.body as z.infer<typeof verifyOtpSchema>;

    const record = otpStore.get(phoneNumber);
    if (!record || record.code !== code || record.expiresAt < Date.now()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_OTP',
          message: 'OTP geçersiz veya süresi dolmuş.',
        },
      });
    }

    otpStore.delete(phoneNumber);

    let user = await prisma.user.findUnique({ where: { phoneNumber } });
    if (!user) {
      // Create bare user; onboarding will complete profile
      user = await prisma.user.create({
        data: {
          phoneNumber,
          nickname: `user_${Date.now()}`,
          age: 18,
          gender: 'OTHER',
          interestedIn: 'BOTH',
          city: 'Istanbul',
          country: 'TR',
        },
      });
    }

    const token = signJwt({
      userId: user.id,
      phoneNumber: user.phoneNumber,
    });

    return res.json({
      success: true,
      data: {
        token,
        user,
      },
    });
  },
);

// Social Authentication (Google / Apple)
router.post(
  '/social',
  validateBody(socialAuthSchema),
  async (req, res) => {
    try {
      const { provider, idToken, email, name } = req.body as z.infer<typeof socialAuthSchema>;
      
      // NOT: Gerçek uygulamada idToken'ı Google/Apple ile doğrulamanız gerekir.
      // Google: https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=XXX
      // Apple: JWT doğrulama
      
      // MVP için basit mock doğrulama - idToken'dan unique identifier oluştur
      // Gerçek uygulamada bu kısım Google/Apple API ile doğrulanmalı
      const providerId = `${provider}_${idToken.slice(0, 20)}`;
      
      // E-posta veya provider ID ile kullanıcı ara
      let user = null;
      
      if (email) {
        // E-posta ile kullanıcı ara (phoneNumber alanını e-posta olarak kullanıyoruz)
        user = await prisma.user.findFirst({
          where: {
            phoneNumber: email,
            authProvider: provider,
          },
        });
      }
      
      if (!user) {
        // Yeni kullanıcı oluştur
        const nickname = name 
          ? name.replace(/\s+/g, '_').toLowerCase().slice(0, 15) + '_' + Date.now().toString().slice(-4)
          : `${provider}_user_${Date.now()}`;
        
        user = await prisma.user.create({
          data: {
            phoneNumber: email || `${provider}_${Date.now()}@social.cardmatch`,
            nickname: nickname,
            age: 18,
            gender: 'OTHER',
            interestedIn: 'BOTH',
            city: 'Istanbul',
            country: 'TR',
            authProvider: provider,
          },
        });
        
        console.log(`[Auth] New social user created: ${user.id} via ${provider}`);
      } else {
        console.log(`[Auth] Existing social user logged in: ${user.id} via ${provider}`);
      }

      const token = signJwt({
        userId: user.id,
        phoneNumber: user.phoneNumber,
      });

      return res.json({
        success: true,
        data: {
          token,
          user,
          isNewUser: !user.verified, // Profil kurulumu gerekiyor mu
        },
      });
    } catch (error) {
      console.error('[Auth] Social auth error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'SOCIAL_AUTH_ERROR',
          message: 'Sosyal giriş sırasında bir hata oluştu.',
        },
      });
    }
  },
);

export default router;

