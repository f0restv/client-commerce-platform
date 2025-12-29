/**
 * eBay Comparable Sales Service
 *
 * Fetches comparable sales data from eBay for pricing analysis.
 * Uses the Browse API which requires app-level authentication (no user auth needed).
 */

import { getAppToken, getConfig, getApiBaseUrl } from "./auth";

// =============================================================================
// Types
// =============================================================================

export interface EbayCompSale {
  itemId: string;
  title: string;
  price: number;
  currency: string;
  condition: string;
  soldDate?: string;
  listingUrl: string;
  imageUrl?: string;
  seller?: {
    username: string;
    feedbackScore: number;
    feedbackPercentage: number;
  };
  shippingCost?: number;
  isBuyItNow: boolean;
}

export interface CompSearchOptions {
  sold?: boolean;
  limit?: number;
  minPrice?: number;
  maxPrice?: number;
  condition?: string;
  sortBy?: "price" | "date" | "relevance";
}

interface EbayItemSummary {
  itemId: string;
  title: string;
  price: {
    value: string;
    currency: string;
  };
  condition: string;
  conditionId: string;
  itemEndDate?: string;
  itemWebUrl: string;
  image?: {
    imageUrl: string;
  };
  seller?: {
    username: string;
    feedbackScore: number;
    feedbackPercentage: string;
  };
  shippingOptions?: {
    shippingCost?: {
      value: string;
    };
  }[];
  buyingOptions?: string[];
}

// =============================================================================
// Comparable Sales Search
// =============================================================================

/**
 * Get comparable sales from eBay for pricing analysis
 * @param searchTerms - Array of search terms to query
 * @param options - Search options (sold, limit, price range, etc.)
 */
export async function getComparableSales(
  searchTerms: string[],
  options: CompSearchOptions = {}
): Promise<EbayCompSale[]> {
  const appToken = await getAppToken();
  const config = getConfig();
  const baseUrl = getApiBaseUrl(config.sandbox);

  const query = searchTerms.join(" ");
  const limit = options.limit || 20;

  // Build filter string
  const filters: string[] = [];

  if (options.sold) {
    // For completed/sold items, we need to use a date filter
    // eBay Browse API completed items filter
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    filters.push(`itemEndDate:[${ninetyDaysAgo.toISOString()}]`);
  }

  if (options.minPrice !== undefined) {
    filters.push(`price:[${options.minPrice}]`);
  }

  if (options.maxPrice !== undefined) {
    filters.push(`price:[..${options.maxPrice}]`);
  }

  if (options.condition) {
    filters.push(`conditionIds:{${mapConditionToId(options.condition)}}`);
  }

  // Build URL parameters
  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
  });

  if (filters.length > 0) {
    params.set("filter", filters.join(","));
  }

  // Sort order
  if (options.sortBy === "price") {
    params.set("sort", "price");
  } else if (options.sortBy === "date") {
    params.set("sort", "-itemEndDate");
  }

  const response = await fetch(
    `${baseUrl}/buy/browse/v1/item_summary/search?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${appToken}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`eBay search failed: ${errorText}`);
  }

  const data = await response.json();
  const items: EbayItemSummary[] = data.itemSummaries || [];

  return items.map(mapToCompSale);
}

/**
 * Get sold comparables specifically (past 90 days)
 */
export async function getSoldComparables(
  searchTerms: string[],
  limit: number = 20
): Promise<EbayCompSale[]> {
  return getComparableSales(searchTerms, { sold: true, limit });
}

/**
 * Get active listings for price comparison
 */
export async function getActiveComparables(
  searchTerms: string[],
  limit: number = 20
): Promise<EbayCompSale[]> {
  return getComparableSales(searchTerms, { sold: false, limit });
}

/**
 * Get pricing statistics from comparable sales
 */
export async function getPricingStats(
  searchTerms: string[],
  options: { includeSold?: boolean; includeActive?: boolean } = {}
): Promise<{
  soldStats?: {
    average: number;
    median: number;
    low: number;
    high: number;
    count: number;
  };
  activeStats?: {
    average: number;
    median: number;
    low: number;
    high: number;
    count: number;
  };
  suggestedPrice?: number;
}> {
  const result: {
    soldStats?: {
      average: number;
      median: number;
      low: number;
      high: number;
      count: number;
    };
    activeStats?: {
      average: number;
      median: number;
      low: number;
      high: number;
      count: number;
    };
    suggestedPrice?: number;
  } = {};

  // Get sold items stats
  if (options.includeSold !== false) {
    const soldItems = await getSoldComparables(searchTerms, 50);
    if (soldItems.length > 0) {
      result.soldStats = calculateStats(soldItems.map((i) => i.price));
    }
  }

  // Get active listings stats
  if (options.includeActive !== false) {
    const activeItems = await getActiveComparables(searchTerms, 50);
    if (activeItems.length > 0) {
      result.activeStats = calculateStats(activeItems.map((i) => i.price));
    }
  }

  // Calculate suggested price (weighted average of sold median and active median)
  if (result.soldStats && result.activeStats) {
    // Weight sold prices more heavily (70/30)
    result.suggestedPrice =
      result.soldStats.median * 0.7 + result.activeStats.median * 0.3;
  } else if (result.soldStats) {
    result.suggestedPrice = result.soldStats.median;
  } else if (result.activeStats) {
    // Discount active by 10% since items haven't sold yet
    result.suggestedPrice = result.activeStats.median * 0.9;
  }

  return result;
}

// =============================================================================
// Search for Specific Item
// =============================================================================

/**
 * Search for comparables for a specific coin/item
 */
export async function searchCoinComparables(
  year?: number,
  mint?: string,
  denomination?: string,
  grade?: string,
  certification?: string,
  limit: number = 20
): Promise<EbayCompSale[]> {
  const searchTerms: string[] = [];

  if (year) searchTerms.push(year.toString());
  if (mint) searchTerms.push(mint);
  if (denomination) searchTerms.push(denomination);
  if (grade) searchTerms.push(grade);
  if (certification) searchTerms.push(certification);

  if (searchTerms.length === 0) {
    throw new Error("At least one search criteria required");
  }

  return getComparableSales(searchTerms, { sold: true, limit });
}

/**
 * Get comprehensive market data for a product
 */
export async function getMarketData(searchTerms: string[]): Promise<{
  soldComps: EbayCompSale[];
  activeComps: EbayCompSale[];
  pricingStats: Awaited<ReturnType<typeof getPricingStats>>;
}> {
  const [soldComps, activeComps, pricingStats] = await Promise.all([
    getSoldComparables(searchTerms, 25),
    getActiveComparables(searchTerms, 25),
    getPricingStats(searchTerms),
  ]);

  return { soldComps, activeComps, pricingStats };
}

// =============================================================================
// Helpers
// =============================================================================

function mapToCompSale(item: EbayItemSummary): EbayCompSale {
  return {
    itemId: item.itemId,
    title: item.title,
    price: parseFloat(item.price.value),
    currency: item.price.currency,
    condition: item.condition,
    soldDate: item.itemEndDate,
    listingUrl: item.itemWebUrl,
    imageUrl: item.image?.imageUrl,
    seller: item.seller
      ? {
          username: item.seller.username,
          feedbackScore: item.seller.feedbackScore,
          feedbackPercentage: parseFloat(item.seller.feedbackPercentage || "0"),
        }
      : undefined,
    shippingCost: item.shippingOptions?.[0]?.shippingCost
      ? parseFloat(item.shippingOptions[0].shippingCost.value)
      : undefined,
    isBuyItNow: item.buyingOptions?.includes("FIXED_PRICE") || false,
  };
}

function mapConditionToId(condition: string): string {
  const conditionMap: Record<string, string> = {
    new: "1000",
    "like new": "2750",
    "used - excellent": "3000",
    excellent: "3000",
    "used - very good": "4000",
    "very good": "4000",
    "used - good": "5000",
    good: "5000",
    "used - acceptable": "6000",
    acceptable: "6000",
  };
  return conditionMap[condition.toLowerCase()] || "3000";
}

function calculateStats(prices: number[]): {
  average: number;
  median: number;
  low: number;
  high: number;
  count: number;
} {
  if (prices.length === 0) {
    return { average: 0, median: 0, low: 0, high: 0, count: 0 };
  }

  const sorted = [...prices].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, val) => acc + val, 0);

  const median =
    sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];

  return {
    average: sum / sorted.length,
    median,
    low: sorted[0],
    high: sorted[sorted.length - 1],
    count: sorted.length,
  };
}

// =============================================================================
// Category Search
// =============================================================================

/**
 * Search within a specific eBay category
 */
export async function searchByCategory(
  categoryId: string,
  searchTerms?: string[],
  options: CompSearchOptions = {}
): Promise<EbayCompSale[]> {
  const appToken = await getAppToken();
  const config = getConfig();
  const baseUrl = getApiBaseUrl(config.sandbox);

  const params = new URLSearchParams({
    category_ids: categoryId,
    limit: String(options.limit || 20),
  });

  if (searchTerms && searchTerms.length > 0) {
    params.set("q", searchTerms.join(" "));
  }

  const response = await fetch(
    `${baseUrl}/buy/browse/v1/item_summary/search?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${appToken}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`eBay category search failed: ${errorText}`);
  }

  const data = await response.json();
  const items: EbayItemSummary[] = data.itemSummaries || [];

  return items.map(mapToCompSale);
}

// Common eBay coin category IDs for convenience
export const EBAY_COIN_CATEGORIES = {
  US_COINS: "11116",
  WORLD_COINS: "11117",
  BULLION: "39482",
  GOLD_BULLION: "179028",
  SILVER_BULLION: "179022",
  ANCIENT_COINS: "4733",
  CURRENCY: "11118",
  MEDALS: "11094",
  TOKENS: "11093",
} as const;
