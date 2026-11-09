import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://your-app.vercel.app";
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CRON_SECRET = process.env.CRON_SECRET;

// GET/POST /api/cron
// Triggered by Vercel Cron:
//   - Every hour → reminders
//   - Sunday 18:00 → weekly insights
export async function POST(req: NextRequest) {
  // Validate secret
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (token !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0 = Sunday
  const hour = now.getUTCHours();

  let results = {
    remindersSent: 0,
    insightsSent: 0,
    errors: 0,
  };

  try {
    // 1. Hourly: Send reminders
    results.remindersSent = await sendReminders(now);
  } catch (err) {
    console.error("Cron reminders error:", err);
    results.errors++;
  }

  try {
    // 2. Sunday 18:00: Send weekly insights
    if (dayOfWeek === 0 && hour === 18) {
      results.insightsSent = await sendWeeklyInsights();
    }
  } catch (err) {
    console.error("Cron insights error:", err);
    results.errors++;
  }

  return NextResponse.json({ ok: true, results });
}

// ==========================================
// Hourly reminders
// ==========================================
async function sendReminders(now: Date): Promise<number> {
  let sent = 0;

  try {
    // Get all profiles with reminder time set
    const profiles = await prisma.myDayProfile.findMany({
      where: {
        reminderTime: { not: null },
      },
    });

    for (const profile of profiles) {
      try {
        // Check if reminder time is now (in user's timezone)
        const reminderTime = profile.reminderTime;
        if (!reminderTime) continue;

        // Get user's current hour (approximate using offset from UTC)
        const userTime = convertToUserTime(reminderTime, profile.timezone, now);
        if (!userTime.isTime) continue;

        // Check if user already completed today's check-in
        const todayStr = now.toISOString().split("T")[0];
        const todayLog = await prisma.myDayDailyLog.findUnique({
          where: {
            profileId_localDate: {
              profileId: profile.id,
              localDate: new Date(todayStr),
            },
          },
        });

        if (todayLog && todayLog.status === "COMPLETED") {
          continue; // Already checked in
        }

        // Check max retries
        const pendingTasks = await prisma.myDayReminderTask.findMany({
          where: {
            profileId: profile.id,
            isActive: true,
          },
          orderBy: { createdAt: "desc" },
        });

        const lastTask = pendingTasks[0];
        if (lastTask && lastTask.retryCount >= lastTask.maxRetries) {
          continue; // Max retries exceeded
        }

        // Create reminder task
        await prisma.myDayReminderTask.create({
          data: {
            profileId: profile.id,
            retryCount: lastTask ? lastTask.retryCount + 1 : 0,
            maxRetries: 3,
          },
        });

        // Send reminder via Telegram Bot API
        await sendReminderToUser(String(profile.telegramId));
        sent++;
      } catch (err) {
        console.error(`Reminder error for ${profile.telegramId}:`, err);
      }
    }
  } catch (err) {
    console.error("sendReminders error:", err);
  }

  return sent;
}

function convertToUserTime(
  reminderTime: Date,
  timezone: string,
  now: Date
): { isTime: boolean } {
  try {
    // Get the hour from the reminderTime (stored as DateTime, use the time portion)
    const reminderHour = reminderTime.getUTCHours();
    const reminderMinute = reminderTime.getUTCMinutes();

    // Simple check: if current UTC hour matches reminder hour (approximate)
    // In production, use a timezone library like `temporal` or `date-fns-tz`
    // For now, check if we're in the same hour window
    const nowHour = now.getUTCHours();

    // This is a rough check — in production, properly convert UTC to timezone
    // using IANA timezone database
    return { isTime: nowHour === reminderHour };
  } catch {
    return { isTime: false };
  }
}

async function sendReminderToUser(telegramId: string) {
  if (!BOT_TOKEN) {
    console.warn("TELEGRAM_BOT_TOKEN not set, skipping reminder");
    return;
  }

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  const mdUrl = `${APP_URL}/md?tg_user=${telegramId}&path=checkin`;

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: parseInt(telegramId),
        text:
          "⏰ Пора отметить свой день!\n\n" +
          "☀️ Сколько вы спали?\n💧 Сколько выпили воды?\n😊 Как настроение?\n\n" +
          "Нажмите кнопку, чтобы открыть приложение:",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "☀️ Отметить день",
                url: mdUrl,
              },
            ],
            [
              {
                text: "✅ Да, сегодня!",
                callback_data: `checkin ${telegramId}`,
              },
              {
                text: "⏰ Позже (через 10 мин)",
                callback_data: `snooze ${telegramId} 10`,
              },
            ],
          ],
        },
      }),
    });
  } catch (err) {
    console.error("Failed to send reminder:", err);
  }
}

// ==========================================
// Weekly insights (Sunday 18:00 UTC)
// ==========================================
async function sendWeeklyInsights(): Promise<number> {
  let sent = 0;

  try {
    const profiles = await prisma.myDayProfile.findMany({
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

    for (const profile of profiles) {
      try {
        const completedLogs = profile.dailyLogs.filter(
          (l) => l.status === "COMPLETED"
        );

        if (completedLogs.length < 3) continue;

        const insights: string[] = [];

        for (const rule of profile.insightRules) {
          const condition = rule.condition as { type: string } | null;
          if (!condition) continue;

          if (await matchesCondition(condition, completedLogs)) {
            insights.push(rule.message);
          }
        }

        if (insights.length === 0) continue;

        await sendInsightsToUser(String(profile.telegramId), insights);
        sent++;
      } catch (err) {
        console.error(`Insights error for ${profile.telegramId}:`, err);
      }
    }
  } catch (err) {
    console.error("sendWeeklyInsights error:", err);
  }

  return sent;
}

async function sendInsightsToUser(telegramId: string, insights: string[]) {
  if (!BOT_TOKEN) return;

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  let text = "📊 Ваш еженедельный отчёт:\n\n";
  insights.slice(0, 3).forEach((insight, i) => {
    text += `${i + 1}. ${insight}\n`;
  });

  if (insights.length === 1) {
    text += "\nПродолжайте вести дневник — чем больше данных, тем точнее инсайты!";
  }

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: parseInt(telegramId),
        text,
      }),
    });
  } catch (err) {
    console.error("Failed to send insights:", err);
  }
}

async function matchesCondition(
  condition: { type: string; [key: string]: any },
  logs: any[]
): Promise<boolean> {
  switch (condition.type) {
    case "less_than": {
      const field = condition.field;
      const threshold = condition.threshold;
      const days = condition.days || 7;

      if (!field || threshold === undefined) return false;

      const now = new Date();
      const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      const recentLogs = logs.filter((l) => l.localDate >= since);

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
      const recentLogs = logs.filter((l) => l.localDate >= since);

      if (recentLogs.length === 0) return false;

      const aboveCount = recentLogs.filter(
        (l) => l[field] !== null && l[field] >= threshold
      ).length;

      return aboveCount >= (condition.minDays || 3);
    }

    case "streak": {
      const minDays = condition.minDays;
      if (!minDays) return false;
      return logs.length >= minDays;
    }

    default:
      return false;
  }
}
