import fetch from "node-fetch";
import { createWriteStream } from "fs";
import { pipeline } from "stream";
import { promisify } from "util";
import { FileType } from "../models";
import { logger } from "../utils/winston-logger.js";
import { Browser, chromium, LaunchOptions, Page } from "playwright";
import {
  LOG_DEBUG,
  PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
} from "../constants.js";
import { retryAsync } from "../utils/retry-async.js";

const streamPipeline = promisify(pipeline);

const IG_URL_REELS = "https://igram.world/reels-downloader";
const IG_URL_STORIES = "https://igram.world/story-saver";

async function getFileLocationFromIgram(url: string) {
  const igramUrl = url.includes("stories") ? IG_URL_STORIES : IG_URL_REELS;
  let browser: Browser | null = null;
  let href: string | null = null;
  let page: Page | null = null;

  const browserOptions: LaunchOptions = {
    ...(PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH && {
      executablePath: PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    }),
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: true,
    timeout: 10000,
  };
  LOG_DEBUG &&
    logger.debug(`Browser options: ${JSON.stringify(browserOptions)}`);

  LOG_DEBUG && logger.debug(`Launching browser`);
  browser = await chromium.launch(browserOptions);

  // If the url is a /share/reel/ link, we need to navigate to the actual page (might be temporary issue)
  if (url.includes("/share/reel/")) {
    page = await executePageCreationWithTimeout(
      browser,
      "Handle /share/reel/ link"
    );
    page.goto(url);
    url = page.url();
  }

  page = await executePageCreationWithTimeout(browser, "Handle igram url");

  LOG_DEBUG && logger.debug(`Navigating to ${igramUrl}`);
  await page.goto(igramUrl);

  LOG_DEBUG && logger.debug(`Setting viewport size to 1080x1024`);
  await page.setViewportSize({ width: 1080, height: 1024 });

  LOG_DEBUG && logger.debug(`Filling search form with ${url}`);
  await page.fill("#search-form-input", url);
  LOG_DEBUG && logger.debug(`Clicking search button`);
  await page.click(".search-form__button");

  try {
    LOG_DEBUG && logger.debug(`Waiting for search result`);
    await page.waitForSelector("text=Search Result");
    LOG_DEBUG && logger.debug(`Waiting for media content image`);
    await page.waitForSelector(".media-content__image");
    LOG_DEBUG && logger.debug(`Waiting for media content info`);
    await page.waitForSelector(".media-content__info");
  } catch (error) {
    LOG_DEBUG && logger.debug(`Getting error status`);
    await page.waitForSelector(".search-result .error-message");
    const errorMessage = await page.evaluate(() => {
      const errorMessage = document.querySelector(
        ".search-result .error-message"
      )?.textContent;
      return errorMessage;
    });
    logger.error(`The service IGRAM returned an error: ${errorMessage}`);
    throw new Error(`Произошла ошибка в сервисе IGRAM: ${errorMessage}`);
  }

  href = await getHrefFromIgram(page, browser);

  if (!href) {
    logger.error(`Failed to get HREF from igram`);
    throw new Error("Failed to get HREF from igram");
  }

  await browser.close();
  return href;
}

export async function igramApiDownloadVideo(
  url: string,
  outputPath: string
): Promise<{ fileType: FileType }> {
  const createAsyncRequest = async () => {
    return getFileLocationFromIgram(url);
  };
  const location = await retryAsync<string>(createAsyncRequest, {
    retry: 3,
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

async function executePageCreationWithTimeout(
  browser: Browser,
  operationName: string
): Promise<Page> {
  try {
    LOG_DEBUG &&
      logger.debug(`Creating new Chromium page for: ${operationName}`);
    const page: Page = await Promise.race([
      browser.newPage(),
      new Promise<Page>((_, reject) =>
        setTimeout(
          () => reject(new Error(`${operationName} timeout after 10 seconds`)),
          10000
        )
      ),
    ]);
    return page;
  } catch (error) {
    if (browser) {
      await browser.close();
    }
    throw new Error(`Failed to create Chromium page for: ${operationName}`);
  }
}

async function getHrefFromIgram(
  page: Page,
  browser: Browser
): Promise<string | null> {
  LOG_DEBUG && logger.debug(`Getting href from igram`);
  try {
    const href: string | null = await Promise.race([
      await page.evaluate(() => {
        const link = document.querySelector(".media-content__info a");
        return link ? link.getAttribute("href") : null;
      }),
      new Promise<string>((_, reject) =>
        setTimeout(
          () =>
            reject(new Error(`Get href from igram timeout after 10 seconds`)),
          10000
        )
      ),
    ]);

    return href;
  } catch (error) {
    if (browser) {
      await browser.close();
    }
    throw new Error(`Failed to get href from igram`);
  }
}
