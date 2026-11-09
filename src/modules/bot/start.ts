import { Bot } from "grammy";
import { prisma } from "@/lib/prisma";
import { getInsights } from "@/lib/myday/insights";
import { calculateStreak, calculateAverage } from "@/lib/myday/streak";
import { getLocalDateStr } from "@/lib/myday/datetime";
import { sanitizeTelegramId } from "@/lib/myday/validation";
import type { InsightCondition, StatsResponse } from "@/lib/myday/types";

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN || "dev-token");

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://your-app.vercel.app";

// ==========================================
// /start command
// ==========================================
bot.command("start", async (ctx) => {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const telegramId = sanitizeTelegramId(String(chatId));
  if (!telegramId) return;

  const profile = await prisma.myDayProfile.upsert({
    where: { telegramId },
    create: { telegramId },
    update: {},
  });

  const mdUrl = `${APP_URL}/md?tg_user=${telegramId}&path=${profile.onboardedAt ? "checkin" : "onboarding"}`;

  await ctx.reply(
    "Привет! 👋\n\nЯ помогу вам сформировать привычку отслеживать сон, воду и настроение.\n\nНажмите кнопку ниже, чтобы открыть мини-приложение:",
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🚀 Открыть приложение", url: mdUrl }],
        ],
      },
    }
  );
});

// ==========================================
// /stats command
// ==========================================
bot.command("stats", async (ctx) => {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const telegramId = sanitizeTelegramId(String(chatId));
  if (!telegramId) return;

  try {
    const profile = await prisma.myDayProfile.findUnique({
      where: { telegramId },
      include: {
        habits: true,
        dailyLogs: {
          where: {
            localDate: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            },
          },
          orderBy: { localDate: "asc" },
        },
      },
    });

    if (!profile) {
      return ctx.reply("Профиль не найден. Напишите /start чтобы создать.");
    }

    const completedLogs = profile.dailyLogs.filter((l) => l.status === "COMPLETED");

    if (completedLogs.length === 0) {
      return ctx.reply("Пока нет данных для статистики. Начните отмечать дни!");
    }

    // Use timezone-aware streak calculation
    const streak = calculateStreak(profile.dailyLogs, new Date(), profile.timezone);

    const avgSleep = calculateAverage(profile.dailyLogs, "sleepHours");
    const avgWater = calculateAverage(profile.dailyLogs, "waterCups", 0);
    const avgMood = calculateAverage(profile.dailyLogs, "mood");

    const moodEmojis = ["", "😢", "😕", "😐", "😊", "🤩"];

    let text = `📊 Ваша статистика:\n\n`;
    text += `🔥 Серия: ${streak} дн.\n`;
    if (avgSleep) text += `☀️ Сон: ${avgSleep} ч\n`;
    if (avgWater) text += `💧 Вода: ${avgWater} стак.\n`;
    if (avgMood) text += `😊 Настроение: ${moodEmojis[Math.round(avgMood)]}\n`;
    text += `\n📝 Всего записей: ${completedLogs.length}`;

    const mdUrl = `${APP_URL}/md/stats?tg_user=${telegramId}&path=stats`;

    await ctx.reply(text, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📊 Открыть статистику", url: mdUrl }],
        ],
      },
    });
  } catch (err) {
    console.error("Stats command error:", err);
    await ctx.reply("Не удалось загрузить статистику. Попробуйте позже.");
  }
});

// ==========================================
// /insights command
// ==========================================
bot.command("insights", async (ctx) => {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const telegramId = sanitizeTelegramId(String(chatId));
  if (!telegramId) return;

  try {
    const profile = await prisma.myDayProfile.findUnique({
      where: { telegramId },
      include: {
        insightRules: { where: { isActive: true } },
        dailyLogs: {
          where: {
            localDate: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            },
          },
          orderBy: { localDate: "asc" },
        },
      },
    });

    if (!profile) {
      return ctx.reply("Профиль не найден.");
    }

    const completedLogs = profile.dailyLogs.filter((l) => l.status === "COMPLETED");

    if (completedLogs.length < 3) {
      return ctx.reply("💡 Нужно минимум 3 записи для инсайтов. Продолжайте отмечать дни!");
    }

    // Parse conditions and use shared helper with timezone
    const typedRules = profile.insightRules.map((rule) => ({
      id: rule.id,
      message: rule.message,
      condition: rule.condition as InsightCondition | null,
    }));

    const matched = getInsights(typedRules, profile.dailyLogs, profile.timezone);

    if (matched.length === 0) {
      return ctx.reply("🔍 Пока не нашли интересных закономерностей. Продолжайте вести дневник!");
    }

    let text = "💡 Ваши инсайты за последние 30 дней:\n\n";
    matched.slice(0, 3).forEach((insight, i) => {
      text += `${i + 1}. ${insight.message}\n`;
    });

    await ctx.reply(text);
  } catch (err) {
    console.error("Insights command error:", err);
    await ctx.reply("Не удалось загрузить инсайты. Попробуйте позже.");
  }
});

// ==========================================
// Inline callback queries (buttons)
// ==========================================

bot.on("callback_query:data", async (ctx) => {
  const callbackData = ctx.callbackQuery.data;
  const chatId = ctx.callbackQuery.message?.chat.id;

  if (!callbackData || !chatId) return;

  const [action, telegramIdStr, ...rest] = callbackData.split(" ");

  switch (action) {
    case "checkin": {
      try {
        const profile = await prisma.myDayProfile.findUnique({
          where: { telegramId: telegramIdStr },
        });

        if (!profile) {
          return ctx.answerCallbackQuery({ text: "Профиль не найден" });
        }

        // Use user's local date
        const localDateStr = getLocalDateStr(new Date(), profile.timezone);

        await prisma.myDayDailyLog.upsert({
          where: {
            profileId_localDate: {
              profileId: profile.id,
              localDate: new Date(localDateStr + "T00:00:00.000Z"),
            },
          },
          create: {
            profileId: profile.id,
            localDate: new Date(localDateStr + "T00:00:00.000Z"),
            status: "COMPLETED",
          },
          update: { status: "COMPLETED" },
        });

        await ctx.answerCallbackQuery({ text: "✅ Отмечено!" });
        await ctx.reply("✅ Отлично! День отмечен! 🎉");
      } catch (err) {
        console.error("Checkin callback error:", err);
        await ctx.answerCallbackQuery({ text: "Ошибка" });
      }
      break;
    }

    case "snooze": {
      const [minutes] = rest;
      const snoozeMinutes = parseInt(minutes) || 10;

      try {
        const profile = await prisma.myDayProfile.findUnique({
          where: { telegramId: telegramIdStr },
        });

        if (profile) {
          await prisma.myDayReminderTask.create({
            data: {
              profileId: profile.id,
              createdAt: new Date(Date.now() + snoozeMinutes * 60 * 1000),
              maxRetries: 3,
            },
          });
        }

        await ctx.answerCallbackQuery({
          text: `⏰ Напомню через ${snoozeMinutes} мин`,
        });
      } catch (err) {
        console.error("Snooze callback error:", err);
        await ctx.answerCallbackQuery({ text: "Отложено" });
      }
      break;
    }

    case "open_app": {
      await ctx.answerCallbackQuery({ text: "Открываю..." });
      break;
    }

    default:
      await ctx.answerCallbackQuery();
  }
});

export { bot };
