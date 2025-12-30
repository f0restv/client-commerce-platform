import * as cheerio from 'cheerio';
import type { Parser, PageScrapeResult, ScrapedItem, ScraperSelectors } from '../types';

/**
 * Generic parser for websites that don't match specific platform patterns.
 * Uses configurable CSS selectors provided in ClientSource.selectors.
 */
export class GenericParser implements Parser {
  private selectors: ScraperSelectors;

  constructor(selectors?: ScraperSelectors) {
    this.selectors = selectors || this.getDefaultSelectors();
  }

  /**
   * Update selectors for this parser instance
   */
  setSelectors(selectors: ScraperSelectors): void {
    this.selectors = selectors;
  }

  canHandle(_url: string): boolean {
    // Generic parser is a fallback, always returns true
    return true;
  }

  getListUrl(baseUrl: string, page = 1): string {
    const url = new URL(baseUrl);

    if (page > 1) {
      // Try common pagination patterns
      if (url.searchParams.has('page')) {
        url.searchParams.set('page', page.toString());
      } else if (url.searchParams.has('p')) {
        url.searchParams.set('p', page.toString());
      } else if (url.pathname.includes('/page/')) {
        url.pathname = url.pathname.replace(/\/page\/\d+/, `/page/${page}`);
      } else {
        url.searchParams.set('page', page.toString());
      }
    }

    return url.toString();
  }

  parseListPage(html: string, baseUrl: string): PageScrapeResult {
    const $ = cheerio.load(html);
    const items: ScrapedItem[] = [];
    const errors: string[] = [];

    // Find product container
    const productList = $(this.selectors.productList);
    if (productList.length === 0) {
      // Try to auto-detect product listing
      const autoDetected = this.autoDetectProducts($);
      if (autoDetected.length === 0) {
        errors.push(`No products found with selector: ${this.selectors.productList}`);
        return { items, hasNextPage: false, errors };
      }
      return this.parseAutoDetectedProducts(autoDetected, $, baseUrl);
    }

    // Find product links within the list
    const productLinks = productList.find(this.selectors.productLink);

    productLinks.each((_, element) => {
      try {
        const $item = $(element);
        const item = this.parseListItem($item, $, baseUrl);
        if (item) {
          items.push(item);
        }
      } catch (err) {
        errors.push(`Failed to parse product: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    });

    // Check for next page
    const hasNextPage = this.hasNextPage($);
    const nextPageUrl = hasNextPage ? this.getNextPageUrl($, baseUrl) : undefined;

    return { items, hasNextPage, nextPageUrl, errors };
  }

  parseDetailPage(html: string, url: string): ScrapedItem | null {
    const $ = cheerio.load(html);

    try {
      // Title (required)
      const title = $(this.selectors.title).first().text().trim();
      if (!title) {
        return null;
      }

      // Price
      const priceText = $(this.selectors.price).first().text().trim();
      const price = this.parsePrice(priceText);

      // Description
      const description = this.selectors.description
        ? $(this.selectors.description).first().text().trim() || null
        : null;

      // Images
      const images: string[] = [];
      if (this.selectors.images) {
        $(this.selectors.images).each((_, img) => {
          const src = $(img).attr('src') || $(img).attr('data-src') || $(img).attr('href');
          if (src) {
            images.push(this.resolveUrl(src, url));
          }
        });
      }

      // SKU
      const sku = this.selectors.sku ? $(this.selectors.sku).first().text().trim() || undefined : undefined;

      // Condition
      const condition = this.selectors.condition
        ? $(this.selectors.condition).first().text().trim() || undefined
        : undefined;

      // Quantity
      let quantity = 1;
      if (this.selectors.quantity) {
        const qtyText = $(this.selectors.quantity).first().text().trim();
        const qtyMatch = qtyText.match(/(\d+)/);
        if (qtyMatch) {
          quantity = parseInt(qtyMatch[1], 10);
        }
      }

      // Category
      const category = this.selectors.category
        ? $(this.selectors.category).first().text().trim() || undefined
        : undefined;

      return {
        sourceUrl: url,
        title,
        price,
        description,
        images: [...new Set(images)],
        sku,
        condition,
        quantity,
        category,
        scrapedAt: new Date(),
      };
    } catch {
      return null;
    }
  }

  /**
   * Try to automatically detect product listings on the page
   */
  private autoDetectProducts($: cheerio.CheerioAPI): cheerio.Cheerio<any> {
    const commonSelectors = [
      // E-commerce patterns
      '.product',
      '.product-item',
      '.product-card',
      '[data-product]',
      '[data-product-id]',
      '.item',
      // Grid patterns
      '.grid-item',
      '.col-product',
      // List patterns
      '.listing-item',
      '.search-result',
      // WooCommerce
      '.woocommerce-loop-product__link',
      'li.product',
      // Auction patterns
      '.lot',
      '.auction-item',
      '.lot-item',
    ];

    for (const selector of commonSelectors) {
      const found = $(selector);
      if (found.length >= 2) {
        // At least 2 items to be considered a listing
        return found;
      }
    }

    return $([]);
  }

  private parseAutoDetectedProducts(
    products: cheerio.Cheerio<any>,
    $: cheerio.CheerioAPI,
    baseUrl: string
  ): PageScrapeResult {
    const items: ScrapedItem[] = [];
    const errors: string[] = [];

    products.each((_, element) => {
      try {
        const $product = $(element);

        // Find title
        const titleEl = $product.find('h1, h2, h3, h4, a[href*="/product"], a[href*="/item"]').first();
        const title = titleEl.text().trim();
        if (!title || title.length < 3) return;

        // Find URL
        const linkEl = titleEl.is('a') ? titleEl : $product.find('a').first();
        let productUrl = linkEl.attr('href') || '';
        if (!productUrl) return;
        productUrl = this.resolveUrl(productUrl, baseUrl);

        // Find price
        const priceEl = $product.find('[class*="price"], .amount, .cost').first();
        const price = this.parsePrice(priceEl.text());

        // Find image
        const imgEl = $product.find('img').first();
        const imgSrc = imgEl.attr('src') || imgEl.attr('data-src');
        const images = imgSrc ? [this.resolveUrl(imgSrc, baseUrl)] : [];

        items.push({
          sourceUrl: productUrl,
          title,
          price,
          description: null,
          images,
          quantity: 1,
          scrapedAt: new Date(),
        });
      } catch (err) {
        errors.push(`Auto-detect parse error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    });

    return { items, hasNextPage: this.hasNextPage($), errors };
  }

  private parseListItem(
    $item: cheerio.Cheerio<any>,
    $: cheerio.CheerioAPI,
    baseUrl: string
  ): ScrapedItem | null {
    // Get link and title
    const linkEl = $item.is('a') ? $item : $item.find('a').first();
    let url = linkEl.attr('href') || '';
    if (!url) return null;
    url = this.resolveUrl(url, baseUrl);

    // Try to get title from various places
    let title = linkEl.attr('title') || linkEl.text().trim();
    if (!title || title.length < 3) {
      title = $item.find('h1, h2, h3, h4, .title, .name').first().text().trim();
    }
    if (!title) return null;

    // Get price if available on list page
    const priceEl = $item.find('[class*="price"], .amount').first();
    const price = this.parsePrice(priceEl.text());

    // Get image
    const imgEl = $item.find('img').first();
    const imgSrc = imgEl.attr('src') || imgEl.attr('data-src');
    const images = imgSrc ? [this.resolveUrl(imgSrc, baseUrl)] : [];

    return {
      sourceUrl: url,
      title,
      price,
      description: null,
      images,
      quantity: 1,
      scrapedAt: new Date(),
    };
  }

  private parsePrice(priceText: string): number | null {
    if (!priceText) return null;

    // Handle ranges - take first price
    const rangeMatch = priceText.match(/[\d,.]+/);
    if (!rangeMatch) return null;

    // Remove everything except digits, commas, and periods
    let cleaned = rangeMatch[0];

    // Handle European format (1.234,56) vs US format (1,234.56)
    if (cleaned.includes(',') && cleaned.includes('.')) {
      // Determine format by position of last separator
      const lastComma = cleaned.lastIndexOf(',');
      const lastDot = cleaned.lastIndexOf('.');
      if (lastComma > lastDot) {
        // European: 1.234,56
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
      } else {
        // US: 1,234.56
        cleaned = cleaned.replace(/,/g, '');
      }
    } else if (cleaned.includes(',')) {
      // Could be either "1,234" or "1,50"
      const parts = cleaned.split(',');
      if (parts[parts.length - 1].length === 2) {
        // Likely decimal: 1,50
        cleaned = cleaned.replace(',', '.');
      } else {
        // Likely thousands: 1,234
        cleaned = cleaned.replace(/,/g, '');
      }
    }

    const price = parseFloat(cleaned);
    return isNaN(price) ? null : price;
  }

  private resolveUrl(url: string, baseUrl: string): string {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    if (url.startsWith('//')) {
      return 'https:' + url;
    }
    try {
      return new URL(url, baseUrl).toString();
    } catch {
      return url;
    }
  }

  private hasNextPage($: cheerio.CheerioAPI): boolean {
    if (this.selectors.nextPage) {
      return $(this.selectors.nextPage).length > 0;
    }

    // Common next page patterns
    const nextSelectors = [
      'a[rel="next"]',
      '.pagination .next:not(.disabled)',
      '.next-page:not(.disabled)',
      'a:contains("Next")',
      'a:contains("›")',
      '[aria-label="Next page"]',
    ];

    for (const sel of nextSelectors) {
      if ($(sel).length > 0) {
        return true;
      }
    }

    return false;
  }

  private getNextPageUrl($: cheerio.CheerioAPI, currentUrl: string): string | undefined {
    const selectors = [
      this.selectors.nextPage,
      'a[rel="next"]',
      '.pagination .next a',
      '.next-page a',
      'a:contains("Next")',
    ].filter(Boolean) as string[];

    for (const sel of selectors) {
      const href = $(sel).attr('href');
      if (href) {
        return this.resolveUrl(href, currentUrl);
      }
    }

    return undefined;
  }

  private getDefaultSelectors(): ScraperSelectors {
    return {
      productList: '.products, .product-list, .items, [data-products]',
      productLink: 'a[href*="/product"], a[href*="/item"], .product a, .item a',
      title: 'h1, .product-title, .item-title, [data-title]',
      price: '.price, .product-price, [data-price], .amount',
      description: '.description, .product-description, [data-description]',
      images: '.product-images img, .gallery img, [data-image]',
      nextPage: 'a[rel="next"], .pagination .next a',
    };
  }
}

/**
 * Create a generic parser with custom selectors
 */
export function createGenericParser(selectors?: ScraperSelectors): GenericParser {
  return new GenericParser(selectors);
}

export const genericParser = new GenericParser();
