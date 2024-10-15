import fetch from "node-fetch";
import { createWriteStream } from "fs";
import { pipeline } from "stream";
import { promisify } from "util";
import { chromium } from "playwright-core";
import { FileType } from "../models";
import { logger } from "../utils/winston-logger.js";
import { Browser } from "playwright";

const streamPipeline = promisify(pipeline);

const IG_URL_REELS = "https://igram.world/reels-downloader";
const IG_URL_STORIES = "https://igram.world/story-saver";

async function getFileLocationFromIgram(url: string) {
  const igramUrl = url.includes("stories") ? IG_URL_STORIES : IG_URL_REELS;
  let browser: Browser | null = null;
  let href: string | null = null;

  try {
    logger.info(`Launching browser`);
    browser = await chromium.launch({
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
        "/usr/bin/chromium-browser",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      timeout: 10000,
    });

    const page = await browser.newPage();

    logger.info(`Navigating to ${igramUrl}`);
    await page.goto(igramUrl);

    logger.info(`Setting viewport size to 1080x1024`);
    await page.setViewportSize({ width: 1080, height: 1024 });

    try {
      logger.info(`Waiting for consent button`);
      await page.waitForSelector(".fc-consent-root .fc-button.fc-cta-consent", {
        timeout: 5000,
      });
      await page.click(".fc-consent-root .fc-button.fc-cta-consent");
    } catch (error) {
      logger.info("Consent button not found or not clickable. Skipping...");
    }

    logger.info(`Filling search form with ${url}`);
    await page.fill("#search-form-input", url);
    logger.info(`Clicking search button`);
    await page.click(".search-form__button");

    try {
      logger.info(`Waiting for modal button`);
      await page.waitForSelector(".modal__btn", { timeout: 2000 });
      logger.info(`Clicking modal button`);
      await page.click(".modal__btn");
    } catch (error) {
      logger.info("Modal button not found or not clickable. Skipping...");
    }

    logger.info(`Waiting for search result`);
    await page.waitForSelector("text=Search Result");
    logger.info(`Waiting for media content image`);
    await page.waitForSelector(".media-content__image");
    logger.info(`Waiting for media content info`);
    await page.waitForSelector(".media-content__info");

    href = await page.evaluate(() => {
      const link = document.querySelector(".media-content__info a");
      return link ? link.getAttribute("href") : null;
    });

    if (!href) {
      throw new Error("Failed to get video location from igram");
    }

    return href;
  } catch (error) {
    logger.error(`Error in getFileLocationFromIgram`, {
      error: (error as Error).message,
      stack: (error as Error).stack,
    });
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return href;
}

export async function igramApiDownloadVideo(
  url: string,
  outputPath: string
): Promise<{ fileType: FileType }> {
  const location = await getFileLocationFromIgram(url);
  if (!location) {
    throw new Error("Failed to get video location from igram");
  }

  let format: FileType = "mp4";
  if (
    location.includes(".jpg") ||
    location.includes(".png") ||
    location.includes(".jpeg")
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
