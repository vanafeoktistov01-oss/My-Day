import { Bot } from "grammy";
import { prisma } from "@/lib/prisma";

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN || "dev-token");

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://your-app.vercel.app";

// ==========================================
// /start command
// ==========================================
bot.command("start", async (ctx) => {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const telegramId = String(chatId);

  // Upsert profile
  const profile = await prisma.myDayProfile.upsert({
    where: { telegramId },
    create: { telegramId },
    update: {},
  });

  const mdUrl = `${APP_URL}/md?tg_user=${telegramId}&path=${profile.onboardedAt ? "checkin" : "onboarding"}`;

  await ctx.reply(
    `Привет! 👋\n\nЯ помогу вам сформировать привычку отслеживать сон, воду и настроение.\n\nНажмите кнопку ниже, чтобы открыть мини-приложение:`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🚀 Открыть приложение",
              url: mdUrl,
            },
          ],
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

  const telegramId = String(chatId);

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

    // Calculate streak
    const completedLogs = profile.dailyLogs.filter((l) => l.status === "COMPLETED");
    let streak = 0;
    const now = new Date();
    let checkDate = new Date(now);

    const todayStr = checkDate.toISOString().split("T")[0];
    const todayLog = completedLogs.find(
      (l) => l.localDate.toISOString().split("T")[0] === todayStr
    );
    if (!todayLog) {
      checkDate.setDate(checkDate.getDate() - 1);
    }

    while (true) {
      const dateStr = checkDate.toISOString().split("T")[0];
      const hasLog = completedLogs.find(
        (l) => l.localDate.toISOString().split("T")[0] === dateStr
      );
      if (hasLog) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    const avgSleep = completedLogs.length > 0
      ? (completedLogs.reduce((s, l) => s + (l.sleepHours || 0), 0) / completedLogs.length).toFixed(1)
      : null;
    const avgWater = completedLogs.length > 0
      ? (completedLogs.reduce((s, l) => s + (l.waterCups || 0), 0) / completedLogs.length).toFixed(1)
      : null;

    const moodEmojis = ["", "😢", "😕", "😐", "😊", "🤩"];
    const avgMood = completedLogs.length > 0
      ? completedLogs.reduce((s, l) => s + (l.mood || 3), 0) / completedLogs.length
      : 0;

    let text = `📊 Ваша статистика:\n\n`;
    text += `🔥 Серия: ${streak} дн.\n`;
    if (avgSleep) text += `☀️ Сон: ${avgSleep} ч\n`;
    if (avgWater) text += `💧 Вода: ${avgWater} стак.\n`;
    if (avgMood > 0) text += `😊 Настроение: ${moodEmojis[Math.round(avgMood)]}\n`;
    text += `\n📝 Всего записей: ${completedLogs.length}`;

    const mdUrl = `${APP_URL}/md/stats?tg_user=${telegramId}&path=stats`;

    await ctx.reply(text, {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "📊 Открыть статистику",
              url: mdUrl,
            },
          ],
        ],
      },
    });
  } catch (err) {
    console.error("Stats command error:", err);
    await ctx.reply("Пока нет данных для статистики. Начните отмечать дни!");
  }
});

// ==========================================
// /insights command
// ==========================================
bot.command("insights", async (ctx) => {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const telegramId = String(chatId);

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

    const insights: string[] = [];

    for (const rule of profile.insightRules) {
      const condition = rule.condition as { type: string } | null;
      if (!condition) continue;

      if (await matchesCondition(condition, completedLogs)) {
        insights.push(rule.message);
      }
    }

    if (insights.length === 0) {
      return ctx.reply("🔍 Пока не нашли интересных закономерностей. Продолжайте вести дневник!");
    }

    let text = "💡 Ваши инсайты за последние 30 дней:\n\n";
    insights.slice(0, 3).forEach((insight, i) => {
      text += `${i + 1}. ${insight}\n`;
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
      // Сохраняем COMPLETED чек-ин
      try {
        const profile = await prisma.myDayProfile.findUnique({
          where: { telegramId: telegramIdStr },
        });

        if (!profile) {
          return ctx.answerCallbackQuery({ text: "Профиль не найден" });
        }

        const now = new Date();
        const todayStr = now.toISOString().split("T")[0];

        await prisma.myDayDailyLog.upsert({
          where: {
            profileId_localDate: {
              profileId: profile.id,
              localDate: new Date(todayStr),
            },
          },
          create: {
            profileId: profile.id,
            localDate: new Date(todayStr),
            status: "COMPLETED",
          },
          update: { status: "COMPLETED" },
        });

        await ctx.answerCallbackQuery({ text: "✅ Отмечено!" });
        await ctx.reply("✅ Отлично! День отмечен! 🎉", {
          reply_markup: {
            force_reply: true,
            selective: true,
          },
        });
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
      const mdUrl = `${APP_URL}/md?tg_user=${telegramIdStr}&path=checkin`;
      await ctx.answerCallbackQuery({ text: "Открываю..." });
      // Telegram doesn't support opening URL from callback, so just acknowledge
      break;
    }

    default:
      await ctx.answerCallbackQuery();
  }
});

// ==========================================
// Helper: evaluate condition
// ==========================================
async function matchesCondition(
  condition: { type: string; [key: string]: any },
  logs: any[]
): Promise<boolean> {
  const completedLogs = logs.filter((l) => l.status === "COMPLETED");

  switch (condition.type) {
    case "less_than": {
      const field = condition.field;
      const threshold = condition.threshold;
      const days = condition.days || 7;

      if (!field || threshold === undefined) return false;

      const now = new Date();
      const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      const recentLogs = completedLogs.filter((l) => l.localDate >= since);

      if (recentLogs.length === 0) return false;

      const belowCount = recentLogs.filter(
        (l) => l[field] !== null && l[field] < threshold
      ).length;

      return belowCount >= (condition.minDays || 3);
    }

    case "greater_than": {
      const field = condition.field;
      const threshold = condition.threshold;
      const days = condition.days || 7;

      if (!field || threshold === undefined) return false;

      const now = new Date();
      const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      const recentLogs = completedLogs.filter((l) => l.localDate >= since);

      if (recentLogs.length === 0) return false;

      const aboveCount = recentLogs.filter(
        (l) => l[field] !== null && l[field] >= threshold
      ).length;

      return aboveCount >= (condition.minDays || 3);
    }

    case "streak": {
      const minDays = condition.minDays;
      if (!minDays) return false;

      let streak = 0;
      const now = new Date();
      let checkDate = new Date(now);

      const todayStr = checkDate.toISOString().split("T")[0];
      const todayLog = completedLogs.find(
        (l) => l.localDate.toISOString().split("T")[0] === todayStr
      );
      if (!todayLog) {
        checkDate.setDate(checkDate.getDate() - 1);
      }

      while (true) {
        const dateStr = checkDate.toISOString().split("T")[0];
        const hasLog = completedLogs.find(
          (l) => l.localDate.toISOString().split("T")[0] === dateStr
        );
        if (hasLog) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }

      return streak >= minDays;
    }

    default:
      return false;
  }
}

export { bot };
