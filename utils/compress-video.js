import ffmpeg from "fluent-ffmpeg";

export async function compressVideo(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions("-c:v libx265")
      .outputOptions("-crf 26") // Adjust CRF value for quality/size balance
      .outputOptions("-preset fast") // Adjust preset for encoding speed
      .outputOptions("-c:a aac")
      .outputOptions("-b:a 128k")
      .output(outputPath)
      .on("end", () => resolve(outputPath))
      .on("error", (err) => reject(err))
      .run();
  });
}
