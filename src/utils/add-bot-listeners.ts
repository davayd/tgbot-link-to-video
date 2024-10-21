import TelegramBot from "node-telegram-bot-api";
import { logger } from "./winston-logger.js";
import { addToVideoQueue } from "./video-queue.js";
import { isValidUrl, getDownloaderType } from "./is-valid-url.js";
import { VALID_CHAT_IDS } from "../constants.js";

export async function addBotListeners(bot: TelegramBot) {
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
