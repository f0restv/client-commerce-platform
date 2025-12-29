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
 * Uses eBay sold data for pricing
 */

import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// TYPES
// ============================================================================

export interface PriceChartingItem {
  id: string;
  name: string;
  category: 'pokemon' | 'sports' | 'comics' | 'games' | 'funko';
  prices: {
    ungraded?: number;
    graded?: Record<string, number>; // e.g., { 'PSA 10': 500, 'PSA 9': 200 }
  };
  url: string;
  lastUpdated: string;
}

export interface PriceChartingCache {
  version: string;
  lastFetched: string;
  ttlDays: number;
  items: Record<string, PriceChartingItem>;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const BASE_URL = 'https://www.pricecharting.com';
const CACHE_TTL_DAYS = 7;
const CACHE_FILE = path.join(process.cwd(), 'data', 'pricecharting-cache.json');

const CATEGORY_URLS: Record<string, string> = {
  pokemon: '/category/pokemon-cards',
  sports: '/category/sports-trading-card-singles',
  comics: '/category/comic-books',
  games: '/category/video-games',
  funko: '/category/funko',
};

// ============================================================================
// CACHE
// ============================================================================

function loadCache(): PriceChartingCache | null {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('Cache load error:', e);
  }
  return null;
}

function saveCache(cache: PriceChartingCache): void {
  const dir = path.dirname(CACHE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

// ============================================================================
// SCRAPING
// ============================================================================

async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0',
      'Accept': 'text/html',
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

function parsePrice(text: string): number {
  const cleaned = text.replace(/[^0-9.]/g, '');
  return parseFloat(cleaned) || 0;
}

export async function scrapeItem(url: string, category: PriceChartingItem['category']): Promise<PriceChartingItem | null> {
  try {
    const html = await fetchPage(url);
    const $ = cheerio.load(html);

    const name = $('h1').first().text().trim();
    const id = url.split('/').pop() || '';

    // Extract prices from the price table
    const prices: PriceChartingItem['prices'] = {};
    
    // Ungraded price (usually labeled "Ungraded" or "Loose")
    const ungradedRow = $('tr:contains("Ungraded"), tr:contains("Loose")').first();
    if (ungradedRow.length) {
      prices.ungraded = parsePrice(ungradedRow.find('td.price').text());
    }

    // Graded prices (PSA, CGC, etc.)
    const graded: Record<string, number> = {};
    $('tr').each((_, row) => {
      const label = $(row).find('td').first().text().trim();
      const priceMatch = label.match(/(PSA|CGC|BGS|SGC)\s*(\d+)/i);
      if (priceMatch) {
        const grade = `${priceMatch[1].toUpperCase()} ${priceMatch[2]}`;
        const price = parsePrice($(row).find('td.price').text());
        if (price > 0) graded[grade] = price;
      }
    });
    
    if (Object.keys(graded).length > 0) {
      prices.graded = graded;
    }

    return {
      id,
      name,
      category,
      prices,
      url,
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`Error scraping ${url}:`, error);
    return null;
  }
}

export async function searchCategory(
  category: keyof typeof CATEGORY_URLS,
  query: string
): Promise<PriceChartingItem[]> {
  const searchUrl = `${BASE_URL}/search-products?q=${encodeURIComponent(query)}&type=${category}`;
  const html = await fetchPage(searchUrl);
  const $ = cheerio.load(html);

  const results: PriceChartingItem[] = [];

  // PriceCharting uses #offer_list table with tr.offer rows
  $('#offer_list table tr.offer').each((_, row) => {
    const $row = $(row);

    // Product name is in h2.product_name
    const nameEl = $row.find('h2.product_name, .product_name');
    const name = nameEl.text().trim();

    // Get the product link - can be /offers?product=ID or /game/slug
    const link = $row.find('a[href*="/offers"], a[href*="/game"]').first();
    let href = link.attr('href') || '';

    // Extract product ID from various URL formats
    let productId = '';
    const productMatch = href.match(/product[=\/](\d+)/);
    const gameMatch = href.match(/\/game\/([^?]+)/);
    if (productMatch) {
      productId = productMatch[1];
    } else if (gameMatch) {
      productId = gameMatch[1];
    }

    // Price is typically in a <p> containing $
    const priceText = $row.find('p').filter((_, el) => $(el).text().includes('$')).first().text();
    const price = parsePrice(priceText);

    if (name && productId) {
      // Build proper product URL
      const productUrl = href.startsWith('http') ? href :
        (href.startsWith('/') ? `${BASE_URL}${href}` : `${BASE_URL}/${href}`);

      results.push({
        id: productId,
        name,
        category: category as PriceChartingItem['category'],
        prices: { ungraded: price > 0 ? price : undefined },
        url: productUrl,
        lastUpdated: new Date().toISOString(),
      });
    }
  });

  return results;
}

// ============================================================================
// PUBLIC API
// ============================================================================

export async function search(query: string, category?: keyof typeof CATEGORY_URLS): Promise<PriceChartingItem[]> {
  if (category) {
    return searchCategory(category, query);
  }
  
  // Search all categories
  const allResults: PriceChartingItem[] = [];
  for (const cat of Object.keys(CATEGORY_URLS) as (keyof typeof CATEGORY_URLS)[]) {
    const results = await searchCategory(cat, query);
    allResults.push(...results);
    await new Promise(r => setTimeout(r, 300)); // Rate limit
  }
  return allResults;
}

export async function getItem(url: string): Promise<PriceChartingItem | null> {
  const cache = loadCache();
  const id = url.split('/').pop() || '';
  
  // Check cache
  if (cache?.items[id]) {
    const cached = cache.items[id];
    const age = (Date.now() - new Date(cached.lastUpdated).getTime()) / (1000 * 60 * 60 * 24);
    if (age < CACHE_TTL_DAYS) return cached;
  }

  // Determine category from URL
  let category: PriceChartingItem['category'] = 'games';
  if (url.includes('pokemon')) category = 'pokemon';
  else if (url.includes('sports') || url.includes('card')) category = 'sports';
  else if (url.includes('comic')) category = 'comics';
  else if (url.includes('funko')) category = 'funko';

  const item = await scrapeItem(url, category);
  
  // Update cache
  if (item) {
    const newCache = cache || { version: '1.0', lastFetched: new Date().toISOString(), ttlDays: CACHE_TTL_DAYS, items: {} };
    newCache.items[id] = item;
    newCache.lastFetched = new Date().toISOString();
    saveCache(newCache);
  }

  return item;
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'search':
      const query = args.slice(1).join(' ');
      if (!query) {
        console.log('Usage: npx tsx pricecharting.ts search <query>');
        return;
      }
      console.log(`Searching for "${query}"...`);
      const results = await search(query);
      console.log(`Found ${results.length} results:`);
      results.slice(0, 10).forEach(r => {
        console.log(`  [${r.category}] ${r.name}: $${r.prices.ungraded || 'N/A'}`);
      });
      break;

    case 'get':
      const url = args[1];
      if (!url) {
        console.log('Usage: npx tsx pricecharting.ts get <url>');
        return;
      }
      const item = await getItem(url);
      if (item) {
        console.log('Item:', item.name);
        console.log('Category:', item.category);
        console.log('Prices:', JSON.stringify(item.prices, null, 2));
      }
      break;

    default:
      console.log('PriceCharting Scraper');
      console.log('Commands:');
      console.log('  search <query>  - Search for items');
      console.log('  get <url>       - Get item details');
  }
}

if (process.argv[1]?.includes('pricecharting')) {
  main().catch(console.error);
}
