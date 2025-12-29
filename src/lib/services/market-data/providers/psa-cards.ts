/**
 * PSA Card Price Guide Scraper
 *
 * https://www.psacard.com/priceguide
 *
 * Free public data covering:
 * - Baseball, Basketball, Football, Hockey
 * - Golf, Racing, Boxing
 * - Non-sports (Pokemon, etc.)
 *
 * Prices are based on PSA-certified graded cards only.
 *
 * NOTE: PSA uses Cloudflare protection. This scraper uses Playwright
 * to bypass the JavaScript challenge.
 */

import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

// Optional: Playwright for Cloudflare bypass
let chromium: typeof import('playwright').chromium | undefined;

async function initPlaywright() {
  try {
    const playwright = await import('playwright');
    chromium = playwright.chromium;
    return true;
  } catch {
    // Playwright not available
    return false;
  }
}

const BROWSER_DATA_PATH = path.join(process.cwd(), 'data', 'psa-browser-data');

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

export interface PSACache {
  version: string;
  lastFetched: string;
  ttlDays: number;
  cards: Record<string, PSACardPrice>;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const BASE_URL = 'https://www.psacard.com';
const CACHE_TTL_DAYS = 7;
const CACHE_FILE = path.join(process.cwd(), 'data', 'psa-cache.json');

// Popular sports card sets to scrape
const SPORT_CATEGORIES: Record<string, string> = {
  baseball: '/priceguide/baseball-card-values',
  basketball: '/priceguide/basketball-card-values',
  football: '/priceguide/football-card-values',
  hockey: '/priceguide/hockey-card-values',
  pokemon: '/priceguide/non-sports-tcg-card-values',
};

// ============================================================================
// CACHE
// ============================================================================

function loadCache(): PSACache | null {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    }
  } catch { /* ignore */ }
  return null;
}

function saveCache(cache: PSACache): void {
  const dir = path.dirname(CACHE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

function isCacheValid(cache: PSACache): boolean {
  const age = (Date.now() - new Date(cache.lastFetched).getTime()) / (1000 * 60 * 60 * 24);
  return age < cache.ttlDays;
}

// ============================================================================
// SCRAPING
// ============================================================================

/**
 * Fetch page using Playwright to bypass Cloudflare
 */
async function fetchWithPlaywright(url: string): Promise<string | null> {
  if (!chromium) {
    const available = await initPlaywright();
    if (!available) {
      console.log('Playwright not available. Install with: npm install playwright');
      return null;
    }
  }

  try {
    // Use persistent context to maintain any session state
    const context = await chromium!.launchPersistentContext(BROWSER_DATA_PATH, {
      headless: true,
      viewport: { width: 1280, height: 720 },
    });

    const page = await context.newPage();

    // Navigate and wait for Cloudflare challenge to complete
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    // Wait a bit for any JS to finish
    await page.waitForTimeout(2000);

    // Check if we're still on a challenge page
    const title = await page.title();
    if (title.includes('moment') || title.includes('Checking')) {
      // Still on Cloudflare challenge, wait longer
      await page.waitForTimeout(5000);
    }

    const html = await page.content();
    await context.close();

    return html;
  } catch (error) {
    console.error('Playwright fetch error:', error instanceof Error ? error.message : error);
    return null;
  }
}

async function fetchPage(url: string): Promise<string> {
  // Try Playwright first (handles Cloudflare)
  const playwrightHtml = await fetchWithPlaywright(url);
  if (playwrightHtml && !playwrightHtml.includes('Just a moment')) {
    return playwrightHtml;
  }

  // Fallback to regular fetch (may fail with Cloudflare)
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0',
      'Accept': 'text/html,application/xhtml+xml',
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

function parsePrice(text: string): number {
  if (!text || text === '-' || text === 'N/A') return 0;
  const cleaned = text.replace(/[^0-9.]/g, '');
  return parseFloat(cleaned) || 0;
}

export async function scrapeSetPage(url: string, sport: string): Promise<PSACardPrice[]> {
  try {
    const html = await fetchPage(url);
    const $ = cheerio.load(html);
    const cards: PSACardPrice[] = [];

    // PSA price guide table structure
    $('table tbody tr').each((_, row) => {
      const $row = $(row);
      const cells = $row.find('td');
      
      if (cells.length < 3) return;

      // Extract card info - structure varies but typically:
      // Card name | Year | Set | Grade prices...
      const nameCell = cells.eq(0);
      const name = nameCell.text().trim();
      const link = nameCell.find('a').attr('href');
      
      if (!name) return;

      // Try to extract year from the set/name
      const yearMatch = name.match(/\b(19|20)\d{2}\b/);
      const year = yearMatch ? yearMatch[0] : '';

      // Extract grade prices - look for columns with numeric values
      const grades: Record<string, number> = {};
      
      // Common PSA grades to look for
      const gradeColumns = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
      
      cells.each((i, cell) => {
        const text = $(cell).text().trim();
        const price = parsePrice(text);
        
        // Check if this might be a grade column (has $ or numeric value)
        if (price > 0 && i > 0) {
          // Try to determine grade from header or position
          const gradeIndex = i - 1; // Offset for name column
          if (gradeIndex < gradeColumns.length) {
            grades[gradeColumns[gradeIndex]] = price;
          }
        }
      });

      // Also check for specific grade patterns in the text
      const gradePattern = /PSA\s*(\d+)[:\s]*\$?([\d,]+)/gi;
      let match;
      const rowText = $row.text();
      while ((match = gradePattern.exec(rowText)) !== null) {
        const grade = match[1];
        const price = parsePrice(match[2]);
        if (price > 0) grades[grade] = price;
      }

      if (Object.keys(grades).length > 0 || name) {
        cards.push({
          id: link ? link.split('/').pop() || name : name.toLowerCase().replace(/\s+/g, '-'),
          name,
          year,
          set: '', // Would need to parse from page context
          sport,
          grades,
          url: link ? `${BASE_URL}${link}` : url,
          lastUpdated: new Date().toISOString(),
        });
      }
    });

    return cards;
  } catch (error) {
    console.error(`Error scraping ${url}:`, error);
    return [];
  }
}

/**
 * Search PSA price guide
 */
export async function search(query: string, sport?: string): Promise<PSACardPrice[]> {
  // PSA has a search endpoint
  const searchUrl = `${BASE_URL}/priceguide/search?q=${encodeURIComponent(query)}`;
  
  try {
    const html = await fetchPage(searchUrl);
    const $ = cheerio.load(html);
    const results: PSACardPrice[] = [];

    // Parse search results
    $('.search-result, table tbody tr').each((_, row) => {
      const $row = $(row);
      const link = $row.find('a').first();
      const name = link.text().trim();
      const href = link.attr('href');

      if (name && href) {
        results.push({
          id: href.split('/').pop() || '',
          name,
          year: '',
          set: '',
          sport: sport || 'unknown',
          grades: {},
          url: href.startsWith('http') ? href : `${BASE_URL}${href}`,
          lastUpdated: new Date().toISOString(),
        });
      }
    });

    return results;
  } catch (error) {
    console.error('PSA search error:', error);
    return [];
  }
}

/**
 * Get detailed pricing for a specific card
 */
export async function getCardPrices(cardUrl: string): Promise<PSACardPrice | null> {
  const cache = loadCache();
  const id = cardUrl.split('/').pop() || '';

  // Check cache
  if (cache?.cards[id] && isCacheValid(cache)) {
    return cache.cards[id];
  }

  try {
    const html = await fetchPage(cardUrl);
    const $ = cheerio.load(html);

    const name = $('h1').first().text().trim();
    const grades: Record<string, number> = {};

    // Parse price table
    $('table tr, .price-row').each((_, row) => {
      const $row = $(row);
      const gradeMatch = $row.text().match(/PSA\s*(\d+)/i);
      if (gradeMatch) {
        const grade = gradeMatch[1];
        const priceText = $row.find('.price, td:last-child').text();
        const price = parsePrice(priceText);
        if (price > 0) grades[grade] = price;
      }
    });

    // Also try structured data
    $('[data-grade]').each((_, el) => {
      const $el = $(el);
      const grade = $el.attr('data-grade');
      const price = parsePrice($el.attr('data-price') || $el.text());
      if (grade && price > 0) grades[grade] = price;
    });

    const card: PSACardPrice = {
      id,
      name: name || id,
      year: '',
      set: '',
      sport: 'unknown',
      grades,
      url: cardUrl,
      lastUpdated: new Date().toISOString(),
    };

    // Update cache
    const newCache = cache || { version: '1.0', lastFetched: new Date().toISOString(), ttlDays: CACHE_TTL_DAYS, cards: {} };
    newCache.cards[id] = card;
    newCache.lastFetched = new Date().toISOString();
    saveCache(newCache);

    return card;
  } catch (error) {
    console.error(`Error fetching ${cardUrl}:`, error);
    return null;
  }
}

/**
 * Get cached data
 */
export function getCachedCards(): PSACache | null {
  return loadCache();
}

/**
 * Search cached cards
 */
export function searchCached(query: string): PSACardPrice[] {
  const cache = loadCache();
  if (!cache) return [];

  const lowerQuery = query.toLowerCase();
  return Object.values(cache.cards).filter(
    card => card.name.toLowerCase().includes(lowerQuery) ||
            card.set.toLowerCase().includes(lowerQuery)
  );
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  console.log('PSA Price Guide Scraper');
  console.log('');

  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'search':
      const query = args.slice(1).join(' ');
      if (!query) {
        console.log('Usage: npx tsx psa-cards.ts search <query>');
        return;
      }
      console.log(`Searching for "${query}"...`);
      const results = await search(query);
      console.log(`Found ${results.length} results:`);
      results.slice(0, 10).forEach(r => {
        console.log(`  ${r.name}`);
        console.log(`    URL: ${r.url}`);
      });
      break;

    case 'get':
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

    case 'status':
    default:
      const cache = loadCache();
      console.log('Cache Status:');
      if (cache) {
        console.log(`  Cards cached: ${Object.keys(cache.cards).length}`);
        console.log(`  Last fetched: ${cache.lastFetched}`);
        console.log(`  Valid: ${isCacheValid(cache) ? 'Yes' : 'No'}`);
      } else {
        console.log('  No cache found');
      }
      console.log('');
      console.log('Commands:');
      console.log('  search <query>  - Search for cards');
      console.log('  get <url>       - Get card prices');
      console.log('  status          - Show cache status');
      break;
  }
}

if (process.argv[1]?.includes('psa-cards')) {
  main().catch(console.error);
}
