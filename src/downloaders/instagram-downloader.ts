import fetch from "node-fetch";
import { createWriteStream } from "fs";
import { pipeline } from "stream";
import { promisify } from "util";
import { chromium } from "playwright-core";
import { FileType } from "../models";
import { logger, LOG_DEBUG } from "../utils/winston-logger.js";
import { Browser } from "playwright";

const streamPipeline = promisify(pipeline);

const IG_URL_REELS = "https://igram.world/reels-downloader";
const IG_URL_STORIES = "https://igram.world/story-saver";

async function getFileLocationFromIgram(url: string) {
  const igramUrl = url.includes("stories") ? IG_URL_STORIES : IG_URL_REELS;
  let browser: Browser | null = null;
  let href: string | null = null;
  const executablePath =
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    "/usr/bin/chromium-browser";

  LOG_DEBUG && logger.debug(`Executable path: ${executablePath}`);

  LOG_DEBUG && logger.debug(`Launching browser`);
  browser = await chromium.launch({
    executablePath,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: true,
  });

  const page = await browser.newPage();

  LOG_DEBUG && logger.debug(`Navigating to ${igramUrl}`);
  await page.goto(igramUrl);

  LOG_DEBUG && logger.debug(`Setting viewport size to 1080x1024`);
  await page.setViewportSize({ width: 1080, height: 1024 });

  try {
    LOG_DEBUG && logger.debug(`Waiting for consent button`);
    await page.waitForSelector(".fc-consent-root .fc-button.fc-cta-consent", {
      timeout: 5000,
    });
    await page.click(".fc-consent-root .fc-button.fc-cta-consent");
  } catch (error) {
    LOG_DEBUG &&
      logger.debug("Consent button not found or not clickable. Skipping...");
  }

  LOG_DEBUG && logger.debug(`Filling search form with ${url}`);
  await page.fill("#search-form-input", url);
  LOG_DEBUG && logger.debug(`Clicking search button`);
  await page.click(".search-form__button");

  try {
    LOG_DEBUG && logger.debug(`Waiting for modal button`);
    await page.waitForSelector(".modal__btn", { timeout: 2000 });
    LOG_DEBUG && logger.debug(`Clicking modal button`);
    await page.click(".modal__btn");
  } catch (error) {
    LOG_DEBUG &&
      logger.debug("Modal button not found or not clickable. Skipping...");
  }

  try {
    LOG_DEBUG && logger.debug(`Waiting for search result`);
    await page.waitForSelector("text=Search Result");
    LOG_DEBUG && logger.debug(`Waiting for media content image`);
    await page.waitForSelector(".media-content__image");
    LOG_DEBUG && logger.debug(`Waiting for media content info`);
    await page.waitForSelector(".media-content__info");
  } catch (error) {
    try {
      LOG_DEBUG && logger.debug(`Getting error status`);
      await page.waitForSelector(".search-result .error-message");
    } catch (error) {
      const errorMessage = document.querySelector(
        ".search-result .error-message"
      )?.textContent;
      throw new Error(`The service returned an error: ${errorMessage}`);
    }
  }

  href = await page.evaluate(() => {
    const link = document.querySelector(".media-content__info a");
    return link ? link.getAttribute("href") : null;
  });

  if (!href) {
    throw new Error("Failed to get HREF from igram");
  }

  await browser.close();

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
