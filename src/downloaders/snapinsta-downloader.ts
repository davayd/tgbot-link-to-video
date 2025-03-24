import fetch from "node-fetch";
import { createWriteStream } from "fs";
import { pipeline } from "stream";
import { promisify } from "util";
import { FileType } from "../models.js";
import { logger } from "../utils/winston-logger.js";
import { Page } from "playwright";
import { LOG_DEBUG } from "../constants.js";
import { retryAsync } from "../utils/retry-async.js";
import { removeConsent } from "./browser-helpers.js";
import { BaseBrowserDownloader } from "./base-browser-downloader.js";

const streamPipeline = promisify(pipeline);

const IG_URL_REELS = "https://snapinsta.app";
const SERVICE_NAME = "SNAPINSTA";

async function getFileLocation(userLink: string) {
  const engine = new BaseBrowserDownloader(SERVICE_NAME, IG_URL_REELS);

  return engine.download(async (page) => {
    await removeConsent(page);

    LOG_DEBUG && logger.debug(`Filling search form with ${userLink}`);
    await page.fill("input#url", userLink);

    LOG_DEBUG && logger.debug(`Clicking search button`);
    await page.click("button#btn-submit");

    await removeAd(page);

    LOG_DEBUG && logger.debug(`Getting download link`);
    await page.waitForSelector(".download-bottom a", {});
    const result: string | null = await page.$eval(
      ".download-bottom a",
      (el) => {
        const href = el.getAttribute("href");
        return href;
      }
    );
    LOG_DEBUG && logger.debug(`Download link: ${result}`);

    return result;
  });
}

export async function snapinstaDownloadVideo(
  url: string,
  outputPath: string
): Promise<{ fileType: FileType }> {
  const createAsyncRequest = async () => {
    return getFileLocation(url);
  };
  const serviceResult = await retryAsync<string>(createAsyncRequest, {
    retry: 1,
    delay: 3000,
  });

  const response = await fetch(serviceResult);
  if (!response.ok)
    throw new Error(`Failed to download video: ${response.statusText}`);

  await streamPipeline(
    response.body,
    createWriteStream(outputPath + "." + "mp4")
  );

  return { fileType: "mp4" };
}

async function removeAd(page: Page) {
  const ad = await page.isVisible("div#adOverlay");
  if (ad) {
    await page.click("button#close-modal");
  }
}
