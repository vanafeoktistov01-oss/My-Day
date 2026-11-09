import { NextRequest, NextResponse } from "next/server";
import { bot } from "@/modules/bot/start";

// POST /api/bot/webhook
// Telegram webhook handler
export async function POST(req: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "Bot token not configured" }, { status: 500 });
  }

  try {
    const body = await req.json();

    // Handle update with Grammy bot
    await bot.handleUpdate(body);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}
