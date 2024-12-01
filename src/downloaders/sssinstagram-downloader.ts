import fetch from "node-fetch";
import { createWriteStream } from "fs";
import { pipeline } from "stream";
import { promisify } from "util";
import { FileType } from "../models.js";
import { logger } from "../utils/winston-logger.js";
import { Browser, chromium, LaunchOptions, Page } from "playwright";
import {
  LOG_DEBUG,
  PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
} from "../constants.js";
import { retryAsync } from "../utils/retry-async.js";

const streamPipeline = promisify(pipeline);

const SERVICE_LINK = "https://sssinstagram.com/reels-downloader";
const SERVICE_NAME = "SSSINSTAGRAM";

async function getFileLocation(userLink: string) {
  let browser: Browser | null = null;
  let page: Page | null = null;

  const browserOptions: LaunchOptions = {
    ...(PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH && {
      executablePath: PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    }),
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: true,
    timeout: 10000,
  };

  LOG_DEBUG && logger.debug(`Launching browser`);
  browser = await chromium.launch(browserOptions);

  LOG_DEBUG && logger.debug(`Creating new page`);
  page = await executePageCreationWithTimeout(
    browser,
    `Handle ${SERVICE_NAME} url`
  );

  let serviceResult: string | null = null;
  try {
    LOG_DEBUG &&
      logger.debug(`Browser options: ${JSON.stringify(browserOptions)}`);

    LOG_DEBUG && logger.debug(`Launching browser`);

    // If the url is a /share/reel/ link, we need to navigate to the actual page (might be temporary issue)
    if (userLink.includes("/share/reel/")) {
      const redirectedPage = await executePageCreationWithTimeout(
        browser,
        `Handle /share/reel/ link`
      );
      await redirectedPage.goto(userLink);
      userLink = redirectedPage.url();
      await redirectedPage.close();
    }

    LOG_DEBUG && logger.debug(`Navigating to ${SERVICE_LINK}`);
    await page.goto(SERVICE_LINK);

    LOG_DEBUG && logger.debug(`Setting viewport size to 1080x1024`);
    await page.setViewportSize({ width: 1080, height: 1024 });

    LOG_DEBUG && logger.debug(`Filling search form with ${userLink}`);
    await page.fill("input#input", userLink);

    LOG_DEBUG && logger.debug(`Clicking search button`);
    await page.click(".form__submit");

    LOG_DEBUG && logger.debug(`Getting download link`);
    await page.waitForSelector("a.button__download");
    const result: string | null = await page.$eval(
      "a.button__download",
      (el) => {
        const href = el.getAttribute("href");
        return href ?? null;
      }
    );
    LOG_DEBUG && logger.debug(`Download link: ${result}`);

    serviceResult = result;

    if (!serviceResult) {
      LOG_DEBUG && logger.error(`Failed to get HREF from ${SERVICE_NAME}`);
      throw new Error(`Не удалось получить ссылку из ${SERVICE_NAME}`);
    }

    return serviceResult;
  } catch (error: any) {
    LOG_DEBUG && logger.error(`ERROR: ${error.stack}`);
    throw error;
  } finally {
    await browser.close();
    browser = null;
    page = null;
  }
}

export async function sssinstagramDownloadVideo(
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

  const response = await fetch(serviceResult[0]);
  if (!response.ok)
    throw new Error(`Failed to download video: ${response.statusText}`);

  await streamPipeline(
    response.body,
    createWriteStream(outputPath + "." + "mp4")
  );

  return { fileType: "mp4" };
}

async function executePageCreationWithTimeout(
  browser: Browser,
  operationName: string
): Promise<Page> {
  LOG_DEBUG && logger.debug(`Creating new Chromium page for: ${operationName}`);
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
}
