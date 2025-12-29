/**
 * Greysheet HTML Scraper
 *
 * Scrapes detailed coin pricing from Greysheet HTML pages at:
 * /prices/item/{slug}/gsid/{id}
 *
 * Extracts:
 * - Grade-by-grade pricing (CAC, CPG retail, Greysheet wholesale, Bluesheet PCGS/NGC)
 * - Recent auction results
 * - Coin metadata (mintage, category)
 *
 * Usage:
 *   import { GreysheetHTML } from './greysheet-html';
 *   const data = await GreysheetHTML.fetchByGSID(7437);
 *   const results = await GreysheetHTML.search('1878 Morgan');
 */

import * as fs from 'fs';
import * as path from 'path';
import * as cheerio from 'cheerio';

// ============================================================================
// TYPES
// ============================================================================

export interface GreysheetGradePrice {
  grade: string;
  cac: boolean;
  cpg_retail: number | null;
  greysheet_wholesale: number | null;
  bluesheet_pcgs: number | null;
  bluesheet_ngc: number | null;
}

export interface GreysheetAuctionResult {
  grade: string;
  date: string;
  price: number;
  grader: string;
  cac?: boolean;
}

export interface GreysheetCoinData {
  source: 'greysheet.com';
  gsid: number;
  item: string;
  category: string;
  mintage: number | null;
  scraped_at: string;
  url: string;
  prices: GreysheetGradePrice[];
  recent_auctions: GreysheetAuctionResult[];
}

export interface GreysheetHTMLCache {
  version: string;
  lastFetched: string;
  ttlHours: number;
  items: Record<number, GreysheetCoinData>;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const GREYSHEET_BASE_URL = 'https://www.greysheet.com';
const CACHE_TTL_HOURS = 24;
const CACHE_FILE_PATH = path.join(process.cwd(), 'data', 'greysheet-html-cache.json');
const COOKIES_FILE_PATH = path.join(process.cwd(), 'data', 'greysheet-cookies.txt');

// Rate limiting
const REQUEST_DELAY_MS = 1000;
let lastRequestTime = 0;

// ============================================================================
// COOKIE MANAGEMENT
// ============================================================================

function loadCookies(): string {
  // First check environment variable
  if (process.env.GREYSHEET_COOKIES) {
    return process.env.GREYSHEET_COOKIES;
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

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================

function loadCache(): GreysheetHTMLCache | null {
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

function saveCache(cache: GreysheetHTMLCache): void {
  try {
    const dir = path.dirname(CACHE_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(cache, null, 2));
  } catch (error) {
    console.error('[GreysheetHTML] Error saving cache:', error);
  }
}

function createEmptyCache(): GreysheetHTMLCache {
  return {
    version: '1.0',
    lastFetched: new Date().toISOString(),
    ttlHours: CACHE_TTL_HOURS,
    items: {},
  };
}

function isCacheItemValid(cache: GreysheetHTMLCache, gsid: number): boolean {
  const item = cache.items[gsid];
  if (!item) return false;

  const scrapedAt = new Date(item.scraped_at);
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
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Cache-Control': 'no-cache',
      ...(cookies ? { Cookie: cookies } : {}),
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        `Authentication required (${response.status}). Ensure cookies are set in data/greysheet-cookies.txt or GREYSHEET_COOKIES env var.`
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

function parsePrice(text: string | undefined): number | null {
  if (!text || text === '') return null;
  // Remove $, commas, whitespace, and any non-numeric characters except decimal
  const cleaned = text.replace(/[^0-9.]/g, '');
  const value = parseFloat(cleaned);
  return isNaN(value) ? null : value;
}

function parseGrade(text: string): string {
  // Normalize grade text (e.g., "MS 67" -> "MS67", "AU-58" -> "AU58")
  return text.replace(/[\s-]/g, '').toUpperCase();
}

function parseDate(text: string): string {
  // Try to parse various date formats and return ISO date
  const cleaned = text.trim();

  // Try common formats: "Dec 9, 2025", "2025-12-09", "12/09/2025"
  const date = new Date(cleaned);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }

  // Return original if can't parse
  return cleaned;
}

// Greysheet JSON data structures embedded in HTML
interface GreysheetJSONItem {
  Id: number;
  Name: string;
  Title: string;
  Mintage: string;
  CoinageType: string;
  // ... other fields
}

interface GreysheetJSONPriceRow {
  EntryId: number;
  Grade: number;
  GradeLabel: string;
  IsCac: boolean;
  CpgVal: string;
  GreyVal: string;
  BluePVal: string;
  BlueNVal: string;
}

interface GreysheetJSONModel {
  Item: GreysheetJSONItem;
  Data: GreysheetJSONPriceRow[];
  AuctionPriceData?: Array<{
    GradeLabel: string;
    SaleDate: string;
    SalePrice: number;
    GradingService: string;
    IsCac: boolean;
  }>;
}

/**
 * Extract embedded JSON model from Greysheet HTML
 * The page embeds pricing data as a JavaScript variable: var model = {...}
 */
function extractJSONModel(html: string): GreysheetJSONModel | null {
  // Look for the model variable in the HTML
  // Pattern: var model = {...}; or filterItemPricing function that contains model
  const modelMatch = html.match(/var\s+model\s*=\s*(\{[\s\S]*?\});?\s*(?:var|function|$)/);

  if (modelMatch) {
    try {
      // Clean up the JSON - sometimes it has trailing issues
      let jsonStr = modelMatch[1];
      // Remove any trailing semicolons or whitespace issues
      jsonStr = jsonStr.replace(/;?\s*$/, '');
      return JSON.parse(jsonStr);
    } catch {
      // JSON parse failed, try alternative approach
    }
  }

  // Alternative: look for model in filterItemPricing function
  const filterMatch = html.match(/function\s+filterItemPricing\s*\(\s*\)\s*\{[\s\S]*?var\s+model\s*=\s*(\{[\s\S]*?\});/);
  if (filterMatch) {
    try {
      return JSON.parse(filterMatch[1]);
    } catch {
      // JSON parse failed
    }
  }

  // Try to find it anywhere with a more aggressive pattern
  const anyModelMatch = html.match(/"Item":\s*\{[^}]*"Id":\s*\d+[^}]*\}[\s\S]*?"Data":\s*\[/);
  if (anyModelMatch) {
    // Find the start of the model object
    const startIdx = html.indexOf(anyModelMatch[0]) - 1;
    if (startIdx >= 0) {
      // Find matching closing brace
      let braceCount = 0;
      let endIdx = startIdx;
      let inString = false;
      let escapeNext = false;

      for (let i = startIdx; i < html.length && i < startIdx + 500000; i++) {
        const char = html[i];

        if (escapeNext) {
          escapeNext = false;
          continue;
        }

        if (char === '\\') {
          escapeNext = true;
          continue;
        }

        if (char === '"' && !escapeNext) {
          inString = !inString;
          continue;
        }

        if (inString) continue;

        if (char === '{') braceCount++;
        if (char === '}') {
          braceCount--;
          if (braceCount === 0) {
            endIdx = i + 1;
            break;
          }
        }
      }

      if (endIdx > startIdx) {
        try {
          const jsonStr = html.substring(startIdx, endIdx);
          return JSON.parse(jsonStr);
        } catch {
          // JSON parse failed
        }
      }
    }
  }

  return null;
}

/**
 * Extract prices from the embedded JSON model
 */
function extractPricesFromJSON(model: GreysheetJSONModel): GreysheetGradePrice[] {
  const prices: GreysheetGradePrice[] = [];

  if (!model.Data || !Array.isArray(model.Data)) {
    return prices;
  }

  for (const row of model.Data) {
    prices.push({
      grade: row.GradeLabel || `MS${row.Grade}`,
      cac: row.IsCac === true,
      cpg_retail: parsePrice(row.CpgVal),
      greysheet_wholesale: parsePrice(row.GreyVal),
      bluesheet_pcgs: parsePrice(row.BluePVal),
      bluesheet_ngc: parsePrice(row.BlueNVal),
    });
  }

  return prices;
}

/**
 * Extract auction results from the embedded JSON model
 */
function extractAuctionsFromJSON(model: GreysheetJSONModel): GreysheetAuctionResult[] {
  const auctions: GreysheetAuctionResult[] = [];

  if (!model.AuctionPriceData || !Array.isArray(model.AuctionPriceData)) {
    return auctions;
  }

  for (const row of model.AuctionPriceData) {
    auctions.push({
      grade: row.GradeLabel,
      date: parseDate(row.SaleDate),
      price: row.SalePrice,
      grader: row.GradingService || 'Unknown',
      ...(row.IsCac ? { cac: true } : {}),
    });
  }

  return auctions;
}

/**
 * Extract metadata from the embedded JSON model
 */
function extractMetadataFromJSON(model: GreysheetJSONModel): {
  item: string;
  category: string;
  mintage: number | null;
} {
  const item = model.Item;

  let mintage: number | null = null;
  if (item.Mintage) {
    mintage = parseInt(item.Mintage.replace(/,/g, ''), 10);
    if (isNaN(mintage)) mintage = null;
  }

  return {
    item: item.Name || item.Title || '',
    category: item.CoinageType || '',
    mintage,
  };
}

function extractPriceTable($: cheerio.CheerioAPI): GreysheetGradePrice[] {
  const prices: GreysheetGradePrice[] = [];

  // The table has columns: Grade | CAC | CPG Value (Retail) | Greysheet Price (Wholesale) | Bluesheet Values
  // Bluesheet has sub-columns: PCGS | NGC

  // Find the main price table - look for table with grade/price columns
  const tables = $('table');

  tables.each((_, table) => {
    const $table = $(table);
    const headerText = $table.find('thead, th, tr:first-child').text().toLowerCase();

    // Check if this looks like a price table
    if (
      headerText.includes('grade') ||
      headerText.includes('cpg') ||
      headerText.includes('greysheet') ||
      headerText.includes('bluesheet')
    ) {
      // Found the price table, extract rows
      $table.find('tbody tr, tr').each((_, row) => {
        const $row = $(row);
        const cells = $row.find('td');

        if (cells.length < 3) return; // Skip header rows or incomplete rows

        // Extract cell values
        const cellTexts: string[] = [];
        cells.each((_, cell) => {
          cellTexts.push($(cell).text().trim());
        });

        // Try to parse as a price row
        // Expected format: Grade | CAC indicator | CPG | Greysheet | Bluesheet PCGS | Bluesheet NGC
        const gradeText = cellTexts[0];
        if (!gradeText) return;

        // Check if this looks like a grade (e.g., MS65, AU58, VF20)
        const gradeMatch = gradeText.match(/^(MS|AU|XF|EF|VF|F|VG|G|AG|PR|PF)\s*-?\s*\d+/i);
        if (!gradeMatch) return;

        const grade = parseGrade(gradeMatch[0]);

        // Check for CAC - could be in its own column, or indicated by text/icon
        const hasCAC =
          cellTexts.some(
            (t) => t.toLowerCase().includes('cac') || t.includes('✓') || t.includes('●')
          ) ||
          $row.find('.cac, [class*="cac"], img[src*="cac"]').length > 0;

        // Parse price columns (adjust indices based on actual table structure)
        let cpgRetail: number | null = null;
        let greyshetWholesale: number | null = null;
        let bluesheetPcgs: number | null = null;
        let bluesheetNgc: number | null = null;

        // The columns may vary, try to identify by header or position
        for (let i = 1; i < cellTexts.length; i++) {
          const price = parsePrice(cellTexts[i]);
          if (price === null) continue;

          // Assign prices based on column position (typical layout)
          if (i === 1 || i === 2) {
            // CAC column might be here, check if it's a price
            if (price > 0) {
              if (cpgRetail === null) cpgRetail = price;
              else if (greyshetWholesale === null) greyshetWholesale = price;
            }
          } else if (i === 2 || i === 3) {
            if (greyshetWholesale === null) greyshetWholesale = price;
            else if (bluesheetPcgs === null) bluesheetPcgs = price;
          } else if (i === 3 || i === 4) {
            if (bluesheetPcgs === null) bluesheetPcgs = price;
            else if (bluesheetNgc === null) bluesheetNgc = price;
          } else if (i >= 4) {
            if (bluesheetNgc === null) bluesheetNgc = price;
          }
        }

        // Re-parse with better heuristics based on column headers
        const $headers = $table.find('thead th, th');
        if ($headers.length > 0) {
          cells.each((idx, cell) => {
            const headerText = $headers.eq(idx).text().toLowerCase();
            const price = parsePrice($(cell).text());

            if (headerText.includes('cpg') || headerText.includes('retail')) {
              cpgRetail = price;
            } else if (headerText.includes('greysheet') || headerText.includes('wholesale')) {
              greyshetWholesale = price;
            } else if (headerText.includes('bluesheet') || headerText.includes('pcgs')) {
              if (headerText.includes('ngc')) {
                bluesheetNgc = price;
              } else {
                bluesheetPcgs = price;
              }
            }
          });
        }

        // Only add if we have at least some price data
        if (cpgRetail !== null || greyshetWholesale !== null) {
          prices.push({
            grade,
            cac: hasCAC,
            cpg_retail: cpgRetail,
            greysheet_wholesale: greyshetWholesale,
            bluesheet_pcgs: bluesheetPcgs,
            bluesheet_ngc: bluesheetNgc,
          });
        }
      });
    }
  });

  // Alternative: look for grid/flex layout with price cells
  if (prices.length === 0) {
    // Try to find price rows in non-table layouts
    $('.price-row, [class*="grade-row"], [data-grade]').each((_, row) => {
      const $row = $(row);
      const grade = parseGrade(
        $row.find('.grade, [class*="grade"]').text() || $row.attr('data-grade') || ''
      );

      if (!grade) return;

      prices.push({
        grade,
        cac:
          $row.find('.cac, [class*="cac"]').length > 0 ||
          $row.text().toLowerCase().includes('cac'),
        cpg_retail: parsePrice($row.find('[class*="cpg"], [class*="retail"]').text()),
        greysheet_wholesale: parsePrice(
          $row.find('[class*="greysheet"], [class*="wholesale"]').text()
        ),
        bluesheet_pcgs: parsePrice($row.find('[class*="pcgs"]').text()),
        bluesheet_ngc: parsePrice($row.find('[class*="ngc"]').text()),
      });
    });
  }

  return prices;
}

function extractPriceTableV2($: cheerio.CheerioAPI): GreysheetGradePrice[] {
  const prices: GreysheetGradePrice[] = [];

  // Based on the sample data structure, the page likely has a clear table
  // Let's be more flexible in parsing

  // Look for all tables and rows containing grade/price information
  $('tr').each((_, row) => {
    const $row = $(row);
    const rowText = $row.text();

    // Skip if it's a header row
    if ($row.find('th').length > 0) return;

    // Look for grade pattern in the row
    const gradeMatch = rowText.match(/(MS|AU|XF|EF|VF|F|VG|G|AG|PR|PF)\s*-?\s*(\d+)/i);
    if (!gradeMatch) return;

    const grade = parseGrade(gradeMatch[0]);

    // Get all cells
    const cells = $row.find('td');
    const values: (number | null)[] = [];

    cells.each((_, cell) => {
      const text = $(cell).text().trim();
      // Skip cells that just have the grade
      if (text.match(/^(MS|AU|XF|EF|VF|F|VG|G|AG|PR|PF)\s*-?\s*\d+$/i)) return;
      values.push(parsePrice(text));
    });

    // Check for CAC indicator
    const hasCAC =
      $row.find('img[src*="cac"], .cac-sticker, [class*="cac"]').length > 0 ||
      rowText.toLowerCase().includes('cac') ||
      $row.find('td').eq(1).text().trim() === '✓';

    // If CAC column exists, it shifts the price columns
    const offset = hasCAC ? 1 : 0;

    const priceValues = values.filter((v) => v !== null) as number[];

    if (priceValues.length > 0) {
      prices.push({
        grade,
        cac: hasCAC,
        cpg_retail: priceValues[0 + offset] ?? null,
        greysheet_wholesale: priceValues[1 + offset] ?? null,
        bluesheet_pcgs: priceValues[2 + offset] ?? null,
        bluesheet_ngc: priceValues[3 + offset] ?? null,
      });
    }
  });

  return prices;
}

function extractAuctionResults($: cheerio.CheerioAPI): GreysheetAuctionResult[] {
  const auctions: GreysheetAuctionResult[] = [];

  // Look for auction history section
  const auctionSelectors = [
    '.auction-history',
    '.recent-auctions',
    '[class*="auction"]',
    '#auction-results',
    'section:has(h2:contains("Auction")), section:has(h3:contains("Auction"))',
  ];

  for (const selector of auctionSelectors) {
    $(selector)
      .find('tr, .auction-row, [class*="auction-item"]')
      .each((_, row) => {
        const $row = $(row);
        const text = $row.text();

        // Extract grade
        const gradeMatch = text.match(/(MS|AU|XF|EF|VF|F|VG|G|AG|PR|PF)\s*-?\s*\d+/i);
        if (!gradeMatch) return;

        const grade = parseGrade(gradeMatch[0]);

        // Extract date
        const dateMatch = text.match(
          /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})|(\w{3,9}\s+\d{1,2},?\s+\d{4})|(\d{4}-\d{2}-\d{2})/
        );
        const date = dateMatch ? parseDate(dateMatch[0]) : '';

        // Extract price
        const priceMatch = text.match(/\$?([\d,]+(?:\.\d{2})?)/);
        const price = priceMatch ? parsePrice(priceMatch[1]) : null;

        // Extract grader (PCGS, NGC, etc.)
        let grader = 'Unknown';
        if (text.toLowerCase().includes('pcgs')) grader = 'PCGS';
        else if (text.toLowerCase().includes('ngc')) grader = 'NGC';
        else if (text.toLowerCase().includes('anacs')) grader = 'ANACS';
        else if (text.toLowerCase().includes('icg')) grader = 'ICG';

        // Check for CAC
        const hasCac =
          text.toLowerCase().includes('cac') ||
          $row.find('img[src*="cac"], .cac').length > 0;

        if (grade && price !== null) {
          auctions.push({
            grade,
            date,
            price,
            grader,
            ...(hasCac ? { cac: true } : {}),
          });
        }
      });

    if (auctions.length > 0) break;
  }

  // Alternative: look for auction data in tables
  if (auctions.length === 0) {
    $('table').each((_, table) => {
      const $table = $(table);
      const headerText = $table.text().toLowerCase();

      if (
        headerText.includes('auction') ||
        headerText.includes('sale') ||
        headerText.includes('sold')
      ) {
        $table.find('tbody tr, tr:not(:first-child)').each((_, row) => {
          const $row = $(row);
          const cells = $row.find('td');
          if (cells.length < 3) return;

          const text = $row.text();
          const gradeMatch = text.match(/(MS|AU|XF|EF|VF|F|VG|G|AG|PR|PF)\s*-?\s*\d+/i);
          if (!gradeMatch) return;

          const grade = parseGrade(gradeMatch[0]);
          const dateMatch = text.match(
            /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})|(\w{3,9}\s+\d{1,2},?\s+\d{4})|(\d{4}-\d{2}-\d{2})/
          );
          const priceMatch = text.match(/\$?([\d,]+(?:\.\d{2})?)/g);

          let grader = 'Unknown';
          if (text.toLowerCase().includes('pcgs')) grader = 'PCGS';
          else if (text.toLowerCase().includes('ngc')) grader = 'NGC';

          const hasCac = text.toLowerCase().includes('cac');

          // Get the last price match (usually the sale price)
          const price = priceMatch ? parsePrice(priceMatch[priceMatch.length - 1]) : null;

          if (price !== null) {
            auctions.push({
              grade,
              date: dateMatch ? parseDate(dateMatch[0]) : '',
              price,
              grader,
              ...(hasCac ? { cac: true } : {}),
            });
          }
        });
      }
    });
  }

  return auctions;
}

function extractMetadata(
  $: cheerio.CheerioAPI
): { item: string; category: string; mintage: number | null } {
  // Extract coin name/item
  let item =
    $('h1').first().text().trim() ||
    $('[class*="coin-name"], [class*="item-name"]').first().text().trim() ||
    $('title').text().split('|')[0].trim();

  // Clean up the item name
  item = item.replace(/coin\s*values?/i, '').trim();

  // Extract category from breadcrumbs or page content
  let category =
    $('.breadcrumb li:nth-last-child(2)').text().trim() ||
    $('[class*="category"], [class*="series"]').first().text().trim() ||
    '';

  // Extract mintage
  let mintage: number | null = null;
  const mintageMatch = $('body')
    .text()
    .match(/mintage[:\s]*([0-9,]+)/i);
  if (mintageMatch) {
    mintage = parseInt(mintageMatch[1].replace(/,/g, ''), 10);
  }

  return { item, category, mintage };
}

// ============================================================================
// MAIN SCRAPING FUNCTIONS
// ============================================================================

/**
 * Fetch coin data by GSID (Greysheet ID)
 */
export async function fetchByGSID(
  gsid: number,
  slug?: string,
  forceRefresh = false
): Promise<GreysheetCoinData | null> {
  // Check cache first
  if (!forceRefresh) {
    const cache = loadCache();
    if (cache && isCacheItemValid(cache, gsid)) {
      return cache.items[gsid];
    }
  }

  // Build URL - we need slug + gsid
  // If slug not provided, try to look it up from cache or use a generic one
  const itemSlug = slug || `coin-${gsid}`;
  const url = `${GREYSHEET_BASE_URL}/prices/item/${itemSlug}/gsid/${gsid}`;

  try {
    console.log(`[GreysheetHTML] Fetching GSID ${gsid}: ${url}`);
    const html = await fetchWithRetry(url);

    const $ = cheerio.load(html);

    // Check if we got a valid page (not login redirect or error)
    const pageTitle = $('title').text().toLowerCase();
    if (pageTitle.includes('login') || pageTitle.includes('error')) {
      console.warn(`[GreysheetHTML] Got login/error page for GSID ${gsid}`);
      return null;
    }

    // PREFERRED: Try to extract from embedded JSON model first (most reliable)
    const jsonModel = extractJSONModel(html);

    let item: string;
    let category: string;
    let mintage: number | null;
    let prices: GreysheetGradePrice[];
    let recentAuctions: GreysheetAuctionResult[];

    if (jsonModel) {
      // Use JSON extraction (most reliable)
      const metadata = extractMetadataFromJSON(jsonModel);
      item = metadata.item;
      category = metadata.category;
      mintage = metadata.mintage;
      prices = extractPricesFromJSON(jsonModel);
      recentAuctions = extractAuctionsFromJSON(jsonModel);
      console.log(`[GreysheetHTML] Extracted ${prices.length} prices from JSON model`);
    } else {
      // Fallback to HTML parsing
      console.log(`[GreysheetHTML] JSON model not found, falling back to HTML parsing`);
      const metadata = extractMetadata($);
      item = metadata.item;
      category = metadata.category;
      mintage = metadata.mintage;

      prices = extractPriceTable($);
      if (prices.length === 0) {
        prices = extractPriceTableV2($);
      }

      recentAuctions = extractAuctionResults($);
    }

    const coinData: GreysheetCoinData = {
      source: 'greysheet.com',
      gsid,
      item,
      category,
      mintage,
      scraped_at: new Date().toISOString(),
      url,
      prices,
      recent_auctions: recentAuctions,
    };

    // Update cache
    const cache = loadCache() || createEmptyCache();
    cache.items[gsid] = coinData;
    cache.lastFetched = new Date().toISOString();
    saveCache(cache);

    return coinData;
  } catch (error) {
    console.error(`[GreysheetHTML] Error fetching GSID ${gsid}:`, error);
    return null;
  }
}

/**
 * Fetch coin data by URL
 */
export async function fetchByURL(url: string, forceRefresh = false): Promise<GreysheetCoinData | null> {
  // Extract GSID from URL
  const gsidMatch = url.match(/gsid\/(\d+)/);
  const slugMatch = url.match(/item\/([^/]+)\/gsid/);

  if (!gsidMatch) {
    throw new Error('Invalid URL: must contain gsid parameter');
  }

  const gsid = parseInt(gsidMatch[1], 10);
  const slug = slugMatch?.[1];

  return fetchByGSID(gsid, slug, forceRefresh);
}

/**
 * Search for coins by name in the cache
 */
export function searchCached(query: string): GreysheetCoinData[] {
  const cache = loadCache();
  if (!cache) return [];

  const lowerQuery = query.toLowerCase();
  return Object.values(cache.items).filter(
    (coin) =>
      coin.item.toLowerCase().includes(lowerQuery) ||
      coin.category.toLowerCase().includes(lowerQuery) ||
      coin.gsid.toString() === query
  );
}

/**
 * Get price for a specific grade from cached data
 */
export function getPriceForGrade(
  gsid: number,
  grade: string,
  options: { cac?: boolean } = {}
): GreysheetGradePrice | null {
  const cache = loadCache();
  if (!cache || !cache.items[gsid]) return null;

  const coin = cache.items[gsid];
  const normalizedGrade = parseGrade(grade);

  return (
    coin.prices.find(
      (p) =>
        parseGrade(p.grade) === normalizedGrade &&
        (options.cac === undefined || p.cac === options.cac)
    ) || null
  );
}

/**
 * Get cached coin data by GSID (without fetching)
 */
export function getCached(gsid: number): GreysheetCoinData | null {
  const cache = loadCache();
  return cache?.items[gsid] || null;
}

/**
 * Get all cached data
 */
export function getAllCached(): GreysheetHTMLCache | null {
  return loadCache();
}

/**
 * Check if we have valid cached data for a GSID
 */
export function hasCachedData(gsid: number): boolean {
  const cache = loadCache();
  return cache !== null && isCacheItemValid(cache, gsid);
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
    console.error('[GreysheetHTML] Error clearing cache:', error);
  }
}

/**
 * Batch fetch multiple GSIDs
 */
export async function fetchBatch(
  items: Array<{ gsid: number; slug?: string }>,
  options: { forceRefresh?: boolean; concurrency?: number } = {}
): Promise<Map<number, GreysheetCoinData | null>> {
  const { forceRefresh = false, concurrency = 1 } = options;
  const results = new Map<number, GreysheetCoinData | null>();

  // Process in batches to respect rate limiting
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(({ gsid, slug }) => fetchByGSID(gsid, slug, forceRefresh))
    );

    batch.forEach((item, idx) => {
      results.set(item.gsid, batchResults[idx]);
    });
  }

  return results;
}

// ============================================================================
// MARKET DATA SERVICE INTEGRATION
// ============================================================================

/**
 * Convert Greysheet data to unified MarketPrice format
 */
export function toMarketPrice(coin: GreysheetCoinData): import('../types').MarketPrice {
  const gradedPrices: Record<string, import('../types').PriceRange> = {};

  for (const price of coin.prices) {
    const gradeKey = price.cac ? `${price.grade} CAC` : price.grade;

    // Use wholesale (greysheet) as mid, CPG retail as high, calculate low
    const wholesale = price.greysheet_wholesale ?? price.cpg_retail ?? 0;
    const retail = price.cpg_retail ?? wholesale;
    const low = wholesale * 0.9; // 10% below wholesale

    if (wholesale > 0 || retail > 0) {
      gradedPrices[gradeKey] = {
        low,
        mid: wholesale || retail,
        high: retail,
      };
    }
  }

  // Get the most recent auction for lastSale
  const latestAuction = coin.recent_auctions[0];

  return {
    itemId: coin.gsid.toString(),
    name: coin.item,
    category: 'coin',
    source: 'Greysheet HTML',
    sourceUrl: coin.url,
    prices: {
      graded: Object.keys(gradedPrices).length > 0 ? gradedPrices : undefined,
    },
    lastSale: latestAuction
      ? {
          price: latestAuction.price,
          date: latestAuction.date,
          venue: `${latestAuction.grader} Auction`,
        }
      : undefined,
    lastUpdated: coin.scraped_at,
  };
}

// ============================================================================
// EXPORTED API
// ============================================================================

export const GreysheetHTML = {
  fetchByGSID,
  fetchByURL,
  fetchBatch,
  searchCached,
  getPriceForGrade,
  getCached,
  getAllCached,
  hasCachedData,
  clearCache,
  toMarketPrice,
};

export default GreysheetHTML;

// ============================================================================
// CLI
// ============================================================================

async function main() {
  console.log('='.repeat(60));
  console.log('Greysheet HTML Scraper');
  console.log('='.repeat(60));

  const args = process.argv.slice(2);
  const command = args[0] || 'status';

  switch (command) {
    case 'fetch': {
      const gsid = parseInt(args[1], 10);
      const slug = args[2];
      if (!gsid) {
        console.log('Usage: npx tsx greysheet-html.ts fetch <gsid> [slug]');
        console.log('Example: npx tsx greysheet-html.ts fetch 7437 1878-7-over-8tf-morgan-silver-dollar-strong-coin-values');
        process.exit(1);
      }
      const data = await fetchByGSID(gsid, slug);
      if (data) {
        console.log('\nCoin:', data.item);
        console.log('Category:', data.category);
        console.log('Mintage:', data.mintage?.toLocaleString() || 'Unknown');
        console.log('\nPrices:');
        data.prices.forEach((p) => {
          console.log(
            `  ${p.grade}${p.cac ? ' CAC' : ''}: ` +
              `CPG $${p.cpg_retail ?? '-'}, ` +
              `GS $${p.greysheet_wholesale ?? '-'}, ` +
              `BS PCGS $${p.bluesheet_pcgs ?? '-'}, NGC $${p.bluesheet_ngc ?? '-'}`
          );
        });
        if (data.recent_auctions.length > 0) {
          console.log('\nRecent Auctions:');
          data.recent_auctions.slice(0, 5).forEach((a) => {
            console.log(`  ${a.grade} ${a.grader}${a.cac ? ' CAC' : ''}: $${a.price} (${a.date})`);
          });
        }
      } else {
        console.log('No data found for GSID', gsid);
      }
      break;
    }

    case 'url': {
      const url = args[1];
      if (!url) {
        console.log('Usage: npx tsx greysheet-html.ts url <url>');
        process.exit(1);
      }
      const data = await fetchByURL(url);
      if (data) {
        console.log(JSON.stringify(data, null, 2));
      } else {
        console.log('Failed to fetch data from URL');
      }
      break;
    }

    case 'search': {
      const query = args.slice(1).join(' ');
      if (!query) {
        console.log('Usage: npx tsx greysheet-html.ts search <query>');
        process.exit(1);
      }
      const results = searchCached(query);
      console.log(`\nFound ${results.length} cached matches for "${query}":`);
      results.forEach((c) => console.log(`  GSID ${c.gsid}: ${c.item}`));
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
        const itemCount = Object.keys(cache.items).length;
        console.log('\nCache Status:');
        console.log(`  Items cached: ${itemCount}`);
        console.log(`  Last fetched: ${new Date(cache.lastFetched).toLocaleString()}`);
        console.log(`  TTL: ${cache.ttlHours} hours`);
      } else {
        console.log('\nNo cache found.');
      }

      const cookies = loadCookies();
      console.log('\nAuthentication:');
      if (cookies) {
        console.log('  Cookies: Configured ✓');
      } else {
        console.log('  Cookies: Not configured');
        console.log('  Set in data/greysheet-cookies.txt or GREYSHEET_COOKIES env var');
      }

      console.log('\nCommands:');
      console.log('  status         - Show cache status (default)');
      console.log('  fetch <gsid>   - Fetch coin by GSID');
      console.log('  url <url>      - Fetch coin by URL');
      console.log('  search <query> - Search cached coins');
      console.log('  clear          - Clear cache');
      break;
    }
  }
}

if (
  process.argv[1] &&
  (process.argv[1].includes('greysheet-html.ts') || process.argv[1].includes('greysheet-html.js'))
) {
  main().catch(console.error);
}
