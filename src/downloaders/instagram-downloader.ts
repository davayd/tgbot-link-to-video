import fetch from "node-fetch";
import { createWriteStream } from "fs";
import { pipeline } from "stream";
import { promisify } from "util";

const streamPipeline = promisify(pipeline);

import { chromium } from "playwright-core";
import { FileType } from "../models";

const IG_URL_REELS = "https://igram.world/reels-downloader";
const IG_URL_STORIES = "https://igram.world/story-saver";

async function getFileLocationFromIgram(url: string) {
  const igramUrl = url.includes("stories") ? IG_URL_STORIES : IG_URL_REELS;

  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium-browser',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  try {
    await page.goto(igramUrl);

    await page.setViewportSize({ width: 1080, height: 1024 });

    await page.waitForSelector(".fc-consent-root .fc-button.fc-cta-consent");
    await page.click(".fc-consent-root .fc-button.fc-cta-consent");

    await page.fill("#search-form-input", url);
    await page.click(".search-form__button");

    await page.waitForSelector(".modal__btn");
    await page.click(".modal__btn");

    await page.waitForSelector("text=Search Result");
    await page.waitForSelector(".media-content__image");
    await page.waitForSelector(".media-content__info");

    const href = await page.evaluate(() => {
      const link = document.querySelector(".media-content__info a");
      return link ? link.getAttribute("href") : null;
    });

    if (!href) {
      throw new Error("Failed to get video location from igram");
    }

    return href;
  } finally {
    await browser.close();
  }
}

export async function igramApiDownloadVideo(
  url: string,
  outputPath: string
): Promise<{ fileType: FileType }> {
  const location = await getFileLocationFromIgram(url);
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
