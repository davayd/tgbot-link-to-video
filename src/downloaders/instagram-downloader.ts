import fetch from "node-fetch";
import { createWriteStream } from "fs";
import { pipeline } from "stream";
import { promisify } from "util";
import { FileType } from "../models";
import { logger } from "../utils/winston-logger.js";
import {
  Browser,
  BrowserContext,
  chromium,
  LaunchOptions,
  Page,
  Response,
} from "playwright";
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

  browser = await chromium.launch(browserOptions);
  const context = await browser.newContext({ recordVideo: { dir: "videos/" } });

  try {
    LOG_DEBUG &&
      logger.debug(`Browser options: ${JSON.stringify(browserOptions)}`);

    LOG_DEBUG && logger.debug(`Launching browser`);
    page = await executePageCreationWithTimeout(context, "Handle igram url");

    // If the url is a /share/reel/ link, we need to navigate to the actual page (might be temporary issue)
    if (url.includes("/share/reel/")) {
      const redirectedPage = await executePageCreationWithTimeout(
        context,
        "Handle /share/reel/ link"
      );
      await redirectedPage.goto(url);
      url = redirectedPage.url();
      await redirectedPage.close();
    }

    LOG_DEBUG && logger.debug(`Navigating to ${igramUrl}`);
    await page.goto(igramUrl);

    LOG_DEBUG && logger.debug(`Setting viewport size to 1080x1024`);
    await page.setViewportSize({ width: 1080, height: 1024 });

    LOG_DEBUG && logger.debug(`Filling search form with ${url}`);
    await page.fill("#search-form-input", url);

    LOG_DEBUG && logger.debug(`Waiting for response from api.igram.world`);
    const promise = page.waitForResponse("https://api.igram.world/api/convert");

    LOG_DEBUG && logger.debug(`Clicking search button`);
    await page.click(".search-form__button");

    LOG_DEBUG && logger.debug(`Getting link from promise response`);
    const promiseResponse = await promise;
    href = await getHrefFromIgram(promiseResponse);
  } catch (error: any) {
    LOG_DEBUG &&
      logger.error(
        `The service IGRAM returned an error ${JSON.stringify(error.stack)}`
      );
    await context.close();
    await browser.close();
    browser = null;
    page = null;
    throw new Error(`Произошла ошибка в сервисе IGRAM`);
  }

  if (!href) {
    LOG_DEBUG && logger.error(`Failed to get HREF from igram`);
    throw new Error("Не удалось получить ссылку из IGRAM");
  }

  await page.waitForTimeout(5000);
  await context.close();
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
    retry: 2,
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
  context: BrowserContext,
  operationName: string
): Promise<Page> {
  try {
    LOG_DEBUG &&
      logger.debug(`Creating new Chromium page for: ${operationName}`);
    const page: Page = await Promise.race([
      context.newPage(),
      new Promise<Page>((_, reject) =>
        setTimeout(
          () => reject(new Error(`${operationName} timeout after 10 seconds`)),
          10000
        )
      ),
    ]);
    return page;
  } catch (error) {
    if (context) {
      await context.close();
    }
    throw new Error(`Failed to create Chromium page for: ${operationName}`);
  }
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
