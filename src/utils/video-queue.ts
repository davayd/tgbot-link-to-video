import PQueue from "p-queue";
import { ProcessVideoContext } from "../models.js";
import { processAndSendVideo } from "./process-and-send-video.js";
import { logger } from "./winston-logger.js";
import { LOG_DEBUG } from "../constants.js";
import { retryAsync } from "./retry-async.js";

const queue = new PQueue({ concurrency: 1 });

queue.on("add", () => {
  LOG_DEBUG &&
    logger.debug(
      `Task is added.  Size: ${queue.size}  Pending: ${queue.pending}`
    );
});

queue.on("next", () => {
  LOG_DEBUG &&
    logger.debug(
      `Task is completed.  Size: ${queue.size}  Pending: ${queue.pending}`
    );
});

queue.on("error", (error: any) => {
  logger.error(`Error in queue: ${error.stack}`);
});

export function addToVideoQueue(context: ProcessVideoContext): void {
  queue.add(async () => {
    try {
      await retryAsync(() => processAndSendVideo(context), {
        retry: 3,
        delay: 1000,
      });
    } catch (error: any) {
      logger.error(`Error in addToVideoQueue: ${error.stack}`);
    }
  });
}
