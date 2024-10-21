import TelegramBot from "node-telegram-bot-api";
import { logger } from "./winston-logger.js";
import { addToVideoQueue } from "./video-queue.js";
import { isValidUrl, getDownloaderType } from "./is-valid-url.js";
import { DB_loadUnhandledLinks } from "./database.js";
import { VALID_CHAT_IDS } from "../constants.js";

export async function addBotListeners(bot: TelegramBot) {
  // Retry command
  bot.onText(/\/retry/, async (msg) => {
    try {
      const chatId = msg.chat.id;
      const originalMessageId = msg.message_id;

      const statusMessage = await bot.sendMessage(
        chatId,
        "🔄 Получение последних ссылок на супер-мемы..."
      );

      const unhandledLinks = await DB_loadUnhandledLinks();

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
        addToVideoQueue({
          bot,
          url: link.url,
          chatId:
            Number.isNaN(link.chatId) || !link.chatId ? chatId : link.chatId,
          username: link.username || "unknown",
          downloader: getDownloaderType(link.url),
          originalMessageId: link.originalMessageId,
        });
      }

      if (statusMessage && chatId) {
        await bot.deleteMessage(chatId, statusMessage.message_id);
      }
    } catch (error: any) {
      logger.error(`Error in /retry command: ${error.stack}`);
    }
  });

  // Inputs from instagram and youtube
  bot.on("text", async (msg) => {
    try {
      const chatId = msg.chat.id;
      const originalMessageId = msg.message_id;
      const url = msg.text;
      const username =
        msg.forward_sender_name ?? msg.from?.username ?? "unknown";

      if (!url || !isValidUrl(url)) {
        return;
      }
      if (!VALID_CHAT_IDS.includes(chatId)) {
        return;
      }

      logger.info(
        `Received message: \n url: ${url}, \n chatId: ${chatId}, \n username: ${username}`
      );

      addToVideoQueue({
        bot,
        url,
        chatId,
        username,
        downloader: getDownloaderType(url),
        originalMessageId,
      });
    } catch (error: any) {
      logger.error(`Error in onText listener: ${error.stack}`);
    }
  });
}
