import PQueue from "p-queue";
import { ProcessVideoContext } from "../models.js";
import { processAndSendVideo } from "./process-and-send-video.js";
import { LOG_DEBUG, logger } from "./winston-logger.js";

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

export function addToVideoQueue(context: ProcessVideoContext): void {
  queue.add(async () => {
    await processAndSendVideo(context);
  });
}
