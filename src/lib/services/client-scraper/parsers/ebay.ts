import * as cheerio from 'cheerio';
import type { Parser, PageScrapeResult, ScrapedItem } from '../types';

/**
 * Parser for eBay seller stores
 */
export class EbayParser implements Parser {
  private storeId: string | null = null;

  canHandle(url: string): boolean {
    return url.includes('ebay.com') || url.includes('ebay.co.uk');
  }

  getListUrl(baseUrl: string, page = 1): string {
    const url = new URL(baseUrl);

    // Extract store ID from URL patterns like:
    // https://www.ebay.com/str/storename
    // https://www.ebay.com/sch/storename/m.html
    const storeMatch = baseUrl.match(/\/str\/([^/?]+)/) || baseUrl.match(/\/sch\/([^/]+)\/m\.html/);
    if (storeMatch) {
      this.storeId = storeMatch[1];
    }

    // Build listing URL with pagination
    if (this.storeId) {
      const listUrl = new URL(`https://www.ebay.com/sch/${this.storeId}/m.html`);
      if (page > 1) {
        listUrl.searchParams.set('_pgn', page.toString());
      }
      listUrl.searchParams.set('_ipg', '240'); // Max items per page
      listUrl.searchParams.set('rt', 'nc'); // Active listings only
      return listUrl.toString();
    }

    // Fallback: just add pagination to existing URL
    url.searchParams.set('_pgn', page.toString());
    return url.toString();
  }

  parseListPage(html: string, baseUrl: string): PageScrapeResult {
    const $ = cheerio.load(html);
    const items: ScrapedItem[] = [];
    const errors: string[] = [];

    // eBay uses various listing formats
    const listingSelectors = [
      '.srp-results .s-item',
      '.srp-river-results .s-item',
      '#ListViewInner li',
      '.b-list__items_nofooter .s-item',
    ];

    let listings: cheerio.Cheerio<cheerio.Element> | null = null;

    for (const selector of listingSelectors) {
      const found = $(selector);
      if (found.length > 0) {
        listings = found;
        break;
      }
    }

    if (!listings || listings.length === 0) {
      errors.push('No listings found on page');
      return { items, hasNextPage: false, errors };
    }

    listings.each((_, element) => {
      try {
        const $item = $(element);

        // Skip "Shop on eBay" promotional items
        const title = $item.find('.s-item__title, .lvtitle, .vip').text().trim();
        if (!title || title.toLowerCase().includes('shop on ebay')) {
          return;
        }

        // Get item URL
        const linkEl = $item.find('.s-item__link, .vip, a.s-item__link').first();
        const itemUrl = linkEl.attr('href') || '';
        if (!itemUrl || !itemUrl.includes('ebay.com/itm/')) {
          return;
        }

        // Extract item ID from URL
        const itemIdMatch = itemUrl.match(/\/itm\/(\d+)/);
        const externalId = itemIdMatch ? itemIdMatch[1] : undefined;

        // Get price
        const priceText = $item.find('.s-item__price, .prc, .bold').first().text().trim();
        const price = this.parsePrice(priceText);

        // Get image
        const imgEl = $item.find('.s-item__image-img, img').first();
        const imgSrc = imgEl.attr('src') || imgEl.attr('data-src') || '';
        const images = imgSrc ? [this.cleanImageUrl(imgSrc)] : [];

        // Get condition
        const condition = $item.find('.SECONDARY_INFO, .cndtn').text().trim() || undefined;

        // Get shipping info (optional)
        const shipping = $item.find('.s-item__shipping, .ship').text().trim();

        const item: ScrapedItem = {
          sourceUrl: itemUrl,
          externalId,
          title,
          price,
          description: null, // Requires detail page
          images,
          condition,
          quantity: 1,
          attributes: shipping ? { shipping } : undefined,
          scrapedAt: new Date(),
        };

        items.push(item);
      } catch (err) {
        errors.push(`Failed to parse listing: ${err instanceof Error ? err.message : 'Unknown error'}`);
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
      // Title
      const title = $('#itemTitle, .x-item-title__mainTitle span').text().replace(/^Details about\s*/i, '').trim();
      if (!title) {
        return null;
      }

      // Price
      const priceText = $('#prcIsum, .x-price-primary span').first().text().trim();
      const price = this.parsePrice(priceText);

      // Description
      const description = $('#desc_ifr').attr('src')
        ? null // iframe description - would need separate fetch
        : $('#viTabs_0_is, .d-item-description').text().trim() || null;

      // Images
      const images: string[] = [];
      $('#icImg, .ux-image-carousel-item img').each((_, img) => {
        const src = $(img).attr('src') || $(img).attr('data-src');
        if (src) {
          images.push(this.cleanImageUrl(src));
        }
      });

      // Also check for image gallery
      $('img[id^="icThumbs"]').each((_, img) => {
        const src = $(img).attr('src');
        if (src) {
          images.push(this.cleanImageUrl(src));
        }
      });

      // External ID
      const itemIdMatch = url.match(/\/itm\/(\d+)/);
      const externalId = itemIdMatch ? itemIdMatch[1] : undefined;

      // Condition
      const condition = $('#vi-itm-cond, .x-item-condition-text span').first().text().trim() || undefined;

      // Quantity
      const qtyText = $('#qtySubTxt, .d-quantity__availability span').text();
      const qtyMatch = qtyText.match(/(\d+)\s*available/i);
      const quantity = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;

      // SKU (seller's item number)
      const sku = $('#descItemNumber').text().trim() || undefined;

      // Category
      const categoryParts: string[] = [];
      $('#vi-VR-brumb-lnkLst li a, .seo-breadcrumb-text a').each((_, el) => {
        categoryParts.push($(el).text().trim());
      });
      const category = categoryParts.length > 0 ? categoryParts.join(' > ') : undefined;

      // Item specifics
      const attributes: Record<string, string> = {};
      $('.ux-labels-values__labels, .itemAttr th').each((i, label) => {
        const labelText = $(label).text().replace(':', '').trim();
        const valueEl = $(label).next('.ux-labels-values__values, td');
        const valueText = valueEl.text().trim();
        if (labelText && valueText) {
          attributes[labelText] = valueText;
        }
      });

      return {
        sourceUrl: url,
        externalId,
        title,
        price,
        description,
        images: [...new Set(images)], // dedupe
        sku,
        condition,
        quantity,
        category,
        attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
        scrapedAt: new Date(),
      };
    } catch {
      return null;
    }
  }

  private parsePrice(priceText: string): number | null {
    if (!priceText) return null;

    // Handle price ranges (take the lower price)
    if (priceText.includes(' to ')) {
      priceText = priceText.split(' to ')[0];
    }

    // Remove currency symbols and commas
    const cleaned = priceText.replace(/[^0-9.]/g, '');
    const price = parseFloat(cleaned);

    return isNaN(price) ? null : price;
  }

  private cleanImageUrl(url: string): string {
    // eBay uses s-l64, s-l140, s-l300, s-l500, s-l1600 for different sizes
    // Upgrade to larger size
    return url
      .replace(/s-l\d+/, 's-l1600')
      .replace(/\/thumbs\//, '/images/')
      .split('?')[0]; // Remove query params
  }

  private hasNextPage($: cheerio.CheerioAPI): boolean {
    // Check for next page link
    const nextLink = $('a.pagination__next, .pagn-next a, a[rel="next"]');
    return nextLink.length > 0 && !nextLink.hasClass('disabled');
  }

  private getNextPageUrl($: cheerio.CheerioAPI, currentUrl: string): string | undefined {
    const nextLink = $('a.pagination__next, .pagn-next a, a[rel="next"]').attr('href');
    if (nextLink) {
      if (nextLink.startsWith('http')) {
        return nextLink;
      }
      const base = new URL(currentUrl);
      return new URL(nextLink, base.origin).toString();
    }
    return undefined;
  }
}

export const ebayParser = new EbayParser();
