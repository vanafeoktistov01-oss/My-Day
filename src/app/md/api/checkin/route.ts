import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sanitizeTelegramId } from "@/lib/myday/validation";
import { validateCheckin } from "@/lib/myday/validation";
import { getLocalDateStr } from "@/lib/myday/datetime";

// GET /md/api/checkin?telegramId=xxx
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
      return NextResponse.json({ today: null, profile: null });
    }

    // Convert UTC now to user's local date
    const localDateStr = getLocalDateStr(new Date(), profile.timezone);

    const todayLog = await prisma.myDayDailyLog.findUnique({
      where: {
        profileId_localDate: {
          profileId: profile.id,
          localDate: new Date(localDateStr + "T00:00:00.000Z"),
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
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

// POST /md/api/checkin
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const telegramId = sanitizeTelegramId(url.searchParams.get("telegramId"));

  if (!telegramId) {
    return NextResponse.json({ error: "Invalid telegramId" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const validated = validateCheckin(body);

    if (!validated) {
      return NextResponse.json(
        { error: "Invalid checkin data", details: "Check sleepHours, waterCups, mood, habitDone ranges" },
        { status: 400 }
      );
    }

    const { sleepHours, waterCups, mood, habitDone } = validated;

    const profile = await prisma.myDayProfile.findUnique({
      where: { telegramId },
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Convert UTC now to user's local date
    const localDateStr = getLocalDateStr(new Date(), profile.timezone);

    const log = await prisma.myDayDailyLog.upsert({
      where: {
        profileId_localDate: {
          profileId: profile.id,
          localDate: new Date(localDateStr + "T00:00:00.000Z"),
        },
      },
      create: {
        profileId: profile.id,
        localDate: new Date(localDateStr + "T00:00:00.000Z"),
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
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
