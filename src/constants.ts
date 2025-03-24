export const VALID_CHAT_IDS = JSON.parse(process.env.VALID_CHAT_IDS ?? "[]");
export const LOG_DEBUG = process.env.LOG_DEBUG === "true";
export const PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
export const BOT_TOKEN = process.env.BOT_TOKEN;
export const WEBHOOK_URL = process.env.WEBHOOK_URL;
export const SHOW_USER_CAPTION = true && process.env.SHOW_USER_CAPTION === "true";
export const IS_PROD = process.env.IS_PROD === "true";