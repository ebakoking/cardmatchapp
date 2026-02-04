/**
 * Yeni eşleşme sistemi – HTTP API
 * GET /api/match/questions → 5 soru + seçenekler (100k ölçek için indexed)
 */
import { Router } from 'express';
import { prisma } from '../prisma';
import { verifyJwt } from '../utils/jwt';

const router = Router();

function authMiddleware(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Yetkisiz erişim' },
    });
  }
  try {
    const payload = verifyJwt(authHeader.slice(7));
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Geçersiz token' },
    });
  }
}

/** Havuzdan rastgele 5 soru + her biri 4 seçenek (500 soru havuzu) */
router.get('/questions', authMiddleware, async (_req, res) => {
  try {
    const allIds = await prisma.matchQuestion.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    if (allIds.length < 5) {
      return res.status(503).json({
        success: false,
        error: { code: 'NOT_ENOUGH_QUESTIONS', message: 'Yeterli soru yok. Lütfen daha sonra deneyin.' },
      });
    }
    const shuffled = allIds.sort(() => Math.random() - 0.5);
    const selectedIds = shuffled.slice(0, 5).map((r) => r.id);
    const questions = await prisma.matchQuestion.findMany({
      where: { id: { in: selectedIds } },
      include: {
        options: { orderBy: { orderIndex: 'asc' }, take: 4 },
      },
    });
    const order = selectedIds.map((id) => questions.find((q) => q.id === id)).filter(Boolean) as typeof questions;
    const payload = questions.map((q) => ({
      id: q.id,
      questionText: q.questionText,
      orderIndex: q.orderIndex,
      options: q.options.map((o) => ({ id: o.id, optionText: o.optionText, orderIndex: o.orderIndex })),
    }));
    return res.json({ success: true, questions: payload });
  } catch (e) {
    console.error('[Match] GET /questions error:', e);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Sorular yüklenemedi' },
    });
  }
});

export default router;
