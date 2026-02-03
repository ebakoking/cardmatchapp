import { Router } from 'express';
import { prisma } from '../prisma';
import { verifyJwt } from '../utils/jwt';

const router = Router();

// Boost fiyatı (TL cinsinden)
const BOOST_PRICE_TL = 199.90;
const BOOST_DURATION_HOURS = 1; // 1 saat

// RevenueCat Product ID (App Store / Play Store'da tanımlı)
const BOOST_PRODUCT_ID = 'cardmatch_boost_1h';

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

// Boost durumunu getir
router.get('/status', authMiddleware, async (req: any, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        isBoostActive: true,
        boostExpiresAt: true,
        boostCount: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'Kullanıcı bulunamadı' },
      });
    }

    // Boost süresi dolmuşsa otomatik kapat
    if (user.isBoostActive && user.boostExpiresAt && new Date() > user.boostExpiresAt) {
      await prisma.user.update({
        where: { id: req.user.userId },
        data: { isBoostActive: false },
      });
      user.isBoostActive = false;
    }

    const remainingSeconds = user.isBoostActive && user.boostExpiresAt
      ? Math.max(0, Math.floor((user.boostExpiresAt.getTime() - Date.now()) / 1000))
      : 0;

    return res.json({
      success: true,
      data: {
        isActive: user.isBoostActive,
        expiresAt: user.boostExpiresAt,
        remainingSeconds,
        totalBoostsUsed: user.boostCount,
        price: BOOST_PRICE_TL,
        durationHours: BOOST_DURATION_HOURS,
        productId: BOOST_PRODUCT_ID,
      },
    });
  } catch (error) {
    console.error('Boost status error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Sunucu hatası' },
    });
  }
});

// Boost aktifleştir (In-App Purchase sonrası)
// NOT: Production'da burada RevenueCat webhook veya receipt doğrulama yapılmalı
router.post('/activate', authMiddleware, async (req: any, res) => {
  try {
    const { purchaseToken, transactionId } = req.body;

    // TODO: Production'da RevenueCat veya Apple/Google receipt doğrulama yapılmalı
    // Şimdilik development için direkt aktifleştir
    // 
    // Production için:
    // 1. RevenueCat SDK ile purchase doğrula
    // 2. veya Apple verifyReceipt / Google Billing API ile doğrula
    // 3. Duplicate transaction kontrolü yap
    
    console.log('[Boost] Activate request:', { 
      userId: req.user.userId, 
      purchaseToken: purchaseToken?.slice(0, 20) + '...',
      transactionId 
    });

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        isBoostActive: true,
        boostExpiresAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'Kullanıcı bulunamadı' },
      });
    }

    // 🔒 SECURITY FIX: Transaction ID zorunlu (null bypass'ı önle)
    if (!transactionId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_TRANSACTION_ID',
          message: 'Transaction ID gerekli.',
        },
      });
    }

    // Transaction ID ile duplicate kontrolü (aynı satın alma tekrar kullanılmasın)
    const existingPurchase = await prisma.boostPurchase.findFirst({
      where: {
        transactionId,
      },
    });

    if (existingPurchase) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'DUPLICATE_TRANSACTION',
          message: 'Bu satın alma zaten kullanılmış.',
        },
      });
    }

    // Boost zaten aktifse süreyi uzat
    let newExpiresAt: Date;
    if (user.isBoostActive && user.boostExpiresAt && user.boostExpiresAt > new Date()) {
      // Mevcut süreye ekle
      newExpiresAt = new Date(user.boostExpiresAt.getTime() + BOOST_DURATION_HOURS * 60 * 60 * 1000);
    } else {
      // Yeni boost başlat
      newExpiresAt = new Date(Date.now() + BOOST_DURATION_HOURS * 60 * 60 * 1000);
    }

    // Kullanıcıyı güncelle
    const updatedUser = await prisma.user.update({
      where: { id: req.user.userId },
      data: {
        isBoostActive: true,
        boostExpiresAt: newExpiresAt,
        boostCount: { increment: 1 },
      },
      select: {
        isBoostActive: true,
        boostExpiresAt: true,
        boostCount: true,
      },
    });

    // Satın alma kaydı
    await prisma.boostPurchase.create({
      data: {
        userId: req.user.userId,
        tokenCost: 0, // Artık token kullanmıyoruz
        priceTL: BOOST_PRICE_TL,
        durationHours: BOOST_DURATION_HOURS,
        expiresAt: newExpiresAt,
        transactionId: transactionId || null,
        purchaseToken: purchaseToken || null,
      },
    });

    const remainingSeconds = Math.floor((newExpiresAt.getTime() - Date.now()) / 1000);

    console.log('[Boost] Activated successfully:', {
      userId: req.user.userId,
      expiresAt: newExpiresAt,
      totalBoosts: updatedUser.boostCount,
    });

    return res.json({
      success: true,
      message: 'Boost 1 saat için aktifleştirildi!',
      data: {
        isActive: true,
        expiresAt: newExpiresAt,
        remainingSeconds,
        totalBoostsUsed: updatedUser.boostCount,
      },
    });
  } catch (error) {
    console.error('Boost activate error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Sunucu hatası' },
    });
  }
});

// Boost deaktifleştir (opsiyonel - admin veya test için)
router.post('/deactivate', authMiddleware, async (req: any, res) => {
  try {
    await prisma.user.update({
      where: { id: req.user.userId },
      data: {
        isBoostActive: false,
        boostExpiresAt: null,
      },
    });

    return res.json({
      success: true,
      message: 'Boost deaktifleştirildi',
    });
  } catch (error) {
    console.error('Boost deactivate error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Sunucu hatası' },
    });
  }
});

// Boost geçmişi
router.get('/history', authMiddleware, async (req: any, res) => {
  try {
    const history = await prisma.boostPurchase.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error('Boost history error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Sunucu hatası' },
    });
  }
});

export default router;
