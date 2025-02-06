import { Browser, chromium, LaunchOptions, Page } from "playwright";
import {
  LOG_DEBUG,
  PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
} from "../constants.js";
import { logger } from "../utils/winston-logger.js";
import { retryAsync } from "../utils/retry-async.js";

export class BaseBrowserDownloader {
  private browser: Browser | null = null;
  private browserOptions: LaunchOptions = {
    ...(PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH && {
      executablePath: PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    }),
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: true,
    timeout: 60 * 1000,
  };

  constructor(
    private readonly _serviceName: string,
    private readonly serviceLink: string
  ) {}

  private async launchBrowser() {
    if (this.browser) {
      return this.browser;
    }

    LOG_DEBUG && logger.debug(`Launching browser`);
    this.browser = await this.executeBrowserLaunchWithTimeout(
      this.browserOptions
    );
    LOG_DEBUG && logger.debug(`Browser launched`);
    return this.browser;
  }

  private async createPage(browser: Browser) {
    LOG_DEBUG && logger.debug(`Creating new page`);
    const page = await this.executePageCreationWithTimeout(browser);
    LOG_DEBUG && logger.debug(`Page created`);
    return page;
  }

  async download(fn: (page: Page) => Promise<string | null>) {
    try {
      const browser = await this.launchBrowser();
      this.browser = browser;

      // If the url is a /share/reel/ link, we need to navigate to the actual page (might be temporary issue)
      // if (userLink.includes("/share/reel/")) {
      //   const redirectedPage = await executePageCreationWithTimeout(
      //     browser,
      //     `Handle /share/reel/ link`
      //   );
      //   await redirectedPage.goto(userLink);
      //   userLink = redirectedPage.url();
      //   await redirectedPage.close();
      // }

      const page = await this.createPage(browser);

      LOG_DEBUG && logger.debug(`Navigating to ${this.serviceLink}`);
      await page.goto(this.serviceLink);

      LOG_DEBUG && logger.debug(`Setting viewport size to 1080x1024`);
      await page.setViewportSize({ width: 1080, height: 1024 });

      const result = await fn(page);

      if (!result) {
        LOG_DEBUG &&
          logger.error(`Failed to get HREF from ${this._serviceName}`);
        await browser.close();
        this.browser = null;
        throw new Error(`Failed to get HREF from ${this._serviceName}`);
      }

      return result;
    } finally {
      await this.browser?.close();
      this.browser = null;
    }
  }

  private async executePageCreationWithTimeout(
    browser: Browser
  ): Promise<Page> {
    LOG_DEBUG && logger.debug(`Creating new Chromium page`);
    const createAsyncRequest = () =>
      Promise.race([
        browser.newPage(),
        new Promise<Page>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Page creation timeout after 60 seconds`)),
            60 * 1000
          )
        ),
      ]);

    const page = await retryAsync<Page>(createAsyncRequest, {
      retry: 2,
      delay: 3000,
    });
    return page;
  }

  private async executeBrowserLaunchWithTimeout(
    browserOptions: LaunchOptions
  ): Promise<Browser> {
    LOG_DEBUG && logger.debug(`Creating new Chromium browser`);
    const createAsyncRequest = () =>
      Promise.race([
        chromium.launch(browserOptions),
        new Promise<Browser>((_, reject) =>
          setTimeout(
            () =>
              reject(new Error(`Launching browser timeout after 60 seconds`)),
            60 * 1000
          )
        ),
      ]);

    const browser = await retryAsync<Browser>(createAsyncRequest, {
      retry: 2,
      delay: 3000,
    });
    return browser;
  }

  async waitForSelectorWithTimeout(page: Page, selector: string) {
    return Promise.race([
      page.waitForSelector(selector, { timeout: 61 * 1000 }),
      new Promise<Browser>((_, reject) =>
        setTimeout(
          () =>
            reject(new Error(`Waiting for selector timeout after 60 seconds`)),
          60 * 1000
        )
      ),
    ]);
  }
}
