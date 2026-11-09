import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isReminderTime, getLocalDateStr } from "@/lib/myday/datetime";
import { evaluateCondition, getInsights } from "@/lib/myday/insights";
import type { InsightCondition, StatsResponse } from "@/lib/myday/types";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://your-app.vercel.app";
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CRON_SECRET = process.env.CRON_SECRET;

// GET/POST /api/cron
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (token !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  const hour = now.getUTCHours();

  let results = {
    remindersSent: 0,
    insightsSent: 0,
    errors: 0,
  };

  try {
    results.remindersSent = await sendReminders(now);
  } catch (err) {
    console.error("Cron reminders error:", err);
    results.errors++;
  }

  try {
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
  try {
    // Batch: fetch all profiles and today's logs in one query
    const profiles = await prisma.myDayProfile.findMany({
      where: {
        reminderTime: { not: null },
      },
    });

    if (profiles.length === 0) return 0;

    // Batch fetch all today's logs at once
    const todayStr = now.toISOString().split("T")[0];
    const todayLogs = await prisma.myDayDailyLog.findMany({
      where: {
        localDate: {
          gte: new Date(todayStr + "T00:00:00.000Z"),
          lt: new Date(todayStr + "T23:59:59.999Z"),
        },
        profileId: {
          in: profiles.map((p) => p.id),
        },
      },
    });

    // Build lookup: profileId -> today's log
    const todayLogMap = new Map(
      todayLogs.map((log) => [log.profileId, log])
    );

    let sent = 0;

    for (const profile of profiles) {
      try {
        const reminderTime = profile.reminderTime;
        if (!reminderTime) continue;

        // Use proper timezone-aware check.
        // reminderTime is stored at midnight UTC (e.g. "2000-01-01T09:00:00Z")
        // Extract "HH:MM" from the ISO string (deterministic across Node versions)
        const reminderTimeStr = reminderTime.toISOString().slice(11, 16);

        if (!isReminderTime(now, reminderTimeStr, profile.timezone)) {
          continue;
        }

        // Check if user already completed today's check-in
        const todayLog = todayLogMap.get(profile.id);
        if (todayLog && todayLog.status === "COMPLETED") {
          continue;
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
          continue;
        }

        await prisma.myDayReminderTask.create({
          data: {
            profileId: profile.id,
            retryCount: lastTask ? lastTask.retryCount + 1 : 0,
            maxRetries: 3,
          },
        });

        await sendReminderToUser(String(profile.telegramId));
        sent++;
      } catch (err) {
        console.error(`Reminder error for ${profile.telegramId}:`, err);
      }
    }

    return sent;
  } catch (err) {
    console.error("sendReminders error:", err);
    return 0;
  }
}

async function sendReminderToUser(telegramId: string) {
  if (!BOT_TOKEN) return;

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
            [{ text: "☀️ Отметить день", url: mdUrl }],
            [
              { text: "✅ Да, сегодня!", callback_data: `checkin ${telegramId}` },
              { text: "⏰ Позже (через 10 мин)", callback_data: `snooze ${telegramId} 10` },
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

    let sent = 0;

    for (const profile of profiles) {
      try {
        const completedLogs = profile.dailyLogs.filter(
          (l) => l.status === "COMPLETED"
        );

        if (completedLogs.length < 3) continue;

        // Use shared typed rules and evaluator with user's timezone
        const typedRules = profile.insightRules.map((rule) => ({
          id: rule.id,
          message: rule.message,
          condition: rule.condition as InsightCondition | null,
        }));

        const matched = getInsights(typedRules, profile.dailyLogs, profile.timezone);
        if (matched.length === 0) continue;

        await sendInsightsToUser(String(profile.telegramId), matched);
        sent++;
      } catch (err) {
        console.error(`Insights error for ${profile.telegramId}:`, err);
      }
    }

    return sent;
  } catch (err) {
    console.error("sendWeeklyInsights error:", err);
    return 0;
  }
}

async function sendInsightsToUser(
  telegramId: string,
  insights: Array<{ ruleId: string; message: string }>
) {
  if (!BOT_TOKEN) return;

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  let text = "📊 Ваш еженедельный отчёт:\n\n";
  insights.slice(0, 3).forEach((insight, i) => {
    text += `${i + 1}. ${insight.message}\n`;
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
