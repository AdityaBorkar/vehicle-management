import puppeteer, { type Browser, type Page } from "puppeteer";

const DEFAULT_VIEWPORT = { height: 900, width: 1440 };
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";

class BrowserAutomation {
  private browser: Browser | null = null;
  private initPromise: Promise<Browser> | null = null;

  async init(): Promise<Browser> {
    if (this.browser) return this.browser;

    if (this.initPromise) return this.initPromise;

    this.initPromise = puppeteer
      .launch({
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-blink-features=AutomationControlled",
        ],
        headless: false,
      })
      .then((b) => {
        this.browser = b;
        return b;
      });

    return this.initPromise;
  }

  async newPage(): Promise<Page> {
    const browser = await this.init();
    const page = await browser.newPage();

    await page.setViewport(DEFAULT_VIEWPORT);
    await page.setUserAgent(DEFAULT_USER_AGENT);

    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
    });

    return page;
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.initPromise = null;
    }
  }

  async scrapeChallanDetails(_vehicleNumber: string): Promise<unknown> {
    const page = await this.newPage();
    try {
      return null;
    } finally {
      await page.close();
    }
  }

  async scrapeVehicleDetails(_vehicleNumber: string): Promise<unknown> {
    const page = await this.newPage();
    try {
      return null;
    } finally {
      await page.close();
    }
  }
}

export const browserAutomation = new BrowserAutomation();

const cleanup = async () => {
  await browserAutomation.close();
  process.exit(0);
};

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
