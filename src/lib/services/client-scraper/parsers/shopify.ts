import * as cheerio from 'cheerio';
import type { Parser, PageScrapeResult, ScrapedItem } from '../types';

/**
 * Parser for Shopify stores
 * Shopify stores have a consistent structure and often expose a /products.json endpoint
 */
export class ShopifyParser implements Parser {
  canHandle(url: string): boolean {
    // Shopify stores can be detected by:
    // 1. URL pattern /products or /collections
    // 2. meta tag or script references to Shopify
    // We'll check URL patterns here; HTML detection happens during scraping
    return url.includes('/products') || url.includes('/collections');
  }

  getListUrl(baseUrl: string, page = 1): string {
    const url = new URL(baseUrl);

    // Shopify collections support pagination
    // Format: /collections/all?page=N or /products?page=N
    if (!url.pathname.includes('/collections') && !url.pathname.includes('/products')) {
      url.pathname = '/collections/all';
    }

    if (page > 1) {
      url.searchParams.set('page', page.toString());
    }

    return url.toString();
  }

  /**
   * Get the JSON API URL for a Shopify store
   * Shopify stores expose product data at /products.json
   */
  getJsonUrl(baseUrl: string, page = 1): string {
    const url = new URL(baseUrl);
    url.pathname = '/products.json';
    url.searchParams.set('limit', '250');
    if (page > 1) {
      url.searchParams.set('page', page.toString());
    }
    return url.toString();
  }

  /**
   * Parse JSON response from Shopify's products.json endpoint
   */
  parseJsonResponse(json: ShopifyProductsResponse, baseUrl: string): PageScrapeResult {
    const items: ScrapedItem[] = [];
    const errors: string[] = [];

    if (!json.products || !Array.isArray(json.products)) {
      errors.push('Invalid Shopify JSON response');
      return { items, hasNextPage: false, errors };
    }

    for (const product of json.products) {
      try {
        // Get first available variant for price
        const variant = product.variants?.[0];
        const price = variant?.price ? parseFloat(variant.price) : null;

        // Get images
        const images = product.images?.map((img) => img.src) || [];

        // Build product URL
        const productUrl = new URL(`/products/${product.handle}`, baseUrl).toString();

        // Get quantity from variants
        let quantity = 0;
        if (product.variants) {
          for (const v of product.variants) {
            if (v.available) {
              quantity += v.inventory_quantity || 1;
            }
          }
        }

        const item: ScrapedItem = {
          sourceUrl: productUrl,
          externalId: product.id?.toString(),
          title: product.title,
          price,
          description: this.stripHtml(product.body_html || ''),
          images,
          sku: variant?.sku || undefined,
          quantity: quantity || 1,
          category: product.product_type || undefined,
          attributes: {
            vendor: product.vendor || '',
            tags: product.tags?.join(', ') || '',
          },
          scrapedAt: new Date(),
        };

        items.push(item);
      } catch (err) {
        errors.push(`Failed to parse product ${product.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    // Shopify returns empty array when no more pages
    const hasNextPage = json.products.length >= 250;

    return { items, hasNextPage, errors };
  }

  parseListPage(html: string, baseUrl: string): PageScrapeResult {
    const $ = cheerio.load(html);
    const items: ScrapedItem[] = [];
    const errors: string[] = [];

    // Common Shopify product grid selectors
    const productSelectors = [
      '.product-card',
      '.product-item',
      '.grid__item .card',
      '.collection-product-card',
      '[data-product-card]',
      '.product-grid-item',
      '.ProductItem',
    ];

    let products: cheerio.Cheerio<any> | null = null;

    for (const selector of productSelectors) {
      const found = $(selector);
      if (found.length > 0) {
        products = found;
        break;
      }
    }

    if (!products || products.length === 0) {
      errors.push('No products found on page - may need JSON API');
      return { items, hasNextPage: false, errors };
    }

    products.each((_, element) => {
      try {
        const $product = $(element);

        // Get title
        const titleEl = $product.find('a.product-card__title, .product-item__title, h3 a, .card__heading a').first();
        const title = titleEl.text().trim();
        if (!title) return;

        // Get URL
        let productUrl = titleEl.attr('href') || $product.find('a').first().attr('href') || '';
        if (productUrl && !productUrl.startsWith('http')) {
          productUrl = new URL(productUrl, baseUrl).toString();
        }
        if (!productUrl) return;

        // Get price
        const priceText = $product.find('.price, .product-price, .money, [data-product-price]').first().text();
        const price = this.parsePrice(priceText);

        // Get image
        const imgEl = $product.find('img').first();
        const imgSrc = imgEl.attr('src') || imgEl.attr('data-src') || '';
        const images = imgSrc ? [this.cleanImageUrl(imgSrc, baseUrl)] : [];

        // Extract handle/id from URL
        const handleMatch = productUrl.match(/\/products\/([^/?]+)/);
        const externalId = handleMatch ? handleMatch[1] : undefined;

        const item: ScrapedItem = {
          sourceUrl: productUrl,
          externalId,
          title,
          price,
          description: null, // Requires detail page
          images,
          quantity: 1,
          scrapedAt: new Date(),
        };

        items.push(item);
      } catch (err) {
        errors.push(`Failed to parse product: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    });

    // Check for pagination
    const hasNextPage = this.hasNextPage($);
    const nextPageUrl = hasNextPage ? this.getNextPageUrl($, baseUrl) : undefined;

    return { items, hasNextPage, nextPageUrl, errors };
  }

  parseDetailPage(html: string, url: string): ScrapedItem | null {
    const $ = cheerio.load(html);

    try {
      // Try to get product data from JSON-LD
      const jsonLd = $('script[type="application/ld+json"]')
        .toArray()
        .map((el) => {
          try {
            return JSON.parse($(el).html() || '');
          } catch {
            return null;
          }
        })
        .find((data) => data?.['@type'] === 'Product');

      if (jsonLd) {
        return this.parseJsonLd(jsonLd, url);
      }

      // Fallback to HTML parsing
      const title = $('h1.product__title, .product-single__title, h1[data-product-title]').first().text().trim();
      if (!title) return null;

      // Price
      const priceText = $('.product__price, .product-single__price, [data-product-price]').first().text();
      const price = this.parsePrice(priceText);

      // Description
      const description = $('.product__description, .product-single__description, [data-product-description]')
        .first()
        .text()
        .trim() || null;

      // Images
      const images: string[] = [];
      $('.product__media img, .product-single__photo img, [data-product-image]').each((_, img) => {
        const src = $(img).attr('src') || $(img).attr('data-src');
        if (src) {
          images.push(this.cleanImageUrl(src, url));
        }
      });

      // SKU
      const sku = $('[data-sku], .product-single__sku').first().text().trim() || undefined;

      // Quantity/Availability
      const isAvailable = !$('.sold-out, [data-sold-out]').length;
      const quantity = isAvailable ? 1 : 0;

      // Handle from URL
      const handleMatch = url.match(/\/products\/([^/?]+)/);
      const externalId = handleMatch ? handleMatch[1] : undefined;

      return {
        sourceUrl: url,
        externalId,
        title,
        price,
        description,
        images: [...new Set(images)],
        sku,
        quantity,
        scrapedAt: new Date(),
      };
    } catch {
      return null;
    }
  }

  private parseJsonLd(data: ProductJsonLd, url: string): ScrapedItem {
    const price = data.offers?.price
      ? parseFloat(data.offers.price.toString())
      : data.offers?.lowPrice
        ? parseFloat(data.offers.lowPrice.toString())
        : null;

    const images = Array.isArray(data.image) ? data.image : data.image ? [data.image] : [];

    const handleMatch = url.match(/\/products\/([^/?]+)/);
    const externalId = handleMatch ? handleMatch[1] : data.sku;

    return {
      sourceUrl: url,
      externalId,
      title: data.name,
      price,
      description: data.description || null,
      images,
      sku: data.sku,
      quantity: data.offers?.availability?.includes('InStock') ? 1 : 0,
      category: data.category,
      scrapedAt: new Date(),
    };
  }

  private parsePrice(priceText: string): number | null {
    if (!priceText) return null;

    // Remove currency symbols, whitespace, and common text
    const cleaned = priceText
      .replace(/from|starting at|sale|regular price/gi, '')
      .replace(/[^0-9.]/g, '');

    const price = parseFloat(cleaned);
    return isNaN(price) ? null : price;
  }

  private cleanImageUrl(url: string, baseUrl: string): string {
    // Make URL absolute if needed
    if (url.startsWith('//')) {
      url = 'https:' + url;
    } else if (!url.startsWith('http')) {
      url = new URL(url, baseUrl).toString();
    }

    // Shopify CDN images can be resized by modifying the URL
    // Remove size suffix to get original size
    return url.replace(/_\d+x\d*\./, '.').replace(/_\d+x\./, '.');
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private hasNextPage($: cheerio.CheerioAPI): boolean {
    return (
      $('a[rel="next"], .pagination__next:not(.disabled), [aria-label="Next page"]').length > 0
    );
  }

  private getNextPageUrl($: cheerio.CheerioAPI, currentUrl: string): string | undefined {
    const nextLink = $('a[rel="next"], .pagination__next a, [aria-label="Next page"]').attr('href');
    if (nextLink) {
      if (nextLink.startsWith('http')) {
        return nextLink;
      }
      return new URL(nextLink, currentUrl).toString();
    }
    return undefined;
  }
}

// Shopify API types
interface ShopifyProductsResponse {
  products: ShopifyProduct[];
}

interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  body_html: string | null;
  vendor: string | null;
  product_type: string | null;
  tags: string[];
  variants: ShopifyVariant[];
  images: ShopifyImage[];
}

interface ShopifyVariant {
  id: number;
  title: string;
  sku: string | null;
  price: string;
  available: boolean;
  inventory_quantity: number;
}

interface ShopifyImage {
  id: number;
  src: string;
  alt: string | null;
}

interface ProductJsonLd {
  '@type': 'Product';
  name: string;
  description?: string;
  image?: string | string[];
  sku?: string;
  category?: string;
  offers?: {
    price?: number | string;
    lowPrice?: number | string;
    availability?: string;
  };
}

export const shopifyParser = new ShopifyParser();
