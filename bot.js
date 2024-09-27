require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const ytdlp = require("yt-dlp-exec");
const fs = require("fs-extra");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const winston = require("winston");

ffmpeg.setFfmpegPath(ffmpegPath);

// Use the BOT_TOKEN environment variable
const cookieFileName = "cookies.txt";
const token = process.env.BOT_TOKEN;

// Function to create the .netrc file
// function createNetrcFile() {
//   const netrcContent = `machine instagram\n  login ${process.env.INSTAGRAM_LOGIN}\n  password ${process.env.INSTAGRAM_PASSWORD}`;
//   const netrcPath = path.join(__dirname, ".netrc");

//   fs.writeFileSync(netrcPath, netrcContent, { mode: 0o600 });
//   console.log(".netrc file created successfully at:", netrcPath);
// }

// createNetrcFile();

if (!token) {
  console.error("BOT_TOKEN environment variable is not set");
  process.exit(1);
}

function isValidUrl(url) {
  const youtubeRegex =
    /(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/shorts\//;
  const instagramRegex =
    /(https?:\/\/)?(www\.)?instagram\.com\/(p|reel|tv|reels)\//;
  return youtubeRegex.test(url) || instagramRegex.test(url);
}

const bot = new TelegramBot(token, { polling: true });

// Configure Winston logger
const logger = winston.createLogger({
  level: "error",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: "error.log", level: "error" }),
  ],
});

async function convertToMp4(inputPath, outputPath) {
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

async function compressVideo(inputPath, outputPath) {
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

bot.onText(/(.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const url = match[1]; // The captured URL
  const userMessageId = msg.message_id; // ID of the user's command message

  if (!isValidUrl(url)) {
    // Dont do anything
    return;
  }

  let statusMessage;

  try {
    // Delete user's command message
    await bot.deleteMessage(chatId, userMessageId).catch((error) => {
      logger.error("Error deleting user message", {
        error: error.message,
        stack: error.stack,
      });
    });

    // Send initial status message
    statusMessage = await bot.sendMessage(chatId, `Starting download`);

    // Get video info
    const result = await ytdlp(url, {
      dumpSingleJson: true,
      noCheckCertificates: true,
      noWarnings: true,
      preferFreeFormats: true,
      // netrcLocation: path.join(__dirname, ".netrc"),
      cookies: cookieFileName,
    });

    if (!result || !result.title) {
      throw new Error("Failed to get video information");
    }

    // Generate a safe filename
    const safeTitle = result.title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    const fileName = `${safeTitle}`;
    const fileDir = __dirname;

    // Update status: Downloading
    await bot
      .editMessageText(`Downloading: ${result.title}`, {
        chat_id: chatId,
        message_id: statusMessage.message_id,
      })
      .catch((error) => {
        logger.error("Error updating status message", {
          error: error.message,
          stack: error.stack,
        });
      });

    // Download the video
    await ytdlp(url, {
      output: path.join(fileDir, fileName + ".%(ext)s"),
      noPlaylist: true,
      restrictFilenames: true,
      // netrcLocation: path.join(__dirname, ".netrc"),
      cookies: cookieFileName,
    });

    // Check if file exists (without knowing the extension)
    const files = await fs.readdir(fileDir);
    const downloadedFile = files.find((file) => file.startsWith(fileName));

    if (!downloadedFile) {
      throw new Error("Downloaded file not found");
    }

    const filePath = path.join(fileDir, downloadedFile);
    let finalFilePath = filePath;

    // Check file size
    const stats = await fs.stat(filePath);
    const fileSizeInMb = stats.size / (1024 * 1024);

    if (fileSizeInMb > 100) {
      throw new Error("File size exceeds 100MB limit");
    }

    // Check if the file is not MP4
    if (!downloadedFile.endsWith(".mp4")) {
      // Update status: Converting
      await bot
        .editMessageText(`Converting: ${result.title} to MP4`, {
          chat_id: chatId,
          message_id: statusMessage.message_id,
        })
        .catch((error) => {
          logger.error("Error updating status message", {
            error: error.message,
            stack: error.stack,
          });
        });

      const mp4FilePath = path.join(fileDir, `${fileName}.mp4`);
      finalFilePath = await convertToMp4(filePath, mp4FilePath);

      // Delete the original non-MP4 file
      await fs.unlink(filePath).catch((error) => {
        logger.error("Error deleting original file", {
          error: error.message,
          stack: error.stack,
        });
      });
    }

    // Check if compression is needed (file size > 50MB)
    if (fileSizeInMb > 50) {
      // Update status: Compressing
      await bot
        .editMessageText(`Compressing: ${result.title}`, {
          chat_id: chatId,
          message_id: statusMessage.message_id,
        })
        .catch((error) => {
          logger.error("Error updating status message", {
            error: error.message,
            stack: error.stack,
          });
        });

      const compressedFilePath = path.join(
        fileDir,
        `${fileName}_compressed.mp4`
      );
      finalFilePath = await compressVideo(finalFilePath, compressedFilePath);
    }

    // Update status: Uploading
    await bot
      .editMessageText(`Uploading: ${result.title}`, {
        chat_id: chatId,
        message_id: statusMessage.message_id,
      })
      .catch((error) => {
        logger.error("Error updating status message", {
          error: error.message,
          stack: error.stack,
        });
      });

    // Send the video file using the local file path
    try {
      await bot.sendVideo(chatId, finalFilePath, {
        filename: path.basename(finalFilePath),
        caption: `From @${msg.from.username} with 💕`,
      });
    } catch (error) {
      logger.error("Error sending video", {
        error: error.message,
        stack: error.stack,
      });
    } finally {
      // Delete the file after sending
      await fs.unlink(finalFilePath).catch((error) => {
        logger.error("Error deleting final file", {
          error: error.message,
          stack: error.stack,
        });
      });
    }

    // Delete the status message
    await bot.deleteMessage(chatId, statusMessage.message_id).catch((error) => {
      logger.error("Error deleting status message", {
        error: error.message,
        stack: error.stack,
      });
    });
  } catch (error) {
    console.error("Error:", error);
    // Log the error to file
    logger.error("Error processing video", {
      url: url,
      error: error.message,
      stack: error.stack,
    });

    // Send error message to user
    await bot
      .sendMessage(
        chatId,
        `Failed to process video from: ${url}. Error: ${error.message}`
      )
      .catch((sendError) => {
        logger.error("Error sending error message to user", {
          error: sendError.message,
          stack: sendError.stack,
        });
      });

    // Try to delete the status message if it exists
    if (statusMessage) {
      await bot
        .deleteMessage(chatId, statusMessage.message_id)
        .catch((deleteError) => {
          logger.error("Error deleting status message after error", {
            error: deleteError.message,
            stack: deleteError.stack,
          });
        });
    }
  }
});

// Error handler for polling errors
bot.on("polling_error", (error) => {
  logger.error("Polling error", { error: error.message, stack: error.stack });
});

console.log("Bot is running...");
