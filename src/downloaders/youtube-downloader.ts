import ytdlp from "yt-dlp-exec";

export async function ytdlpDownloadVideo(url: string, output: string) {
  return await ytdlp(url, {
    output: output,
    noPlaylist: true,
    restrictFilenames: true,
  });
}
