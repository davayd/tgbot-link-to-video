import ffmpeg from "fluent-ffmpeg";

export async function convertToMp4(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions("-c:v libx264")
      .outputOptions("-c:a aac")
      .output(outputPath)
      .on("end", () => resolve(outputPath))
      .on("error", (err) => reject(err))
      .run();
  });
}
