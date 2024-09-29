import "dotenv/config";
import TelegramBot from "node-telegram-bot-api";
import { isValidUrl } from "./utils/is-valid-url.js";
import { processAndSendVideo } from "./utils/process-and-send-video.js";
import { logger } from "./utils/winston-logger.js";

// Use the BOT_TOKEN environment variable
const token = process.env.BOT_TOKEN;

if (!token) {
  console.error("BOT_TOKEN environment variable is not set");
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

export const UNHANDLED_LINKS = new Set();

// Add the new command handler /retry
bot.onText(/\/retry/, async (msg) => {
  const chatId = msg.chat.id;

  const statusMessage = await bot.sendMessage(
    chatId,
    "🔄 Получение последних ссылок на супер-мемы..."
  );

  try {
    const chatLinks = UNHANDLED_LINKS;

    if (chatLinks.length === 0) {
      await bot.editMessageText(
        "Команда /retry не найшла необработанных ссылок на супер-мемы 🥲",
        {
          chat_id: chatId,
          message_id: statusMessage.message_id,
        }
      );
      return;
    }

    await bot.editMessageText(
      `🔄 Найдено ${chatLinks.length} ссылок. Обрабатываем...`,
      {
        chat_id: chatId,
        message_id: statusMessage.message_id,
      }
    );

    for (const [index, url] of chatLinks.entries()) {
      await bot.editMessageText(
        `🔄 Обрабатываем ссылку ${index + 1} из ${chatLinks.size}...`,
        {
          chat_id: chatId,
          message_id: statusMessage.message_id,
        }
      );

      // Use the existing download and send logic
      await processAndSendVideo(bot, url, chatId, msg.from.username);
    }
  } catch (error) {
    logger.error("Error in /retry command", {
      error: error.message,
      stack: error.stack,
    });
    await bot.deleteMessage(chatId, statusMessage.message_id);
  }
});

// Update the existing URL handler to use the new function
bot.onText(/(.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const url = match[1];

  if (!isValidUrl(url)) {
    return;
  }

  await processAndSendVideo(bot, url, chatId, msg.from.username);
});

// Error handler for polling errors
bot.on("polling_error", (error) => {
  logger.error("Polling error", { error: error.message, stack: error.stack });
});

console.log("Bot is running...");
