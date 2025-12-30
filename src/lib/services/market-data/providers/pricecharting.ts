/**
 * PriceCharting.com Scraper
 *
 * Free multi-category price guide covering:
 * - Pokemon cards
 * - Sports cards
 * - Comic books
 * - Video games
 * - Funko Pops
 *
 * Uses eBay sold data for pricing.
 *
 * Features:
 * - Uses BaseScraper for retry and rate limiting
 * - Integrated Redis/memory caching
 * - Structured logging
 */

import { BaseScraper, type ScraperConfig } from '@/lib/services/scraper';

// ============================================================================
// TYPES
// ============================================================================

export type PriceChartingCategory = 'pokemon' | 'sports' | 'comics' | 'games' | 'funko';

export interface PriceChartingItem {
  id: string;
  name: string;
  category: PriceChartingCategory;
  prices: {
    ungraded?: number;
    graded?: Record<string, number>; // e.g., { 'PSA 10': 500, 'PSA 9': 200 }
  };
  url: string;
  lastUpdated: string;
}

export interface PriceChartingSearchResult {
  items: PriceChartingItem[];
  total: number;
  cached: boolean;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const SCRAPER_CONFIG: ScraperConfig = {
  name: 'pricecharting',
  baseUrl: 'https://www.pricecharting.com',
  useBrowser: false, // No Cloudflare protection
  rateLimit: {
    requestsPerMinute: 30,
    minDelayMs: 2000,
  },
  retry: {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 15000,
  },
  cacheTtlSeconds: 60 * 60 * 24 * 7, // 7 days
};

const CATEGORY_URLS: Record<PriceChartingCategory, string> = {
  pokemon: '/category/pokemon-cards',
  sports: '/category/sports-trading-card-singles',
  comics: '/category/comic-books',
  games: '/category/video-games',
  funko: '/category/funko',
};

// ============================================================================
// SCRAPER CLASS
// ============================================================================

class PriceChartingScraper extends BaseScraper {
  constructor() {
    super(SCRAPER_CONFIG);
  }

  async isAvailable(): Promise<boolean> {
    try {
      const result = await this.fetch('/');
      return result.html.includes('pricecharting');
    } catch {
      return false;
    }
  }

  /**
   * Search for items across categories
   */
  async search(query: string, category?: PriceChartingCategory): Promise<PriceChartingSearchResult> {
    const typeParam = category || '';
    const searchUrl = `/search-products?q=${encodeURIComponent(query)}${typeParam ? `&type=${typeParam}` : ''}`;

    try {
      const result = await this.fetch(searchUrl);
      const $ = this.parseHtml(result.html);
      const items: PriceChartingItem[] = [];

      // Parse search results
      $('.search-result, table tbody tr, .product').each((_, row) => {
        const $row = $(row);
        const link = $row.find('a').first();
        const name = link.text().trim() || $row.find('.title').text().trim();
        const href = link.attr('href');

        if (name && href) {
          // Try to extract price from the row
          const priceText = $row.find('.price, .used-price, td.price').text();
          const price = this.parsePrice(priceText);

          items.push({
            id: href.split('/').pop() || '',
            name,
            category: category || this.detectCategory(name, href),
            prices: price !== null && price > 0 ? { ungraded: price } : {},
            url: href.startsWith('http') ? href : `${this.config.baseUrl}${href}`,
            lastUpdated: new Date().toISOString(),
          });
        }
      });

      // Validate results
      if (items.length === 0 && !result.html.includes('No results')) {
        this.alert('Search returned no results - selectors may need updating', { query });
      }

      return {
        items,
        total: items.length,
        cached: result.fromCache,
      };
    } catch (error) {
      this.log.error({ error, query }, 'PriceCharting search failed');
      return { items: [], total: 0, cached: false };
    }
  }

  /**
   * Get detailed pricing for a specific item
   */
  async getItemPrices(itemUrl: string, category: PriceChartingCategory): Promise<PriceChartingItem | null> {
    try {
      const result = await this.fetch(itemUrl);
      const $ = this.parseHtml(result.html);

      const name = $('h1').first().text().trim();
      const id = itemUrl.split('/').pop() || '';
      const prices: PriceChartingItem['prices'] = {};

      // Extract ungraded price (usually labeled "Ungraded" or "Loose")
      const ungradedRow = $('tr:contains("Ungraded"), tr:contains("Loose")').first();
      if (ungradedRow.length) {
        const price = this.parsePrice(ungradedRow.find('td.price, .price').text());
        if (price !== null && price > 0) {
          prices.ungraded = price;
        }
      }

      // Extract graded prices (PSA, CGC, etc.)
      const graded: Record<string, number> = {};
      $('tr').each((_, row) => {
        const label = $(row).find('td').first().text().trim();
        const priceMatch = label.match(/(PSA|CGC|BGS|SGC)\s*(\d+)/i);
        if (priceMatch) {
          const grade = `${priceMatch[1].toUpperCase()} ${priceMatch[2]}`;
          const price = this.parsePrice($(row).find('td.price, .price').text());
          if (price !== null && price > 0) graded[grade] = price;
        }
      });

      if (Object.keys(graded).length > 0) {
        prices.graded = graded;
      }

      // Also try to extract from structured data
      $('[data-price]').each((_, el) => {
        const $el = $(el);
        const type = $el.attr('data-type');
        const price = this.parsePrice($el.attr('data-price') || $el.text());
        if (type && price !== null && price > 0) {
          if (type === 'ungraded' || type === 'loose') {
            prices.ungraded = price;
          } else {
            prices.graded = prices.graded || {};
            prices.graded[type] = price;
          }
        }
      });

      return {
        id,
        name: name || id,
        category,
        prices,
        url: itemUrl,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      this.log.error({ error, itemUrl }, 'Failed to fetch item prices');
      return null;
    }
  }

  /**
   * Browse a category
   */
  async browseCategory(category: PriceChartingCategory): Promise<PriceChartingItem[]> {
    const categoryUrl = CATEGORY_URLS[category];
    if (!categoryUrl) {
      this.log.warn({ category }, 'Unknown category');
      return [];
    }

    try {
      const result = await this.fetch(categoryUrl);
      const $ = this.parseHtml(result.html);
      const items: PriceChartingItem[] = [];

      $('table tbody tr, .product').each((_, row) => {
        const $row = $(row);
        const link = $row.find('a').first();
        const name = link.text().trim();
        const href = link.attr('href');

        if (name && href) {
          const priceText = $row.find('.price, td:last-child').text();
          const price = this.parsePrice(priceText);

          items.push({
            id: href.split('/').pop() || '',
            name,
            category,
            prices: price !== null && price > 0 ? { ungraded: price } : {},
            url: href.startsWith('http') ? href : `${this.config.baseUrl}${href}`,
            lastUpdated: new Date().toISOString(),
          });
        }
      });

      this.validateResults(items, 10, `${category} category browse`);
      return items;
    } catch (error) {
      this.log.error({ error, category }, 'Failed to browse category');
      return [];
    }
  }

  /**
   * Detect category from item name or URL
   */
  private detectCategory(name: string, url: string): PriceChartingCategory {
    const combined = `${name} ${url}`.toLowerCase();

    if (combined.includes('pokemon') || combined.includes('pikachu') || combined.includes('charizard')) {
      return 'pokemon';
    }
    if (combined.includes('funko') || combined.includes('pop!')) {
      return 'funko';
    }
    if (combined.includes('comic') || combined.includes('marvel') || combined.includes('dc comics')) {
      return 'comics';
    }
    if (combined.includes('topps') || combined.includes('panini') || combined.includes('card')) {
      return 'sports';
    }
    return 'games';
  }
}

// ============================================================================
// SINGLETON INSTANCE & EXPORTS
// ============================================================================

let _instance: PriceChartingScraper | null = null;

function getInstance(): PriceChartingScraper {
  if (!_instance) {
    _instance = new PriceChartingScraper();
  }
  return _instance;
}

/**
 * Search PriceCharting
 */
export async function searchCategory(
  category: keyof typeof CATEGORY_URLS,
  query: string
): Promise<PriceChartingItem[]> {
  const result = await getInstance().search(query, category);
  return result.items;
}

/**
 * Search PriceCharting (legacy export for backwards compatibility)
 */
export async function search(
  query: string,
  category?: PriceChartingCategory
): Promise<PriceChartingItem[]> {
  const result = await getInstance().search(query, category);
  return result.items;
}

/**
 * Scrape a specific item page
 */
export async function scrapeItem(
  url: string,
  category: PriceChartingCategory
): Promise<PriceChartingItem | null> {
  return getInstance().getItemPrices(url, category);
}

/**
 * Get item prices (legacy export for backwards compatibility)
 */
export async function getItem(url: string): Promise<PriceChartingItem | null> {
  // Detect category from URL
  const category = url.includes('pokemon') ? 'pokemon' :
                   url.includes('funko') ? 'funko' :
                   url.includes('comic') ? 'comics' :
                   url.includes('card') ? 'sports' : 'games';
  return getInstance().getItemPrices(url, category);
}

/**
 * Browse a category
 */
export async function browseCategory(category: PriceChartingCategory): Promise<PriceChartingItem[]> {
  return getInstance().browseCategory(category);
}

/**
 * Check if scraper is available
 */
export async function isAvailable(): Promise<boolean> {
  return getInstance().isAvailable();
}

/**
 * Get scraper status
 */
export function getStatus() {
  return getInstance().getStatus();
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  console.log('PriceCharting Scraper (BaseScraper)');
  console.log('');

  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'search': {
      const category = args[1] as PriceChartingCategory;
      const query = args.slice(2).join(' ');
      if (!query) {
        console.log('Usage: npx tsx pricecharting.ts search <category> <query>');
        console.log('Categories: pokemon, sports, comics, games, funko');
        return;
      }
      console.log(`Searching ${category} for "${query}"...`);
      const results = await searchCategory(category, query);
      console.log(`Found ${results.length} results:`);
      results.slice(0, 10).forEach((item) => {
        console.log(`  ${item.name}`);
        if (item.prices.ungraded) {
          console.log(`    Price: $${item.prices.ungraded}`);
        }
      });
      break;
    }

    case 'browse': {
      const category = args[1] as PriceChartingCategory;
      if (!category || !CATEGORY_URLS[category]) {
        console.log('Usage: npx tsx pricecharting.ts browse <category>');
        console.log('Categories: pokemon, sports, comics, games, funko');
        return;
      }
      console.log(`Browsing ${category}...`);
      const items = await browseCategory(category);
      console.log(`Found ${items.length} items:`);
      items.slice(0, 10).forEach((item) => {
        console.log(`  ${item.name}`);
      });
      break;
    }

    case 'status':
    default: {
      const status = getStatus();
      const available = await isAvailable();
      console.log('Scraper Status:');
      console.log(`  Name: ${status.name}`);
      console.log(`  Base URL: ${status.baseUrl}`);
      console.log(`  Uses Browser: ${status.useBrowser}`);
      console.log(`  Available: ${available}`);
      console.log('');
      console.log('Commands:');
      console.log('  search <category> <query>  - Search for items');
      console.log('  browse <category>          - Browse a category');
      console.log('  status                     - Show scraper status');
      break;
    }
  }
}

if (process.argv[1]?.includes('pricecharting')) {
  main().catch(console.error);
}
