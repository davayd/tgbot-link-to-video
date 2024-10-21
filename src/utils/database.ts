import { createClient } from "redis";
import { logger } from "./winston-logger.js";
import { REDIS_URL } from "../constants.js";

const client = createClient({
  url: REDIS_URL ?? "redis://redis:6379",
});

client.on("error", (err) => logger.error("Redis Client Error", err.stack));

export async function DB_connectToDatabase() {
  await client.connect();
  logger.info("Connected to Redis");
}

export async function DB_saveUnhandledLink(
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

export async function DB_loadUnhandledLinks() {
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

export async function DB_removeUnhandledLink(url: string) {
  await client.del(`unhandled:${url}`);
}
