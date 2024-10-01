import { logger } from "./winston-logger.js";
import path, { dirname } from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import TelegramBot from "node-telegram-bot-api";
import * as db from "./database.js";
import { saveUnhandledLink } from "./handle-unhandled-links-silently.js";
import { igramApiDownloadVideo } from "../downloaders/instagram-downloader.js";
import { ytdlpDownloadVideo } from "../downloaders/youtube-downloader.js";
import { FileType, ProcessVideoContext } from "../models.js";

export async function processAndSendVideo({
  bot,
  url,
  chatId,
  username,
  silent,
  downloader,
}: ProcessVideoContext): Promise<void> {
  let statusMessage: TelegramBot.Message | undefined;

  const sendStatus = async (message: string) => {
    if (silent) return;
    if (statusMessage) {
      await bot.editMessageText(message, {
        chat_id: chatId,
        message_id: statusMessage.message_id,
      });
    } else {
      statusMessage = await bot.sendMessage(chatId, message);
    }
  };

  const sendErrorMessage = async (message: string) => {
    if (silent) return;
    await bot.sendMessage(chatId, message);
  };

  const logError = (context: string, error: unknown) => {
    logger.error(`Error ${context}`, {
      url: url,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  };

  const sendFile = async (filePath: string, fileType: FileType) => {
    if (fileType === "mp4") {
      await bot.sendVideo(chatId, filePath, {
        caption: `From @${username} with 💕`,
      });
    } else if (fileType === "jpg") {
      await bot.sendPhoto(chatId, filePath, {
        caption: `From @${username} with 💕`,
      });
    } else {
      throw new Error(`Unsupported file type: ${fileType}`);
    }
  };

  try {
    // Update last_processed_at at the start of processing
    await db.updateLastProcessedAt(url);

    await sendStatus(`🔄 Начинаем скачивание...`);

    // Generate a safe filename
    const fileName = Math.random()
      .toString(36)
      .substring(2, 22)
      .replace(/\s/g, "");
    const fileDir = dirname(fileURLToPath(import.meta.url));

    await sendStatus(`🔄 Скачиваем: ${fileName}`);

    // Download the video
    let fileType: FileType = "mp4";
    if (downloader === "ytdlp") {
      await ytdlpDownloadVideo(url, path.join(fileDir, fileName));
      fileType = "mp4";
    } else if (downloader === "igram") {
      const { fileType: fileTypeFromDownloader } = await igramApiDownloadVideo(
        url,
        path.join(fileDir, fileName)
      );
      fileType = fileTypeFromDownloader;
    }

    // Check if file exists (without knowing the extension)
    const files = await fs.readdir(fileDir);
    const downloadedFile = files.find((file) => file.startsWith(fileName));
    if (!downloadedFile) {
      throw new Error("Не удалось скачать видео");
    }

    // File in format like /usr/src/app/video.mp4
    const filePath = path.join(fileDir, downloadedFile);

    // Check file size
    const stats = await fs.stat(filePath);
    const fileSizeInMb = stats.size / (1024 * 1024);
    if (fileSizeInMb > 100) {
      throw new Error("File size exceeds 100MB limit");
    }

    await sendStatus(`🔄 Отправляем: ${fileName}`);

    // Send the file
    try {
      await sendFile(filePath, fileType);
      await db.removeUnhandledLink(url);
    } catch (error: unknown) {
      logError("sending video", error);
      await sendErrorMessage(
        `😿 Не удалось отправить файл. Попробуйте еще раз позже.`
      );
    } finally {
      // Delete the file after sending
      await fs.unlink(filePath);
    }
  } catch (error: unknown) {
    logError("processing video", error);

    await saveUnhandledLink(url, chatId, username);

    await sendErrorMessage(
      `😿 Похоже, что превышен лимит скачивания видео-мемов, попробуй позже или попробуйте команду /retry чтобы повторить загрузку 🤞.`
    );
  } finally {
    if (statusMessage) {
      await sendStatus(``); // This will delete the status message if not in silent mode
    }
  }
}
