/**
 * Base Scraper - Robust foundation for all web scrapers
 *
 * Features:
 * - Exponential backoff retry
 * - Rate limiting
 * - Playwright browser for Cloudflare bypass
 * - Structured logging
 * - Error reporting with alerts
 * - Automatic cache integration
 *
 * Usage:
 *   class MyScraper extends BaseScraper {
 *     constructor() {
 *       super({
 *         name: 'my-scraper',
 *         baseUrl: 'https://example.com',
 *         rateLimit: { requestsPerMinute: 30 },
 *       });
 *     }
 *   }
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as cheerio from 'cheerio';
import { createLogger, startTimer } from '@/lib/logger';
import { cache as redisCache } from '@/lib/redis';

// ============================================================================
// TYPES
// ============================================================================

export interface ScraperConfig {
  /** Unique name for this scraper */
  name: string;
  /** Base URL for the site */
  baseUrl: string;
  /** Rate limiting config */
  rateLimit?: {
    /** Requests per minute (default: 30) */
    requestsPerMinute?: number;
    /** Minimum delay between requests in ms (default: 2000) */
    minDelayMs?: number;
  };
  /** Retry config */
  retry?: {
    /** Max retry attempts (default: 3) */
    maxAttempts?: number;
    /** Base delay for exponential backoff in ms (default: 1000) */
    baseDelayMs?: number;
    /** Max delay between retries in ms (default: 30000) */
    maxDelayMs?: number;
  };
  /** Cache TTL in seconds (default: 7 days) */
  cacheTtlSeconds?: number;
  /** Use Playwright browser instead of fetch (default: false) */
  useBrowser?: boolean;
  /** Custom headers for requests */
  headers?: Record<string, string>;
  /** Cookies for authenticated requests */
  cookies?: string;
}

export interface FetchOptions {
  /** Use browser even if scraper default is fetch */
  forceBrowser?: boolean;
  /** Skip cache lookup */
  skipCache?: boolean;
  /** Override cache TTL for this request */
  cacheTtl?: number;
  /** Additional headers for this request */
  headers?: Record<string, string>;
}

export interface FetchResult {
  html: string;
  statusCode: number;
  fromCache: boolean;
  url: string;
  fetchedAt: string;
}

export interface ScraperError extends Error {
  scraperName: string;
  url: string;
  statusCode?: number;
  retryCount: number;
  isRetryable: boolean;
}

// ============================================================================
// BASE SCRAPER CLASS
// ============================================================================

export abstract class BaseScraper {
  protected config: Required<ScraperConfig>;
  protected log: ReturnType<typeof createLogger>;
  protected lastRequestTime: number = 0;
  protected requestQueue: Promise<void> = Promise.resolve();

  // Playwright browser (lazy initialized)
  private static browser: Browser | null = null;
  private static browserContext: BrowserContext | null = null;

  constructor(config: ScraperConfig) {
    this.config = {
      name: config.name,
      baseUrl: config.baseUrl,
      rateLimit: {
        requestsPerMinute: config.rateLimit?.requestsPerMinute ?? 30,
        minDelayMs: config.rateLimit?.minDelayMs ?? 2000,
      },
      retry: {
        maxAttempts: config.retry?.maxAttempts ?? 3,
        baseDelayMs: config.retry?.baseDelayMs ?? 1000,
        maxDelayMs: config.retry?.maxDelayMs ?? 30000,
      },
      cacheTtlSeconds: config.cacheTtlSeconds ?? 60 * 60 * 24 * 7, // 7 days
      useBrowser: config.useBrowser ?? false,
      headers: config.headers ?? {},
      cookies: config.cookies ?? '',
    };

    this.log = createLogger({
      service: 'scraper',
      scraper: this.config.name,
    });
  }

  // ============================================================================
  // BROWSER MANAGEMENT
  // ============================================================================

  /**
   * Get or create the shared browser instance.
   */
  private async getBrowser(): Promise<Browser> {
    if (!BaseScraper.browser) {
      this.log.info('Launching Playwright browser');
      BaseScraper.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }
    return BaseScraper.browser;
  }

  /**
   * Get or create a browser context with cookies.
   */
  private async getContext(): Promise<BrowserContext> {
    if (!BaseScraper.browserContext) {
      const browser = await this.getBrowser();
      BaseScraper.browserContext = await browser.newContext({
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 720 },
      });

      // Add cookies if provided
      if (this.config.cookies) {
        const cookies = this.parseCookieString(this.config.cookies);
        if (cookies.length > 0) {
          await BaseScraper.browserContext.addCookies(cookies);
        }
      }
    }
    return BaseScraper.browserContext;
  }

  /**
   * Parse cookie string into Playwright cookie format.
   */
  private parseCookieString(
    cookieStr: string
  ): Array<{ name: string; value: string; domain: string; path: string }> {
    const domain = new URL(this.config.baseUrl).hostname;
    return cookieStr
      .split(';')
      .map((cookie) => cookie.trim())
      .filter((cookie) => cookie.includes('='))
      .map((cookie) => {
        const [name, ...valueParts] = cookie.split('=');
        return {
          name: name.trim(),
          value: valueParts.join('=').trim(),
          domain,
          path: '/',
        };
      });
  }

  /**
   * Close browser and cleanup resources.
   */
  public static async cleanup(): Promise<void> {
    if (BaseScraper.browserContext) {
      await BaseScraper.browserContext.close();
      BaseScraper.browserContext = null;
    }
    if (BaseScraper.browser) {
      await BaseScraper.browser.close();
      BaseScraper.browser = null;
    }
  }

  // ============================================================================
  // RATE LIMITING
  // ============================================================================

  /**
   * Wait for rate limit before making request.
   */
  private async waitForRateLimit(): Promise<void> {
    const minDelay = this.config.rateLimit.minDelayMs ?? 2000;
    const timeSinceLastRequest = Date.now() - this.lastRequestTime;

    if (timeSinceLastRequest < minDelay) {
      const waitTime = minDelay - timeSinceLastRequest;
      this.log.debug({ waitTime }, 'Rate limiting - waiting');
      await this.sleep(waitTime);
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Queue a request to ensure sequential execution with rate limiting.
   */
  private async queueRequest<T>(fn: () => Promise<T>): Promise<T> {
    // Chain onto the request queue
    const result = this.requestQueue.then(async () => {
      await this.waitForRateLimit();
      return fn();
    });

    // Update queue (ignore errors in queue tracking)
    this.requestQueue = result.then(
      () => {},
      () => {}
    );

    return result;
  }

  // ============================================================================
  // RETRY LOGIC
  // ============================================================================

  /**
   * Execute a function with exponential backoff retry.
   */
  private async withRetry<T>(
    operation: string,
    fn: () => Promise<T>,
    isRetryable: (error: unknown) => boolean = () => true
  ): Promise<T> {
    const maxAttempts = this.config.retry.maxAttempts ?? 3;
    const baseDelayMs = this.config.retry.baseDelayMs ?? 1000;
    const maxDelayMs = this.config.retry.maxDelayMs ?? 30000;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        if (attempt === maxAttempts || !isRetryable(error)) {
          break;
        }

        // Calculate exponential backoff with jitter
        const delay = Math.min(
          baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 1000,
          maxDelayMs
        );

        this.log.warn(
          { attempt, maxAttempts, delay, error: String(error) },
          `${operation} failed, retrying`
        );

        await this.sleep(delay);
      }
    }

    // Create structured error
    const scraperError = new Error(
      `${operation} failed after ${maxAttempts} attempts: ${lastError}`
    ) as ScraperError;
    scraperError.scraperName = this.config.name;
    scraperError.url = operation;
    scraperError.retryCount = maxAttempts;
    scraperError.isRetryable = false;

    throw scraperError;
  }

  /**
   * Check if an error is retryable (network errors, 5xx, 429).
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      if (
        message.includes('network') ||
        message.includes('timeout') ||
        message.includes('econnreset') ||
        message.includes('socket')
      ) {
        return true;
      }
    }

    // Check for HTTP status codes
    if (typeof error === 'object' && error !== null && 'statusCode' in error) {
      const status = (error as { statusCode: number }).statusCode;
      return status >= 500 || status === 429;
    }

    return true; // Default to retryable
  }

  // ============================================================================
  // FETCHING
  // ============================================================================

  /**
   * Fetch a URL with all the bells and whistles.
   */
  protected async fetch(url: string, options?: FetchOptions): Promise<FetchResult> {
    const fullUrl = url.startsWith('http') ? url : `${this.config.baseUrl}${url}`;
    const cacheKey = `scraper:${this.config.name}:${fullUrl}`;
    const cacheTtl = options?.cacheTtl ?? this.config.cacheTtlSeconds;

    // Check cache first
    if (!options?.skipCache) {
      const cached = await redisCache.get<FetchResult>(cacheKey);
      if (cached) {
        this.log.debug({ url: fullUrl }, 'Cache hit');
        return { ...cached, fromCache: true };
      }
    }

    const timer = startTimer('fetch', { url: fullUrl, scraper: this.config.name });

    const result = await this.queueRequest(async () => {
      return this.withRetry(
        `fetch ${fullUrl}`,
        async () => {
          const useBrowser = options?.forceBrowser || this.config.useBrowser;
          let html: string;
          let statusCode: number;

          if (useBrowser) {
            const result = await this.fetchWithBrowser(fullUrl);
            html = result.html;
            statusCode = result.statusCode;
          } else {
            const result = await this.fetchWithHttp(fullUrl, options?.headers);
            html = result.html;
            statusCode = result.statusCode;
          }

          return {
            html,
            statusCode,
            fromCache: false,
            url: fullUrl,
            fetchedAt: new Date().toISOString(),
          };
        },
        this.isRetryableError.bind(this)
      );
    });

    timer.done({ statusCode: result.statusCode, cached: false });

    // Cache the result
    await redisCache.set(cacheKey, result, { ttl: cacheTtl });

    return result;
  }

  /**
   * Fetch with standard HTTP (faster, but may be blocked).
   */
  private async fetchWithHttp(
    url: string,
    extraHeaders?: Record<string, string>
  ): Promise<{ html: string; statusCode: number }> {
    const headers: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      ...this.config.headers,
      ...extraHeaders,
    };

    if (this.config.cookies) {
      headers['Cookie'] = this.config.cookies;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}: ${response.statusText}`) as ScraperError;
      error.statusCode = response.status;
      throw error;
    }

    return {
      html: await response.text(),
      statusCode: response.status,
    };
  }

  /**
   * Fetch with Playwright browser (slower, but bypasses Cloudflare).
   */
  private async fetchWithBrowser(url: string): Promise<{ html: string; statusCode: number }> {
    const context = await this.getContext();
    const page = await context.newPage();

    try {
      const response = await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: 30000,
      });

      const statusCode = response?.status() ?? 200;

      // Wait for any JavaScript rendering
      await page.waitForTimeout(1000);

      const html = await page.content();
      return { html, statusCode };
    } finally {
      await page.close();
    }
  }

  // ============================================================================
  // PARSING HELPERS
  // ============================================================================

  /**
   * Parse HTML with Cheerio.
   */
  protected parseHtml(html: string): cheerio.CheerioAPI {
    return cheerio.load(html);
  }

  /**
   * Parse a price string to number.
   */
  protected parsePrice(text: string): number | null {
    if (!text) return null;
    const cleaned = text.replace(/[^0-9.,-]/g, '').replace(',', '');
    const value = parseFloat(cleaned);
    return isNaN(value) ? null : value;
  }

  /**
   * Parse a number string to integer.
   */
  protected parseInt(text: string): number | null {
    if (!text) return null;
    const cleaned = text.replace(/[^0-9-]/g, '');
    const value = parseInt(cleaned, 10);
    return isNaN(value) ? null : value;
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  /**
   * Sleep for a given number of milliseconds.
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Log an alert for scraper issues (selector changes, auth failures, etc.).
   */
  protected alert(message: string, context?: Record<string, unknown>): void {
    this.log.error({ alert: true, ...context }, `SCRAPER ALERT: ${message}`);
    // TODO: In production, send to monitoring service (PagerDuty, Slack, etc.)
  }

  /**
   * Check if selectors are returning expected data.
   * Call this after parsing to detect when sites change structure.
   */
  protected validateResults<T>(
    results: T[],
    minExpected: number,
    context: string
  ): void {
    if (results.length < minExpected) {
      this.alert(
        `${context}: Expected at least ${minExpected} results, got ${results.length}. Selectors may need updating.`,
        { resultCount: results.length, minExpected }
      );
    }
  }

  // ============================================================================
  // ABSTRACT METHODS (implement in subclasses)
  // ============================================================================

  /**
   * Check if the scraper is available (auth valid, site reachable).
   */
  abstract isAvailable(): Promise<boolean>;

  /**
   * Get the scraper's current status.
   */
  getStatus(): { name: string; baseUrl: string; useBrowser: boolean } {
    return {
      name: this.config.name,
      baseUrl: this.config.baseUrl,
      useBrowser: this.config.useBrowser,
    };
  }
}

export default BaseScraper;
