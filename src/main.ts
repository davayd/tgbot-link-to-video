import "dotenv/config";
import TelegramBot from "node-telegram-bot-api";
import { addBotListeners, logger } from "./utils/index.js";
import { BOT_TOKEN } from "./constants.js";

if (!BOT_TOKEN) {
  logger.error(`BOT_TOKEN environment variable is not set`);
  process.exit(1);
}

try {
  const bot = new TelegramBot(BOT_TOKEN, {
    webHook: true
  });
  bot.on("polling_error", (error) => {
    logger.error(`Polling error: ${error.stack}`);
  });
  bot.on("webhook_error", (error) => {
    logger.error(`Webhook error: ${error.stack}`);
  });
  await addBotListeners(bot);
  const webhookInfo = await bot.getWebHookInfo();
  logger.debug(webhookInfo);

  logger.info("Bot is running...");
} catch (error: any) {
  console.log(error);
  logger.error(`Error initializing bot: ${error.stack}`);
  process.exit(1);
}
