import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /md/api/insights?telegramId=xxx
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const telegramId = url.searchParams.get("telegramId");

  if (!telegramId) {
    return NextResponse.json({ error: "telegramId required" }, { status: 400 });
  }

  try {
    const profile = await prisma.myDayProfile.findUnique({
      where: { telegramId },
      include: {
        insightRules: {
          where: { isActive: true },
        },
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
      return NextResponse.json({ insights: [] });
    }

    const insights: Array<{ ruleId: string; message: string }> = [];

    for (const rule of profile.insightRules) {
      const condition = rule.condition as { type: string; [key: string]: any } | null;
      if (!condition) continue;

      const matched = evaluateCondition(condition, profile.dailyLogs);
      if (matched) {
        insights.push({
          ruleId: rule.id,
          message: rule.message,
        });
      }
    }

    return NextResponse.json({ insights: insights.slice(0, 3) });
  } catch (err) {
    console.error("Insights GET error:", err);
    return NextResponse.json({ insights: [] });
  }
}

function evaluateCondition(
  condition: { type: string; [key: string]: any },
  logs: any[]
): boolean {
  const completedLogs = logs.filter((l) => l.status === "COMPLETED");

  switch (condition.type) {
    case "less_than": {
      // Пример: { type: "less_than", field: "sleepHours", threshold: 7 }
      // Проверяет, сколько раз за последние 7 дней поле было ниже threshold
      const field = condition.field;
      const threshold = condition.threshold;
      const days = condition.days || 7;

      if (!field || threshold === undefined) return false;

      const now = new Date();
      const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      const recentLogs = completedLogs.filter(
        (l) => l.localDate >= since
      );

      if (recentLogs.length === 0) return false;

      const belowCount = recentLogs.filter(
        (l) => l[field] !== null && l[field] < threshold
      ).length;

      return belowCount >= (condition.minDays || 3);
    }

    case "greater_than": {
      // Пример: { type: "greater_than", field: "waterCups", threshold: 6 }
      const field = condition.field;
      const threshold = condition.threshold;
      const days = condition.days || 7;

      if (!field || threshold === undefined) return false;

      const now = new Date();
      const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      const recentLogs = completedLogs.filter(
        (l) => l.localDate >= since
      );

      if (recentLogs.length === 0) return false;

      const aboveCount = recentLogs.filter(
        (l) => l[field] !== null && l[field] >= threshold
      ).length;

      return aboveCount >= (condition.minDays || 3);
    }

    case "streak": {
      // Пример: { type: "streak", minDays: 7 }
      const minDays = condition.minDays;
      if (!minDays) return false;

      let streak = 0;
      const now = new Date();
      let checkDate = new Date(now);

      // Если сегодня не отметили — начинаем с вчера
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

    case "missed": {
      // Пример: { type: "missed", field: "sleepHours", days: 3 }
      const days = condition.days || 3;
      const now = new Date();
      const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      const recentLogs = completedLogs.filter(
        (l) => l.localDate >= since
      );

      return recentLogs.length < (days - 1);
    }

    case "mood_trend": {
      // Пример: { type: "mood_trend", direction: "declining" }
      if (completedLogs.length < 5) return false;

      const firstHalf = completedLogs.slice(0, Math.floor(completedLogs.length / 2));
      const secondHalf = completedLogs.slice(Math.floor(completedLogs.length / 2));

      const avgFirst = firstHalf.reduce((s, l) => s + (l.mood || 3), 0) / firstHalf.length;
      const avgSecond = secondHalf.reduce((s, l) => s + (l.mood || 3), 0) / secondHalf.length;

      if (condition.direction === "declining") return avgSecond < avgFirst - 0.5;
      if (condition.direction === "improving") return avgSecond > avgFirst + 0.5;
      return false;
    }

    default:
      return false;
  }
}
