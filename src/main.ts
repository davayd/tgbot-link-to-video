import "dotenv/config";
import TelegramBot from "node-telegram-bot-api";
import { getDownloaderType, isValidUrl } from "./utils/is-valid-url.js";
import { logger } from "./utils/winston-logger.js";
import { connectToDatabase, loadUnhandledLinks } from "./utils/database.js";
import { addToVideoQueue } from "./utils/video-queue.js";
import { handleUnhandledLinksSilently } from "./utils/handle-unhandled-links-silently.js";

const VALID_CHAT_IDS = [-1002476906937, 389685263];

// Bot token
const token = process.env.BOT_TOKEN;
if (!token) {
  console.error("BOT_TOKEN environment variable is not set");
  process.exit(1);
}
const bot = new TelegramBot(token, { polling: true });

// Retry command
bot.onText(/\/retry/, async (msg) => {
  const chatId = msg.chat.id;
  const originalMessageId = msg.message_id;

  const statusMessage = await bot.sendMessage(
    chatId,
    "🔄 Получение последних ссылок на супер-мемы..."
  );

  const unhandledLinks = await loadUnhandledLinks();

  try {
    if (unhandledLinks.length === 0) {
      await bot.editMessageText(
        "Команда /retry не найшла необработанных ссылок на супер-мемы 🥲",
        {
          chat_id: chatId,
          message_id: statusMessage.message_id,
        }
      );
      await bot.deleteMessage(chatId, originalMessageId);
      return;
    }

    await bot.editMessageText(
      `🔄 Найдено ${unhandledLinks.length}. Обрабатываем...`,
      {
        chat_id: chatId,
        message_id: statusMessage.message_id,
      }
    );

    for (const link of unhandledLinks) {
      await addToVideoQueue({
        bot,
        url: link.url,
        chatId:
          Number.isNaN(link.chatId) || !link.chatId ? chatId : link.chatId,
        username: link.username || "unknown",
        downloader: getDownloaderType(link.url),
        originalMessageId: link.originalMessageId,
      });
    }
  } catch (error) {
    logger.debug("Error in /retry command", {
      error: (error as Error).message,
      stack: (error as Error).stack,
    });
  } finally {
    if (statusMessage) {
      await bot.deleteMessage(chatId, statusMessage.message_id);
    }
  }
});

// Inputs from instagram and youtube
bot.on("text", async (msg) => {
  const chatId = msg.chat.id;
  const originalMessageId = msg.message_id;
  const url = msg.text;
  const username = msg.from?.username || "unknown";

  if (!url || !isValidUrl(url)) {
    return;
  }
  if (!VALID_CHAT_IDS.includes(chatId)) {
    return;
  }

  logger.debug("Received message", {
    chatId,
    url,
    originalMessageId,
  });

  await addToVideoQueue({
    bot,
    url,
    chatId,
    username,
    downloader: getDownloaderType(url),
    originalMessageId,
  });
});

// Error handler for polling errors
bot.on("polling_error", (error) => {
  logger.debug("Polling error", {
    error: error.message,
    stack: error.stack,
  });
});

logger.debug("Bot is running...");

// Initialize the database and load unhandled links when the application starts
try {
  await connectToDatabase();
  await handleUnhandledLinksSilently(bot);
} catch (error: any) {
  logger.debug("Error connecting to Redis", {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
}
