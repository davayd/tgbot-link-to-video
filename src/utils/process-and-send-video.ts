import path, { dirname } from "path";
import fs from "fs/promises";
import TelegramBot from "node-telegram-bot-api";
import { fileURLToPath } from "url";
import { LOG_INFO, logger } from "./winston-logger.js";
import * as db from "./database.js";
import { igramApiDownloadVideo } from "../downloaders/instagram-downloader.js";
import { ytdlpDownloadVideo } from "../downloaders/youtube-downloader.js";
import { FileType, ProcessVideoContext } from "../models.js";

export async function processAndSendVideo({
  bot,
  url,
  chatId,
  username,
  downloader,
}: ProcessVideoContext): Promise<void> {
  let statusMessage: TelegramBot.Message | undefined;

  const sendStatus = async (message: string) => {
    if (statusMessage) {
      await bot.editMessageText(message, {
        chat_id: chatId,
        message_id: statusMessage.message_id,
      });
    } else {
      statusMessage = await bot.sendMessage(chatId, message);
    }
  };

  const logError = (context: string, error: unknown) => {
    logger.debug(`Error ${context}`, {
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
    await sendStatus(`🔄 Начинаем скачивание...`);

    // Generate a safe filename
    const fileName = Math.random()
      .toString(36)
      .substring(2, 22)
      .replace(/\s/g, "");
    const fileDir = dirname(fileURLToPath(import.meta.url));

    await sendStatus(`🔄 Скачиваем...`);

    // Download the video
    let fileType: FileType = "mp4";
    LOG_INFO && logger.debug(`Downloader: ${downloader}`);
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

    LOG_INFO && logger.debug(`FileType: ${fileType}`);

    // Check if file exists (without knowing the extension)
    const files = await fs.readdir(fileDir);
    const downloadedFile = files.find((file) => file.startsWith(fileName));
    LOG_INFO && logger.debug(`DownloadedFile: ${downloadedFile}`);
    if (!downloadedFile) {
      throw new Error("Не удалось скачать видео");
    }

    // File in format like /usr/src/app/video.mp4
    const filePath = path.join(fileDir, downloadedFile);
    LOG_INFO && logger.debug(`FilePath: ${filePath}`);

    // Check file size
    const stats = await fs.stat(filePath);
    const fileSizeInMb = stats.size / (1024 * 1024);
    LOG_INFO && logger.debug(`FileSizeInMb: ${fileSizeInMb}`);
    if (fileSizeInMb > 100) {
      throw new Error("File size exceeds 100MB limit");
    }

    await sendStatus(`🔄 Отправляем: ${fileName}`);
    await sendFile(filePath, fileType);

    await db.removeUnhandledLink(url);
    await fs.unlink(filePath);
  } catch (error: unknown) {
    logError("processing video", error);
  } finally {
    if (statusMessage) {
      await bot.deleteMessage(chatId, statusMessage.message_id);
    }
  }
}
