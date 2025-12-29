/**
 * Greysheet Price Data Service
 * 
 * Scrapes coin pricing data from greysheet.com
 * Requires active subscription - uses Playwright with existing browser session
 * 
 * Usage:
 *   npx tsx src/lib/services/market-data/greysheet.ts
 * 
 * NOTE: Greysheet requires authentication. Two options:
 * 1. Use Playwright with persistent browser context (saves login session)
 * 2. Set GREYSHEET_COOKIES environment variable with session cookies
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Optional: Playwright for authenticated scraping
let chromium: typeof import('playwright').chromium | undefined;

async function initPlaywright() {
  try {
    const playwright = await import('playwright');
    chromium = playwright.chromium;
  } catch {
    // Playwright not available - will use fetch with cookies
  }
}

// ============================================================================
// TYPES
// ============================================================================

export interface GreysheetPrice {
  slug: string;
  name: string;
  series: string;
  grades: Record<string, { bid: number; ask: number }>;
  lastUpdated: string;
}

export interface GreysheetCache {
  version: string;
  lastFetched: string;
  ttlDays: number;
  prices: Record<string, GreysheetPrice>;
}

interface GradePrice {
  bid: number;
  ask: number;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const GREYSHEET_BASE_URL = 'https://www.greysheet.com';
const CACHE_TTL_DAYS = 7;
const CACHE_FILE_PATH = path.join(process.cwd(), 'data', 'greysheet-cache.json');
const BROWSER_DATA_PATH = path.join(process.cwd(), 'data', 'greysheet-browser-data');

// Session cookies from environment (export from browser after login)
const SESSION_COOKIES = process.env.GREYSHEET_COOKIES || '';

// Target coin series for scraping
const TARGET_SERIES: Record<string, string[]> = {
  'morgan-dollars': [
    '1878-8tf-1-ms', '1878-7tf-1-ms', '1878-s-1-ms', '1878-cc-1-ms',
    '1879-1-ms', '1879-s-1-ms', '1879-o-1-ms', '1879-cc-1-ms',
    '1880-1-ms', '1880-s-1-ms', '1880-o-1-ms', '1880-cc-1-ms',
    '1881-1-ms', '1881-s-1-ms', '1881-o-1-ms', '1881-cc-1-ms',
    '1882-1-ms', '1882-s-1-ms', '1882-o-1-ms', '1882-cc-1-ms',
    '1883-1-ms', '1883-s-1-ms', '1883-o-1-ms', '1883-cc-1-ms',
    '1884-1-ms', '1884-s-1-ms', '1884-o-1-ms', '1884-cc-1-ms',
    '1885-1-ms', '1885-s-1-ms', '1885-o-1-ms', '1885-cc-1-ms',
    '1886-1-ms', '1886-s-1-ms', '1886-o-1-ms',
    '1887-1-ms', '1887-s-1-ms', '1887-o-1-ms',
    '1888-1-ms', '1888-s-1-ms', '1888-o-1-ms',
    '1889-1-ms', '1889-s-1-ms', '1889-o-1-ms', '1889-cc-1-ms',
    '1890-1-ms', '1890-s-1-ms', '1890-o-1-ms', '1890-cc-1-ms',
    '1891-1-ms', '1891-s-1-ms', '1891-o-1-ms', '1891-cc-1-ms',
    '1892-1-ms', '1892-s-1-ms', '1892-o-1-ms', '1892-cc-1-ms',
    '1893-1-ms', '1893-s-1-ms', '1893-o-1-ms', '1893-cc-1-ms',
    '1894-1-ms', '1894-s-1-ms', '1894-o-1-ms',
    '1895-s-1-ms', '1895-o-1-ms',
    '1896-1-ms', '1896-s-1-ms', '1896-o-1-ms',
    '1897-1-ms', '1897-s-1-ms', '1897-o-1-ms',
    '1898-1-ms', '1898-s-1-ms', '1898-o-1-ms',
    '1899-1-ms', '1899-s-1-ms', '1899-o-1-ms',
    '1900-1-ms', '1900-s-1-ms', '1900-o-1-ms',
    '1901-1-ms', '1901-s-1-ms', '1901-o-1-ms',
    '1902-1-ms', '1902-s-1-ms', '1902-o-1-ms',
    '1903-1-ms', '1903-s-1-ms', '1903-o-1-ms',
    '1904-1-ms', '1904-s-1-ms', '1904-o-1-ms',
    '1921-1-ms', '1921-d-1-ms', '1921-s-1-ms',
  ],
  'peace-dollars': [
    '1921-1-peace-ms', '1922-1-ms', '1922-d-1-ms', '1922-s-1-ms',
    '1923-1-ms', '1923-d-1-ms', '1923-s-1-ms',
    '1924-1-ms', '1924-s-1-ms',
    '1925-1-ms', '1925-s-1-ms',
    '1926-1-ms', '1926-d-1-ms', '1926-s-1-ms',
    '1927-1-ms', '1927-d-1-ms', '1927-s-1-ms',
    '1928-1-ms', '1928-s-1-ms',
    '1934-1-ms', '1934-d-1-ms', '1934-s-1-ms',
    '1935-1-ms', '1935-s-1-ms',
  ],
  'silver-eagles': [
    '2024-1-silver-eagle-ms', '2023-1-silver-eagle-ms', '2022-1-silver-eagle-ms',
    '2021-1-silver-eagle-ms', '2020-1-silver-eagle-ms', '2019-1-silver-eagle-ms',
    '2018-1-silver-eagle-ms', '2017-1-silver-eagle-ms', '2016-1-silver-eagle-ms',
    '2015-1-silver-eagle-ms', '2014-1-silver-eagle-ms', '2013-1-silver-eagle-ms',
    '2012-1-silver-eagle-ms', '2011-1-silver-eagle-ms', '2010-1-silver-eagle-ms',
    '1986-1-silver-eagle-ms', '1987-1-silver-eagle-ms', '1988-1-silver-eagle-ms',
    '1989-1-silver-eagle-ms', '1990-1-silver-eagle-ms', '1991-1-silver-eagle-ms',
    '1992-1-silver-eagle-ms', '1993-1-silver-eagle-ms', '1994-1-silver-eagle-ms',
    '1995-1-silver-eagle-ms', '1996-1-silver-eagle-ms', '1997-1-silver-eagle-ms',
    '1998-1-silver-eagle-ms', '1999-1-silver-eagle-ms', '2000-1-silver-eagle-ms',
  ],
  'gold-eagles': [
    '2024-50-gold-eagle-ms', '2023-50-gold-eagle-ms', '2022-50-gold-eagle-ms',
    '2021-50-gold-eagle-ms', '2020-50-gold-eagle-ms', '2019-50-gold-eagle-ms',
    '2024-25-gold-eagle-ms', '2023-25-gold-eagle-ms',
    '2024-10-gold-eagle-ms', '2023-10-gold-eagle-ms',
    '2024-5-gold-eagle-ms', '2023-5-gold-eagle-ms',
  ],
  'walking-liberty-halves': [
    '1916-50c-ms', '1916-d-50c-ms', '1916-s-50c-ms',
    '1917-50c-ms', '1917-d-50c-obv-ms', '1917-d-50c-rev-ms', '1917-s-50c-obv-ms', '1917-s-50c-rev-ms',
    '1918-50c-ms', '1918-d-50c-ms', '1918-s-50c-ms',
    '1919-50c-ms', '1919-d-50c-ms', '1919-s-50c-ms',
    '1920-50c-ms', '1920-d-50c-ms', '1920-s-50c-ms',
    '1921-50c-ms', '1921-d-50c-ms', '1921-s-50c-ms',
    '1927-s-50c-ms', '1928-s-50c-ms', '1929-50c-ms', '1929-d-50c-ms', '1929-s-50c-ms',
    '1933-s-50c-ms', '1934-50c-ms', '1934-d-50c-ms', '1934-s-50c-ms',
    '1935-50c-ms', '1935-d-50c-ms', '1935-s-50c-ms',
    '1936-50c-ms', '1936-d-50c-ms', '1936-s-50c-ms',
    '1937-50c-ms', '1937-d-50c-ms', '1937-s-50c-ms',
    '1938-50c-ms', '1938-d-50c-ms',
    '1939-50c-ms', '1939-d-50c-ms', '1939-s-50c-ms',
    '1940-50c-ms', '1940-s-50c-ms',
    '1941-50c-ms', '1941-d-50c-ms', '1941-s-50c-ms',
    '1942-50c-ms', '1942-d-50c-ms', '1942-s-50c-ms',
    '1943-50c-ms', '1943-d-50c-ms', '1943-s-50c-ms',
    '1944-50c-ms', '1944-d-50c-ms', '1944-s-50c-ms',
    '1945-50c-ms', '1945-d-50c-ms', '1945-s-50c-ms',
    '1946-50c-ms', '1946-d-50c-ms', '1946-s-50c-ms',
    '1947-50c-ms', '1947-d-50c-ms',
  ],
};

// Standard coin grades to look for
const STANDARD_GRADES = [
  'VG8', 'F12', 'VF20', 'VF25', 'VF30', 'VF35',
  'EF40', 'EF45', 'AU50', 'AU53', 'AU55', 'AU58',
  'MS60', 'MS61', 'MS62', 'MS63', 'MS64', 'MS65', 'MS66', 'MS67', 'MS68', 'MS69', 'MS70',
];

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================

function loadCache(): GreysheetCache | null {
  try {
    if (fs.existsSync(CACHE_FILE_PATH)) {
      const data = fs.readFileSync(CACHE_FILE_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading cache:', error);
  }
  return null;
}

function saveCache(cache: GreysheetCache): void {
  try {
    const dir = path.dirname(CACHE_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(cache, null, 2));
  } catch (error) {
    console.error('Error saving cache:', error);
  }
}

function isCacheValid(cache: GreysheetCache): boolean {
  const lastFetched = new Date(cache.lastFetched);
  const now = new Date();
  const daysSinceLastFetch = (now.getTime() - lastFetched.getTime()) / (1000 * 60 * 60 * 24);
  return daysSinceLastFetch < cache.ttlDays;
}

function createEmptyCache(): GreysheetCache {
  return {
    version: '1.0',
    lastFetched: new Date().toISOString(),
    ttlDays: CACHE_TTL_DAYS,
    prices: {},
  };
}

// ============================================================================
// SCRAPING FUNCTIONS
// ============================================================================

async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries = 3
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Cache-Control': 'no-cache',
        ...(options.headers as Record<string, string> || {}),
      };

      // Add session cookies if available
      if (SESSION_COOKIES) {
        headers['Cookie'] = SESSION_COOKIES;
      }

      const response = await fetch(url, {
        ...options,
        headers,
        redirect: 'follow',
      });

      if (response.ok) {
        return response;
      }

      // If we get a 403/401, likely need auth - throw immediately
      if (response.status === 401 || response.status === 403) {
        throw new Error(`Authentication required (${response.status}). Set GREYSHEET_COOKIES env var or use Playwright login.`);
      }

      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }

    // Wait before retry (exponential backoff)
    if (attempt < maxRetries) {
      await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
    }
  }

  throw lastError || new Error('Failed to fetch after retries');
}

/**
 * Scrape using Playwright with persistent login session
 */
async function scrapeWithPlaywright(url: string): Promise<string | null> {
  if (!chromium) {
    console.log('    Playwright not available. Install with: npm install playwright');
    return null;
  }

  try {
    // Use persistent context to maintain login session
    const context = await chromium.launchPersistentContext(BROWSER_DATA_PATH, {
      headless: true,
      viewport: { width: 1280, height: 720 },
    });

    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    // Check if we need to login
    const loginButton = await page.$('a[href*="login"], button:has-text("Login")');
    if (loginButton) {
      console.log('    Not logged in. Please run with --login flag first to authenticate.');
      await context.close();
      return null;
    }

    // Wait for price table to load
    await page.waitForSelector('table, .price-grid, [data-grade]', { timeout: 10000 }).catch(() => {});

    const html = await page.content();
    await context.close();

    return html;
  } catch (error) {
    console.error('    Playwright error:', error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Interactive login flow using Playwright
 */
async function interactiveLogin(): Promise<boolean> {
  if (!chromium) {
    console.log('Playwright not available. Install with: npm install playwright');
    return false;
  }

  console.log('\nOpening browser for Greysheet login...');
  console.log('Please log in manually. The browser will stay open for 2 minutes.\n');

  try {
    // Launch visible browser with persistent context
    const context = await chromium.launchPersistentContext(BROWSER_DATA_PATH, {
      headless: false,
      viewport: { width: 1280, height: 800 },
    });

    const page = await context.newPage();
    await page.goto('https://www.greysheet.com/login');

    // Wait for user to login (max 2 minutes)
    console.log('Waiting for login... (press Ctrl+C to cancel)');
    
    // Wait until we're redirected away from login page or see user menu
    await page.waitForFunction(
      () => !window.location.href.includes('login') || document.querySelector('.user-menu, .account-menu'),
      { timeout: 120000 }
    ).catch(() => {});

    // Check if logged in
    const cookies = await context.cookies();
    const hasSession = cookies.some(c => c.name.includes('session') || c.name.includes('auth'));

    if (hasSession) {
      console.log('\n✓ Login successful! Session saved to:', BROWSER_DATA_PATH);
      console.log('You can now run scraper commands without --login');
    } else {
      console.log('\n⚠ Could not detect login. Try again or check your credentials.');
    }

    await context.close();
    return hasSession;
  } catch (error) {
    console.error('Login error:', error instanceof Error ? error.message : error);
    return false;
  }
}

function parsePrice(priceText: string): number {
  if (!priceText) return 0;
  // Remove $, commas, and any non-numeric characters except decimal point
  const cleaned = priceText.replace(/[^0-9.]/g, '');
  return parseFloat(cleaned) || 0;
}

function extractGradePrices($: cheerio.CheerioAPI): Record<string, GradePrice> {
  const grades: Record<string, GradePrice> = {};

  // Try to find price table rows
  // Greysheet typically shows grades with bid/ask columns
  $('table tr, .price-row, [data-grade]').each((_, row) => {
    const $row = $(row);
    const text = $row.text();

    // Look for grade patterns like MS65, AU58, etc.
    for (const grade of STANDARD_GRADES) {
      if (text.includes(grade)) {
        // Try to find bid/ask prices in this row
        const cells = $row.find('td, .price-cell, .bid, .ask');
        const prices: number[] = [];

        cells.each((_, cell) => {
          const price = parsePrice($(cell).text());
          if (price > 0) {
            prices.push(price);
          }
        });

        // If we found prices, the first is typically bid, second is ask
        if (prices.length >= 1) {
          grades[grade] = {
            bid: prices[0],
            ask: prices.length > 1 ? prices[1] : prices[0],
          };
        }
      }
    }
  });

  // Alternative: look for structured data
  $('[data-grade]').each((_, el) => {
    const $el = $(el);
    const grade = $el.attr('data-grade');
    const bid = parsePrice($el.attr('data-bid') || $el.find('.bid').text());
    const ask = parsePrice($el.attr('data-ask') || $el.find('.ask').text());

    if (grade && (bid > 0 || ask > 0)) {
      grades[grade] = { bid, ask: ask || bid };
    }
  });

  return grades;
}

async function scrapeCoinPage(slug: string): Promise<GreysheetPrice | null> {
  const url = `${GREYSHEET_BASE_URL}/coin-prices/item/${slug}`;
  console.log(`  Fetching: ${slug}`);

  try {
    let html: string | null = null;

    // Try Playwright first (better for authenticated content)
    if (chromium) {
      html = await scrapeWithPlaywright(url);
    }

    // Fallback to fetch with cookies
    if (!html) {
      const response = await fetchWithRetry(url);
      html = await response.text();
    }

    const $ = cheerio.load(html);

    // Check if we got the actual coin page or redirected to home/login
    const pageTitle = $('title').text();
    if (pageTitle.includes('Login') || !pageTitle.includes(slug.split('-')[0])) {
      console.log(`    Warning: May need authentication for ${slug}`);
    }

    // Extract coin name - look for specific greysheet selectors
    const name = $('.coin-header h1, .item-name, h1.coin-title').first().text().trim() ||
                 $('h1').first().text().trim() ||
                 slug;

    // Extract series from breadcrumbs or meta
    const series = $('.breadcrumb li:nth-last-child(2) a, .series-name').text().trim() ||
                   determineSeries(slug);

    // Extract grade prices from price table
    const grades = extractGradePrices($);

    // Also try to parse JSON-LD structured data if available
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const jsonLd = JSON.parse($(el).html() || '{}');
        if (jsonLd.offers && Array.isArray(jsonLd.offers)) {
          jsonLd.offers.forEach((offer: { name?: string; price?: number }) => {
            const grade = offer.name?.match(/(MS|AU|EF|VF|F|VG|G)\d+/)?.[0];
            if (grade && offer.price) {
              grades[grade] = { bid: offer.price, ask: offer.price };
            }
          });
        }
      } catch {
        // Ignore JSON parse errors
      }
    });

    // If we got some data, return it
    if (Object.keys(grades).length > 0 || name !== slug) {
      return {
        slug,
        name: name !== 'Greysheet: U.S. & World Currency Values For Dealers & Collectors' ? name : slug,
        series,
        grades,
        lastUpdated: new Date().toISOString(),
      };
    }

    console.log(`    Warning: No price data found for ${slug}`);
    return null;
  } catch (error) {
    console.error(`    Error scraping ${slug}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

function determineSeries(slug: string): string {
  if (slug.includes('silver-eagle')) return 'Silver Eagles';
  if (slug.includes('gold-eagle')) return 'Gold Eagles';
  if (slug.includes('peace')) return 'Peace Dollars';
  if (slug.includes('50c')) return 'Walking Liberty Half Dollars';
  if (slug.includes('-1-ms') && !slug.includes('peace')) return 'Morgan Dollars';
  return 'Unknown';
}

// ============================================================================
// MAIN API
// ============================================================================

/**
 * Get price data for a specific coin slug
 */
export async function getCoinPrice(slug: string, forceRefresh = false): Promise<GreysheetPrice | null> {
  const cache = loadCache();

  // Check cache first
  if (!forceRefresh && cache && isCacheValid(cache) && cache.prices[slug]) {
    return cache.prices[slug];
  }

  // Scrape fresh data
  const price = await scrapeCoinPage(slug);

  // Update cache
  if (price) {
    const updatedCache = cache || createEmptyCache();
    updatedCache.prices[slug] = price;
    updatedCache.lastFetched = new Date().toISOString();
    saveCache(updatedCache);
  }

  return price;
}

/**
 * Get all prices for a series
 */
export async function getSeriesPrices(
  series: keyof typeof TARGET_SERIES,
  forceRefresh = false
): Promise<GreysheetPrice[]> {
  const slugs = TARGET_SERIES[series];
  if (!slugs) {
    throw new Error(`Unknown series: ${series}`);
  }

  const prices: GreysheetPrice[] = [];

  for (const slug of slugs) {
    const price = await getCoinPrice(slug, forceRefresh);
    if (price) {
      prices.push(price);
    }
    // Rate limiting - be polite to the server
    await new Promise(r => setTimeout(r, 500));
  }

  return prices;
}

/**
 * Refresh all cached prices
 */
export async function refreshAllPrices(): Promise<{
  success: number;
  failed: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let success = 0;
  let failed = 0;

  const cache = createEmptyCache();

  for (const [series, slugs] of Object.entries(TARGET_SERIES)) {
    console.log(`\nScraping ${series}...`);

    for (const slug of slugs) {
      try {
        const price = await scrapeCoinPage(slug);
        if (price) {
          cache.prices[slug] = price;
          success++;
        } else {
          failed++;
        }
      } catch (error) {
        failed++;
        errors.push(`${slug}: ${error instanceof Error ? error.message : error}`);
      }

      // Rate limiting
      await new Promise(r => setTimeout(r, 500));
    }
  }

  // Save the updated cache
  saveCache(cache);

  return { success, failed, errors };
}

/**
 * Get cached prices (without fetching)
 */
export function getCachedPrices(): GreysheetCache | null {
  return loadCache();
}

/**
 * Check if cache needs refresh
 */
export function needsRefresh(): boolean {
  const cache = loadCache();
  return !cache || !isCacheValid(cache);
}

/**
 * Search cached prices by query
 */
export function searchPrices(query: string): GreysheetPrice[] {
  const cache = loadCache();
  if (!cache) return [];

  const lowerQuery = query.toLowerCase();
  return Object.values(cache.prices).filter(
    price =>
      price.name.toLowerCase().includes(lowerQuery) ||
      price.slug.toLowerCase().includes(lowerQuery) ||
      price.series.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Export cache to CSV format
 */
export function exportToCSV(): string {
  const cache = loadCache();
  if (!cache || Object.keys(cache.prices).length === 0) {
    return '';
  }

  // Collect all unique grades across all coins
  const allGrades = new Set<string>();
  Object.values(cache.prices).forEach(coin => {
    Object.keys(coin.grades).forEach(g => allGrades.add(g));
  });
  const gradeList = Array.from(allGrades).sort((a, b) => {
    // Sort grades numerically (MS60 < MS65, etc.)
    const aNum = parseInt(a.replace(/\D/g, '')) || 0;
    const bNum = parseInt(b.replace(/\D/g, '')) || 0;
    return aNum - bNum;
  });

  // Build header
  const headers = ['Slug', 'Name', 'Series', 'Last Updated'];
  gradeList.forEach(grade => {
    headers.push(`${grade} Bid`, `${grade} Ask`);
  });

  // Build rows
  const rows: string[] = [headers.join(',')];

  Object.values(cache.prices).forEach(coin => {
    const row: string[] = [
      `"${coin.slug}"`,
      `"${coin.name.replace(/"/g, '""')}"`,
      `"${coin.series}"`,
      `"${coin.lastUpdated}"`,
    ];

    gradeList.forEach(grade => {
      const gradePrice = coin.grades[grade];
      row.push(gradePrice ? gradePrice.bid.toString() : '');
      row.push(gradePrice ? gradePrice.ask.toString() : '');
    });

    rows.push(row.join(','));
  });

  return rows.join('\n');
}

/**
 * Save CSV export to file
 */
export function saveCSVExport(outputPath?: string): string {
  const csv = exportToCSV();
  if (!csv) {
    throw new Error('No data to export');
  }

  const filePath = outputPath || path.join(process.cwd(), 'data', 'greysheet-export.csv');
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, csv);
  return filePath;
}

/**
 * Get price for specific grade
 */
export function getPriceForGrade(
  slug: string,
  grade: string
): GradePrice | null {
  const cache = loadCache();
  if (!cache || !cache.prices[slug]) return null;

  return cache.prices[slug].grades[grade] || null;
}

// ============================================================================
// CLI INTERFACE
// ============================================================================

async function main() {
  // Initialize Playwright if available
  await initPlaywright();

  console.log('='.repeat(60));
  console.log('Greysheet Price Scraper');
  console.log('='.repeat(60));

  const args = process.argv.slice(2);
  const command = args[0] || 'status';

  switch (command) {
    case 'login':
      console.log('\nStarting interactive login...');
      await interactiveLogin();
      break;

    case 'refresh':
      console.log('\nRefreshing all prices...');
      console.log('Note: This requires an active Greysheet subscription and may take a while.\n');
      const result = await refreshAllPrices();
      console.log('\n' + '='.repeat(60));
      console.log(`Completed: ${result.success} success, ${result.failed} failed`);
      if (result.errors.length > 0) {
        console.log('\nErrors:');
        result.errors.forEach(e => console.log(`  - ${e}`));
      }
      break;

    case 'get':
      const slug = args[1];
      if (!slug) {
        console.log('Usage: npx tsx greysheet.ts get <slug>');
        console.log('Example: npx tsx greysheet.ts get 1881-s-1-ms');
        process.exit(1);
      }
      const price = await getCoinPrice(slug);
      if (price) {
        console.log('\nCoin:', price.name);
        console.log('Series:', price.series);
        console.log('Grades:');
        if (Object.keys(price.grades).length > 0) {
          Object.entries(price.grades).forEach(([grade, prices]) => {
            console.log(`  ${grade}: Bid $${prices.bid.toFixed(2)}, Ask $${prices.ask.toFixed(2)}`);
          });
        } else {
          console.log('  No grade prices found. You may need to login first: npx tsx greysheet.ts login');
        }
      } else {
        console.log('No data found for', slug);
      }
      break;

    case 'series':
      const seriesName = args[1] as keyof typeof TARGET_SERIES;
      if (!seriesName || !TARGET_SERIES[seriesName]) {
        console.log('Usage: npx tsx greysheet.ts series <series-name>');
        console.log('Available series:', Object.keys(TARGET_SERIES).join(', '));
        process.exit(1);
      }
      console.log(`\nFetching ${seriesName}...`);
      const seriesPrices = await getSeriesPrices(seriesName);
      console.log(`\nFound ${seriesPrices.length} coins:`);
      seriesPrices.forEach(p => {
        const gradeCount = Object.keys(p.grades).length;
        console.log(`  ${p.name}: ${gradeCount} grades`);
      });
      break;

    case 'search':
      const searchQuery = args.slice(1).join(' ');
      if (!searchQuery) {
        console.log('Usage: npx tsx greysheet.ts search <query>');
        process.exit(1);
      }
      const results = searchPrices(searchQuery);
      console.log(`\nFound ${results.length} matches for "${searchQuery}":`);
      results.forEach(p => console.log(`  - ${p.name} (${p.series})`));
      break;

    case 'export':
      console.log('\nExporting to CSV...');
      try {
        const csvPath = saveCSVExport(args[1]);
        console.log(`✓ Exported to: ${csvPath}`);
      } catch (error) {
        console.error('Export failed:', error instanceof Error ? error.message : error);
      }
      break;

    case 'status':
    default:
      const cache = loadCache();
      if (cache) {
        const coinCount = Object.keys(cache.prices).length;
        const lastFetched = new Date(cache.lastFetched);
        const isValid = isCacheValid(cache);
        console.log('\nCache Status:');
        console.log(`  Coins cached: ${coinCount}`);
        console.log(`  Last fetched: ${lastFetched.toLocaleString()}`);
        console.log(`  TTL: ${cache.ttlDays} days`);
        console.log(`  Valid: ${isValid ? 'Yes' : 'No (needs refresh)'}`);
        
        // Show series breakdown
        const seriesCount: Record<string, number> = {};
        Object.values(cache.prices).forEach(p => {
          seriesCount[p.series] = (seriesCount[p.series] || 0) + 1;
        });
        if (Object.keys(seriesCount).length > 0) {
          console.log('\n  By Series:');
          Object.entries(seriesCount).forEach(([s, c]) => console.log(`    ${s}: ${c}`));
        }
      } else {
        console.log('\nNo cache found. Run with "refresh" to fetch prices.');
      }

      // Check authentication status
      console.log('\nAuthentication:');
      if (SESSION_COOKIES) {
        console.log('  GREYSHEET_COOKIES: Set ✓');
      } else if (fs.existsSync(BROWSER_DATA_PATH)) {
        console.log('  Browser session: Saved ✓');
      } else {
        console.log('  Not configured. Run: npx tsx greysheet.ts login');
      }

      console.log('\nCommands:');
      console.log('  login   - Interactive browser login (saves session)');
      console.log('  status  - Show cache status (default)');
      console.log('  refresh - Fetch all prices from Greysheet');
      console.log('  get     - Get price for specific slug');
      console.log('  series  - Get all prices for a series');
      console.log('  search  - Search cached prices');
      console.log('  export  - Export cache to CSV spreadsheet');
      break;
  }
}

// Run if executed directly (ESM check)
const isMain = process.argv[1] && (
  process.argv[1].includes('greysheet.ts') ||
  process.argv[1].includes('greysheet.js')
);

if (isMain) {
  main().catch(console.error);
}
