import * as cheerio from "cheerio";
import { db } from "./db";

interface ScrapedItem {
  title: string;
  price: number;
  description?: string;
  imageUrls: string[];
  url: string;
  source: string;
  soldDate?: Date;
}

interface ScrapingResult {
  items: ScrapedItem[];
  totalFound: number;
  errors: string[];
}

/**
 * Scrape eBay sold listings for comparable data
 */
export async function scrapeEbaySold(
  searchQuery: string,
  limit = 20
): Promise<ScrapingResult> {
  const items: ScrapedItem[] = [];
  const errors: string[] = [];

  try {
    const encodedQuery = encodeURIComponent(searchQuery);
    const url = `https://www.ebay.com/sch/i.html?_nkw=${encodedQuery}&LH_Complete=1&LH_Sold=1&_sop=13`;

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

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

      if (title && price > 0 && !title.includes("Shop on eBay")) {
        items.push({
          title,
          price,
          imageUrls: imageUrl ? [imageUrl] : [],
          url: itemUrl,
          source: "ebay",
        });
      }
    });
  } catch (error) {
    errors.push(`eBay scraping error: ${error instanceof Error ? error.message : "Unknown"}`);
  }

  return { items, totalFound: items.length, errors };
}

/**
 * Scrape Heritage Auctions for comparable data
 */
export async function scrapeHeritage(
  searchQuery: string,
  limit = 20
): Promise<ScrapingResult> {
  const items: ScrapedItem[] = [];
  const errors: string[] = [];

  try {
    const encodedQuery = encodeURIComponent(searchQuery);
    const url = `https://coins.ha.com/c/search-results.zx?N=790+231&Ntt=${encodedQuery}`;

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

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
      const itemUrl = $item.find("a").attr("href") || "";
      const imageUrl = $item.find("img").attr("src") || "";

      if (title && price > 0) {
        items.push({
          title,
          price,
          imageUrls: imageUrl ? [imageUrl] : [],
          url: itemUrl.startsWith("http") ? itemUrl : `https://coins.ha.com${itemUrl}`,
          source: "heritage",
        });
      }
    });
  } catch (error) {
    errors.push(`Heritage scraping error: ${error instanceof Error ? error.message : "Unknown"}`);
  }

  return { items, totalFound: items.length, errors };
}

/**
 * Scrape PCGS price guide
 */
export async function scrapePCGSPriceGuide(
  pcgsNumber: string
): Promise<{ prices: Record<string, number>; population?: Record<string, number> } | null> {
  try {
    const url = `https://www.pcgs.com/coinfacts/coin/${pcgsNumber}`;

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const prices: Record<string, number> = {};
    const population: Record<string, number> = {};

    // Parse price guide table
    $(".price-guide-table tr").each((_, row) => {
      const grade = $(row).find("td:first-child").text().trim();
      const priceText = $(row).find("td:nth-child(2)").text();
      const price = parsePrice(priceText);
      if (grade && price > 0) {
        prices[grade] = price;
      }
    });

    // Parse population data
    $(".population-table tr").each((_, row) => {
      const grade = $(row).find("td:first-child").text().trim();
      const popText = $(row).find("td:nth-child(2)").text().trim();
      const pop = parseInt(popText.replace(/,/g, ""), 10);
      if (grade && !isNaN(pop)) {
        population[grade] = pop;
      }
    });

    return { prices, population };
  } catch {
    return null;
  }
}

/**
 * Search multiple sources for comparables
 */
export async function searchComparables(
  query: string,
  sources: ("ebay" | "heritage")[] = ["ebay", "heritage"]
): Promise<ScrapedItem[]> {
  const results: ScrapedItem[] = [];

  const promises = sources.map(async (source) => {
    switch (source) {
      case "ebay":
        return scrapeEbaySold(query, 10);
      case "heritage":
        return scrapeHeritage(query, 10);
      default:
        return { items: [], totalFound: 0, errors: [] };
    }
  });

  const allResults = await Promise.all(promises);

  for (const result of allResults) {
    results.push(...result.items);
  }

  return results;
}

/**
 * Create a scraping job to import items from a URL
 */
export async function createScrapingJob(
  sourceUrl: string,
  config?: Record<string, unknown>
): Promise<string> {
  const job = await db.scrapingJob.create({
    data: {
      source: sourceUrl,
      status: "PENDING",
      config: config ? JSON.parse(JSON.stringify(config)) : undefined,
    },
  });

  // In production, this would queue the job for background processing
  // processScrapingJob(job.id);

  return job.id;
}

/**
 * Process a scraping job (would run in background worker)
 */
export async function processScrapingJob(jobId: string): Promise<void> {
  await db.scrapingJob.update({
    where: { id: jobId },
    data: { status: "RUNNING", startedAt: new Date() },
  });

  try {
    const job = await db.scrapingJob.findUnique({ where: { id: jobId } });
    if (!job) throw new Error("Job not found");

    // Determine the source type and scrape accordingly
    const url = new URL(job.source);
    let items: ScrapedItem[] = [];

    if (url.hostname.includes("ebay")) {
      const result = await scrapeEbaySold(url.searchParams.get("_nkw") || "", 50);
      items = result.items;
    }

    await db.scrapingJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        itemsFound: items.length,
      },
    });
  } catch (error) {
    await db.scrapingJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errors: { error: error instanceof Error ? error.message : "Unknown error" },
      },
    });
  }
}

/**
 * Parse price from various formats
 */
function parsePrice(priceText: string): number {
  const cleaned = priceText
    .replace(/[^\d.,]/g, "")
    .replace(",", "");

  const price = parseFloat(cleaned);
  return isNaN(price) ? 0 : price;
}

/**
 * Calculate market statistics from scraped items
 */
export function calculateMarketStats(items: ScrapedItem[]): {
  avgPrice: number;
  lowPrice: number;
  highPrice: number;
  medianPrice: number;
  count: number;
} {
  if (items.length === 0) {
    return { avgPrice: 0, lowPrice: 0, highPrice: 0, medianPrice: 0, count: 0 };
  }

  const prices = items.map((i) => i.price).sort((a, b) => a - b);
  const sum = prices.reduce((acc, p) => acc + p, 0);

  return {
    avgPrice: Math.round((sum / prices.length) * 100) / 100,
    lowPrice: prices[0],
    highPrice: prices[prices.length - 1],
    medianPrice: prices[Math.floor(prices.length / 2)],
    count: prices.length,
  };
}
