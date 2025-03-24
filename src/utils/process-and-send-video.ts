import path from "path";
import fs from "fs/promises";
import { logger } from "./winston-logger.js";
import { igramApiDownloadVideo } from "../downloaders/igram-downloader.js";
import { ytdlpDownloadVideo } from "../downloaders/youtube-downloader.js";
import { DownloaderType, FileType, ProcessVideoContext } from "../models.js";
import { LOG_DEBUG, SHOW_USER_CAPTION } from "../constants.js";
import TelegramBot from "node-telegram-bot-api";
import { ssstikDownloadVideo } from "../downloaders/tiktok-downloader.js";
import { snapinstaDownloadVideo } from "../downloaders/snapinsta-downloader.js";
import { sssinstagramDownloadVideo } from "../downloaders/sssinstagram-downloader.js";

type InstagramDownloader = "sssinstagram" | "igram" | "snapinsta";
const instagramDownloaders: InstagramDownloader[] = [
  "sssinstagram",
  "igram",
  "snapinsta",
];

export async function processAndSendVideo({
  bot,
  url,
  chatId,
  user,
  downloader,
  originalMessage,
  topicId,
}: ProcessVideoContext): Promise<void> {
  let filePath: string | null = null;
  try {
    // Generate a safe filename
    const fileName = Math.random()
      .toString(36)
      .substring(2, 22)
      .replace(/\s/g, "");
    const fileDir = process.cwd();

    // Download the video
    let fileType: FileType = "mp4";
    LOG_DEBUG && logger.debug(`Downloader: ${downloader}`);
    const { fileType: fileTypeFromDownloader } = await tryDownload(
      downloader,
      url,
      fileDir,
      fileName
    );
    fileType = fileTypeFromDownloader;

    LOG_DEBUG && logger.debug(`FileType: ${fileType}`);

    // Check if file exists (without knowing the extension)
    const files = await fs.readdir(fileDir);
    const downloadedFile = files.find((file) => file.startsWith(fileName));
    LOG_DEBUG && logger.debug(`DownloadedFile: ${downloadedFile}`);
    if (!downloadedFile) {
      throw new Error("Failed to download video");
    }

    // File in format like /usr/src/app/video.mp4
    filePath = path.join(fileDir, downloadedFile);
    LOG_DEBUG && logger.debug(`FilePath: ${filePath}`);

    // Check file size
    const stats = await fs.stat(filePath);
    const fileSizeInMb = stats.size / (1024 * 1024);
    LOG_DEBUG && logger.debug(`FileSizeInMb: ${fileSizeInMb}`);
    if (fileSizeInMb > 100) {
      throw new Error("File size exceeds 100MB limit");
    }

    await bot.sendChatAction(chatId, "upload_video", {
      message_thread_id: topicId,
    });
    await sendFile(
      bot,
      chatId,
      user,
      filePath,
      fileType,
      originalMessage,
      topicId
    );
    await bot.deleteMessage(chatId, originalMessage.message_id);
  } catch (error: any) {
    // let errorMessage = error.message;
    // await bot.sendMessage(chatId, `${errorMessage}`, {
    //   reply_to_message_id: originalMessageId,
    // });
    logger.error(`Error in processAndSendVideo: ${error.stack}`);
  } finally {
    if (filePath) {
      await fs.unlink(filePath);
    }
  }
}

async function sendFile(
  bot: TelegramBot,
  chatId: string | number,
  user: TelegramBot.User,
  filePath: string,
  fileType: FileType,
  originalMessage: TelegramBot.Message,
  topicId: number | undefined
) {
  try {
    const username = user.username ?? user.first_name;

    if (fileType === "mp4") {
      await bot.sendVideo(chatId, filePath, {
        caption: SHOW_USER_CAPTION ? `From @${username} with 💕` : undefined,
        message_thread_id: topicId,
      });

    } else if (fileType === "jpg") {
      await bot.sendPhoto(chatId, filePath, {
        caption: SHOW_USER_CAPTION ? `From @${username} with 💕` : undefined,
        message_thread_id: topicId,
      });
    } else {
      logger.error(`Unsupported file type: ${fileType}`);
      throw new Error(`Unsupported file type: ${fileType}`);
    }
  } catch (error: any) {
    logger.error(`Error in sendFile: ${error.stack}`);
    throw new Error(`Error in sendFile`);
  }
}

async function tryDownloadInstagram(
  url: string,
  fileDir: string,
  fileName: string
) {
  let lastError: Error | null = null;

  for (const downloader of instagramDownloaders) {
    try {
      let fileType: FileType = "mp4";

      switch (downloader) {
        case "sssinstagram":
          ({ fileType } = await sssinstagramDownloadVideo(
            url,
            path.join(fileDir, fileName)
          ));
          break;
        case "igram":
          ({ fileType } = await igramApiDownloadVideo(
            url,
            path.join(fileDir, fileName)
          ));
          break;
        case "snapinsta":
          ({ fileType } = await snapinstaDownloadVideo(
            url,
            path.join(fileDir, fileName)
          ));
          break;
      }

      return { fileType };
    } catch (error) {
      lastError = error as Error;
      console.log(`Failed to download with ${downloader}:`, error);
      continue;
    }
  }

  throw lastError || new Error("All Instagram downloaders failed");
}

async function tryDownload(
  downloader: DownloaderType,
  url: string,
  fileDir: string,
  fileName: string
) {
  let fileType: FileType = "mp4";

  if (url.includes("instagram.com")) {
    return tryDownloadInstagram(url, fileDir, fileName);
  }

  switch (downloader) {
    case "ytdlp":
      await ytdlpDownloadVideo(url, path.join(fileDir, fileName));
      break;
    case "ssstik":
      ({ fileType } = await ssstikDownloadVideo(
        url,
        path.join(fileDir, fileName)
      ));
      break;
    default:
      throw new Error(`Unsupported downloader: ${downloader}`);
  }

  return { fileType };
}
