/**
 * Web Scraper Module
 *
 * Provides robust scraping infrastructure with:
 * - BaseScraper class for building scrapers
 * - Automatic retry with exponential backoff
 * - Rate limiting
 * - Playwright browser for Cloudflare bypass
 * - Integrated caching
 * - Structured logging
 *
 * Usage:
 *   import { BaseScraper } from '@/lib/services/scraper';
 *
 *   class MyDataScraper extends BaseScraper {
 *     constructor() {
 *       super({
 *         name: 'my-data',
 *         baseUrl: 'https://example.com',
 *         useBrowser: true, // For Cloudflare-protected sites
 *       });
 *     }
 *
 *     async isAvailable(): Promise<boolean> {
 *       try {
 *         await this.fetch('/');
 *         return true;
 *       } catch {
 *         return false;
 *       }
 *     }
 *
 *     async scrapeItem(id: string) {
 *       const result = await this.fetch(`/item/${id}`);
 *       const $ = this.parseHtml(result.html);
 *       return {
 *         name: $('h1').text(),
 *         price: this.parsePrice($('.price').text()),
 *       };
 *     }
 *   }
 */

export { BaseScraper, type ScraperConfig, type FetchOptions, type FetchResult, type ScraperError } from './base';
