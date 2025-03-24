import fetch from "node-fetch";
import { createWriteStream } from "fs";
import { pipeline } from "stream";
import { promisify } from "util";
import { DownloaderType, FileType } from "../models.js";
import { logger } from "../utils/winston-logger.js";
import { LOG_DEBUG } from "../constants.js";
import { retryAsync } from "../utils/retry-async.js";
import { BaseBrowserDownloader } from "./base-browser-downloader.js";
import { getFileExtension } from "../utils/is-valid-url.js";

const streamPipeline = promisify(pipeline);

const SERVICE_LINK = "https://cobalt.tools/";
const SERVICE_NAME: DownloaderType = "cobalt";

async function getFileLocation(userLink: string) {
  const engine = new BaseBrowserDownloader(SERVICE_NAME, SERVICE_LINK);

  return engine.download(async (page) => {
    await page.waitForTimeout(100_000);

    LOG_DEBUG && logger.debug(`Filling search form with ${userLink}`);
    await page.fill("input#link-area", userLink);

    LOG_DEBUG && logger.debug(`Clicking search button`);
    const downloadBtnLocator = page.locator("button.download-button");
    await downloadBtnLocator.waitFor({ state: "visible", timeout: 60 * 1000 });
    await downloadBtnLocator.click();

    await page.waitForTimeout(100_000);

    // LOG_DEBUG && logger.debug(`Trying to find locator`);
    // const linkLocator = page.locator("a.button__download");
    // await linkLocator.waitFor({ state: "visible", timeout: 60 * 1000 });
    // LOG_DEBUG && logger.debug(`Locator found`);

    // LOG_DEBUG && logger.debug(`Getting download link`);
    // const result: string | null = await linkLocator.evaluate((el) => {
    //   const href = el.getAttribute("href");
    //   return href ?? null;
    // });

    return "";
  });
}

export async function cobaltDownloadVideo(
  url: string,
  outputPath: string
): Promise<{ fileType: FileType }> {
  const createAsyncRequest = async () => {
    return getFileLocation(url);
  };
  const serviceResult = await retryAsync<string>(createAsyncRequest, {
    retry: 2,
    delay: 3000,
  });

  const response = await fetch(serviceResult);
  if (!response.ok)
    throw new Error(`Failed to download video: ${response.statusText}`);

  const fileExtension = getFileExtension(url);
  await streamPipeline(
    response.body,
    createWriteStream(outputPath + "." + fileExtension)
  );

  return { fileType: fileExtension };
}
