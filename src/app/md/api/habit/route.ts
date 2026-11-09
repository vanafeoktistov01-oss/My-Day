import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sanitizeTelegramId } from "@/lib/myday/validation";

// POST /md/api/habit
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const telegramId = sanitizeTelegramId(url.searchParams.get("telegramId"));

  if (!telegramId) {
    return NextResponse.json({ error: "Invalid telegramId" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const title = (body.title || "").trim();
    const icon = body.icon || "🏃";

    if (!title || title.length < 1 || title.length > 100) {
      return NextResponse.json(
        { error: "title is required (1-100 chars)" },
        { status: 400 }
      );
    }

    const profile = await prisma.myDayProfile.upsert({
      where: { telegramId },
      create: { telegramId },
      update: {},
    });

    const habit = await prisma.myDayHabit.create({
      data: {
        profileId: profile.id,
        title,
        icon,
      },
    });

    return NextResponse.json(habit);
  } catch (err) {
    console.error("Habit POST error:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
