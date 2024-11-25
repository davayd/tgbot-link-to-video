import TelegramBot from "node-telegram-bot-api";

export type DownloaderType = "ytdlp" | "igram" | "ssstik";
export type FileType = "mp4" | "jpg";
export interface ProcessVideoContext {
  bot: TelegramBot;
  url: string;
  chatId: number | string;
  username: string;
  downloader: DownloaderType;
  originalMessageId: number;
}
