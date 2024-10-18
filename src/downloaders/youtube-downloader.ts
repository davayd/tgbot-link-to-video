import ytdlp from "yt-dlp-exec";

export async function ytdlpDownloadVideo(url: string, output: string) {
  return await ytdlp(url, {
    output: output,
    noPlaylist: true,
    restrictFilenames: true,
    format: "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
  });
}
