import { Browser, Page } from "playwright";
import { LOG_DEBUG } from "../constants.js";
import { logger } from "../utils/winston-logger.js";
import { retryAsync } from "../utils/retry-async.js";

export async function removeConsent(page: Page) {
  try {
    LOG_DEBUG && logger.debug(`Waiting for consent button`);
    await page.click(".fc-consent-root .fc-button.fc-cta-consent");
    LOG_DEBUG && logger.debug(`Consent button clicked`);
  } catch (error) {
    LOG_DEBUG &&
      logger.debug("Consent button not found or not clickable. Skipping...");
  }
}

export async function executePageCreationWithTimeout(
  browser: Browser,
  operationName: string
): Promise<Page> {
  LOG_DEBUG && logger.debug(`Creating new Chromium page for: ${operationName}`);
  const createAsyncRequest = () =>
    Promise.race([
      browser.newPage(),
      new Promise<Page>((_, reject) =>
        setTimeout(
          () => reject(new Error(`${operationName} timeout after 10 seconds`)),
          10 * 1000
        )
      ),
    ]);

  const page = await retryAsync<Page>(createAsyncRequest, {
    retry: 2,
    delay: 3000,
  });
  return page;
}
