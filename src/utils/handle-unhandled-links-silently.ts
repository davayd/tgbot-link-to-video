import TelegramBot from "node-telegram-bot-api";
import { getDownloaderType } from "./is-valid-url.js";
import { DB_loadUnhandledLinks } from "./database.js";
import { addToVideoQueue } from "./video-queue.js";

export async function handleUnhandledLinksSilently(
  bot: TelegramBot
): Promise<void> {
  const unhandledLinks = await DB_loadUnhandledLinks();
  if (unhandledLinks.length === 0) {
    return;
  }

  for (const link of unhandledLinks) {
    addToVideoQueue({
      bot,
      url: link.url,
      chatId: link.chatId,
      username: link.username,
      downloader: getDownloaderType(link.url),
      originalMessageId: link.originalMessageId,
    });
  }
}
