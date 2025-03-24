import TelegramBot from "node-telegram-bot-api";

export type DownloaderType =
  | "ytdlp"
  | "igram"
  | "sssinstagram"
  | "ssstik"
  | "snapinsta"
  | "cobalt";

export type FileType = "mp4" | "jpg";
export interface ProcessVideoContext {
  bot: TelegramBot;
  url: string;
  chatId: number | string;
  topicId: number | undefined;
  user: TelegramBot.User;
  originalMessage: TelegramBot.Message;
}
