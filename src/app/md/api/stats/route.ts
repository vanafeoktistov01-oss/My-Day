import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /md/api/stats?telegramId=xxx
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const telegramId = url.searchParams.get("telegramId");

  if (!telegramId) {
    return NextResponse.json({ error: "telegramId required" }, { status: 400 });
  }

  try {
    const profile = await prisma.myDayProfile.findUnique({
      where: { telegramId },
      include: { habits: true },
    });

    if (!profile) {
      return NextResponse.json({
        streak: 0,
        maxStreak: 0,
        totalLogs: 0,
        heatmap: [],
        habits: [],
        avgSleep: null,
        avgWater: null,
        avgMood: null,
      });
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Получаем логи за 30 дней
    const logs = await prisma.myDayDailyLog.findMany({
      where: {
        profileId: profile.id,
        localDate: { gte: thirtyDaysAgo },
      },
      orderBy: { localDate: "asc" },
    });

    // Streak — считаем с сегодня назад
    let streak = 0;
    let checkDate = new Date(now);

    while (true) {
      const dateStr = checkDate.toISOString().split("T")[0];
      const hasLog = logs.find(
        (l) => l.localDate.toISOString().split("T")[0] === dateStr && l.status === "COMPLETED"
      );
      if (hasLog) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        // Сегодня ещё не отметили — пропускаем сегодня и проверям вчера
        if (checkDate.toISOString().split("T")[0] === now.toISOString().split("T")[0]) {
          checkDate.setDate(checkDate.getDate() - 1);
          continue;
        }
        break;
      }
    }

    // Max streak
    let maxStreak = 0;
    let currentStreak = 0;
    for (const log of logs) {
      if (log.status === "COMPLETED") {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }

    // Heatmap (30 дней)
    const heatmap: Array<{ date: string; completed: boolean }> = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const dayLog = logs.find(
        (l) => l.localDate.toISOString().split("T")[0] === dateStr
      );
      heatmap.push({
        date: dateStr,
        completed: !!dayLog && dayLog.status === "COMPLETED",
      });
    }

    // Average stats
    const completedLogs = logs.filter((l) => l.status === "COMPLETED");
    const avgSleep = completedLogs.length > 0
      ? completedLogs.reduce((s, l) => s + (l.sleepHours || 0), 0) / completedLogs.length
      : null;
    const avgWater = completedLogs.length > 0
      ? completedLogs.reduce((s, l) => s + (l.waterCups || 0), 0) / completedLogs.length
      : null;
    const avgMood = completedLogs.length > 0
      ? completedLogs.reduce((s, l) => s + (l.mood || 0), 0) / completedLogs.length
      : null;

    return NextResponse.json({
      streak,
      maxStreak,
      totalLogs: logs.length,
      heatmap,
      habits: profile.habits,
      avgSleep: avgSleep ? Math.round(avgSleep * 10) / 10 : null,
      avgWater: avgWater ? Math.round(avgWater * 10) / 10 : null,
      avgMood: avgMood ? Math.round(avgMood * 10) / 10 : null,
    });
  } catch (err) {
    console.error("Stats GET error:", err);
    return NextResponse.json({
      streak: 0,
      maxStreak: 0,
      totalLogs: 0,
      heatmap: [],
      habits: [],
      avgSleep: null,
      avgWater: null,
      avgMood: null,
    });
  }
}
