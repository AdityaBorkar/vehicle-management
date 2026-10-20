import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { type BrowserContext, chromium, type Page } from "patchright";

export interface BrowserAutomationOptions {
	headless?: boolean;
	profileDir?: string;
}

function resolveProfileDir(): string {
	if (process.env.BROWSER_PROFILE_DIR) return process.env.BROWSER_PROFILE_DIR;
	const cacheBase = process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache");
	return join(cacheBase, "vehicle-management", "chrome-profile");
}

function shouldRunHeadless(explicit?: boolean): boolean {
	if (explicit !== undefined) return explicit;
	const env = process.env.HEADLESS?.toLowerCase();
	return env === "1" || env === "true";
}

class BrowserAutomation {
	private context: BrowserContext | null = null;
	private initPromise: Promise<BrowserContext> | null = null;
	private readonly options: BrowserAutomationOptions;

	constructor(options: BrowserAutomationOptions = {}) {
		this.options = options;
	}

	async init(): Promise<BrowserContext> {
		if (this.context) return this.context;
		if (this.initPromise) return this.initPromise;

		const profileDir = this.options.profileDir ?? resolveProfileDir();
		if (!existsSync(profileDir)) {
			mkdirSync(profileDir, { recursive: true });
		}

		const headless = shouldRunHeadless(this.options.headless);
		const baseOptions = {
			acceptDownloads: true,
			args: ["--no-sandbox", "--disable-setuid-sandbox"],
			headless,
			locale: "en-IN",
			timezoneId: "Asia/Kolkata",
			viewport: null as { height: number; width: number } | null,
		};

		this.initPromise = (async () => {
			try {
				const context = await chromium.launchPersistentContext(profileDir, {
					...baseOptions,
					channel: "chrome",
				});
				this.context = context;
				return context;
			} catch {
				const context = await chromium.launchPersistentContext(profileDir, {
					...baseOptions,
				});
				this.context = context;
				return context;
			}
		})();

		return this.initPromise;
	}

	async newPage(): Promise<Page> {
		const context = await this.init();
		return context.newPage();
	}

	async close(): Promise<void> {
		if (this.context) {
			await this.context.close();
			this.context = null;
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

	async scrapeVehicleDetails(vehicleNumber: string): Promise<unknown> {
		const { vahanVehicleDetails } = await import(
			"./workflows/vahan-vehicle-details"
		);
		const page = await this.newPage();
		try {
			return await vahanVehicleDetails(page, {
				registrationNumber: vehicleNumber,
			});
		} finally {
			await page.close();
		}
	}
}

export const browserAutomation = new BrowserAutomation();

export type { BrowserContext, Page };

const cleanup = async () => {
	await browserAutomation.close();
	process.exit(0);
};

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
