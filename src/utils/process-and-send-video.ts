import { logger } from "./winston-logger.js";
import path, { dirname } from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import TelegramBot from "node-telegram-bot-api";
import * as db from "./database.js";
import { saveUnhandledLink } from "./handle-unhandled-links-silently.js";
import { igramApiDownloadVideo } from "../downloaders/instagram-downloader.js";
import { ytdlpDownloadVideo } from "../downloaders/youtube-downloader.js";
import { ProcessVideoContext } from "../models.js";

export async function processAndSendVideo(
  ctx: ProcessVideoContext
): Promise<void> {
  let statusMessage: TelegramBot.Message | undefined;

  try {
    // Update last_processed_at at the start of processing
    await db.updateLastProcessedAt(ctx.url);

    // Step 1: Send initial status message
    if (!ctx.silent) {
      statusMessage = await ctx.bot.sendMessage(
        ctx.chatId,
        `🔄 Начинаем скачивание...`
      );
    }

    // Step 3: Generate a safe filename
    const title = Math.random()
      .toString(36)
      .substring(2, 22)
      .replace(/\s/g, "");
    const fileName = title;
    const fileDir = dirname(fileURLToPath(import.meta.url));

    // Step 4: Update status to Downloading
    if (!ctx.silent) {
      await ctx.bot.editMessageText(`🔄 Скачиваем: ${title}`, {
        chat_id: ctx.chatId,
        message_id: statusMessage?.message_id,
      });
    }

    // Step 5: Download the video
    if (ctx.downloader === "ytdlp") {
      const outputPath = path.join(fileDir, fileName + ".mp4");
      await ytdlpDownloadVideo(ctx.url, outputPath);
    } else if (ctx.downloader === "igram") {
      const outputPath = path.join(fileDir, fileName);
      await igramApiDownloadVideo(ctx.url, outputPath);
    }

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

    // Step 10: Update status to Uploading
    if (!ctx.silent) {
      await ctx.bot.editMessageText(`🔄 Отправляем: ${title}`, {
        chat_id: ctx.chatId,
        message_id: statusMessage?.message_id,
      });
    }

    // Step 11: Send the video file
    try {
      await ctx.bot.sendVideo(ctx.chatId, finalFilePath, {
        caption: `From @${ctx.username} with 💕`,
      });
      await db.removeUnhandledLink(ctx.url);
    } catch (error) {
      logger.error("Error sending video", {
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
    } finally {
      // Step 12: Delete the file after sending
      await fs.unlink(finalFilePath);
    }
  } catch (error) {
    // Log the error to file
    logger.error("Error processing video", {
      url: ctx.url,
      error: (error as Error).message,
      stack: (error as Error).stack,
    });

    await saveUnhandledLink(ctx.url, ctx.chatId, ctx.username);

    // Send error message to user
    if (!ctx.silent) {
      await ctx.bot.sendMessage(
        ctx.chatId,
        `😿 Похоже, что превышен лимит скачивания видео-мемов, попробуй позже или попробуйте команду /retry чтобы повторить загрузку 🤞.`
      );
    }
  } finally {
    if (statusMessage) {
      await ctx.bot.deleteMessage(ctx.chatId, statusMessage.message_id);
    }
  }
}
