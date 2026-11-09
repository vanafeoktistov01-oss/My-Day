#!/usr/bin/env tsx
/**
 * scripts/setup-bot.ts
 * 
 * Configure Telegram bot:
 * 1. Set webhook URL
 * 2. Set commands
 * 
 * Usage:
 *   npx tsx scripts/setup-bot.ts
 */

import { bot } from "@/modules/bot/start";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL;
const WEBHOOK_URL = APP_URL ? `${APP_URL}/api/bot/webhook` : null;

async function setup() {
  console.log("🔧 Setting up Telegram bot...\n");

  // 1. Set webhook
  if (WEBHOOK_URL) {
    try {
      const webhookResult = await bot.api.setWebhook(WEBHOOK_URL);
      console.log("✅ Webhook set:", WEBHOOK_URL);
    } catch (err: any) {
      console.error("❌ Failed to set webhook:", err.message);
    }
  } else {
    console.log("⚠️  NEXT_PUBLIC_APP_URL not set. Run:");
    console.log("   cp .env.example .env");
    console.log("   # Edit .env with NEXT_PUBLIC_APP_URL");
  }

  // 2. Set bot commands
  try {
    await bot.api.setMyCommands([
      { command: "start", description: "Начать работу" },
      { command: "stats", description: "Посмотреть статистику" },
      { command: "insights", description: "Получить инсайты" },
    ]);
    console.log("✅ Bot commands set: /start, /stats, /insights");
  } catch (err: any) {
    console.error("❌ Failed to set commands:", err.message);
  }

  console.log("\n🎉 Setup complete!");
  console.log("\nTo start the bot, run the Next.js dev server:");
  console.log("   npm run dev");
  console.log("\nThe bot will handle updates via the webhook at:");
  console.log(WEBHOOK_URL || "(not configured)");
}

setup().catch(console.error);
