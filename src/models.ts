import TelegramBot from "node-telegram-bot-api";

export type DownloaderType =
  | "ytdlp"
  | "igram"
  | "sssinstagram"
  | "ssstik"
  | "snapinsta";
export type FileType = "mp4" | "jpg";
export interface ProcessVideoContext {
  bot: TelegramBot;
  url: string;
  chatId: number | string;
  user: TelegramBot.User;
  downloader: DownloaderType;
  originalMessage: TelegramBot.Message;
}
