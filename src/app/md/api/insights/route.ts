import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sanitizeTelegramId } from "@/lib/myday/validation";
import { getInsights } from "@/lib/myday/insights";
import type { InsightCondition, InsightsResponse } from "@/lib/myday/types";

// GET /md/api/insights?telegramId=xxx
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const telegramId = sanitizeTelegramId(url.searchParams.get("telegramId"));

  if (!telegramId) {
    return NextResponse.json({ error: "Invalid telegramId" }, { status: 400 });
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

    // Parse JSON conditions with proper typing
    const typedRules = profile.insightRules.map((rule) => ({
      id: rule.id,
      message: rule.message,
      condition: rule.condition as InsightCondition | null,
    }));

    const matched = getInsights(typedRules, profile.dailyLogs);

    const response: InsightsResponse = { insights: matched };
    return NextResponse.json(response);
  } catch (err) {
    console.error("Insights GET error:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
