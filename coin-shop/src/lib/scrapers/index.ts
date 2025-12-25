import * as cheerio from 'cheerio';
import type { ScrapedListing } from '@/types';

interface ScraperConfig {
  userAgent?: string;
  timeout?: number;
}

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

/**
 * Base scraper class with common functionality
 */
abstract class BaseScraper {
  protected config: ScraperConfig;

  constructor(config: ScraperConfig = {}) {
    this.config = {
      userAgent: config.userAgent || DEFAULT_USER_AGENT,
      timeout: config.timeout || 10000,
    };
  }

  protected async fetchPage(url: string): Promise<string> {
    const response = await fetch(url, {
      headers: {
        'User-Agent': this.config.userAgent!,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: AbortSignal.timeout(this.config.timeout!),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }

    return response.text();
  }

  abstract scrape(url: string): Promise<ScrapedListing>;
  abstract search(query: string, options?: Record<string, unknown>): Promise<ScrapedListing[]>;
}

/**
 * eBay Scraper
 */
export class EbayScraper extends BaseScraper {
  async scrape(url: string): Promise<ScrapedListing> {
    const html = await this.fetchPage(url);
    const $ = cheerio.load(html);

    const title = $('h1.x-item-title__mainTitle span').text().trim() ||
                  $('h1[itemprop="name"]').text().trim();

    const priceText = $('span[itemprop="price"]').text().trim() ||
                      $('.x-price-primary span').first().text().trim();
    const price = this.parsePrice(priceText);

    const description = $('#desc_ifr').attr('src') ? '' :
                       $('#viTabs_0_is').text().trim();

    const images: string[] = [];
    $('img.img-fluid, .ux-image-carousel-item img').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src');
      if (src && !src.includes('placeholder')) {
        images.push(src.replace('s-l64', 's-l1600'));
      }
    });

    return {
      id: crypto.randomUUID(),
      source_url: url,
      source_platform: 'ebay',
      title,
      description,
      price,
      images,
      raw_data: {
        seller: $('.x-sellercard-atf__info__about-seller span').text().trim(),
        condition: $('#vi-itm-cond').text().trim(),
        shipping: $('.d-shipping-minview').text().trim(),
      },
      status: 'new',
      scraped_at: new Date().toISOString(),
    };
  }

  async search(query: string, options: { category?: string; minPrice?: number; maxPrice?: number } = {}): Promise<ScrapedListing[]> {
    const searchUrl = new URL('https://www.ebay.com/sch/i.html');
    searchUrl.searchParams.set('_nkw', query);
    searchUrl.searchParams.set('_sacat', options.category || '11116'); // Coins & Paper Money

    if (options.minPrice) searchUrl.searchParams.set('_udlo', String(options.minPrice));
    if (options.maxPrice) searchUrl.searchParams.set('_udhi', String(options.maxPrice));

    const html = await this.fetchPage(searchUrl.toString());
    const $ = cheerio.load(html);

    const listings: ScrapedListing[] = [];

    $('.s-item').each((_, el) => {
      const $item = $(el);
      const link = $item.find('.s-item__link').attr('href');
      if (!link || link.includes('p2489527')) return; // Skip promoted

      const title = $item.find('.s-item__title').text().trim();
      if (!title || title === 'Shop on eBay') return;

      const priceText = $item.find('.s-item__price').text().trim();
      const image = $item.find('.s-item__image-img').attr('src');

      listings.push({
        id: crypto.randomUUID(),
        source_url: link,
        source_platform: 'ebay',
        title,
        price: this.parsePrice(priceText),
        images: image ? [image.replace('s-l225', 's-l1600')] : [],
        raw_data: {},
        status: 'new',
        scraped_at: new Date().toISOString(),
      });
    });

    return listings.slice(0, 50); // Limit results
  }

  private parsePrice(priceText: string): number | undefined {
    const match = priceText.match(/[\d,]+\.?\d*/);
    if (match) {
      return parseFloat(match[0].replace(',', ''));
    }
    return undefined;
  }
}

/**
 * Heritage Auctions Scraper
 */
export class HeritageScraper extends BaseScraper {
  async scrape(url: string): Promise<ScrapedListing> {
    const html = await this.fetchPage(url);
    const $ = cheerio.load(html);

    const title = $('h1.lot-title').text().trim();
    const priceText = $('.current-bid-amount, .winning-bid').text().trim();

    const images: string[] = [];
    $('.lot-image img').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src');
      if (src) images.push(src);
    });

    return {
      id: crypto.randomUUID(),
      source_url: url,
      source_platform: 'heritage',
      title,
      description: $('.lot-description').text().trim(),
      price: this.parsePrice(priceText),
      images,
      raw_data: {
        lot_number: $('.lot-number').text().trim(),
        estimate: $('.estimate-range').text().trim(),
      },
      status: 'new',
      scraped_at: new Date().toISOString(),
    };
  }

  async search(query: string): Promise<ScrapedListing[]> {
    // Heritage Auctions search implementation
    const searchUrl = `https://coins.ha.com/c/search-results.zx?N=790+231&Ntt=${encodeURIComponent(query)}`;

    const html = await this.fetchPage(searchUrl);
    const $ = cheerio.load(html);

    const listings: ScrapedListing[] = [];

    $('.search-result-item').each((_, el) => {
      const $item = $(el);
      const link = $item.find('a.lot-link').attr('href');
      if (!link) return;

      listings.push({
        id: crypto.randomUUID(),
        source_url: `https://coins.ha.com${link}`,
        source_platform: 'heritage',
        title: $item.find('.lot-title').text().trim(),
        price: this.parsePrice($item.find('.current-bid').text()),
        images: [$item.find('img').attr('src') || ''].filter(Boolean),
        raw_data: {},
        status: 'new',
        scraped_at: new Date().toISOString(),
      });
    });

    return listings;
  }

  private parsePrice(priceText: string): number | undefined {
    const match = priceText.match(/[\d,]+/);
    if (match) {
      return parseFloat(match[0].replace(',', ''));
    }
    return undefined;
  }
}

/**
 * APMEX Scraper (for bullion prices)
 */
export class ApmexScraper extends BaseScraper {
  async scrape(url: string): Promise<ScrapedListing> {
    const html = await this.fetchPage(url);
    const $ = cheerio.load(html);

    const title = $('h1.product-title').text().trim();
    const priceText = $('.price-current').text().trim();

    const images: string[] = [];
    $('.product-image img').each((_, el) => {
      const src = $(el).attr('src');
      if (src) images.push(src);
    });

    return {
      id: crypto.randomUUID(),
      source_url: url,
      source_platform: 'apmex',
      title,
      description: $('.product-description').text().trim(),
      price: this.parsePrice(priceText),
      images,
      raw_data: {
        sku: $('.product-sku').text().trim(),
        availability: $('.availability').text().trim(),
      },
      status: 'new',
      scraped_at: new Date().toISOString(),
    };
  }

  async search(query: string): Promise<ScrapedListing[]> {
    const searchUrl = `https://www.apmex.com/search?q=${encodeURIComponent(query)}`;
    const html = await this.fetchPage(searchUrl);
    const $ = cheerio.load(html);

    const listings: ScrapedListing[] = [];

    $('.product-item').each((_, el) => {
      const $item = $(el);
      const link = $item.find('a.product-link').attr('href');
      if (!link) return;

      listings.push({
        id: crypto.randomUUID(),
        source_url: `https://www.apmex.com${link}`,
        source_platform: 'apmex',
        title: $item.find('.product-name').text().trim(),
        price: this.parsePrice($item.find('.price').text()),
        images: [$item.find('img').attr('src') || ''].filter(Boolean),
        raw_data: {},
        status: 'new',
        scraped_at: new Date().toISOString(),
      });
    });

    return listings;
  }

  private parsePrice(priceText: string): number | undefined {
    const match = priceText.match(/[\d,]+\.?\d*/);
    if (match) {
      return parseFloat(match[0].replace(',', ''));
    }
    return undefined;
  }
}

/**
 * Unified scraper service
 */
export class ScraperService {
  private ebay: EbayScraper;
  private heritage: HeritageScraper;
  private apmex: ApmexScraper;

  constructor() {
    this.ebay = new EbayScraper();
    this.heritage = new HeritageScraper();
    this.apmex = new ApmexScraper();
  }

  async scrapeUrl(url: string): Promise<ScrapedListing> {
    if (url.includes('ebay.com')) {
      return this.ebay.scrape(url);
    } else if (url.includes('ha.com') || url.includes('heritage')) {
      return this.heritage.scrape(url);
    } else if (url.includes('apmex.com')) {
      return this.apmex.scrape(url);
    }

    throw new Error(`Unsupported platform for URL: ${url}`);
  }

  async searchAll(query: string, options?: Record<string, unknown>): Promise<ScrapedListing[]> {
    const results = await Promise.allSettled([
      this.ebay.search(query, options),
      this.heritage.search(query),
      this.apmex.search(query),
    ]);

    const listings: ScrapedListing[] = [];

    for (const result of results) {
      if (result.status === 'fulfilled') {
        listings.push(...result.value);
      }
    }

    return listings;
  }

  async searchPlatform(platform: string, query: string, options?: Record<string, unknown>): Promise<ScrapedListing[]> {
    switch (platform.toLowerCase()) {
      case 'ebay':
        return this.ebay.search(query, options);
      case 'heritage':
        return this.heritage.search(query);
      case 'apmex':
        return this.apmex.search(query);
      default:
        throw new Error(`Unknown platform: ${platform}`);
    }
  }
}

// Singleton instance
let scraperService: ScraperService | null = null;

export function getScraperService(): ScraperService {
  if (!scraperService) {
    scraperService = new ScraperService();
  }
  return scraperService;
}
