import { Router } from 'express';
import { prisma } from '../prisma';
import { verifyJwt } from '../utils/jwt';

const router = Router();

const GENDER_FILTER_COST = 50; // elmas
const GENDER_FILTER_DURATION_MS = 30 * 60 * 1000; // 30 dakika

// Auth middleware
function authMiddleware(req: any, res: any, next: any) {
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

// POST /api/gender-filter/activate
router.post('/activate', authMiddleware, async (req: any, res) => {
  try {
    const { filterType } = req.body; // 'MALE' | 'FEMALE' | 'BOTH'
    const userId = req.user.userId;

    console.log('[GenderFilter] Activate request:', { userId, filterType });

    // Validate
    if (!['MALE', 'FEMALE', 'BOTH'].includes(filterType)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_FILTER_TYPE',
          message: 'Geçersiz filtre tipi'
        }
      });
    }

    // BOTH ücretsiz (varsayılan - filtre kapat)
    if (filterType === 'BOTH') {
      await prisma.user.update({
        where: { id: userId },
        data: {
          filterGenderActive: false,
          filterGender: 'BOTH',
          filterGenderExpiresAt: null,
        },
      });

      console.log('[GenderFilter] Filter disabled (BOTH selected)');
      return res.json({
        success: true,
        message: 'Filtre kaldırıldı',
        filterType: 'BOTH',
        expiresAt: null,
      });
    }

    // Bakiye kontrolü (tokenBalance alanı elmas içeriyor)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tokenBalance: true },
    });

    if (!user || user.tokenBalance < GENDER_FILTER_COST) {
      console.log('[GenderFilter] Insufficient balance:', {
        required: GENDER_FILTER_COST,
        balance: user?.tokenBalance || 0
      });
      return res.status(402).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_BALANCE',
          message: 'Yetersiz bakiye',
        },
        required: GENDER_FILTER_COST,
        balance: user?.tokenBalance || 0,
      });
    }

    const expiresAt = new Date(Date.now() + GENDER_FILTER_DURATION_MS);

    // Transaction ile elmas düş + filtre aktif et + satın alma kaydet
    await prisma.$transaction(async (tx) => {
      // Elmas düş ve filtre aktif et
      await tx.user.update({
        where: { id: userId },
        data: {
          tokenBalance: { decrement: GENDER_FILTER_COST },
          filterGenderActive: true,
          filterGender: filterType,
          filterGenderExpiresAt: expiresAt,
        },
      });

      // Satın alma kaydı
      await tx.genderFilterPurchase.create({
        data: {
          userId,
          filterType,
          tokenCost: GENDER_FILTER_COST,
          durationMinutes: 30,
          expiresAt,
        },
      });
    });

    console.log('[GenderFilter] ✅ Filter activated:', {
      filterType,
      expiresAt,
      newBalance: user.tokenBalance - GENDER_FILTER_COST
    });

    return res.json({
      success: true,
      message: `${filterType === 'MALE' ? 'Erkek' : 'Kadın'} filtresi aktif edildi (30 dakika)`,
      filterType,
      expiresAt,
      newBalance: user.tokenBalance - GENDER_FILTER_COST,
    });
  } catch (error: any) {
    console.error('[GenderFilter] Activate error:', error?.message || error);
    const message =
      process.env.NODE_ENV === 'development' && error?.message
        ? error.message
        : 'Bir hata oluştu. Lütfen tekrar dene.';
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message },
    });
  }
});

// GET /api/gender-filter/status
router.get('/status', authMiddleware, async (req: any, res) => {
  try {
    const userId = req.user.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        filterGenderActive: true,
        filterGender: true,
        filterGenderExpiresAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'Kullanıcı bulunamadı.' },
      });
    }

    // Süresi dolmuşsa kapat
    if (user.filterGenderActive && user.filterGenderExpiresAt) {
      if (new Date() > user.filterGenderExpiresAt) {
        console.log('[GenderFilter] Filter expired, disabling:', userId);
        await prisma.user.update({
          where: { id: userId },
          data: {
            filterGenderActive: false,
            filterGender: 'BOTH',
            filterGenderExpiresAt: null,
          },
        });

        return res.json({
          success: true,
          active: false,
          filterType: 'BOTH',
          expiresAt: null,
        });
      }
    }

    return res.json({
      success: true,
      active: user.filterGenderActive || false,
      filterType: user.filterGender || 'BOTH',
      expiresAt: user.filterGenderExpiresAt || null,
    });
  } catch (error: any) {
    console.error('[GenderFilter] Status error:', error?.message || error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Bir hata oluştu.' },
    });
  }
});

export default router;
