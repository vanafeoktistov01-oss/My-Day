import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /md/api/profile?telegramId=xxx
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const telegramId = url.searchParams.get("telegramId");

  if (!telegramId) {
    return NextResponse.json({ error: "telegramId required" }, { status: 400 });
  }

  try {
    const profile = await prisma.myDayProfile.upsert({
      where: { telegramId },
      create: { telegramId },
      update: {},
    });

    return NextResponse.json(profile);
  } catch (err) {
    console.error("Profile GET error:", err);
    // Демо-режим при ошибке БД
    return NextResponse.json({
      id: "demo",
      telegramId,
      onboardedAt: null,
      timezone: "Europe/Moscow",
      reminderTime: null,
      trialStartedAt: null,
      proActive: false,
    });
  }
}

// POST /md/api/profile
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const telegramId = url.searchParams.get("telegramId");

  if (!telegramId) {
    return NextResponse.json({ error: "telegramId required" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { timezone, reminderTime } = body;

    const profile = await prisma.myDayProfile.upsert({
      where: { telegramId },
      create: { telegramId, timezone, reminderTime: reminderTime ? new Date(reminderTime) : undefined },
      update: {
        ...(timezone && { timezone }),
        ...(reminderTime && { reminderTime: new Date(reminderTime) }),
        onboardedAt: new Date(),
      },
    });

    return NextResponse.json(profile);
  } catch (err) {
    console.error("Profile POST error:", err);
    return NextResponse.json({
      telegramId,
      timezone: "Europe/Moscow",
      onboardedAt: new Date(),
    });
  }
}
