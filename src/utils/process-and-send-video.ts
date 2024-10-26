import path from "path";
import fs from "fs/promises";
import { logger } from "./winston-logger.js";
import { igramApiDownloadVideo } from "../downloaders/instagram-downloader.js";
import { ytdlpDownloadVideo } from "../downloaders/youtube-downloader.js";
import { FileType, ProcessVideoContext } from "../models.js";
import { LOG_DEBUG } from "../constants.js";

export async function processAndSendVideo({
  bot,
  url,
  chatId,
  username,
  downloader,
  originalMessageId,
}: ProcessVideoContext): Promise<void> {
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
      logger.error(`Unsupported file type: ${fileType}`);
      throw new Error(`Unsupported file type: ${fileType}`);
    }
  };

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

    await sendFile(filePath, fileType);
    await fs.unlink(filePath);
    await bot.deleteMessage(chatId, originalMessageId);
  } catch (error: any) {
    let errorMessage = error.message;
    if (error.name === "RequestError" || error.name === "AggregateError") {
      errorMessage =
        "Network error occurred while processing the video. Please try again later.";
    }
    await bot.sendMessage(chatId, `${errorMessage}`, {
      reply_to_message_id: originalMessageId,
    });
    logger.error(`Error in processAndSendVideo: ${error.stack}`);
  }
}

async function tryDownload(
  downloader: string,
  url: string,
  fileDir: string,
  fileName: string
) {
  const maxRetries = 3;
  let retries = 0;
  let downloadSuccess = false;
  let fileType: FileType = "mp4";

  while (retries < maxRetries && !downloadSuccess) {
    try {
      if (downloader === "ytdlp") {
        await ytdlpDownloadVideo(url, path.join(fileDir, fileName));
        fileType = "mp4";
      } else if (downloader === "igram") {
        const { fileType: fileTypeFromDownloader } =
          await igramApiDownloadVideo(url, path.join(fileDir, fileName));
        fileType = fileTypeFromDownloader;
      }
      downloadSuccess = true;
    } catch (downloadError: any) {
      retries++;
      logger.warn(
        `Download attempt ${retries} failed: ${downloadError.message}`
      );
      if (retries >= maxRetries) {
        throw new Error(
          `Failed to download video after ${maxRetries} attempts: ${downloadError.message}`
        );
      }
      // Wait for a short time before retrying
      await new Promise((resolve) => setTimeout(resolve, 3000 * retries));
    }
  }
  return { fileType };
}
