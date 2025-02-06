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
      const topicId = msg.message_thread_id;
      const originalMessageId = msg.message_id;
      const url = msg.text;
      const user = msg.from;

      if (!url || !isValidUrl(url) || !user) {
        return;
      }

      logger.info(
        `Received message: \n url: ${url}, \n chatId: ${chatId}, \n username: ${user?.username} \n originalMessageId: ${originalMessageId} \n topicId: ${topicId}`
      );

      if (!VALID_CHAT_IDS.includes(chatId)) {
        return;
      }

      addToVideoQueue({
        bot,
        url,
        chatId,
        topicId,
        user,
        downloader: getDownloaderType(url),
        originalMessage: msg,
      });
    } catch (error: any) {
      logger.error(`Error in onText listener: ${error.stack}`);
    }
  });

  bot.on("webhook_error", (error) => {
    logger.error(`Webhook error: ${error.stack}`);
  });

  bot.on("text", async (msg) => {
    const allMembers = `@Kudasati @Arti465 @archi_ll @sky_pneuma @ddfanky`;
    const text = msg.text?.toLowerCase() ?? "";
    const username = msg.from?.username;

    if (text === "хотс?") {
      await bot.sendMessage(
        msg.chat.id,
        allMembers.replace(`@${username}`, "")
      );
    }
  });
}
