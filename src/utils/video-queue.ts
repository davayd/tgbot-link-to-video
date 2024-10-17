import PQueue from "p-queue";
import { ProcessVideoContext } from "../models.js";
import { processAndSendVideo } from "./process-and-send-video.js";
import { logger } from "./winston-logger.js";
import { saveUnhandledLink } from "./database.js";

const queue = new PQueue({ concurrency: 1 });

queue.on("add", () => {
  logger.debug(
    `Task is added.  Size: ${queue.size}  Pending: ${queue.pending}`
  );
});

queue.on("next", () => {
  logger.debug(
    `Task is completed.  Size: ${queue.size}  Pending: ${queue.pending}`
  );
});

export async function addToVideoQueue(
  context: ProcessVideoContext
): Promise<void> {
  await queue.add(async () => {
    try {
      await processAndSendVideo(context);

      if (context.chatId && context.originalMessageId) {
        await context.bot.deleteMessage(
          context.chatId,
          context.originalMessageId
        );
      }
    } catch (error) {
      try {
        await saveUnhandledLink(
          context.url,
          context.chatId,
          context.username,
          context.originalMessageId
        );
      } catch (error) {
        logger.debug(`Error saving unhandled link: ${error}`, {
          url: context.url,
          chatId: context.chatId,
          username: context.username,
        });
      }
      logger.debug(`Error processing video: ${error}`, {
        url: context.url,
        chatId: context.chatId,
        username: context.username,
      });
    }
  });
}
