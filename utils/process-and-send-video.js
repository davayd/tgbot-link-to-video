import { convertToMp4 } from "./convert-to-mp4.js";
import { compressVideo } from "./compress-video.js";
import { logger } from "./winston-logger.js";
import path from "path";
import fs from "fs/promises";
import ytdlp from "yt-dlp-exec";
import { UNHANDLED_LINKS } from "../bot.js";

export async function processAndSendVideo(bot, url, chatId, username) {
  let statusMessage;

  try {
    // Step 1: Send initial status message
    statusMessage = await bot.sendMessage(chatId, `🔄 Начинаем скачивание...`);

    // Step 2: Get video info
    const result = await ytdlp(url, {
      dumpSingleJson: true,
      noCheckCertificates: true,
      noWarnings: true,
      preferFreeFormats: true,
      cookies: USE_COOKIES ? cookieFileName : null,
    });

    if (!result || !result.title) {
      throw new Error("Не удалось получить информацию о видео");
    }

    // Step 3: Generate a safe filename
    let safeTitle = result.title
      .replace(/[^a-z0-9]/gi, "_")
      .toLowerCase()
      .slice(0, 49);
    const fileName = `${safeTitle}`;
    const fileDir = __dirname;

    // Step 4: Update status to Downloading
    await bot
      .editMessageText(`🔄 Скачиваем: ${result.title}`, {
        chat_id: chatId,
        message_id: statusMessage.message_id,
      })
      .catch((error) => {
        logger.error("Error updating status message", {
          error: error.message,
          stack: error.stack,
        });
      });

    // Step 5: Download the video
    await ytdlp(url, {
      output: path.join(fileDir, fileName + ".%(ext)s"),
      noPlaylist: true,
      restrictFilenames: true,
      cookies: USE_COOKIES ? cookieFileName : null,
    });

    // Step 6: Check if file exists (without knowing the extension)
    const files = await fs.readdir(fileDir);
    const downloadedFile = files.find((file) => file.startsWith(fileName));

    if (!downloadedFile) {
      throw new Error("Не удалось скачать видео");
    }

    const filePath = path.join(fileDir, downloadedFile);
    let finalFilePath = filePath;

    // Step 7: Check file size
    const stats = await fs.stat(filePath);
    const fileSizeInMb = stats.size / (1024 * 1024);

    if (fileSizeInMb > 100) {
      throw new Error("File size exceeds 100MB limit");
    }

    // Step 8: Convert to MP4 if necessary
    if (!downloadedFile.endsWith(".mp4")) {
      await bot.editMessageText(`🔄 Конвертируем в MP4: ${result.title}`, {
        chat_id: chatId,
        message_id: statusMessage.message_id,
      });

      const mp4FilePath = path.join(fileDir, `${fileName}.mp4`);
      finalFilePath = await convertToMp4(filePath, mp4FilePath);

      // Delete the original non-MP4 file
      await fs.unlink(filePath).catch((error) => {
        logger.error("Error deleting original file", {
          error: error.message,
          stack: error.stack,
        });
      });
    }

    // Step 9: Compress video if necessary
    if (fileSizeInMb > 50) {
      await bot.editMessageText(`Compressing: ${result.title}`, {
        chat_id: chatId,
        message_id: statusMessage.message_id,
      });

      const compressedFilePath = path.join(
        fileDir,
        `${fileName}_compressed.mp4`
      );
      finalFilePath = await compressVideo(finalFilePath, compressedFilePath);
    }

    // Step 10: Update status to Uploading
    await bot.editMessageText(`Uploading: ${result.title}`, {
      chat_id: chatId,
      message_id: statusMessage.message_id,
    });

    // Step 11: Send the video file
    try {
      await bot.sendVideo(chatId, finalFilePath, {
        filename: path.basename(finalFilePath),
        caption: `From @${username} with 💕`,
      });
    } catch (error) {
      logger.error("Error sending video", {
        error: error.message,
        stack: error.stack,
      });
    } finally {
      // Step 12: Delete the file after sending
      await fs.unlink(finalFilePath).catch((error) => {
        logger.error("Error deleting final file", {
          error: error.message,
          stack: error.stack,
        });
      });
    }

    // Step 13: Delete the status message
    await bot.deleteMessage(chatId, statusMessage.message_id).catch((error) => {
      logger.error("Error deleting status message", {
        error: error.message,
        stack: error.stack,
      });
    });
  } catch (error) {
    // Log the error to file
    logger.error("Error processing video", {
      url: url,
      error: error.message,
      stack: error.stack,
    });

    if (statusMessage) {
      await bot.deleteMessage(chatId, statusMessage.message_id);
    }

    if (!UNHANDLED_LINKS.has(url)) {
      UNHANDLED_LINKS.add(url);
    }

    // Send error message to user
    await bot.sendMessage(
      chatId,
      `😿 Похоже, что превышен лимит скачивания видео-мемов, попробуй позже или попробуйте команду /retry чтобы повторить загрузку 🤞.`
    );
  }
}
