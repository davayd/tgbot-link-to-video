import path from "path";
import fs from "fs/promises";
import { logger } from "./winston-logger.js";
import { igramApiDownloadVideo } from "../downloaders/igram-downloader.js";
import { ytdlpDownloadVideo } from "../downloaders/youtube-downloader.js";
import { DownloaderType, FileType, ProcessVideoContext } from "../models.js";
import { LOG_DEBUG } from "../constants.js";
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
  username,
  downloader,
  originalMessageId,
}: ProcessVideoContext): Promise<void> {
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
    const filePath = path.join(fileDir, downloadedFile);
    LOG_DEBUG && logger.debug(`FilePath: ${filePath}`);

    // Check file size
    const stats = await fs.stat(filePath);
    const fileSizeInMb = stats.size / (1024 * 1024);
    LOG_DEBUG && logger.debug(`FileSizeInMb: ${fileSizeInMb}`);
    if (fileSizeInMb > 100) {
      throw new Error("File size exceeds 100MB limit");
    }

    await bot.sendChatAction(chatId, "upload_video");
    await sendFile(bot, chatId, username, filePath, fileType);
    await fs.unlink(filePath);
    await bot.deleteMessage(chatId, originalMessageId);
  } catch (error: any) {
    // let errorMessage = error.message;
    // await bot.sendMessage(chatId, `${errorMessage}`, {
    //   reply_to_message_id: originalMessageId,
    // });
    logger.error(`Error in processAndSendVideo: ${error.stack}`);
  }
}

async function sendFile(
  bot: TelegramBot,
  chatId: string | number,
  username: string,
  filePath: string,
  fileType: FileType
) {
  try {
    if (fileType === "mp4") {
      await bot.sendVideo(chatId, filePath, {
        caption: `From @${username} with 💕`,
      });
    } else if (fileType === "jpg") {
      await bot.sendPhoto(chatId, filePath, {
        caption: `From @${username} with 💕`,
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
