/**
 * CDN Exchange Price Data Provider
 *
 * Scrapes coin pricing data from cdnexchange.com
 * Requires active subscription - uses cookies from authenticated Safari session
 *
 * Table structure:
 * - Row per coin (1878 8TF, 1878 7TF, 1878-S, etc)
 * - Columns: DESCRIPTION, P1, AG2, AG3, G4, G6, VG8, VG10, F12, F15, VF20, VF25, VF30, VF35,
 *            XF40, XF45, AU50, AU53, AU55, AU58, MS60, MS61, MS62, MS63, MS64, MS65, MS66,
 *            MS67, MS68, MS69, OGP
 *
 * Usage:
 *   import { CDNExchange } from './cdn-exchange';
 *   const data = await CDNExchange.fetchCatalog(8971); // Morgan Dollars
 *   const results = CDNExchange.search('1878-S');
 *
 * CLI:
 *   npx tsx src/lib/services/market-data/providers/cdn-exchange.ts fetch 8971
 *   npx tsx src/lib/services/market-data/providers/cdn-exchange.ts search "1881-S"
 */

import * as fs from 'fs';
import * as path from 'path';
import * as cheerio from 'cheerio';
import type { MarketPrice, PriceRange, MarketDataProvider } from '../types';

// ============================================================================
// TYPES
// ============================================================================

export interface CDNPriceValue {
  /** Price value in USD */
  price: number;
  /** Previous price if changed */
  previousPrice?: number;
  /** Date of last update (e.g., "11/25/2025") */
  updatedAt?: string;
}

export interface CDNGradePrice {
  /** Greysheet wholesale price */
  greysheet?: CDNPriceValue;
  /** CAC price (20% premium typically) */
  cac?: CDNPriceValue;
  /** PCGS price */
  pcgs?: CDNPriceValue;
  /** NGC price */
  ngc?: CDNPriceValue;
}

export interface CDNCoinData {
  /** Catalog ID (e.g., 8971 for Morgan Dollars) */
  catalogId: number;
  /** CDN Entry ID (from the URL, e.g., 7444) */
  entryId?: number;
  /** Description from the table (e.g., "1878 8TF $1") */
  description: string;
  /** Normalized coin identifier */
  coinId: string;
  /** Grade-to-price mapping with all price types */
  grades: Record<string, CDNGradePrice>;
  /** When this coin was scraped */
  scrapedAt: string;
}

export interface CDNCatalogData {
  /** Catalog ID */
  catalogId: number;
  /** Catalog name (e.g., "Morgan Dollars") */
  catalogName: string;
  /** Source URL */
  url: string;
  /** Column headers (grade names) */
  gradeColumns: string[];
  /** Coin data by coinId */
  coins: Record<string, CDNCoinData>;
  /** When this catalog was scraped */
  scrapedAt: string;
}

export interface CDNExchangeCache {
  version: string;
  lastFetched: string;
  ttlHours: number;
  catalogs: Record<number, CDNCatalogData>;
}

// ============================================================================
// KNOWN CATALOGS
// ============================================================================

export const KNOWN_CATALOGS: Record<number, string> = {
  // === DOLLARS ===
  9661: 'Flowing Hair Dollars (1794-1795)',
  8965: 'Draped Bust Dollars (1795-1803)',
  8966: 'Gobrecht Dollars (1836-1839)',
  8967: 'Seated Dollars (1840-1873)',
  8968: 'Seated Dollars, Proof (1840-1873)',
  8969: 'Trade Dollars (1873-1878)',
  8970: 'Trade Dollars, Proof (1873-1885)',
  8971: 'Morgan Dollars (1878-1921)',
  8972: 'Morgan Dollars, Proof (1878-1921)',
  8973: 'Peace Dollars (1921-1935)',
  9560: 'Peace Dollars, Proof (1921-1922)',
  8974: 'Eisenhower Dollars (1971-1978)',
  8976: 'Susan B. Anthony Dollars (1979-1999)',
  8977: 'Presidential Dollars (2007-2016, 2020)',
  9299: 'Sacagawea Dollars (2000-2008)',
  15901: 'Native American Dollars (2009-)',
  9603: 'American Innovation Dollars (2018-)',
  10536: 'Commemorative Morgan & Peace Silver Dollars (2021-)',

  // === HALF DOLLARS ===
  9659: 'Flowing Hair Half Dollars (1794-1795)',
  9660: 'Draped Bust Half Dollars (1796-1807)',
  8954: 'Capped Bust Half Dollars (1807-1839)',
  8955: 'Liberty Seated Half Dollars (1839-1891)',
  8957: 'Barber Halves (1892-1915)',
  8959: 'Walking Liberty Halves (1916-1947)',
  8961: 'Franklin Halves (1948-1963)',
  8963: 'Kennedy Halves (1964-)',

  // === QUARTERS ===
  8945: 'Barber Quarters (1892-1916)',
  8947: 'Standing Liberty Quarters (1916-1930)',
  8949: 'Washington Quarters (1932-1998)',
  8951: 'State Quarters (1999-2008)',

  // === DIMES ===
  8934: 'Barber Dimes (1892-1916)',
  8936: 'Mercury Dimes (1916-1945)',
  8938: 'Roosevelt Dimes (1946-)',

  // === NICKELS ===
  8923: 'Liberty Nickels (1883-1912)',
  8925: 'Buffalo Nickels (1913-1938)',
  8927: 'Jefferson Nickels (1938-)',

  // === CENTS ===
  8911: 'Indian Head Cents (1859-1909)',
  8913: 'Lincoln Cents, Wheat (1909-1958)',
  8916: 'Lincoln Cents, Memorial (1959-2008)',

  // === MODERN BULLION ===
  8979: 'American Silver Eagles (1986-)',
  8980: 'American Gold Eagles (1986-)',
  8981: 'American Platinum Eagles (1997-)',
  8982: 'American Gold Buffalo (2006-)',
};

// ============================================================================
// CONFIGURATION
// ============================================================================

const CDN_BASE_URL = 'https://www.cdnexchange.com';
const CACHE_TTL_HOURS = 24;
const CACHE_FILE_PATH = path.join(process.cwd(), 'data', 'cdn-exchange-cache.json');
const COOKIES_FILE_PATH = path.join(process.cwd(), 'data', 'cdn-cookies.txt');

// Rate limiting
const REQUEST_DELAY_MS = 1500;
let lastRequestTime = 0;

// Standard grade columns from CDN Exchange tables
const STANDARD_GRADE_COLUMNS = [
  'DESCRIPTION',
  'P1', 'AG2', 'AG3', 'G4', 'G6', 'VG8', 'VG10',
  'F12', 'F15', 'VF20', 'VF25', 'VF30', 'VF35',
  'XF40', 'XF45', 'AU50', 'AU53', 'AU55', 'AU58',
  'MS60', 'MS61', 'MS62', 'MS63', 'MS64', 'MS65', 'MS66', 'MS67', 'MS68', 'MS69',
  'OGP',
];

// ============================================================================
// COOKIE MANAGEMENT
// ============================================================================

function loadCookies(): string {
  // First check environment variable
  if (process.env.CDN_COOKIES) {
    return process.env.CDN_COOKIES;
  }

  // Then check file
  try {
    if (fs.existsSync(COOKIES_FILE_PATH)) {
      return fs.readFileSync(COOKIES_FILE_PATH, 'utf-8').trim();
    }
  } catch {
    // Ignore file read errors
  }

  return '';
}

/**
 * Export cookies from Safari using sqlite3
 * Safari stores cookies in ~/Library/Cookies/Cookies.binarycookies
 * but we can't easily read that format. Instead, user should export manually.
 */
export function getCookiesInstructions(): string {
  return `
To export Safari cookies for CDN Exchange:

Option 1: Use browser developer tools
1. Open Safari and go to cdnexchange.com (logged in)
2. Open Developer Tools (Cmd+Option+I)
3. Go to Network tab, reload the page
4. Click on any request to cdnexchange.com
5. Find the "Cookie" header in the request headers
6. Copy the entire cookie string
7. Save it to: data/cdn-cookies.txt

Option 2: Use a cookie export extension
1. Install a Safari extension that can export cookies
2. Export cookies for cdnexchange.com
3. Format as: cookie1=value1; cookie2=value2; ...
4. Save to: data/cdn-cookies.txt

The file should contain a single line with the cookie string.
`;
}

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================

function loadCache(): CDNExchangeCache | null {
  try {
    if (fs.existsSync(CACHE_FILE_PATH)) {
      const data = fs.readFileSync(CACHE_FILE_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch {
    // Ignore cache errors
  }
  return null;
}

function saveCache(cache: CDNExchangeCache): void {
  try {
    const dir = path.dirname(CACHE_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(cache, null, 2));
  } catch (error) {
    console.error('[CDNExchange] Error saving cache:', error);
  }
}

function createEmptyCache(): CDNExchangeCache {
  return {
    version: '1.0',
    lastFetched: new Date().toISOString(),
    ttlHours: CACHE_TTL_HOURS,
    catalogs: {},
  };
}

function isCacheCatalogValid(cache: CDNExchangeCache, catalogId: number): boolean {
  const catalog = cache.catalogs[catalogId];
  if (!catalog) return false;

  const scrapedAt = new Date(catalog.scrapedAt);
  const now = new Date();
  const hoursSinceScrape = (now.getTime() - scrapedAt.getTime()) / (1000 * 60 * 60);

  return hoursSinceScrape < cache.ttlHours;
}

// ============================================================================
// HTTP FETCHING
// ============================================================================

async function rateLimitedFetch(url: string): Promise<Response> {
  // Enforce rate limiting
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < REQUEST_DELAY_MS) {
    await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS - timeSinceLastRequest));
  }
  lastRequestTime = Date.now();

  const cookies = loadCookies();

  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      ...(cookies ? { Cookie: cookies } : {}),
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        `Authentication required (${response.status}). Ensure cookies are set in data/cdn-cookies.txt or CDN_COOKIES env var.`
      );
    }
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response;
}

async function fetchWithRetry(url: string, maxRetries = 3): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await rateLimitedFetch(url);
      return await response.text();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry auth errors
      if (lastError.message.includes('Authentication required')) {
        throw lastError;
      }

      if (attempt < maxRetries) {
        // Exponential backoff
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
      }
    }
  }

  throw lastError || new Error('Failed to fetch after retries');
}

// ============================================================================
// HTML PARSING
// ============================================================================

/**
 * Parse a price value from text (e.g., "59.83" or "1,680.00")
 */
function parsePrice(text: string): number | null {
  if (!text || text.trim() === '') return null;
  const cleaned = text.replace(/[$,\s]/g, '');
  const value = parseFloat(cleaned);
  return isNaN(value) || value <= 0 ? null : value;
}

/**
 * Parse a price span element with optional update tooltip
 * The span may have a caret icon with title="Was X updated DATE"
 */
function parsePriceSpan($: cheerio.CheerioAPI, span: cheerio.Cheerio<any>): CDNPriceValue | null {
  // Get the text content (the price value)
  const text = span.text().trim();
  const price = parsePrice(text);

  if (price === null) return null;

  const entry: CDNPriceValue = { price };

  // Check for update info in a caret icon tooltip
  // <i class='fa-solid fa-caret-up' title='Was 40.00 updated 11/25/2025'></i>
  const caret = span.find('i[data-bs-toggle="tooltip"]');
  if (caret.length > 0) {
    const title = caret.attr('title') || '';
    const updateMatch = title.match(/Was\s+([\d,]+(?:\.\d{2})?)\s+updated\s+(\d+\/\d+\/?\d*)/i);
    if (updateMatch) {
      entry.previousPrice = parseFloat(updateMatch[1].replace(/,/g, ''));
      entry.updatedAt = updateMatch[2];
    }
  }

  return entry;
}

/**
 * Parse a price cell containing multiple price types
 * Structure:
 *   <td class='price-cell'>
 *     <span class='p-g d-block'>GREYSHEET_PRICE</span>
 *     <span class='p-c d-block'>CAC_PRICE<badge>CAC</badge></span>
 *     <span class='p-p d-block'>PCGS_PRICE<badge>PCGS</badge></span>
 *     <span class='p-n d-block'>NGC_PRICE<badge>NGC</badge></span>
 *   </td>
 */
function parsePriceCell($: cheerio.CheerioAPI, cell: cheerio.Cheerio<any>): CDNGradePrice | null {
  const gradePrice: CDNGradePrice = {};

  // Parse Greysheet price (p-g)
  const greySpan = cell.find('.p-g');
  if (greySpan.length > 0) {
    const val = parsePriceSpan($, greySpan);
    if (val) gradePrice.greysheet = val;
  }

  // Parse CAC price (p-c)
  const cacSpan = cell.find('.p-c');
  if (cacSpan.length > 0) {
    const val = parsePriceSpan($, cacSpan);
    if (val) gradePrice.cac = val;
  }

  // Parse PCGS price (p-p)
  const pcgsSpan = cell.find('.p-p');
  if (pcgsSpan.length > 0) {
    const val = parsePriceSpan($, pcgsSpan);
    if (val) gradePrice.pcgs = val;
  }

  // Parse NGC price (p-n)
  const ngcSpan = cell.find('.p-n');
  if (ngcSpan.length > 0) {
    const val = parsePriceSpan($, ngcSpan);
    if (val) gradePrice.ngc = val;
  }

  // Return null if no prices found
  if (!gradePrice.greysheet && !gradePrice.cac && !gradePrice.pcgs && !gradePrice.ngc) {
    return null;
  }

  return gradePrice;
}

/**
 * Normalize a coin description to a coinId
 * e.g., "1878 8TF" -> "1878-8tf"
 */
function normalizeCoinId(description: string): string {
  return description
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

/**
 * Parse the pricing table from a CDN Exchange catalog page
 */
function parseTable($: cheerio.CheerioAPI, catalogId: number, catalogName: string, url: string): CDNCatalogData {
  const now = new Date().toISOString();

  const catalogData: CDNCatalogData = {
    catalogId,
    catalogName,
    url,
    gradeColumns: [],
    coins: {},
    scrapedAt: now,
  };

  // Find the main pricing table - look for thead with Description and grade headers
  const mainTable = $('table').first();

  if (mainTable.length === 0) {
    console.warn('[CDNExchange] Could not find pricing table');
    return catalogData;
  }

  // Extract grade columns from header row (th elements in thead)
  const headerCells = mainTable.find('thead tr th');
  const gradeColumns: string[] = [];

  headerCells.each((_, cell) => {
    const text = $(cell).text().trim().toUpperCase().replace('*', '');
    gradeColumns.push(text);
  });

  catalogData.gradeColumns = gradeColumns;
  console.log(`[CDNExchange] Found ${gradeColumns.length} grade columns: ${gradeColumns.slice(0, 5).join(', ')}...`);

  // Parse each data row (tr.entry elements in tbody)
  const dataRows = mainTable.find('tbody tr.entry');
  let rowCount = 0;

  dataRows.each((_, row) => {
    const $row = $(row);
    const cells = $row.find('td');

    if (cells.length < 2) return; // Skip empty rows

    // First cell contains the description with a link
    const firstCell = $(cells[0]);
    const link = firstCell.find('a');
    const description = link.text().trim() || firstCell.text().trim();

    if (!description || description.toLowerCase() === 'description') {
      return; // Skip header rows
    }

    // Extract entry ID from the link href (e.g., /entry/7444 -> 7444)
    const href = link.attr('href') || '';
    const entryMatch = href.match(/\/entry\/(\d+)/);
    const entryId = entryMatch ? parseInt(entryMatch[1], 10) : undefined;

    const coinId = normalizeCoinId(description);

    const coinData: CDNCoinData = {
      catalogId,
      entryId,
      description,
      coinId,
      grades: {},
      scrapedAt: now,
    };

    // Parse each grade column (starting from index 1, skipping description)
    cells.each((idx, cell) => {
      if (idx === 0) return; // Skip description column

      const gradeHeader = gradeColumns[idx];
      if (!gradeHeader || gradeHeader === 'DESCRIPTION') return;

      const $cell = $(cell);
      const gradePrice = parsePriceCell($, $cell);

      if (gradePrice) {
        coinData.grades[gradeHeader] = gradePrice;
      }
    });

    // Only add if we have at least one price
    if (Object.keys(coinData.grades).length > 0) {
      catalogData.coins[coinId] = coinData;
      rowCount++;
    }
  });

  console.log(`[CDNExchange] Parsed ${rowCount} coins from catalog ${catalogId}`);
  return catalogData;
}

// ============================================================================
// CATALOG DISCOVERY
// ============================================================================

interface CatalogNode {
  id: number;
  name: string;
  child_count: number;
  series_id: number | null;
}

/**
 * Discover subcatalogs from a parent node via XHR endpoint
 */
async function fetchCatalogChildren(nodeId: number): Promise<CatalogNode[]> {
  const cookies = loadCookies();

  const response = await fetch(`${CDN_BASE_URL}/xhr/xhr.catalog.php`, {
    method: 'POST',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      ...(cookies ? { Cookie: cookies } : {}),
    },
    body: `action=get_children&node_id=${nodeId}`,
  });

  if (!response.ok) {
    console.error(`[CDNExchange] Failed to fetch children for node ${nodeId}: ${response.status}`);
    return [];
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

/**
 * Recursively discover all pricing catalogs from the catalog tree
 */
export async function discoverCatalogs(
  rootNodeId: number = 1, // 1 = US Coins
  maxDepth: number = 5
): Promise<Map<number, string>> {
  const catalogs = new Map<number, string>();
  const visited = new Set<number>();

  async function explore(nodeId: number, depth: number): Promise<void> {
    if (depth > maxDepth || visited.has(nodeId)) return;
    visited.add(nodeId);

    const children = await fetchCatalogChildren(nodeId);
    await new Promise((r) => setTimeout(r, 200)); // Rate limit

    for (const child of children) {
      if (child.id <= 0) continue; // Skip special nodes like "Generics"

      if (child.child_count === 0) {
        // This is a leaf node = pricing catalog
        catalogs.set(child.id, child.name);
        console.log(`[CDNExchange] Discovered catalog ${child.id}: ${child.name}`);
      } else {
        // Has children, explore deeper
        await explore(child.id, depth + 1);
      }
    }
  }

  console.log(`[CDNExchange] Starting catalog discovery from node ${rootNodeId}...`);
  await explore(rootNodeId, 0);
  console.log(`[CDNExchange] Discovered ${catalogs.size} pricing catalogs`);

  return catalogs;
}

/**
 * Discover and update the KNOWN_CATALOGS map
 */
export async function updateKnownCatalogs(): Promise<void> {
  // Discover from US Coins (1)
  const usCoinCatalogs = await discoverCatalogs(1);

  // Update the known catalogs object
  for (const [id, name] of usCoinCatalogs) {
    if (!KNOWN_CATALOGS[id]) {
      KNOWN_CATALOGS[id] = name;
    }
  }

  console.log(`[CDNExchange] Total known catalogs: ${Object.keys(KNOWN_CATALOGS).length}`);
}

// ============================================================================
// MAIN FETCHING FUNCTIONS
// ============================================================================

/**
 * Fetch a catalog by ID
 */
export async function fetchCatalog(
  catalogId: number,
  forceRefresh = false
): Promise<CDNCatalogData | null> {
  // Check cache first
  if (!forceRefresh) {
    const cache = loadCache();
    if (cache && isCacheCatalogValid(cache, catalogId)) {
      console.log(`[CDNExchange] Using cached data for catalog ${catalogId}`);
      return cache.catalogs[catalogId];
    }
  }

  const catalogName = KNOWN_CATALOGS[catalogId] || `Catalog ${catalogId}`;
  const url = `${CDN_BASE_URL}/pricing/${catalogId}`;

  try {
    console.log(`[CDNExchange] Fetching catalog ${catalogId} (${catalogName}): ${url}`);
    const html = await fetchWithRetry(url);

    const $ = cheerio.load(html);

    // Check if we got a valid page (not login redirect)
    const pageTitle = $('title').text().toLowerCase();
    if (pageTitle.includes('login') || pageTitle.includes('sign in')) {
      console.warn(`[CDNExchange] Got login page for catalog ${catalogId} - authentication required`);
      return null;
    }

    // Try to extract catalog name from page
    const pageHeading = $('h1, h2, .page-title, .catalog-title').first().text().trim();
    const finalCatalogName = pageHeading || catalogName;

    // Parse the table
    const catalogData = parseTable($, catalogId, finalCatalogName, url);

    // Update cache
    const cache = loadCache() || createEmptyCache();
    cache.catalogs[catalogId] = catalogData;
    cache.lastFetched = new Date().toISOString();
    saveCache(cache);

    return catalogData;
  } catch (error) {
    console.error(`[CDNExchange] Error fetching catalog ${catalogId}:`, error);
    return null;
  }
}

/**
 * Fetch multiple catalogs
 */
export async function fetchCatalogs(
  catalogIds: number[],
  forceRefresh = false
): Promise<Map<number, CDNCatalogData | null>> {
  const results = new Map<number, CDNCatalogData | null>();

  for (const catalogId of catalogIds) {
    const data = await fetchCatalog(catalogId, forceRefresh);
    results.set(catalogId, data);
  }

  return results;
}

/**
 * Fetch all known catalogs
 */
export async function fetchAllKnownCatalogs(forceRefresh = false): Promise<CDNExchangeCache> {
  const catalogIds = Object.keys(KNOWN_CATALOGS).map(Number);

  console.log(`[CDNExchange] Fetching ${catalogIds.length} known catalogs...`);

  for (const catalogId of catalogIds) {
    await fetchCatalog(catalogId, forceRefresh);
  }

  return loadCache() || createEmptyCache();
}

// ============================================================================
// SEARCH & LOOKUP
// ============================================================================

/**
 * Search for coins across all cached catalogs
 */
export function search(query: string): CDNCoinData[] {
  const cache = loadCache();
  if (!cache) return [];

  const lowerQuery = query.toLowerCase();
  const results: CDNCoinData[] = [];

  for (const catalog of Object.values(cache.catalogs)) {
    for (const coin of Object.values(catalog.coins)) {
      if (
        coin.description.toLowerCase().includes(lowerQuery) ||
        coin.coinId.includes(lowerQuery)
      ) {
        results.push(coin);
      }
    }
  }

  return results;
}

/**
 * Get coin by exact ID from a specific catalog
 */
export function getCoin(catalogId: number, coinId: string): CDNCoinData | null {
  const cache = loadCache();
  if (!cache || !cache.catalogs[catalogId]) return null;

  return cache.catalogs[catalogId].coins[coinId] || null;
}

/**
 * Get price for a specific coin and grade
 */
export function getPrice(
  catalogId: number,
  coinId: string,
  grade: string
): CDNGradePrice | null {
  const coin = getCoin(catalogId, coinId);
  if (!coin) return null;

  const normalizedGrade = grade.toUpperCase().replace(/\s+/g, '');
  return coin.grades[normalizedGrade] || null;
}

/**
 * Get all cached data
 */
export function getAllCached(): CDNExchangeCache | null {
  return loadCache();
}

/**
 * Check if we have valid cached data for a catalog
 */
export function hasCachedData(catalogId: number): boolean {
  const cache = loadCache();
  return cache !== null && isCacheCatalogValid(cache, catalogId);
}

/**
 * Clear the cache
 */
export function clearCache(): void {
  try {
    if (fs.existsSync(CACHE_FILE_PATH)) {
      fs.unlinkSync(CACHE_FILE_PATH);
    }
  } catch (error) {
    console.error('[CDNExchange] Error clearing cache:', error);
  }
}

// ============================================================================
// MARKET DATA SERVICE INTEGRATION
// ============================================================================

/**
 * Convert CDN coin data to unified MarketPrice format
 */
export function toMarketPrice(coin: CDNCoinData): MarketPrice {
  const gradedPrices: Record<string, PriceRange> = {};

  for (const [grade, gradePrice] of Object.entries(coin.grades)) {
    // Use Greysheet wholesale as the primary price, fall back to PCGS/NGC/CAC
    const primaryPrice =
      gradePrice.greysheet?.price ||
      gradePrice.pcgs?.price ||
      gradePrice.ngc?.price ||
      gradePrice.cac?.price ||
      0;

    if (primaryPrice <= 0) continue;

    // Calculate low/mid/high based on available prices
    // NGC is often lower, CAC is often higher
    const low = gradePrice.ngc?.price || primaryPrice * 0.9;
    const mid = primaryPrice;
    const high = gradePrice.cac?.price || primaryPrice * 1.1;

    gradedPrices[grade] = { low, mid, high };

    // Also add CAC-specific entry if CAC price exists and is different
    if (gradePrice.cac?.price && gradePrice.cac.price !== primaryPrice) {
      gradedPrices[`${grade} CAC`] = {
        low: gradePrice.cac.price * 0.9,
        mid: gradePrice.cac.price,
        high: gradePrice.cac.price * 1.1,
      };
    }
  }

  const entryUrl = coin.entryId
    ? `${CDN_BASE_URL}/entry/${coin.entryId}`
    : `${CDN_BASE_URL}/pricing/${coin.catalogId}`;

  return {
    itemId: `cdn-${coin.catalogId}-${coin.coinId}`,
    name: coin.description,
    category: 'coin',
    source: 'CDN Exchange',
    sourceUrl: entryUrl,
    prices: {
      graded: Object.keys(gradedPrices).length > 0 ? gradedPrices : undefined,
    },
    lastUpdated: coin.scrapedAt,
  };
}

/**
 * Create a MarketDataProvider instance for CDN Exchange
 */
export function createProvider(): MarketDataProvider {
  return {
    name: 'CDN Exchange',
    categories: ['coin'],

    isAvailable(): boolean {
      const cookies = loadCookies();
      return cookies.length > 0;
    },

    async search(query: string, options?: { limit?: number }): Promise<MarketPrice[]> {
      const results = search(query);
      const limited = options?.limit ? results.slice(0, options.limit) : results;
      return limited.map(toMarketPrice);
    },

    async getPrice(itemId: string): Promise<MarketPrice | null> {
      // itemId format: cdn-{catalogId}-{coinId}
      const match = itemId.match(/^cdn-(\d+)-(.+)$/);
      if (!match) return null;

      const catalogId = parseInt(match[1], 10);
      const coinId = match[2];

      const coin = getCoin(catalogId, coinId);
      return coin ? toMarketPrice(coin) : null;
    },

    needsRefresh(): boolean {
      const cache = loadCache();
      if (!cache) return true;

      // Check if any known catalog needs refresh
      for (const catalogId of Object.keys(KNOWN_CATALOGS).map(Number)) {
        if (!isCacheCatalogValid(cache, catalogId)) {
          return true;
        }
      }
      return false;
    },

    async refreshCache(): Promise<void> {
      await fetchAllKnownCatalogs(true);
    },
  };
}

// ============================================================================
// EXPORTED API
// ============================================================================

export const CDNExchange = {
  fetchCatalog,
  fetchCatalogs,
  fetchAllKnownCatalogs,
  discoverCatalogs,
  updateKnownCatalogs,
  search,
  getCoin,
  getPrice,
  getAllCached,
  hasCachedData,
  clearCache,
  toMarketPrice,
  createProvider,
  getCookiesInstructions,
  KNOWN_CATALOGS,
};

export default CDNExchange;

// ============================================================================
// CLI
// ============================================================================

async function main() {
  console.log('='.repeat(60));
  console.log('CDN Exchange Price Scraper');
  console.log('='.repeat(60));

  const args = process.argv.slice(2);
  const command = args[0] || 'status';

  switch (command) {
    case 'fetch': {
      const catalogId = parseInt(args[1], 10);
      if (!catalogId) {
        console.log('Usage: npx tsx cdn-exchange.ts fetch <catalogId>');
        console.log('\nKnown catalogs:');
        for (const [id, name] of Object.entries(KNOWN_CATALOGS)) {
          console.log(`  ${id}: ${name}`);
        }
        process.exit(1);
      }
      const data = await fetchCatalog(catalogId, args.includes('--force'));
      if (data) {
        console.log(`\nCatalog: ${data.catalogName}`);
        console.log(`Coins: ${Object.keys(data.coins).length}`);
        console.log(`Grades: ${data.gradeColumns.length} columns`);
        console.log('\nFirst 5 coins:');
        const coins = Object.values(data.coins).slice(0, 5);
        coins.forEach((coin) => {
          const gradeCount = Object.keys(coin.grades).length;
          console.log(`  ${coin.description}: ${gradeCount} grades with prices`);
        });
      } else {
        console.log('Failed to fetch catalog', catalogId);
      }
      break;
    }

    case 'fetch-all': {
      console.log('\nFetching all known catalogs...');
      await fetchAllKnownCatalogs(args.includes('--force'));
      const cache = loadCache();
      if (cache) {
        console.log(`\nFetched ${Object.keys(cache.catalogs).length} catalogs`);
        for (const catalog of Object.values(cache.catalogs)) {
          console.log(`  ${catalog.catalogId}: ${catalog.catalogName} (${Object.keys(catalog.coins).length} coins)`);
        }
      }
      break;
    }

    case 'search': {
      const query = args.slice(1).join(' ');
      if (!query) {
        console.log('Usage: npx tsx cdn-exchange.ts search <query>');
        process.exit(1);
      }
      const results = search(query);
      console.log(`\nFound ${results.length} matches for "${query}":`);
      results.slice(0, 20).forEach((coin) => {
        const catalog = KNOWN_CATALOGS[coin.catalogId] || 'Unknown';
        const grades = Object.keys(coin.grades).slice(0, 5).join(', ');
        console.log(`  [${catalog}] ${coin.description}: ${grades}...`);
      });
      if (results.length > 20) {
        console.log(`  ... and ${results.length - 20} more`);
      }
      break;
    }

    case 'price': {
      const catalogId = parseInt(args[1], 10);
      const coinId = args[2];
      const grade = args[3];
      if (!catalogId || !coinId) {
        console.log('Usage: npx tsx cdn-exchange.ts price <catalogId> <coinId> [grade]');
        process.exit(1);
      }
      const coin = getCoin(catalogId, coinId);
      if (!coin) {
        console.log('Coin not found');
        process.exit(1);
      }
      console.log(`\n${coin.description}${coin.entryId ? ` (Entry #${coin.entryId})` : ''}:`);
      if (grade) {
        const gradePrice = getPrice(catalogId, coinId, grade);
        if (gradePrice) {
          console.log(`  ${grade}:`);
          if (gradePrice.greysheet) {
            console.log(`    Greysheet: $${gradePrice.greysheet.price.toLocaleString()}${gradePrice.greysheet.previousPrice ? ` (was $${gradePrice.greysheet.previousPrice.toLocaleString()} on ${gradePrice.greysheet.updatedAt})` : ''}`);
          }
          if (gradePrice.cac) {
            console.log(`    CAC:       $${gradePrice.cac.price.toLocaleString()}`);
          }
          if (gradePrice.pcgs) {
            console.log(`    PCGS:      $${gradePrice.pcgs.price.toLocaleString()}`);
          }
          if (gradePrice.ngc) {
            console.log(`    NGC:       $${gradePrice.ngc.price.toLocaleString()}`);
          }
        } else {
          console.log(`  ${grade}: No price available`);
        }
      } else {
        for (const [g, gp] of Object.entries(coin.grades)) {
          const prices: string[] = [];
          if (gp.greysheet) prices.push(`GS $${gp.greysheet.price.toLocaleString()}`);
          if (gp.cac) prices.push(`CAC $${gp.cac.price.toLocaleString()}`);
          if (gp.pcgs) prices.push(`PCGS $${gp.pcgs.price.toLocaleString()}`);
          if (gp.ngc) prices.push(`NGC $${gp.ngc.price.toLocaleString()}`);
          console.log(`  ${g}: ${prices.join(', ')}`);
        }
      }
      break;
    }

    case 'discover': {
      console.log('\nDiscovering catalogs from CDN Exchange...');
      const rootNode = parseInt(args[1], 10) || 1; // Default to US Coins
      const discovered = await discoverCatalogs(rootNode);
      console.log(`\nDiscovered ${discovered.size} pricing catalogs:`);
      const sorted = Array.from(discovered.entries()).sort((a, b) => a[1].localeCompare(b[1]));
      sorted.slice(0, 30).forEach(([id, name]) => {
        console.log(`  ${id}: ${name}`);
      });
      if (sorted.length > 30) {
        console.log(`  ... and ${sorted.length - 30} more`);
      }
      break;
    }

    case 'cookies': {
      console.log(getCookiesInstructions());
      break;
    }

    case 'clear':
      clearCache();
      console.log('Cache cleared.');
      break;

    case 'status':
    default: {
      const cache = loadCache();
      if (cache) {
        const catalogCount = Object.keys(cache.catalogs).length;
        let totalCoins = 0;
        for (const catalog of Object.values(cache.catalogs)) {
          totalCoins += Object.keys(catalog.coins).length;
        }
        console.log('\nCache Status:');
        console.log(`  Catalogs cached: ${catalogCount}`);
        console.log(`  Total coins: ${totalCoins}`);
        console.log(`  Last fetched: ${new Date(cache.lastFetched).toLocaleString()}`);
        console.log(`  TTL: ${cache.ttlHours} hours`);

        if (catalogCount > 0) {
          console.log('\nCached catalogs:');
          for (const catalog of Object.values(cache.catalogs)) {
            const age = (Date.now() - new Date(catalog.scrapedAt).getTime()) / (1000 * 60 * 60);
            const valid = age < cache.ttlHours;
            console.log(
              `  ${catalog.catalogId}: ${catalog.catalogName} ` +
                `(${Object.keys(catalog.coins).length} coins, ${valid ? 'valid' : 'stale'})`
            );
          }
        }
      } else {
        console.log('\nNo cache found.');
      }

      const cookies = loadCookies();
      console.log('\nAuthentication:');
      if (cookies) {
        console.log('  Cookies: Configured ✓');
      } else {
        console.log('  Cookies: Not configured');
        console.log('  Run: npx tsx cdn-exchange.ts cookies');
      }

      console.log('\nCommands:');
      console.log('  status           - Show cache status (default)');
      console.log('  fetch <id>       - Fetch catalog by ID');
      console.log('  fetch-all        - Fetch all known catalogs');
      console.log('  discover [node]  - Discover catalog IDs (default: US Coins)');
      console.log('  search <query>   - Search cached coins');
      console.log('  price <cat> <id> - Get price for coin');
      console.log('  cookies          - Show cookie setup instructions');
      console.log('  clear            - Clear cache');

      console.log('\nKnown catalogs:');
      for (const [id, name] of Object.entries(KNOWN_CATALOGS).slice(0, 10)) {
        console.log(`  ${id}: ${name}`);
      }
      console.log(`  ... and ${Object.keys(KNOWN_CATALOGS).length - 10} more`);
      break;
    }
  }
}

if (
  process.argv[1] &&
  (process.argv[1].includes('cdn-exchange.ts') || process.argv[1].includes('cdn-exchange.js'))
) {
  main().catch(console.error);
}
