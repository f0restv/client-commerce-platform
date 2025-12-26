import type { Browser, Page, BrowserContext as PlaywrightContext } from 'playwright';
import type {
  ClientSourceData,
  ScrapeResult,
  ScrapeError,
  ScrapedItem,
  ScraperConfig,
  ScrapeJobOptions,
  Parser,
} from './types';
import { ebayParser } from './parsers/ebay';
import { shopifyParser, ShopifyParser } from './parsers/shopify';
import { createGenericParser } from './parsers/generic';
import prisma from '@/lib/db';
import { SourceType } from '@prisma/client';

// Lazy load playwright to avoid issues in environments where it's not installed
let playwright: typeof import('playwright') | null = null;

async function getPlaywright() {
  if (!playwright) {
    playwright = await import('playwright');
  }
  return playwright;
}

/**
 * Default scraper configuration
 */
const DEFAULT_CONFIG: ScraperConfig = {
  headless: true,
  maxPages: 10,
  delayBetweenRequests: 1000,
  maxConcurrent: 1,
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  viewport: { width: 1920, height: 1080 },
  includeOutOfStock: false,
};

/**
 * Get the appropriate parser for a source type
 */
function getParser(source: ClientSourceData): Parser {
  switch (source.type) {
    case SourceType.EBAY_STORE:
      return ebayParser;
    case SourceType.SHOPIFY:
      return shopifyParser;
    case SourceType.WEBSITE:
    case SourceType.WOOCOMMERCE:
    case SourceType.SQUARESPACE:
    default:
      return createGenericParser(source.selectors || undefined);
  }
}

/**
 * Main scraper class that orchestrates browser-based scraping
 */
export class ClientScraper {
  private browser: Browser | null = null;
  private context: PlaywrightContext | null = null;

  /**
   * Initialize the browser
   */
  async initialize(config: ScraperConfig = {}): Promise<void> {
    const pw = await getPlaywright();
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };

    this.browser = await pw.chromium.launch({
      headless: mergedConfig.headless,
    });

    this.context = await this.browser.newContext({
      userAgent: mergedConfig.userAgent,
      viewport: mergedConfig.viewport,
    });
  }

  /**
   * Close the browser and cleanup
   */
  async close(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Scrape a client source
   */
  async scrape(source: ClientSourceData, options: ScrapeJobOptions = {}): Promise<ScrapeResult> {
    const startedAt = new Date();
    const errors: ScrapeError[] = [];
    const items: ScrapedItem[] = [];
    const config = { ...DEFAULT_CONFIG, ...source.config };
    const maxPages = options.maxPages || config.maxPages || 10;

    // Ensure browser is initialized
    if (!this.browser || !this.context) {
      await this.initialize(config);
    }

    const parser = getParser(source);
    let page: Page | null = null;

    try {
      page = await this.context!.newPage();

      // Handle Shopify JSON API if available
      if (source.type === SourceType.SHOPIFY) {
        const shopifyItems = await this.scrapeShopifyJson(source, page, maxPages);
        if (shopifyItems.length > 0) {
          items.push(...shopifyItems);
        } else {
          // Fallback to HTML scraping
          await this.scrapePages(source, page, parser, items, errors, maxPages, config);
        }
      } else {
        await this.scrapePages(source, page, parser, items, errors, maxPages, config);
      }

      // Optionally scrape detail pages for additional info
      if (!options.dryRun && items.length > 0) {
        await this.enrichItems(items, page, parser, config, errors);
      }
    } catch (err) {
      errors.push({
        type: 'unknown',
        message: err instanceof Error ? err.message : 'Unknown scraping error',
        stack: err instanceof Error ? err.stack : undefined,
      });
    } finally {
      if (page) {
        await page.close();
      }
    }

    const completedAt = new Date();
    const duration = Math.round((completedAt.getTime() - startedAt.getTime()) / 1000);

    return {
      sourceId: source.id,
      status: errors.some((e) => e.type !== 'parse') ? 'FAILED' : 'COMPLETED',
      items,
      itemsFound: items.length,
      errors,
      duration,
      startedAt,
      completedAt,
    };
  }

  /**
   * Scrape Shopify store using JSON API
   */
  private async scrapeShopifyJson(
    source: ClientSourceData,
    page: Page,
    maxPages: number
  ): Promise<ScrapedItem[]> {
    const items: ScrapedItem[] = [];
    const shopify = shopifyParser as ShopifyParser;
    let currentPage = 1;

    try {
      while (currentPage <= maxPages) {
        const jsonUrl = shopify.getJsonUrl(source.url, currentPage);

        const response = await page.goto(jsonUrl, {
          waitUntil: 'networkidle',
          timeout: 30000,
        });

        if (!response || response.status() !== 200) {
          break;
        }

        const content = await page.content();
        // Extract JSON from page (it's wrapped in HTML)
        const jsonMatch = content.match(/<pre[^>]*>([\s\S]*?)<\/pre>/);
        if (!jsonMatch) {
          // Try to get raw text
          const text = await page.evaluate(() => document.body.innerText);
          try {
            const json = JSON.parse(text);
            const result = shopify.parseJsonResponse(json, source.url);
            items.push(...result.items);
            if (!result.hasNextPage || result.items.length === 0) {
              break;
            }
          } catch {
            break;
          }
        } else {
          try {
            const json = JSON.parse(jsonMatch[1]);
            const result = shopify.parseJsonResponse(json, source.url);
            items.push(...result.items);
            if (!result.hasNextPage || result.items.length === 0) {
              break;
            }
          } catch {
            break;
          }
        }

        currentPage++;
      }
    } catch {
      // JSON API not available, return empty to fallback to HTML
    }

    return items;
  }

  /**
   * Scrape pages using HTML parser
   */
  private async scrapePages(
    source: ClientSourceData,
    page: Page,
    parser: Parser,
    items: ScrapedItem[],
    errors: ScrapeError[],
    maxPages: number,
    config: ScraperConfig
  ): Promise<void> {
    let currentPage = 1;
    let nextUrl: string | undefined = parser.getListUrl(source.url, 1);

    while (nextUrl && currentPage <= maxPages) {
      try {
        // Navigate to page
        const response = await page.goto(nextUrl, {
          waitUntil: 'networkidle',
          timeout: 30000,
        });

        if (!response || response.status() >= 400) {
          errors.push({
            type: 'navigation',
            message: `Failed to load page: ${response?.status() || 'no response'}`,
            url: nextUrl,
          });
          break;
        }

        // Handle authentication if needed
        if (source.config?.requiresAuth && currentPage === 1) {
          await this.handleAuth(page, source.config);
        }

        // Wait for dynamic content
        await this.waitForContent(page);

        // Get page content
        const html = await page.content();

        // Parse the page
        const result = parser.parseListPage(html, nextUrl);

        items.push(...result.items);
        errors.push(
          ...result.errors.map((msg) => ({
            type: 'parse' as const,
            message: msg,
            url: nextUrl,
          }))
        );

        // Check for next page
        if (result.hasNextPage && result.nextPageUrl) {
          nextUrl = result.nextPageUrl;
        } else if (result.hasNextPage) {
          currentPage++;
          nextUrl = parser.getListUrl(source.url, currentPage);
        } else {
          break;
        }

        // Rate limiting
        if (config.delayBetweenRequests) {
          await this.delay(config.delayBetweenRequests);
        }
      } catch (err) {
        errors.push({
          type: 'navigation',
          message: err instanceof Error ? err.message : 'Navigation failed',
          url: nextUrl,
        });
        break;
      }
    }
  }

  /**
   * Enrich items with data from detail pages
   */
  private async enrichItems(
    items: ScrapedItem[],
    page: Page,
    parser: Parser,
    config: ScraperConfig,
    errors: ScrapeError[]
  ): Promise<void> {
    // Only enrich items missing critical data (description, images)
    const needsEnrichment = items.filter(
      (item) => !item.description || item.images.length === 0
    );

    // Limit to avoid excessive requests
    const toEnrich = needsEnrichment.slice(0, 20);

    for (const item of toEnrich) {
      try {
        const response = await page.goto(item.sourceUrl, {
          waitUntil: 'networkidle',
          timeout: 20000,
        });

        if (!response || response.status() >= 400) {
          continue;
        }

        await this.waitForContent(page);
        const html = await page.content();
        const detailed = parser.parseDetailPage(html, item.sourceUrl);

        if (detailed) {
          // Merge detailed data with list data
          if (!item.description && detailed.description) {
            item.description = detailed.description;
          }
          if (item.images.length === 0 && detailed.images.length > 0) {
            item.images = detailed.images;
          }
          if (!item.sku && detailed.sku) {
            item.sku = detailed.sku;
          }
          if (!item.condition && detailed.condition) {
            item.condition = detailed.condition;
          }
          if (!item.category && detailed.category) {
            item.category = detailed.category;
          }
          if (detailed.attributes) {
            item.attributes = { ...item.attributes, ...detailed.attributes };
          }
        }

        if (config.delayBetweenRequests) {
          await this.delay(config.delayBetweenRequests);
        }
      } catch (err) {
        errors.push({
          type: 'parse',
          message: `Failed to enrich item: ${err instanceof Error ? err.message : 'Unknown error'}`,
          url: item.sourceUrl,
        });
      }
    }
  }

  /**
   * Handle authentication if required
   */
  private async handleAuth(page: Page, config: ScraperConfig): Promise<void> {
    if (!config.authUrl || !config.username || !config.password) {
      return;
    }

    try {
      await page.goto(config.authUrl, { waitUntil: 'networkidle' });

      // Common login form selectors
      const usernameSelectors = [
        'input[name="username"]',
        'input[name="email"]',
        'input[type="email"]',
        '#username',
        '#email',
      ];

      const passwordSelectors = [
        'input[name="password"]',
        'input[type="password"]',
        '#password',
      ];

      // Find and fill username
      for (const sel of usernameSelectors) {
        const el = await page.$(sel);
        if (el) {
          await el.fill(config.username);
          break;
        }
      }

      // Find and fill password
      for (const sel of passwordSelectors) {
        const el = await page.$(sel);
        if (el) {
          await el.fill(config.password);
          break;
        }
      }

      // Submit form
      const submitSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:has-text("Log in")',
        'button:has-text("Sign in")',
      ];

      for (const sel of submitSelectors) {
        const el = await page.$(sel);
        if (el) {
          await el.click();
          await page.waitForNavigation({ waitUntil: 'networkidle' });
          break;
        }
      }
    } catch {
      // Auth failed, continue anyway
    }
  }

  /**
   * Wait for dynamic content to load
   */
  private async waitForContent(page: Page): Promise<void> {
    try {
      // Wait for network to be idle
      await page.waitForLoadState('networkidle', { timeout: 10000 });

      // Additional wait for JavaScript-rendered content
      await page.evaluate(() => {
        return new Promise((resolve) => {
          if (document.readyState === 'complete') {
            resolve(true);
          } else {
            window.addEventListener('load', () => resolve(true));
          }
        });
      });
    } catch {
      // Timeout is acceptable
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Run a scrape job for a client source
 */
export async function runScrapeJob(
  sourceId: string,
  options: ScrapeJobOptions = {}
): Promise<ScrapeResult> {
  // Fetch the source from database
  const source = await prisma.clientSource.findUnique({
    where: { id: sourceId },
  });

  if (!source) {
    throw new Error(`ClientSource not found: ${sourceId}`);
  }

  if (!source.isActive && !options.fullRescrape) {
    throw new Error(`ClientSource is inactive: ${sourceId}`);
  }

  // Create scrape history record
  const history = await prisma.scrapeHistory.create({
    data: {
      sourceId,
      status: 'RUNNING',
      startedAt: new Date(),
    },
  });

  const scraper = new ClientScraper();
  let result: ScrapeResult;

  try {
    await scraper.initialize(source.config as ScraperConfig | undefined);

    const sourceData: ClientSourceData = {
      id: source.id,
      clientId: source.clientId,
      name: source.name,
      type: source.type,
      url: source.url,
      isActive: source.isActive,
      scrapeFrequency: source.scrapeFrequency,
      selectors: source.selectors as ClientSourceData['selectors'],
      config: source.config as ClientSourceData['config'],
      lastScrapedAt: source.lastScrapedAt,
      lastItemCount: source.lastItemCount,
      lastError: source.lastError,
    };

    result = await scraper.scrape(sourceData, options);

    // Update history record
    await prisma.scrapeHistory.update({
      where: { id: history.id },
      data: {
        status: result.status,
        itemsFound: result.itemsFound,
        errors: result.errors.length > 0 ? result.errors : undefined,
        duration: result.duration,
        completedAt: result.completedAt,
      },
    });

    // Update source record
    await prisma.clientSource.update({
      where: { id: sourceId },
      data: {
        lastScrapedAt: result.completedAt,
        lastItemCount: result.itemsFound,
        lastError: result.errors.length > 0 ? result.errors[0].message : null,
      },
    });
  } catch (err) {
    // Update history with failure
    await prisma.scrapeHistory.update({
      where: { id: history.id },
      data: {
        status: 'FAILED',
        errors: [{ type: 'unknown', message: err instanceof Error ? err.message : 'Unknown error' }],
        completedAt: new Date(),
      },
    });

    throw err;
  } finally {
    await scraper.close();
  }

  return result;
}

/**
 * Create a new ClientScraper instance
 */
export function createScraper(): ClientScraper {
  return new ClientScraper();
}
