/**
 * PSA Card Price Guide Scraper
 *
 * https://www.psacard.com/priceguide
 *
 * Features:
 * - Uses BaseScraper for Cloudflare bypass via Playwright
 * - Automatic retry with exponential backoff
 * - Rate limiting to avoid bans
 * - Integrated Redis/memory caching
 *
 * Covers: Baseball, Basketball, Football, Hockey, Pokemon, etc.
 */

import { BaseScraper, type ScraperConfig } from '@/lib/services/scraper';

// ============================================================================
// TYPES
// ============================================================================

export interface PSACardPrice {
  id: string;
  name: string;
  year: string;
  set: string;
  sport: string;
  grades: Record<string, number>; // e.g., { '10': 5000, '9': 1000, '8': 500 }
  url: string;
  lastUpdated: string;
}

export interface PSASearchResult {
  cards: PSACardPrice[];
  total: number;
  cached: boolean;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const SCRAPER_CONFIG: ScraperConfig = {
  name: 'psa-cards',
  baseUrl: 'https://www.psacard.com',
  useBrowser: true, // Required for Cloudflare bypass
  rateLimit: {
    requestsPerMinute: 20,
    minDelayMs: 3000, // Be gentle with PSA
  },
  retry: {
    maxAttempts: 3,
    baseDelayMs: 2000,
    maxDelayMs: 30000,
  },
  cacheTtlSeconds: 60 * 60 * 24 * 7, // 7 days
};

// Sport categories
const SPORT_CATEGORIES: Record<string, string> = {
  baseball: '/priceguide/baseball-card-values',
  basketball: '/priceguide/basketball-card-values',
  football: '/priceguide/football-card-values',
  hockey: '/priceguide/hockey-card-values',
  pokemon: '/priceguide/non-sports-tcg-card-values',
};

// ============================================================================
// SCRAPER CLASS
// ============================================================================

class PSACardsScraper extends BaseScraper {
  constructor() {
    super(SCRAPER_CONFIG);
  }

  async isAvailable(): Promise<boolean> {
    try {
      const result = await this.fetch('/priceguide');
      return !result.html.includes('Just a moment') && result.html.includes('Price Guide');
    } catch {
      return false;
    }
  }

  /**
   * Search for cards by query
   */
  async search(query: string, sport?: string): Promise<PSASearchResult> {
    const searchUrl = `/priceguide/search?q=${encodeURIComponent(query)}`;

    try {
      const result = await this.fetch(searchUrl);
      const $ = this.parseHtml(result.html);
      const cards: PSACardPrice[] = [];

      // Parse search results
      $('.search-result, table tbody tr').each((_, row) => {
        const $row = $(row);
        const link = $row.find('a').first();
        const name = link.text().trim();
        const href = link.attr('href');

        if (name && href) {
          // Extract year from name if present
          const yearMatch = name.match(/\b(19|20)\d{2}\b/);

          cards.push({
            id: href.split('/').pop() || '',
            name,
            year: yearMatch ? yearMatch[0] : '',
            set: '',
            sport: sport || this.detectSport(name),
            grades: {},
            url: href.startsWith('http') ? href : `${this.config.baseUrl}${href}`,
            lastUpdated: new Date().toISOString(),
          });
        }
      });

      // Validate we got results (selector check)
      if (cards.length === 0 && !result.html.includes('No results')) {
        this.alert('Search returned no results - selectors may need updating', { query });
      }

      return {
        cards,
        total: cards.length,
        cached: result.fromCache,
      };
    } catch (error) {
      this.log.error({ error, query }, 'PSA search failed');
      return { cards: [], total: 0, cached: false };
    }
  }

  /**
   * Get detailed pricing for a specific card
   */
  async getCardPrices(cardUrl: string): Promise<PSACardPrice | null> {
    try {
      const result = await this.fetch(cardUrl);
      const $ = this.parseHtml(result.html);

      const name = $('h1').first().text().trim();
      const grades: Record<string, number> = {};

      // Parse price table
      $('table tr, .price-row').each((_, row) => {
        const $row = $(row);
        const gradeMatch = $row.text().match(/PSA\s*(\d+)/i);
        if (gradeMatch) {
          const grade = gradeMatch[1];
          const priceText = $row.find('.price, td:last-child').text();
          const price = this.parsePrice(priceText);
          if (price !== null && price > 0) grades[grade] = price;
        }
      });

      // Also try structured data attributes
      $('[data-grade]').each((_, el) => {
        const $el = $(el);
        const grade = $el.attr('data-grade');
        const price = this.parsePrice($el.attr('data-price') || $el.text());
        if (grade && price !== null && price > 0) grades[grade] = price;
      });

      // Validate we got grade data
      if (Object.keys(grades).length === 0) {
        this.log.warn({ cardUrl }, 'No grades found for card');
      }

      const id = cardUrl.split('/').pop() || '';

      return {
        id,
        name: name || id,
        year: this.extractYear(name) || '',
        set: '',
        sport: this.detectSport(name),
        grades,
        url: cardUrl,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      this.log.error({ error, cardUrl }, 'Failed to fetch card prices');
      return null;
    }
  }

  /**
   * Scrape a category set page for multiple cards
   */
  async scrapeSetPage(sport: string): Promise<PSACardPrice[]> {
    const categoryUrl = SPORT_CATEGORIES[sport.toLowerCase()];
    if (!categoryUrl) {
      this.log.warn({ sport }, 'Unknown sport category');
      return [];
    }

    try {
      const result = await this.fetch(categoryUrl);
      const $ = this.parseHtml(result.html);
      const cards: PSACardPrice[] = [];

      $('table tbody tr').each((_, row) => {
        const $row = $(row);
        const cells = $row.find('td');

        if (cells.length < 3) return;

        const nameCell = cells.eq(0);
        const name = nameCell.text().trim();
        const link = nameCell.find('a').attr('href');

        if (!name) return;

        const grades: Record<string, number> = {};
        const gradeColumns = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

        cells.each((i, cell) => {
          const price = this.parsePrice($(cell).text());
          if (price !== null && price > 0 && i > 0) {
            const gradeIndex = i - 1;
            if (gradeIndex < gradeColumns.length) {
              grades[gradeColumns[gradeIndex]] = price;
            }
          }
        });

        // Also extract grades from inline patterns
        const rowText = $row.text();
        const gradePattern = /PSA\s*(\d+)[:\s]*\$?([\d,]+)/gi;
        let match;
        while ((match = gradePattern.exec(rowText)) !== null) {
          const grade = match[1];
          const price = this.parsePrice(match[2]);
          if (price !== null && price > 0) grades[grade] = price;
        }

        if (name) {
          cards.push({
            id: link ? link.split('/').pop() || name : name.toLowerCase().replace(/\s+/g, '-'),
            name,
            year: this.extractYear(name) || '',
            set: '',
            sport,
            grades,
            url: link ? `${this.config.baseUrl}${link}` : categoryUrl,
            lastUpdated: new Date().toISOString(),
          });
        }
      });

      // Validate results
      this.validateResults(cards, 5, `${sport} category scrape`);

      return cards;
    } catch (error) {
      this.log.error({ error, sport }, 'Failed to scrape set page');
      return [];
    }
  }

  /**
   * Extract year from card name
   */
  private extractYear(text: string): string | null {
    const match = text.match(/\b(19|20)\d{2}\b/);
    return match ? match[0] : null;
  }

  /**
   * Detect sport from card name
   */
  private detectSport(name: string): string {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('pokemon') || lowerName.includes('pikachu') || lowerName.includes('charizard')) {
      return 'pokemon';
    }
    if (lowerName.includes('topps') || lowerName.includes('bowman') || lowerName.includes('baseball')) {
      return 'baseball';
    }
    if (lowerName.includes('prizm') || lowerName.includes('basketball') || lowerName.includes('nba')) {
      return 'basketball';
    }
    if (lowerName.includes('football') || lowerName.includes('nfl')) {
      return 'football';
    }
    if (lowerName.includes('hockey') || lowerName.includes('nhl')) {
      return 'hockey';
    }
    return 'unknown';
  }
}

// ============================================================================
// SINGLETON INSTANCE & EXPORTS
// ============================================================================

let _instance: PSACardsScraper | null = null;

function getInstance(): PSACardsScraper {
  if (!_instance) {
    _instance = new PSACardsScraper();
  }
  return _instance;
}

/**
 * Search PSA price guide
 */
export async function search(query: string, sport?: string): Promise<PSACardPrice[]> {
  const result = await getInstance().search(query, sport);
  return result.cards;
}

/**
 * Get detailed pricing for a specific card
 */
export async function getCardPrices(cardUrl: string): Promise<PSACardPrice | null> {
  return getInstance().getCardPrices(cardUrl);
}

/**
 * Scrape a sport category
 */
export async function scrapeSetPage(url: string, sport: string): Promise<PSACardPrice[]> {
  // For backwards compatibility, ignore the url parameter and use the sport
  return getInstance().scrapeSetPage(sport);
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

// Legacy exports for backwards compatibility
export function getCachedCards(): null {
  // Cache is now handled by BaseScraper's integrated caching
  return null;
}

export function searchCached(query: string): PSACardPrice[] {
  // Cache is now handled by BaseScraper - search will use cached results automatically
  return [];
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  console.log('PSA Price Guide Scraper (BaseScraper)');
  console.log('');

  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'search': {
      const query = args.slice(1).join(' ');
      if (!query) {
        console.log('Usage: npx tsx psa-cards.ts search <query>');
        return;
      }
      console.log(`Searching for "${query}"...`);
      const results = await search(query);
      console.log(`Found ${results.length} results:`);
      results.slice(0, 10).forEach((r) => {
        console.log(`  ${r.name}`);
        console.log(`    URL: ${r.url}`);
      });
      break;
    }

    case 'get': {
      const url = args[1];
      if (!url) {
        console.log('Usage: npx tsx psa-cards.ts get <url>');
        return;
      }
      console.log(`Fetching ${url}...`);
      const card = await getCardPrices(url);
      if (card) {
        console.log('Card:', card.name);
        console.log('Grades:');
        Object.entries(card.grades)
          .sort(([a], [b]) => parseInt(b) - parseInt(a))
          .forEach(([grade, price]) => {
            console.log(`  PSA ${grade}: $${price.toLocaleString()}`);
          });
      }
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
      console.log('  search <query>  - Search for cards');
      console.log('  get <url>       - Get card prices');
      console.log('  status          - Show scraper status');
      break;
    }
  }

  // Cleanup browser
  await BaseScraper.cleanup();
}

if (process.argv[1]?.includes('psa-cards')) {
  main().catch(console.error);
}
