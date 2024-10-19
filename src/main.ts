import "dotenv/config";
import TelegramBot from "node-telegram-bot-api";
import {
  handleUnhandledLinksSilently,
  addBotListeners,
  logger,
  DB_connectToDatabase,
} from "./utils/index.js";

const token = process.env.BOT_TOKEN;
if (!token) {
  logger.error("BOT_TOKEN environment variable is not set");
  process.exit(1);
}

try {
  const bot = new TelegramBot(token, { polling: true });
  bot.on("polling_error", (error) => {
    logger.error(`Polling error: ${error}`);
  });
  await DB_connectToDatabase();
  await handleUnhandledLinksSilently(bot);
  await addBotListeners(bot);

  logger.info("Bot is running...");
} catch (error: any) {
  logger.error(`Error initializing bot: ${error}`);
  process.exit(1);
}
