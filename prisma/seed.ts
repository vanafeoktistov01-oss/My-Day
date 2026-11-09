/**
 * Seed script — вставляет 5 демо-правил инсайтов для нового профиля.
 *
 * Usage:
 *   npx prisma db seed
 *
 * Add to package.json:
 *   "prisma": { "seed": "npx tsx prisma/seed.ts" }
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_INSIGHT_RULES = [
  {
    // "Мало сна" — если менее 7 часов сна ≥3 раза за неделю
    message:
      "☀️ Вы спали менее 7 часов {count} раз за последние {days} дней. Постарайтесь ложиться раньше — для взрослых норма 7–9 часов.",
    condition: {
      type: "less_than",
      field: "sleepHours",
      threshold: 7,
      days: 7,
      minDays: 3,
    },
  },
  {
    // "Пейте больше воды" — если менее 6 стаканов ≥3 раза за неделю
    message:
      "💧 Вы выпивали менее 6 стаканов воды {count} раз за последние {days} дней. Норма — 8 стаканов в день.",
    condition: {
      type: "less_than",
      field: "waterCups",
      threshold: 6,
      days: 7,
      minDays: 3,
    },
  },
  {
    // "Пейте достаточно воды" — если ≥8 стаканов ≥5 раз за неделю (позитивный)
    message:
      "💪 Отличная работа с водой! Вы выпивали 8+ стаканов {count} раз за последние {days} дней. Продолжайте!",
    condition: {
      type: "greater_than",
      field: "waterCups",
      threshold: 8,
      days: 7,
      minDays: 5,
    },
  },
  {
    // "Настроение падает" — если среднее настроение ухудшается
    message:
      "😊 Ваше настроение снижается: во второй половине периода вы чувствовали себя хуже, чем в первой. Возможно, стоит пересмотреть привычки.",
    condition: {
      type: "mood_trend",
      direction: "declining",
    },
  },
  {
    // "Супер-серия!" — если стрик ≥7 дней
    message:
      "🔥 Невероятно! Серия из {days} дней без пропусков — вы формируете настоящую привычку!",
    condition: {
      type: "streak",
      minDays: 7,
    },
  },
];

async function main() {
  console.log("🌱 Seeding default insight rules...\n");

  // Find or create a demo profile
  let profile = await prisma.myDayProfile.findFirst();

  if (!profile) {
    profile = await prisma.myDayProfile.create({
      data: {
        telegramId: "seed_demo",
        timezone: "Europe/Moscow",
        reminderTime: new Date("2000-01-01T09:00:00Z"),
      },
    });
    console.log("  Created demo profile:", profile.telegramId);
  }

  // Delete existing rules
  await prisma.myDayInsightRule.deleteMany({
    where: { profileId: profile.id },
  });

  // Insert default rules
  for (const rule of DEFAULT_INSIGHT_RULES) {
    await prisma.myDayInsightRule.create({
      data: {
        profileId: profile.id,
        message: rule.message,
        condition: rule.condition,
        isActive: true,
      },
    });
  }

  console.log(`  Created ${DEFAULT_INSIGHT_RULES.length} insight rules`);
  console.log("\n✅ Seed complete!\n");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
