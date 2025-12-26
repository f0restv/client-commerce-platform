import type { SourceType, JobStatus } from '@prisma/client';

// Re-export Prisma types for convenience
export type { SourceType, JobStatus };

/**
 * Configuration for CSS selectors used in scraping
 */
export interface ScraperSelectors {
  // Product list page
  productList: string;
  productLink: string;
  pagination?: string;
  nextPage?: string;

  // Product detail page
  title: string;
  price: string;
  description?: string;
  images?: string;
  sku?: string;
  condition?: string;
  quantity?: string;
  category?: string;
}

/**
 * Additional scraper configuration options
 */
export interface ScraperConfig {
  // Authentication
  requiresAuth?: boolean;
  authUrl?: string;
  username?: string;
  password?: string;

  // Pagination
  maxPages?: number;
  itemsPerPage?: number;

  // Rate limiting
  delayBetweenRequests?: number; // ms
  maxConcurrent?: number;

  // Browser options
  headless?: boolean;
  userAgent?: string;
  viewport?: { width: number; height: number };

  // Filtering
  includeOutOfStock?: boolean;
  minPrice?: number;
  maxPrice?: number;
}

/**
 * Raw scraped item data before processing
 */
export interface ScrapedItem {
  sourceUrl: string;
  externalId?: string;
  title: string;
  price: number | null;
  description: string | null;
  images: string[];
  sku?: string;
  condition?: string;
  quantity: number;
  category?: string;
  attributes?: Record<string, string>;
  scrapedAt: Date;
}

/**
 * Result from scraping a single page
 */
export interface PageScrapeResult {
  items: ScrapedItem[];
  hasNextPage: boolean;
  nextPageUrl?: string;
  errors: string[];
}

/**
 * Result from a complete scrape operation
 */
export interface ScrapeResult {
  sourceId: string;
  status: JobStatus;
  items: ScrapedItem[];
  itemsFound: number;
  errors: ScrapeError[];
  duration: number; // seconds
  startedAt: Date;
  completedAt: Date;
}

/**
 * Scrape error with context
 */
export interface ScrapeError {
  type: 'navigation' | 'selector' | 'timeout' | 'auth' | 'parse' | 'network' | 'unknown';
  message: string;
  url?: string;
  selector?: string;
  stack?: string;
}

/**
 * Sync operation result
 */
export interface SyncResult {
  sourceId: string;
  itemsFound: number;
  itemsNew: number;
  itemsUpdated: number;
  itemsRemoved: number;
  errors: SyncError[];
  duration: number;
}

/**
 * Sync error with context
 */
export interface SyncError {
  type: 'create' | 'update' | 'remove' | 'lookup';
  message: string;
  itemUrl?: string;
  productId?: string;
}

/**
 * Parser interface that all platform parsers must implement
 */
export interface Parser {
  /**
   * Parse a product list page and extract items
   */
  parseListPage(html: string, baseUrl: string): PageScrapeResult;

  /**
   * Parse a product detail page
   */
  parseDetailPage(html: string, url: string): ScrapedItem | null;

  /**
   * Get the URL pattern for product list pages
   */
  getListUrl(baseUrl: string, page?: number): string;

  /**
   * Check if this parser can handle the given URL
   */
  canHandle(url: string): boolean;
}

/**
 * Client source data with typed selectors and config
 */
export interface ClientSourceData {
  id: string;
  clientId: string;
  name: string;
  type: SourceType;
  url: string;
  isActive: boolean;
  scrapeFrequency: number;
  selectors: ScraperSelectors | null;
  config: ScraperConfig | null;
  lastScrapedAt: Date | null;
  lastItemCount: number;
  lastError: string | null;
}

/**
 * Options for running a scrape job
 */
export interface ScrapeJobOptions {
  maxPages?: number;
  fullRescrape?: boolean;
  dryRun?: boolean;
}

/**
 * Browser context for scraping
 */
export interface BrowserContext {
  goto(url: string, options?: { timeout?: number; waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' }): Promise<void>;
  content(): Promise<string>;
  evaluate<T>(fn: () => T): Promise<T>;
  waitForSelector(selector: string, options?: { timeout?: number }): Promise<void>;
  click(selector: string): Promise<void>;
  type(selector: string, text: string): Promise<void>;
  close(): Promise<void>;
}

/**
 * Comparison result for a single item
 */
export interface ItemComparison {
  scrapedItem: ScrapedItem;
  existingProduct: {
    id: string;
    sku: string;
    title: string;
    price: number | null;
    status: string;
    sourceUrl: string | null;
  } | null;
  action: 'create' | 'update' | 'none';
  changes?: {
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }[];
}
