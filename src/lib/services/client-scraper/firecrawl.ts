/**
 * Firecrawl integration for client site scraping
 * Handles JS-rendered sites, anti-bot, structured output
 */

import FirecrawlApp from '@mendable/firecrawl-js';
import type { ScrapedItem } from './types';

let firecrawlClientInstance: FirecrawlApp | null = null;

/**
 * Get or create Firecrawl client with validation
 */
function getFirecrawlClient(): FirecrawlApp {
  if (firecrawlClientInstance) {
    return firecrawlClientInstance;
  }

  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Missing FIRECRAWL_API_KEY environment variable. ' +
        'Please set this before using Firecrawl scraping.'
    );
  }

  firecrawlClientInstance = new FirecrawlApp({ apiKey });
  return firecrawlClientInstance;
}

/**
 * Check if Firecrawl is available (has API key)
 */
export function isFirecrawlAvailable(): boolean {
  return !!process.env.FIRECRAWL_API_KEY;
}

export interface FirecrawlScrapeOptions {
  formats?: ('markdown' | 'html' | 'links')[];
  onlyMainContent?: boolean;
  waitFor?: number;
  timeout?: number;
}

export interface FirecrawlScrapeResult {
  success: boolean;
  url: string;
  title?: string;
  content?: string;
  html?: string;
  links?: string[];
  metadata?: Record<string, unknown>;
  error?: string;
}

/**
 * Scrape a single page with Firecrawl
 */
export async function scrapeWithFirecrawl(
  url: string,
  options: FirecrawlScrapeOptions = {}
): Promise<FirecrawlScrapeResult> {
  try {
    const client = getFirecrawlClient();

    const response = await client.scrapeUrl(url, {
      formats: options.formats || ['markdown', 'links'],
      onlyMainContent: options.onlyMainContent ?? true,
      waitFor: options.waitFor,
      timeout: options.timeout || 30000,
    });

    if (!response.success) {
      return {
        success: false,
        url,
        error: response.error || 'Scrape failed',
      };
    }

    return {
      success: true,
      url,
      title: response.metadata?.title as string | undefined,
      content: response.markdown,
      html: response.html,
      links: response.links,
      metadata: response.metadata,
    };
  } catch (error) {
    console.error('Firecrawl scrape error:', error);
    return {
      success: false,
      url,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export interface FirecrawlCrawlOptions {
  maxDepth?: number;
  limit?: number;
  includePaths?: string[];
  excludePaths?: string[];
  allowBackwardLinks?: boolean;
}

export interface FirecrawlCrawlResult {
  success: boolean;
  pages: FirecrawlScrapeResult[];
  totalCrawled: number;
  error?: string;
}

/**
 * Crawl an entire site with Firecrawl
 */
export async function crawlClientSite(
  baseUrl: string,
  options: FirecrawlCrawlOptions = {}
): Promise<FirecrawlCrawlResult> {
  try {
    const client = getFirecrawlClient();

    const response = await client.crawlUrl(baseUrl, {
      maxDepth: options.maxDepth ?? 2,
      limit: options.limit ?? 50,
      includePaths: options.includePaths,
      excludePaths: options.excludePaths || [
        '/cart', '/checkout', '/account', '/login', '/admin',
      ],
      allowBackwardLinks: options.allowBackwardLinks ?? false,
    });

    if (!response.success) {
      return {
        success: false,
        pages: [],
        totalCrawled: 0,
        error: response.error || 'Crawl failed',
      };
    }

    const pages: FirecrawlScrapeResult[] = (response.data || []).map((page: any) => ({
      success: true,
      url: page.url || page.sourceURL,
      title: page.metadata?.title,
      content: page.markdown,
      html: page.html,
      links: page.links,
      metadata: page.metadata,
    }));

    return {
      success: true,
      pages,
      totalCrawled: pages.length,
    };
  } catch (error) {
    console.error('Firecrawl crawl error:', error);
    return {
      success: false,
      pages: [],
      totalCrawled: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Extract product items from Firecrawl scraped content
 * Uses AI or patterns to identify products on the page
 */
export async function extractProductsFromPage(
  scrapeResult: FirecrawlScrapeResult
): Promise<ScrapedItem[]> {
  if (!scrapeResult.success || !scrapeResult.content) {
    return [];
  }

  // For now, return empty - integrate with ProductIntelligence later
  // to parse markdown/html and extract product data
  // TODO: Use Claude to extract structured product data from content
  
  return [];
}
