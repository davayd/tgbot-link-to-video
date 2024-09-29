export function isValidUrl(url) {
  return isYoutubeUrl(url) || isInstagramUrl(url) || isTelegramUrl(url);
}

function isInstagramUrl(url) {
  const instagramRegex =
    /(https?:\/\/)?(www\.)?instagram\.com\/(p|reel|tv|reels)\//;
  return instagramRegex.test(url);
}

function isTelegramUrl(url) {
  const telegramRegex = /(https?:\/\/)?(www\.)?t\.me\//;
  return telegramRegex.test(url);
}

function isYoutubeUrl(url) {
  const youtubeRegex =
    /(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/shorts\//;
  return youtubeRegex.test(url);
}
