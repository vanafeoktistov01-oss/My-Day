import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /md/api/checkin?telegramId=xxx
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const telegramId = url.searchParams.get("telegramId");

  if (!telegramId) {
    return NextResponse.json({ error: "telegramId required" }, { status: 400 });
  }

  try {
    // Находим профиль
    const profile = await prisma.myDayProfile.findUnique({
      where: { telegramId },
      include: { habits: true },
    });

    if (!profile) {
      return NextResponse.json({ today: null, profile: null });
    }

    // Текущая дата в часовом поясе пользователя
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0]; // UTC — упрощение

    // Ищем чек-ин за сегодня
    const todayLog = await prisma.myDayDailyLog.findUnique({
      where: {
        profileId_localDate: {
          profileId: profile.id,
          localDate: new Date(todayStr),
        },
      },
    });

    return NextResponse.json({
      today: todayLog || null,
      profile: {
        telegramId: profile.telegramId,
        timezone: profile.timezone,
        habits: profile.habits,
      },
    });
  } catch (err) {
    console.error("Checkin GET error:", err);
    return NextResponse.json({ today: null, profile: null });
  }
}

// POST /md/api/checkin
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const telegramId = url.searchParams.get("telegramId");

  if (!telegramId) {
    return NextResponse.json({ error: "telegramId required" }, { status: 400 });
  }

  let sleepHours: number | null = null;
  let waterCups: number | null = null;
  let mood: number | null = null;
  let habitDone: boolean | null = null;

  try {
    const body = await req.json();
    sleepHours = body.sleepHours ?? null;
    waterCups = body.waterCups ?? null;
    mood = body.mood ?? null;
    habitDone = body.habitDone ?? null;

    // Находим профиль
    const profile = await prisma.myDayProfile.findUnique({
      where: { telegramId },
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    // Upsert daily log
    const log = await prisma.myDayDailyLog.upsert({
      where: {
        profileId_localDate: {
          profileId: profile.id,
          localDate: new Date(todayStr),
        },
      },
      create: {
        profileId: profile.id,
        localDate: new Date(todayStr),
        sleepHours,
        waterCups,
        mood,
        habitDone,
        status: "COMPLETED",
      },
      update: {
        sleepHours,
        waterCups,
        mood,
        habitDone,
        status: "COMPLETED",
      },
    });

    return NextResponse.json(log);
  } catch (err) {
    console.error("Checkin POST error:", err);
    // Демо-режим
    return NextResponse.json({
      id: "demo",
      sleepHours,
      waterCups,
      mood,
      habitDone,
      status: "COMPLETED",
    });
  }
}
