import "dotenv/config";
import TelegramBot from "node-telegram-bot-api";
import { getDownloaderType, isValidUrl } from "./utils/is-valid-url.js";
import { processAndSendVideo } from "./utils/process-and-send-video.js";
import { logger } from "./utils/winston-logger.js";
import { scheduleJob } from "node-schedule";
import {
  connectToDatabase,
  loadUnhandledLinks,
  saveUnhandledLink,
} from "./utils/database.js";
import { handleUnhandledLinksSilently } from "./utils/handle-unhandled-links-silently.js";
import { DownloaderType } from "./models.js";

// Use the BOT_TOKEN environment variable
const token = process.env.BOT_TOKEN;

if (!token) {
  console.error("BOT_TOKEN environment variable is not set");
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

// Add the new command handler /retry
bot.onText(/\/retry/, async (msg) => {
  const chatId = msg.chat.id;

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
      return;
    }

    await bot.editMessageText(
      `🔄 Найдено ${unhandledLinks.length} ссылок. Обрабатываем...`,
      {
        chat_id: chatId,
        message_id: statusMessage.message_id,
      }
    );

    for (const link of unhandledLinks) {
      try {
        // Use the existing download and send logic
        await processAndSendVideo({
          bot,
          url: link.url,
          chatId: link.chatId,
          username: link.username || "unknown",
          downloader: getDownloaderType(link.url),
        });
      } catch (error) {
        logger.error(`Error processing video for URL: ${link.url}`, {
          error: (error as Error).message,
          stack: (error as Error).stack,
        });

        break;
      }
    }
  } catch (error) {
    logger.error("Error in /retry command", {
      error: (error as Error).message,
      stack: (error as Error).stack,
    });
    await bot.deleteMessage(chatId, statusMessage.message_id);
  }
});

// Update the existing URL handler to save unhandled links
bot.onText(/(.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const originalMessageId = msg.message_id;
  const url = match?.[1];

  if (!url || !isValidUrl(url)) {
    return;
  }

  try {
    await processAndSendVideo({
      bot,
      url,
      chatId,
      username: msg.from?.username || "unknown",
      downloader: getDownloaderType(url),
    });
    await bot.deleteMessage(chatId, originalMessageId);
  } catch (error) {
    logger.error(`Error processing video for URL: ${url}`, {
      error: (error as Error).message,
      stack: (error as Error).stack,
    });
    await saveUnhandledLink(url, chatId, msg.from?.username || "unknown");
  }
});

// Error handler for polling errors
bot.on("polling_error", (error) => {
  logger.error("Polling error", {
    error: (error as Error).message,
    stack: (error as Error).stack,
  });
});

logger.info("Bot is running...");

// Initialize the database and load unhandled links when the application starts
connectToDatabase()
  .then(loadUnhandledLinks)
  .then(() => {
    // Set up the scheduler to run every 2 hours
    scheduleJob("0 */2 * * *", async () => {
      try {
        await handleUnhandledLinksSilently(bot);
      } catch (error) {
        logger.error("Error in scheduled retry:", {
          error: (error as Error).message,
          stack: (error as Error).stack,
        });
      }
    });
  })
  .catch((error) => {
    logger.error("Error connecting to Redis", {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  });
