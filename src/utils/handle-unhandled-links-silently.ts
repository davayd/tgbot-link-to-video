import TelegramBot from "node-telegram-bot-api";
import * as db from "./database.js";
import { processAndSendVideo } from "./process-and-send-video.js";
import { logger } from "./winston-logger.js";
import { getDownloaderType } from "./is-valid-url.js";

export async function handleUnhandledLinksSilently(
  bot: TelegramBot
): Promise<void> {
  const unhandledLinks = await db.loadUnhandledLinks();
  if (unhandledLinks.length === 0) {
    return;
  }

  for (const link of unhandledLinks) {
    try {
      await processAndSendVideo({
        bot,
        url: link.url,
        chatId: link.chatId,
        username: link.username,
        downloader: getDownloaderType(link.url),
        originalMessageId: link.originalMessageId,
      });
    } catch (error: any) {
      logger.error(`Error processing video for URL: ${link.url}`, {
        error: error.message,
        stack: error.stack,
      });
      break;
    }
  }
}

export async function removeUnhandledLink(url: string): Promise<void> {
  await db.removeUnhandledLink(url);
}

export async function saveUnhandledLink(
  url: string,
  chatId: number | string,
  username: string,
  originalMessageId: number
): Promise<void> {
  await db.saveUnhandledLink(url, chatId, username, originalMessageId);
}
