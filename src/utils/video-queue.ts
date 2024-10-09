import PQueue from "p-queue";
import { ProcessVideoContext } from "../models.js";
import { processAndSendVideo } from "./process-and-send-video.js";
import { logger } from "./winston-logger.js";
import { saveUnhandledLink } from "./database.js";

const queue = new PQueue({ concurrency: 1 });

queue.on("add", () => {
  logger.info(`Task is added.  Size: ${queue.size}  Pending: ${queue.pending}`);
});

queue.on("next", () => {
  logger.info(
    `Task is completed.  Size: ${queue.size}  Pending: ${queue.pending}`
  );
});

export async function addToVideoQueue(
  context: ProcessVideoContext
): Promise<void> {
  await queue.add(async () => {
    try {
      await processAndSendVideo(context);
      await context.bot.deleteMessage(
        context.chatId,
        context.originalMessageId
      );
    } catch (error) {
      try {
        await saveUnhandledLink(
          context.url,
          context.chatId,
          context.username,
          context.originalMessageId
        );
      } catch (error) {
        logger.error(`Error saving unhandled link: ${error}`, {
          url: context.url,
          chatId: context.chatId,
          username: context.username,
        });
      }
      logger.error(`Error processing video: ${error}`, {
        url: context.url,
        chatId: context.chatId,
        username: context.username,
      });
    }
  });
}