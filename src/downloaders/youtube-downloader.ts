import ytdlp from "yt-dlp-exec";

export async function ytdlpDownloadVideo(url: string, output: string) {
  output = output + ".mp4";
  return await ytdlp(url, {
    output: output,
    noPlaylist: true,
    restrictFilenames: true,
  });
}
