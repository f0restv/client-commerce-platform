import type { MarketData, MarketComparable, UnifiedMarketPrice } from './types';
import { MarketData as UnifiedMarketData, type MarketPrice, type CollectibleCategory as UnifiedCategory } from '../market-data';

const EBAY_FINDING_API = 'https://svcs.ebay.com/services/search/FindingService/v1';
const EBAY_BROWSE_API = 'https://api.ebay.com/buy/browse/v1';

interface EbayConfig {
  appId?: string;
  oauthToken?: string;
}

function getEbayConfig(): EbayConfig {
  return {
    appId: process.env.EBAY_APP_ID,
    oauthToken: process.env.EBAY_OAUTH_TOKEN,
  };
}

export async function scrapeEbayComps(
  searchTerms: string[],
  options: { soldOnly?: boolean; limit?: number } = {}
): Promise<MarketComparable[]> {
  const { soldOnly = false, limit = 20 } = options;
  const config = getEbayConfig();

  if (!config.oauthToken) {
    console.warn('EBAY_OAUTH_TOKEN not configured, returning empty comparables');
    return [];
  }

  const query = searchTerms.join(' ');
  const comparables: MarketComparable[] = [];

  const endpoint = soldOnly
    ? `${EBAY_BROWSE_API}/item_summary/search?q=${encodeURIComponent(query)}&filter=buyingOptions:{FIXED_PRICE|AUCTION},conditionIds:{1000|1500|2000|2500|3000}&limit=${limit}`
    : `${EBAY_BROWSE_API}/item_summary/search?q=${encodeURIComponent(query)}&limit=${limit}`;

  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${config.oauthToken}`,
      'Content-Type': 'application/json',
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`eBay API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  for (const item of data.itemSummaries || []) {
    comparables.push({
      source: soldOnly ? 'ebay-sold' : 'ebay-active',
      title: item.title,
      price: parseFloat(item.price?.value || '0'),
      url: item.itemWebUrl,
      sold: soldOnly,
      soldDate: item.itemEndDate ? new Date(item.itemEndDate) : null,
      condition: item.condition || null,
    });
  }

  return comparables;
}

export async function getEbayStats(searchTerms: string[]): Promise<MarketData['ebayStats']> {
  const [soldComps, activeComps] = await Promise.all([
    scrapeEbayComps(searchTerms, { soldOnly: true, limit: 30 }).catch(() => []),
    scrapeEbayComps(searchTerms, { soldOnly: false, limit: 20 }).catch(() => []),
  ]);

  if (soldComps.length === 0) {
    return null;
  }

  const prices = soldComps.map((c) => c.price).sort((a, b) => a - b);
  const sum = prices.reduce((a, b) => a + b, 0);
  const median = prices.length % 2 === 0
    ? (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2
    : prices[Math.floor(prices.length / 2)];

  return {
    soldCount: soldComps.length,
    soldAverage: sum / prices.length,
    soldMedian: median,
    soldLow: prices[0],
    soldHigh: prices[prices.length - 1],
    activeListings: activeComps.length,
    comparables: [...soldComps, ...activeComps],
  };
}

export async function getRedbookPrice(
  year: number | null,
  denomination: string,
  mint: string | null,
  grade: string
): Promise<number | null> {
  const apiKey = process.env.REDBOOK_API_KEY;
  if (!apiKey) {
    console.warn('REDBOOK_API_KEY not configured');
    return null;
  }

  const params = new URLSearchParams({
    year: year?.toString() || '',
    denomination,
    mint: mint || '',
    grade,
  });

  const response = await fetch(`https://api.redbook.com/v1/price?${params}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    console.error(`Redbook API error: ${response.status}`);
    return null;
  }

  const data = await response.json();
  return data.price || null;
}

export async function getGreysheetPrice(
  year: number | null,
  denomination: string,
  mint: string | null,
  grade: string
): Promise<{ bid: number; ask: number } | null> {
  const apiKey = process.env.GREYSHEET_API_KEY;
  if (!apiKey) {
    console.warn('GREYSHEET_API_KEY not configured');
    return null;
  }

  const params = new URLSearchParams({
    year: year?.toString() || '',
    denomination,
    mint: mint || '',
    grade,
  });

  const response = await fetch(`https://api.greysheet.com/v1/price?${params}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    console.error(`Greysheet API error: ${response.status}`);
    return null;
  }

  const data = await response.json();
  return data.bid && data.ask ? { bid: data.bid, ask: data.ask } : null;
}

export async function findCheapestBuyNow(
  searchTerms: string[]
): Promise<{ price: number; url: string; seller: string } | null> {
  const config = getEbayConfig();
  if (!config.oauthToken) {
    return null;
  }

  const query = searchTerms.join(' ');
  const endpoint = `${EBAY_BROWSE_API}/item_summary/search?q=${encodeURIComponent(query)}&filter=buyingOptions:{FIXED_PRICE}&sort=price&limit=5`;

  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${config.oauthToken}`,
      'Content-Type': 'application/json',
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
    },
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  const cheapest = data.itemSummaries?.[0];

  if (!cheapest) {
    return null;
  }

  return {
    price: parseFloat(cheapest.price?.value || '0'),
    url: cheapest.itemWebUrl,
    seller: cheapest.seller?.username || 'unknown',
  };
}

/**
 * Map ProductIntelligence category to market-data CollectibleCategory
 */
function mapToUnifiedCategory(category?: string): UnifiedCategory | undefined {
  if (!category) return undefined;

  const categoryMap: Record<string, UnifiedCategory> = {
    'coin': 'coin',
    'currency': 'coin',
    'sports-card': 'sports-card',
    'trading-card': 'tcg',
    'pokemon': 'pokemon',
    'comic': 'comic',
    'funko': 'funko',
  };

  return categoryMap[category] || 'other';
}

/**
 * Convert MarketPrice from unified service to UnifiedMarketPrice type
 */
function toUnifiedMarketPrice(mp: MarketPrice): UnifiedMarketPrice {
  return {
    itemId: mp.itemId,
    name: mp.name,
    category: mp.category,
    source: mp.source,
    sourceUrl: mp.sourceUrl,
    prices: mp.prices,
    lastUpdated: mp.lastUpdated,
  };
}

/**
 * Calculate estimated value by aggregating prices from all sources
 */
function calculateEstimatedValue(
  prices: MarketPrice[],
  grade?: string
): { low: number; mid: number; high: number } | null {
  if (prices.length === 0) return null;

  const allMids: number[] = [];

  for (const p of prices) {
    // Try to get graded price if grade is specified
    if (grade && p.prices.graded) {
      // Look for matching grade (case-insensitive, partial match)
      const normalizedGrade = grade.toUpperCase();
      for (const [gradeKey, range] of Object.entries(p.prices.graded)) {
        if (gradeKey.toUpperCase().includes(normalizedGrade) ||
            normalizedGrade.includes(gradeKey.toUpperCase())) {
          allMids.push(range.mid);
          break;
        }
      }
    }

    // Fall back to raw price or first graded price
    if (allMids.length === 0 || !grade) {
      if (p.prices.raw?.mid) {
        allMids.push(p.prices.raw.mid);
      } else if (p.prices.graded) {
        const firstGrade = Object.values(p.prices.graded)[0];
        if (firstGrade?.mid) {
          allMids.push(firstGrade.mid);
        }
      }
    }
  }

  if (allMids.length === 0) return null;

  const avg = allMids.reduce((a, b) => a + b, 0) / allMids.length;
  return {
    low: Math.round(avg * 0.8),
    mid: Math.round(avg),
    high: Math.round(avg * 1.2),
  };
}

export async function fetchMarketData(
  searchTerms: string[],
  coinDetails?: { year: number | null; denomination: string; mint: string | null; grade: string },
  category?: string
): Promise<MarketData> {
  // Run legacy eBay/Redbook/Greysheet fetches in parallel with unified market data
  const [ebayStats, buyNow, redbookPrice, greysheetPrice, unifiedResults] = await Promise.all([
    getEbayStats(searchTerms),
    findCheapestBuyNow(searchTerms),
    coinDetails
      ? getRedbookPrice(coinDetails.year, coinDetails.denomination, coinDetails.mint, coinDetails.grade)
      : Promise.resolve(null),
    coinDetails
      ? getGreysheetPrice(coinDetails.year, coinDetails.denomination, coinDetails.mint, coinDetails.grade)
      : Promise.resolve(null),
    // Fetch from unified market data service
    UnifiedMarketData.search(searchTerms.join(' '), {
      category: mapToUnifiedCategory(category),
      limit: 10,
    }).catch((err) => {
      console.warn('Unified market data fetch failed:', err);
      return [] as MarketPrice[];
    }),
  ]);

  // Convert unified results to our type
  const unifiedPrices = unifiedResults.length > 0
    ? unifiedResults.map(toUnifiedMarketPrice)
    : null;

  // Calculate aggregated estimated value from unified prices
  const estimatedValue = unifiedResults.length > 0
    ? calculateEstimatedValue(unifiedResults, coinDetails?.grade)
    : null;

  return {
    ebayStats,
    redbookPrice,
    greysheetPrice,
    buyNow,
    unifiedPrices,
    estimatedValue,
    fetchedAt: new Date(),
  };
}
