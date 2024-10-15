import { createClient } from "redis";
import { logger } from "./winston-logger.js";

const client = createClient({
  url: process.env.REDIS_URL
});

client.on("error", (err) => logger.debug("Redis Client Error", err));

export async function connectToDatabase() {
  await client.connect();
  logger.debug("Connected to Redis");
}

export async function saveUnhandledLink(
  url: string,
  chatId: number | string,
  username: string,
  originalMessageId: number
) {
  await client.hSet(`unhandled:${url}`, {
    chatId: chatId.toString(),
    username,
    originalMessageId: originalMessageId.toString(),
  });
}

export async function loadUnhandledLinks() {
  const keys = await client.keys("unhandled:*");
  const links = await Promise.all(
    keys.map(async (key) => {
      const data = await client.hGetAll(key);
      return {
        url: key.replace("unhandled:", ""),
        chatId: parseInt(data.chatId),
        username: data.username,
        originalMessageId: parseInt(data.originalMessageId),
      };
    })
  );
  return links;
}

export async function removeUnhandledLink(url: string) {
  await client.del(`unhandled:${url}`);
}
