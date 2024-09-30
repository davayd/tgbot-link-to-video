import fetch from "node-fetch";
import { createWriteStream } from "fs";
import { pipeline } from "stream";
import { promisify } from "util";

const streamPipeline = promisify(pipeline);

import puppeteer from "puppeteer";

const IG_URL = "https://igram.world/reels-downloader";

async function getFileLocationFromIgram(url: string) {
  // Launch the browser and open a new blank page
  const browser = await puppeteer.launch({
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();

  // Navigate the page to a URL.
  await page.goto(IG_URL);

  // Set screen size.
  await page.setViewport({ width: 1080, height: 1024 });

  await page.waitForSelector(".fc-consent-root .fc-button.fc-cta-consent");
  await page.click(".fc-consent-root .fc-button.fc-cta-consent");

  // Type into search box.
  await page.locator("#search-form-input").fill(url);
  await page.locator(".search-form__button").click();

  await page.waitForSelector(".modal__btn");
  await page.click(".modal__btn");

  // Locate the full title with a unique string.
  await page.waitForSelector("text/Search Result");
  await page.waitForSelector(".media-content__image");
  await page.waitForSelector(".media-content__info");

  const href = await page
    .locator(".media-content__info a")
    .map((element) => element.href)
    .wait();
  await browser.close();

  if (!href) {
    throw new Error("Failed to get video location from igram");
  }

  return href;
}

export async function igramApiDownloadVideo(
  url: string,
  outputPath: string
): Promise<void> {
  const location = await getFileLocationFromIgram(url);
  let format = "mp4";
  if (url.includes(".jpg") || url.includes(".png") || url.includes(".jpeg")) {
    format = "jpg";
  }
  const response = await fetch(location);
  if (!response.ok)
    throw new Error(`Failed to download video: ${response.statusText}`);

  await streamPipeline(
    response.body,
    createWriteStream(outputPath + "." + format)
  );
}
