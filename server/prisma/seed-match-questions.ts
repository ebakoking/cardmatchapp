/**
 * Yeni eşleşme sistemi – 500 soru, her biri 4 seçenek (kişilik, sohbet, gündem).
 * Önce migration: npx prisma migrate dev (MatchQuestion tablosu gerekli).
 * Çalıştırma: npx ts-node prisma/seed-match-questions.ts
 */
import { PrismaClient } from '@prisma/client';
import { QUESTIONS } from './match-questions-data';

const prisma = new PrismaClient();

async function main() {
  console.log('[Seed] Match questions: 500 soru, her biri 4 seçenek...');
  if (QUESTIONS.length !== 500) {
    throw new Error(`Beklenen 500 soru, ${QUESTIONS.length} bulundu. match-questions-data.ts kontrol edin.`);
  }
  let created = 0;
  let updated = 0;
  for (let i = 0; i < QUESTIONS.length; i++) {
    const q = QUESTIONS[i];
    const orderIndex = i + 1;
    const options = q.options as [string, string, string, string];
    if (options.length !== 4) {
      console.warn(`[Seed] Soru ${orderIndex} 4 seçenekli değil (${options.length}), atlanıyor.`);
      continue;
    }
    const existing = await prisma.matchQuestion.findFirst({
      where: { orderIndex },
      include: { options: true },
    });
    if (existing) {
      await prisma.matchQuestion.update({
        where: { id: existing.id },
        data: { questionText: q.questionText, isActive: true },
      });
      await prisma.matchQuestionOption.deleteMany({ where: { questionId: existing.id } });
      for (let j = 0; j < 4; j++) {
        await prisma.matchQuestionOption.create({
          data: { questionId: existing.id, optionText: options[j], orderIndex: j },
        });
      }
      updated++;
    } else {
      const question = await prisma.matchQuestion.create({
        data: {
          questionText: q.questionText,
          orderIndex,
          isActive: true,
        },
      });
      for (let j = 0; j < 4; j++) {
        await prisma.matchQuestionOption.create({
          data: {
            questionId: question.id,
            optionText: options[j],
            orderIndex: j,
          },
        });
      }
      created++;
    }
  }
  console.log(`[Seed] Tamamlandı: ${created} yeni, ${updated} güncellendi. Toplam 500 soru, soru başı 4 seçenek.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
