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
import { removeConsent } from "./browser-helpers.js";

const streamPipeline = promisify(pipeline);

const IG_URL_REELS = "https://snapinsta.app/";
const SERVICE_NAME = "SNAPINSTA";

let browser: Browser | null = null;
const browserOptions: LaunchOptions = {
  ...(PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH && {
    executablePath: PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  }),
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
  headless: false,
  timeout: 10000,
};
let page: Page | null = null;

async function getFileLocation(userLink: string) {
  if (!browser) {
    LOG_DEBUG && logger.debug(`Launching browser`);
    browser = await chromium.launch(browserOptions);
  }
  if (!page) {
    LOG_DEBUG && logger.debug(`Creating new page`);
    page = await executePageCreationWithTimeout(
      browser,
      `Handle ${SERVICE_NAME} url`
    );
  }

  let serviceResult: [string, FileType] | null = null;
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

    LOG_DEBUG && logger.debug(`Navigating to ${IG_URL_REELS}`);
    await page.goto(IG_URL_REELS);

    LOG_DEBUG && logger.debug(`Setting viewport size to 1080x1024`);
    await page.setViewportSize({ width: 1080, height: 1024 });

    await removeConsent(page);

    LOG_DEBUG && logger.debug(`Filling search form with ${userLink}`);
    await page.fill("input#url", userLink);

    LOG_DEBUG && logger.debug(`Clicking search button`);
    await page.click("button#btn-submit");

    await removeAd(page);

    LOG_DEBUG && logger.debug(`Getting download link`);
    await page.waitForSelector(".download-bottom a");
    const result: [string, FileType] | null = await page.$eval(
      ".download-bottom a",
      (el) => {
        const fileType =
          el.textContent?.trim() === "Download Video" ? "mp4" : "jpg";
        const href = el.getAttribute("href");
        return href && fileType ? [href, fileType] : null;
      }
    );
    LOG_DEBUG && logger.debug(`Download link: ${result}`);

    serviceResult = result;
  } catch (error: any) {
    LOG_DEBUG &&
      logger.error(
        `The service ${SERVICE_NAME} returned an error ${JSON.stringify(
          error.stack
        )}`
      );
    throw new Error(`Произошла ошибка в сервисе ${SERVICE_NAME}`);
  }

  if (!serviceResult) {
    LOG_DEBUG && logger.error(`Failed to get HREF from ${SERVICE_NAME}`);
    throw new Error(`Не удалось получить ссылку из ${SERVICE_NAME}`);
  }

  await page.close();
  page = null;
  return serviceResult;
}

export async function snapinstaDownloadVideo(
  url: string,
  outputPath: string
): Promise<{ fileType: FileType }> {
  const createAsyncRequest = async () => {
    return getFileLocation(url);
  };
  const serviceResult = await retryAsync<[string, FileType]>(
    createAsyncRequest,
    {
      retry: 2,
      delay: 3000,
    }
  );

  const response = await fetch(serviceResult[0]);
  if (!response.ok)
    throw new Error(`Failed to download video: ${response.statusText}`);

  await streamPipeline(
    response.body,
    createWriteStream(outputPath + "." + serviceResult[1])
  );

  return { fileType: serviceResult[1] };
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

async function removeAd(page: Page) {
  const ad = await page.isVisible("div#adOverlay");
  if (ad) {
    await page.click("button#close-modal");
  }
}
