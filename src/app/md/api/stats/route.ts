import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sanitizeTelegramId } from "@/lib/myday/validation";
import { calculateStreak, calculateMaxStreak, calculateAverage } from "@/lib/myday/streak";
import { getLocalDateStr } from "@/lib/myday/datetime";
import type { StatsResponse } from "@/lib/myday/types";

// GET /md/api/stats?telegramId=xxx
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const telegramId = sanitizeTelegramId(url.searchParams.get("telegramId"));

  if (!telegramId) {
    return NextResponse.json({ error: "Invalid telegramId" }, { status: 400 });
  }

  try {
    const profile = await prisma.myDayProfile.findUnique({
      where: { telegramId },
      include: { habits: true },
    });

    if (!profile) {
      return NextResponse.json(createEmptyStats());
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const logs = await prisma.myDayDailyLog.findMany({
      where: {
        profileId: profile.id,
        localDate: { gte: thirtyDaysAgo },
      },
      orderBy: { localDate: "asc" },
    });

    const now = new Date();

    // Use shared streak calculation with user's timezone
    const streak = calculateStreak(logs, now, profile.timezone);
    const maxStreak = calculateMaxStreak(logs);

    // Heatmap (30 дней) — uses user's local timezone for correct day alignment
    const heatmap: { date: string; completed: boolean }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = getLocalDateStr(d, profile.timezone);
      const dayLog = logs.find(
        (l) => l.localDate.toISOString().split("T")[0] === dateStr
      );
      heatmap.push({
        date: dateStr,
        completed: !!dayLog && dayLog.status === "COMPLETED",
      });
    }

    // Average stats using shared helper
    const avgSleep = calculateAverage(logs, "sleepHours") as number | null;
    const avgWater = calculateAverage(logs, "waterCups", 0) as number | null;
    const avgMood = calculateAverage(logs, "mood");

    const response: StatsResponse = {
      streak,
      maxStreak,
      totalLogs: logs.length,
      heatmap,
      habits: profile.habits,
      avgSleep,
      avgWater,
      avgMood,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("Stats GET error:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

function createEmptyStats(): StatsResponse {
  return {
    streak: 0,
    maxStreak: 0,
    totalLogs: 0,
    heatmap: [],
    habits: [],
    avgSleep: null,
    avgWater: null,
    avgMood: null,
  };
}
