/**
 * Market Data Service
 * Fetches comparable sales and price guide data from eBay, Redbook, Greysheet, etc.
 */

import * as cheerio from "cheerio";
import type {
  MarketDataResult,
  ComparableSale,
  PriceGuideData,
  MarketDataSource,
  CoinIdentification,
  CardIdentification,
  ProductCategory,
} from "./types";

// ============================================================================
// Configuration
// ============================================================================

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

const DEFAULT_HEADERS = {
  "User-Agent": USER_AGENT,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

// ============================================================================
// eBay Sold Listings
// ============================================================================

/**
 * Fetch sold listings from eBay
 */
export async function fetchEbaySoldListings(
  searchQuery: string,
  limit = 20
): Promise<{ items: ComparableSale[]; errors: string[] }> {
  const items: ComparableSale[] = [];
  const errors: string[] = [];

  try {
    const encodedQuery = encodeURIComponent(searchQuery);
    const url = `https://www.ebay.com/sch/i.html?_nkw=${encodedQuery}&LH_Complete=1&LH_Sold=1&_sop=13`;

    const response = await fetch(url, { headers: DEFAULT_HEADERS });

    if (!response.ok) {
      throw new Error(`eBay fetch failed: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    $(".s-item").each((i, el) => {
      if (i >= limit) return false;

      const $item = $(el);
      const title = $item.find(".s-item__title").text().trim();
      const priceText = $item.find(".s-item__price").text();
      const price = parsePrice(priceText);
      const itemUrl = $item.find(".s-item__link").attr("href") || "";
      const imageUrl = $item.find(".s-item__image-img").attr("src") || "";
      const dateText = $item.find(".s-item__ended-date, .s-item__endedDate").text();

      if (title && price > 0 && !title.includes("Shop on eBay")) {
        items.push({
          title,
          price,
          soldDate: parseSoldDate(dateText),
          source: "ebay",
          url: itemUrl,
          grade: extractGradeFromTitle(title),
          certification: extractCertificationFromTitle(title),
          imageUrl: imageUrl || null,
          relevanceScore: 0.8, // Will be refined later
        });
      }
    });
  } catch (error) {
    errors.push(`eBay error: ${error instanceof Error ? error.message : "Unknown"}`);
  }

  return { items, errors };
}

// ============================================================================
// Heritage Auctions
// ============================================================================

/**
 * Fetch auction results from Heritage Auctions
 */
export async function fetchHeritageAuctions(
  searchQuery: string,
  limit = 20
): Promise<{ items: ComparableSale[]; errors: string[] }> {
  const items: ComparableSale[] = [];
  const errors: string[] = [];

  try {
    const encodedQuery = encodeURIComponent(searchQuery);
    const url = `https://coins.ha.com/c/search-results.zx?N=790+231&Ntt=${encodedQuery}`;

    const response = await fetch(url, { headers: DEFAULT_HEADERS });

    if (!response.ok) {
      throw new Error(`Heritage fetch failed: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    $(".search-result-item").each((i, el) => {
      if (i >= limit) return false;

      const $item = $(el);
      const title = $item.find(".item-title").text().trim();
      const priceText = $item.find(".price-realized").text();
      const price = parsePrice(priceText);
      let itemUrl = $item.find("a").attr("href") || "";
      const imageUrl = $item.find("img").attr("src") || "";

      if (!itemUrl.startsWith("http")) {
        itemUrl = `https://coins.ha.com${itemUrl}`;
      }

      if (title && price > 0) {
        items.push({
          title,
          price,
          soldDate: null,
          source: "heritage",
          url: itemUrl,
          grade: extractGradeFromTitle(title),
          certification: extractCertificationFromTitle(title),
          imageUrl: imageUrl || null,
          relevanceScore: 0.85,
        });
      }
    });
  } catch (error) {
    errors.push(`Heritage error: ${error instanceof Error ? error.message : "Unknown"}`);
  }

  return { items, errors };
}

// ============================================================================
// Great Collections
// ============================================================================

/**
 * Fetch auction results from Great Collections
 */
export async function fetchGreatCollections(
  searchQuery: string,
  limit = 20
): Promise<{ items: ComparableSale[]; errors: string[] }> {
  const items: ComparableSale[] = [];
  const errors: string[] = [];

  try {
    const encodedQuery = encodeURIComponent(searchQuery);
    const url = `https://www.greatcollections.com/search?q=${encodedQuery}&type=archive`;

    const response = await fetch(url, { headers: DEFAULT_HEADERS });

    if (!response.ok) {
      throw new Error(`Great Collections fetch failed: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    $(".lot-card, .search-result").each((i, el) => {
      if (i >= limit) return false;

      const $item = $(el);
      const title = $item.find(".lot-title, .title").text().trim();
      const priceText = $item.find(".price-realized, .sold-price").text();
      const price = parsePrice(priceText);
      let itemUrl = $item.find("a").attr("href") || "";

      if (!itemUrl.startsWith("http")) {
        itemUrl = `https://www.greatcollections.com${itemUrl}`;
      }

      if (title && price > 0) {
        items.push({
          title,
          price,
          soldDate: null,
          source: "greatcollections",
          url: itemUrl,
          grade: extractGradeFromTitle(title),
          certification: extractCertificationFromTitle(title),
          imageUrl: null,
          relevanceScore: 0.85,
        });
      }
    });
  } catch (error) {
    errors.push(`Great Collections error: ${error instanceof Error ? error.message : "Unknown"}`);
  }

  return { items, errors };
}

// ============================================================================
// PCGS Price Guide
// ============================================================================

/**
 * Fetch price guide data from PCGS
 */
export async function fetchPCGSPriceGuide(
  pcgsNumber: string
): Promise<{ prices: PriceGuideData[]; errors: string[] }> {
  const prices: PriceGuideData[] = [];
  const errors: string[] = [];

  try {
    const url = `https://www.pcgs.com/coinfacts/coin/${pcgsNumber}`;

    const response = await fetch(url, { headers: DEFAULT_HEADERS });

    if (!response.ok) {
      throw new Error(`PCGS fetch failed: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const source: MarketDataSource = {
      name: "pcgs",
      lastUpdated: new Date(),
      reliability: 0.95,
    };

    $(".price-guide-table tr, .pricing-table tr").each((_, row) => {
      const grade = $(row).find("td:first-child").text().trim();
      const priceText = $(row).find("td:nth-child(2)").text();
      const price = parsePrice(priceText);
      const popText = $(row).find("td:nth-child(3)").text().trim();
      const population = parseInt(popText.replace(/,/g, ""), 10) || null;

      if (grade && price > 0) {
        prices.push({
          source,
          grade,
          price,
          population,
          trend: null,
          lastSaleDate: null,
          lastSalePrice: null,
        });
      }
    });
  } catch (error) {
    errors.push(`PCGS error: ${error instanceof Error ? error.message : "Unknown"}`);
  }

  return { prices, errors };
}

// ============================================================================
// NGC Price Guide
// ============================================================================

/**
 * Fetch price guide data from NGC
 */
export async function fetchNGCPriceGuide(
  coinId: string
): Promise<{ prices: PriceGuideData[]; errors: string[] }> {
  const prices: PriceGuideData[] = [];
  const errors: string[] = [];

  try {
    const url = `https://www.ngccoin.com/coin-explorer/coin/${coinId}`;

    const response = await fetch(url, { headers: DEFAULT_HEADERS });

    if (!response.ok) {
      throw new Error(`NGC fetch failed: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const source: MarketDataSource = {
      name: "ngc",
      lastUpdated: new Date(),
      reliability: 0.95,
    };

    $(".price-guide-row, .pricing-row").each((_, row) => {
      const grade = $(row).find(".grade-cell, td:first-child").text().trim();
      const priceText = $(row).find(".price-cell, td:nth-child(2)").text();
      const price = parsePrice(priceText);

      if (grade && price > 0) {
        prices.push({
          source,
          grade,
          price,
          population: null,
          trend: null,
          lastSaleDate: null,
          lastSalePrice: null,
        });
      }
    });
  } catch (error) {
    errors.push(`NGC error: ${error instanceof Error ? error.message : "Unknown"}`);
  }

  return { prices, errors };
}

// ============================================================================
// Greysheet (CDN) Pricing
// ============================================================================

/**
 * Fetch wholesale pricing from Greysheet/CDN
 * Note: Greysheet requires subscription for full access
 */
export async function fetchGreysheetPricing(
  coinDescription: string
): Promise<{ bid: number | null; ask: number | null; errors: string[] }> {
  const errors: string[] = [];

  try {
    // Greysheet API would require authentication
    // This is a placeholder for the integration
    const encodedQuery = encodeURIComponent(coinDescription);
    const url = `https://www.greysheet.com/search?q=${encodedQuery}`;

    const response = await fetch(url, { headers: DEFAULT_HEADERS });

    if (!response.ok) {
      throw new Error(`Greysheet fetch failed: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const bidText = $(".bid-price, .wholesale-bid").first().text();
    const askText = $(".ask-price, .wholesale-ask").first().text();

    return {
      bid: parsePrice(bidText) || null,
      ask: parsePrice(askText) || null,
      errors,
    };
  } catch (error) {
    errors.push(`Greysheet error: ${error instanceof Error ? error.message : "Unknown"}`);
    return { bid: null, ask: null, errors };
  }
}

// ============================================================================
// Redbook Pricing (US Coins)
// ============================================================================

/**
 * Get estimated Redbook values for US coins
 * Redbook values are typically retail prices
 */
export async function fetchRedbookPricing(
  year: number,
  denomination: string,
  mint?: string
): Promise<{ prices: PriceGuideData[]; errors: string[] }> {
  const prices: PriceGuideData[] = [];
  const errors: string[] = [];

  try {
    // Redbook doesn't have a public API - would need to use their app or database
    // This is a placeholder showing the expected interface
    const searchTerm = `${year} ${denomination}${mint ? ` ${mint}` : ""}`;
    const encodedQuery = encodeURIComponent(searchTerm);

    // Alternative: use PCGS CoinFacts which has similar data
    const url = `https://www.pcgs.com/coinfacts/search?q=${encodedQuery}`;

    const response = await fetch(url, { headers: DEFAULT_HEADERS });

    if (!response.ok) {
      throw new Error(`Redbook/PCGS fetch failed: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const source: MarketDataSource = {
      name: "redbook",
      lastUpdated: new Date(),
      reliability: 0.85,
    };

    // Parse available grades and prices
    $(".search-result-item").first().find(".price-guide tr").each((_, row) => {
      const grade = $(row).find("td:first-child").text().trim();
      const priceText = $(row).find("td:nth-child(2)").text();
      const price = parsePrice(priceText);

      if (grade && price > 0) {
        prices.push({
          source,
          grade,
          price,
          population: null,
          trend: null,
          lastSaleDate: null,
          lastSalePrice: null,
        });
      }
    });
  } catch (error) {
    errors.push(`Redbook error: ${error instanceof Error ? error.message : "Unknown"}`);
  }

  return { prices, errors };
}

// ============================================================================
// PSA Card Pricing
// ============================================================================

/**
 * Fetch card pricing from PSA
 */
export async function fetchPSAPricing(
  certNumber: string
): Promise<{ price: number | null; population: { thisGrade: number; higher: number } | null; errors: string[] }> {
  const errors: string[] = [];

  try {
    const url = `https://www.psacard.com/cert/${certNumber}`;

    const response = await fetch(url, { headers: DEFAULT_HEADERS });

    if (!response.ok) {
      throw new Error(`PSA fetch failed: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const priceText = $(".smr-value, .price-guide-value").text();
    const price = parsePrice(priceText) || null;

    const popThisText = $(".pop-this-grade, .population-this").text();
    const popHigherText = $(".pop-higher, .population-higher").text();

    const population = {
      thisGrade: parseInt(popThisText.replace(/,/g, ""), 10) || 0,
      higher: parseInt(popHigherText.replace(/,/g, ""), 10) || 0,
    };

    return { price, population, errors };
  } catch (error) {
    errors.push(`PSA error: ${error instanceof Error ? error.message : "Unknown"}`);
    return { price: null, population: null, errors };
  }
}

// ============================================================================
// Multi-Source Search
// ============================================================================

/**
 * Search multiple sources for comparable sales
 */
export async function searchComparables(
  query: string,
  sources: MarketDataSource["name"][] = ["ebay", "heritage"],
  limit = 10
): Promise<{ items: ComparableSale[]; errors: string[] }> {
  const allItems: ComparableSale[] = [];
  const allErrors: string[] = [];

  const fetchPromises = sources.map(async (source) => {
    switch (source) {
      case "ebay":
        return fetchEbaySoldListings(query, limit);
      case "heritage":
        return fetchHeritageAuctions(query, limit);
      case "greatcollections":
        return fetchGreatCollections(query, limit);
      default:
        return { items: [], errors: [] };
    }
  });

  const results = await Promise.all(fetchPromises);

  for (const result of results) {
    allItems.push(...result.items);
    allErrors.push(...result.errors);
  }

  // Sort by relevance then date
  allItems.sort((a, b) => {
    if (b.relevanceScore !== a.relevanceScore) {
      return b.relevanceScore - a.relevanceScore;
    }
    if (a.soldDate && b.soldDate) {
      return b.soldDate.getTime() - a.soldDate.getTime();
    }
    return 0;
  });

  return { items: allItems, errors: allErrors };
}

// ============================================================================
// Build Search Query
// ============================================================================

/**
 * Build optimized search query from identification
 */
export function buildSearchQuery(
  category: ProductCategory,
  coinId?: CoinIdentification | null,
  cardId?: CardIdentification | null,
  grade?: string
): string {
  const parts: string[] = [];

  if (category === "coin" && coinId) {
    if (coinId.year) parts.push(coinId.year.toString());
    if (coinId.mintMark) parts.push(coinId.mintMark);
    parts.push(coinId.commonName || coinId.denomination);
    if (grade) parts.push(grade);
    if (coinId.certification) parts.push(coinId.certification);
  } else if (category === "card" && cardId) {
    if (cardId.year) parts.push(cardId.year.toString());
    if (cardId.manufacturer) parts.push(cardId.manufacturer);
    if (cardId.setName) parts.push(cardId.setName);
    if (cardId.playerName) parts.push(cardId.playerName);
    if (cardId.cardNumber) parts.push(`#${cardId.cardNumber}`);
    if (cardId.parallel) parts.push(cardId.parallel);
    if (grade) parts.push(`PSA ${grade}`);
  }

  return parts.join(" ");
}

// ============================================================================
// Main Market Data Function
// ============================================================================

/**
 * Fetch comprehensive market data for a product
 */
export async function fetchMarketData(
  category: ProductCategory,
  identification: CoinIdentification | CardIdentification | null,
  grade?: string,
  options?: {
    sources?: MarketDataSource["name"][];
    maxComparables?: number;
    includeWholesale?: boolean;
  }
): Promise<MarketDataResult> {
  const sources = options?.sources || ["ebay", "heritage"];
  const maxComparables = options?.maxComparables || 20;
  const errors: string[] = [];

  // Build search query
  const query = buildSearchQuery(
    category,
    category === "coin" ? (identification as CoinIdentification) : null,
    category === "card" ? (identification as CardIdentification) : null,
    grade
  );

  if (!query) {
    return {
      comparableSales: [],
      priceGuideData: [],
      marketStats: {
        avgPrice: 0,
        medianPrice: 0,
        lowPrice: 0,
        highPrice: 0,
        sampleSize: 0,
        dateRange: { from: null, to: null },
      },
      spotPrice: null,
      meltValue: null,
      premiumOverMelt: null,
      errors: ["Unable to build search query from identification"],
    };
  }

  // Fetch comparables
  const comparablesResult = await searchComparables(query, sources, maxComparables);
  const comparableSales = comparablesResult.items;
  errors.push(...comparablesResult.errors);

  // Fetch price guide data
  const priceGuideData: PriceGuideData[] = [];

  if (category === "coin") {
    const coinId = identification as CoinIdentification;
    if (coinId?.pcgsNumber) {
      const pcgsResult = await fetchPCGSPriceGuide(coinId.pcgsNumber);
      priceGuideData.push(...pcgsResult.prices);
      errors.push(...pcgsResult.errors);
    }
  }

  // Calculate market statistics
  const marketStats = calculateMarketStats(comparableSales);

  // Get spot price for precious metals
  let spotPrice: number | null = null;
  let meltValue: number | null = null;
  let premiumOverMelt: number | null = null;

  if (category === "coin" || category === "bullion") {
    const coinId = identification as CoinIdentification;
    if (coinId?.metalType && coinId.metalType !== "none" && coinId.weight) {
      // Would integrate with metal-prices.ts
      // spotPrice = await getSpotPrice(coinId.metalType);
      // meltValue = spotPrice * coinId.weight;
      // premiumOverMelt = ((marketStats.avgPrice - meltValue) / meltValue) * 100;
    }
  }

  return {
    comparableSales,
    priceGuideData,
    marketStats,
    spotPrice,
    meltValue,
    premiumOverMelt,
    errors,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse price from text
 */
function parsePrice(priceText: string): number {
  const cleaned = priceText.replace(/[^\d.,]/g, "").replace(",", "");
  const price = parseFloat(cleaned);
  return isNaN(price) ? 0 : price;
}

/**
 * Parse sold date from text
 */
function parseSoldDate(dateText: string): Date | null {
  if (!dateText) return null;

  // Common formats: "Sold Jan 15, 2024" or "Jan 15"
  const cleaned = dateText.replace(/sold\s*/i, "").trim();

  try {
    const date = new Date(cleaned);
    if (!isNaN(date.getTime())) {
      return date;
    }
  } catch {
    // Ignore parsing errors
  }

  return null;
}

/**
 * Extract grade from listing title
 */
function extractGradeFromTitle(title: string): string | null {
  // Coin grades: MS65, VF30, PR69DCAM, etc.
  const coinGradeMatch = title.match(/\b(MS|PR|PF|AU|EF|XF|VF|F|VG|G|AG|FR|P)-?\d{1,2}(DCAM|CAM|PL|DPL|RD|RB|BN)?\b/i);
  if (coinGradeMatch) {
    return coinGradeMatch[0].toUpperCase();
  }

  // Card grades: PSA 10, BGS 9.5, SGC 98
  const cardGradeMatch = title.match(/\b(PSA|BGS|SGC|CGC)\s*(\d+\.?\d*)\b/i);
  if (cardGradeMatch) {
    return `${cardGradeMatch[1].toUpperCase()} ${cardGradeMatch[2]}`;
  }

  return null;
}

/**
 * Extract certification from listing title
 */
function extractCertificationFromTitle(title: string): string | null {
  const certMatch = title.match(/\b(PCGS|NGC|ANACS|ICG|CAC|PSA|BGS|SGC|CGC)\b/i);
  return certMatch ? certMatch[1].toUpperCase() : null;
}

/**
 * Calculate market statistics from comparable sales
 */
function calculateMarketStats(items: ComparableSale[]): MarketDataResult["marketStats"] {
  if (items.length === 0) {
    return {
      avgPrice: 0,
      medianPrice: 0,
      lowPrice: 0,
      highPrice: 0,
      sampleSize: 0,
      dateRange: { from: null, to: null },
    };
  }

  const prices = items.map((i) => i.price).sort((a, b) => a - b);
  const sum = prices.reduce((acc, p) => acc + p, 0);

  const dates = items
    .map((i) => i.soldDate)
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime());

  return {
    avgPrice: Math.round((sum / prices.length) * 100) / 100,
    medianPrice: prices[Math.floor(prices.length / 2)],
    lowPrice: prices[0],
    highPrice: prices[prices.length - 1],
    sampleSize: prices.length,
    dateRange: {
      from: dates[0] || null,
      to: dates[dates.length - 1] || null,
    },
  };
}

/**
 * Refine relevance scores based on grade matching
 */
export function refineRelevanceScores(
  items: ComparableSale[],
  targetGrade: string
): ComparableSale[] {
  return items.map((item) => {
    let score = item.relevanceScore;

    if (item.grade) {
      if (item.grade === targetGrade) {
        score = Math.min(1, score + 0.15);
      } else if (isGradeClose(item.grade, targetGrade)) {
        score = Math.min(1, score + 0.05);
      } else {
        score = Math.max(0, score - 0.1);
      }
    }

    if (item.certification) {
      score = Math.min(1, score + 0.05);
    }

    return { ...item, relevanceScore: score };
  });
}

/**
 * Check if two grades are close
 */
function isGradeClose(grade1: string, grade2: string): boolean {
  const num1 = extractNumericGrade(grade1);
  const num2 = extractNumericGrade(grade2);

  if (num1 === null || num2 === null) return false;

  return Math.abs(num1 - num2) <= 3;
}

/**
 * Extract numeric portion of grade
 */
function extractNumericGrade(grade: string): number | null {
  const match = grade.match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}
