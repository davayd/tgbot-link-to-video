import { DownloaderType } from "../models";

export function isValidUrl(url: string) {
  return isYoutubeUrl(url) || isInstagramUrl(url);
}

function isInstagramUrl(url: string) {
  const instagramRegex =
    /(https?:\/\/)?(www\.)?instagram\.com\/(p|reel|tv|reels|stories)\//;
  return instagramRegex.test(url);
}

function isYoutubeUrl(url: string) {
  const youtubeRegex =
    /(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/shorts\//;
  return youtubeRegex.test(url);
}

export function getDownloaderType(url: string): DownloaderType {
  return isInstagramUrl(url) ? "igram" : "ytdlp";
}
