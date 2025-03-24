import { FileType } from "../models";

export function isValidUrl(url: string) {
  return isYoutubeUrl(url) || isInstagramUrl(url) || isTiktokUrl(url);
}

function isInstagramUrl(url: string) {
  const instagramRegex =
    /(https?:\/\/)?(www\.)?instagram\.com\/([A-Za-z0-9_.]+(\/)?)?(p|reel|tv|reels|stories)\//;
  return instagramRegex.test(url);
}

function isYoutubeUrl(url: string) {
  const youtubeRegex =
    /(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/shorts\//;
  return youtubeRegex.test(url);
}

function isTiktokUrl(url: string) {
  const tiktokRegex = /(https?:\/\/)?(www\.)?tiktok\.com\//;
  return tiktokRegex.test(url);
}

export function getFileExtension(url: string): FileType {
  if (url.includes(".mp4")) return "mp4";
  if (url.includes(".jpg")) return "jpg";
  if (url.includes(".png")) return "jpg";
  if (url.includes(".webp")) return "mp4";
  return "mp4";
}
