import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sanitizeTelegramId } from "@/lib/myday/validation";
import { isValidTimezone } from "@/lib/myday/validation";

// GET /md/api/profile?telegramId=xxx
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const telegramId = sanitizeTelegramId(url.searchParams.get("telegramId"));

  if (!telegramId) {
    return NextResponse.json({ error: "Invalid telegramId" }, { status: 400 });
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
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

// POST /md/api/profile
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const telegramId = sanitizeTelegramId(url.searchParams.get("telegramId"));

  if (!telegramId) {
    return NextResponse.json({ error: "Invalid telegramId" }, { status: 400 });
  }

  try {
    const body = await req.json();
    let { timezone, reminderTime } = body;

    // Validate timezone
    if (timezone && !isValidTimezone(timezone)) {
      return NextResponse.json({ error: "Invalid timezone" }, { status: 400 });
    }

    // Validate reminderTime format
    if (reminderTime && typeof reminderTime !== "string") {
      return NextResponse.json({ error: "Invalid reminderTime format" }, { status: 400 });
    }

    const profile = await prisma.myDayProfile.upsert({
      where: { telegramId },
      create: {
        telegramId,
        timezone: timezone || "Europe/Moscow",
        reminderTime: reminderTime
          ? new Date(`2000-01-01T${reminderTime}Z`)
          : undefined,
      },
      update: {
        ...(timezone && { timezone }),
        ...(reminderTime && {
          reminderTime: new Date(`2000-01-01T${reminderTime}Z`),
        }),
        onboardedAt: new Date(),
      },
    });

    return NextResponse.json(profile);
  } catch (err) {
    console.error("Profile POST error:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
