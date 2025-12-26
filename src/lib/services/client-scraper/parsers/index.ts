export { EbayParser, ebayParser } from './ebay';
export { ShopifyParser, shopifyParser } from './shopify';
export { GenericParser, genericParser, createGenericParser } from './generic';

import type { Parser, ScraperSelectors } from '../types';
import { ebayParser } from './ebay';
import { shopifyParser } from './shopify';
import { createGenericParser } from './generic';
import { SourceType } from '@prisma/client';

/**
 * Get the appropriate parser for a given URL
 */
export function getParserForUrl(url: string): Parser {
  if (ebayParser.canHandle(url)) {
    return ebayParser;
  }
  if (shopifyParser.canHandle(url)) {
    return shopifyParser;
  }
  return createGenericParser();
}

/**
 * Get the appropriate parser for a source type
 */
export function getParserForSourceType(
  type: SourceType,
  selectors?: ScraperSelectors | null
): Parser {
  switch (type) {
    case SourceType.EBAY_STORE:
      return ebayParser;
    case SourceType.SHOPIFY:
      return shopifyParser;
    case SourceType.WEBSITE:
    case SourceType.WOOCOMMERCE:
    case SourceType.SQUARESPACE:
    default:
      return createGenericParser(selectors || undefined);
  }
}
