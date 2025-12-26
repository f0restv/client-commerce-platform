import type { MarketData, MarketComparable } from './types';

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

export async function fetchMarketData(
  searchTerms: string[],
  coinDetails?: { year: number | null; denomination: string; mint: string | null; grade: string }
): Promise<MarketData> {
  const [ebayStats, buyNow, redbookPrice, greysheetPrice] = await Promise.all([
    getEbayStats(searchTerms),
    findCheapestBuyNow(searchTerms),
    coinDetails
      ? getRedbookPrice(coinDetails.year, coinDetails.denomination, coinDetails.mint, coinDetails.grade)
      : Promise.resolve(null),
    coinDetails
      ? getGreysheetPrice(coinDetails.year, coinDetails.denomination, coinDetails.mint, coinDetails.grade)
      : Promise.resolve(null),
  ]);

  return {
    ebayStats,
    redbookPrice,
    greysheetPrice,
    buyNow,
    fetchedAt: new Date(),
  };
}
