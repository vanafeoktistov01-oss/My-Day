#!/bin/bash
# Setup Telegram bot: webhook + commands
# Run inside Railway container

BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-your-token}"
APP_URL="${NEXT_PUBLIC_APP_URL:-https://your-app.vercel.app}"
WEBHOOK_URL="${APP_URL}/api/bot/webhook"

echo "🔧 Setting up Telegram bot..."
echo ""

# 1. Set webhook
echo "Setting webhook to: ${WEBHOOK_URL}"
WEBHOOK_RESULT=$(curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"${WEBHOOK_URL}\"}")

echo "Webhook result: ${WEBHOOK_RESULT}"
echo ""

# 2. Set bot commands
echo "Setting bot commands..."
curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setMyCommands" \
  -H "Content-Type: application/json" \
  -d '[
    {"command": "start", "description": "Начать работу"},
    {"command": "stats", "description": "Посмотреть статистику"},
    {"command": "insights", "description": "Получить инсайты"}
  ]'
echo ""

echo "🎉 Setup complete!"
echo ""
echo "Bot URL: ${APP_URL}/md?path=onboarding"
