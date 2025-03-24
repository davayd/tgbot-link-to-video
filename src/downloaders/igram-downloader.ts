import fetch from "node-fetch";
import { createWriteStream } from "fs";
import { pipeline } from "stream";
import { promisify } from "util";
import { FileType } from "../models.js";
import { logger } from "../utils/winston-logger.js";
import { Response } from "playwright";
import { LOG_DEBUG } from "../constants.js";
import { retryAsync } from "../utils/retry-async.js";
import { BaseBrowserDownloader } from "./base-browser-downloader.js";

const streamPipeline = promisify(pipeline);

const IG_URL_REELS = "https://igram.world/reels-downloader";
const IG_URL_STORIES = "https://igram.world/story-saver";
const SERVICE_NAME = "IGRAM";

async function getFileLocationFromIgram(url: string) {
  const igramUrl = url.includes("stories") ? IG_URL_STORIES : IG_URL_REELS;

  const engine = new BaseBrowserDownloader(SERVICE_NAME, igramUrl);

  return engine.download(async (page) => {
    LOG_DEBUG && logger.debug(`Filling search form with ${url}`);
    await page.fill("#search-form-input", url);

    LOG_DEBUG && logger.debug(`Waiting for response from api.igram.world`);

    const hrefPromise = Promise.race([
      new Promise<null>((resolve, _) =>
        setTimeout(() => resolve(null), 200 * 1000)
      ),
      new Promise<string | null>((resolve, _) => {
        page?.on("requestfinished", async (request) => {
          LOG_DEBUG && logger.debug(`Request finished: ${request.url()}`);
          if (request.url().includes("https://api.igram.world/api/convert")) {
            const response = await request.response();
            if (response) {
              const hrefFromResponse = await getHrefFromIgram(response);
              resolve(hrefFromResponse);
            }
          }
        });
      }),
    ]);

    LOG_DEBUG && logger.debug(`Clicking search button`);
    await page.click(".search-form__button");
    await page.bringToFront();
    const href = await hrefPromise;
    return href;
  });
}

export async function igramApiDownloadVideo(
  url: string,
  outputPath: string
): Promise<{ fileType: FileType }> {
  const createAsyncRequest = async () => {
    return getFileLocationFromIgram(url);
  };
  const location = await retryAsync<string>(createAsyncRequest, {
    retry: 1,
    delay: 3000,
  });

  let format: FileType = "mp4";
  if (
    location.includes(".jpg") ||
    location.includes(".png") ||
    location.includes(".jpeg") ||
    location.includes(".webp")
  ) {
    format = "jpg";
  }
  const response = await fetch(location);
  if (!response.ok)
    throw new Error(`Failed to download video: ${response.statusText}`);

  await streamPipeline(
    response.body,
    createWriteStream(outputPath + "." + format)
  );

  return { fileType: format };
}

async function getHrefFromIgram(response: Response): Promise<string | null> {
  const body: Buffer = await response.body();
  const json = JSON.parse(body.toString("utf-8"));
  LOG_DEBUG && logger.debug(`Response JSON: ${JSON.stringify(json)}`);
  if (
    json.url &&
    Array.isArray(json.url) &&
    json.url.length > 0 &&
    json.url[0].url
  ) {
    return json.url[0].url;
  }
  return null;
}
