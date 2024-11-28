import { chromium, LaunchOptions, Page } from "playwright";
import { Browser } from "playwright";
import {
  LOG_DEBUG,
  PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
} from "../constants.js";
import { logger } from "../utils/winston-logger.js";
import { FileType } from "../models";
import { retryAsync } from "../utils/retry-async.js";
import { promisify } from "util";
import { pipeline } from "stream";
import { createWriteStream } from "fs";
import fetch from "node-fetch";
import { removeConsent } from "./browser-helpers.js";

const RESOURCE_URL = "https://ttsave.app/en";
const SERVICE_NAME = "TTSAVE";

const streamPipeline = promisify(pipeline);

async function getFileLocationSSSTik(url: string) {
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

  try {
    LOG_DEBUG && logger.debug(`Creating new page`);
    page = (await Promise.race([
      browser.newPage(),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Page creation timeout after 10 seconds")),
          10000
        )
      ),
    ])) as Page;
  } catch (error) {
    if (browser) {
      await browser.close();
      browser = null;
    }
    throw new Error("Failed to create Chromium page");
  }

  LOG_DEBUG && logger.debug(`Navigating to ${RESOURCE_URL}`);
  await page.goto(RESOURCE_URL);

  LOG_DEBUG && logger.debug(`Setting viewport size to 1080x1024`);
  await page.setViewportSize({ width: 1080, height: 1024 });

  await removeConsent(page);

  LOG_DEBUG && logger.debug(`Filling search form with ${url}`);
  await page.fill("input#input-query", url);
  LOG_DEBUG && logger.debug(`Clicking search button`);
  await page.click("button#btn-download");

  try {
    LOG_DEBUG && logger.debug(`Waiting for search result`);
    await page.waitForSelector(
      "div#button-download-ready a[type='no-watermark']"
    );
  } catch (error) {
    LOG_DEBUG && logger.debug(`Getting error status`);
    logger.error(`The service ${SERVICE_NAME} returned an error`);
    throw new Error(`Произошла ошибка в сервисе ${SERVICE_NAME}`);
  }

  LOG_DEBUG && logger.debug(`Getting href from ${SERVICE_NAME}`);
  href = await page.evaluate(() => {
    const link = document.querySelector(
      "div#button-download-ready a[type='no-watermark']"
    );
    return link ? link.getAttribute("href") : null;
  });

  if (!href) {
    logger.error(`Failed to get HREF from ${SERVICE_NAME}`);
    throw new Error(`Failed to get HREF from ${SERVICE_NAME}`);
  }

  await browser.close();
  return href;
}

export async function ssstikDownloadVideo(
  url: string,
  outputPath: string
): Promise<{ fileType: FileType }> {
  const createAsyncRequest = async () => {
    return getFileLocationSSSTik(url);
  };
  const location = await retryAsync<string>(createAsyncRequest, {
    retry: 1,
    delay: 3000,
  });

  const response = await fetch(location);
  if (!response.ok)
    throw new Error(`Failed to download video: ${response.statusText}`);

  await streamPipeline(response.body, createWriteStream(outputPath));

  return { fileType: "mp4" };
}
