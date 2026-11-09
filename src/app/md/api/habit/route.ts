import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /md/api/habit
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const telegramId = url.searchParams.get("telegramId");

  if (!telegramId) {
    return NextResponse.json({ error: "telegramId required" }, { status: 400 });
  }

  let title = "";
  let icon = "🏃";

  try {
    const body = await req.json();
    title = body.title || "";
    icon = body.icon || "🏃";

    if (!title) {
      return NextResponse.json({ error: "title required" }, { status: 400 });
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
    return NextResponse.json({
      id: "demo",
      title,
      icon,
    });
  }
}
