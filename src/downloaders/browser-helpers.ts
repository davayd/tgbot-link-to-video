import { Page } from "playwright";
import { LOG_DEBUG } from "../constants.js";
import { logger } from "../utils/winston-logger.js";

export async function removeConsent(page: Page) {
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
}
