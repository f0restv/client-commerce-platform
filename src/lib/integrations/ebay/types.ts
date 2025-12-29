/**
 * eBay Integration Types
 *
 * Shared types used across eBay integration modules.
 */

// =============================================================================
// OAuth Types
// =============================================================================

export interface EbayTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface EbayConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  devId?: string;
  sandbox: boolean;
}

// =============================================================================
// Listing Types
// =============================================================================

export interface ListingOptions {
  auction?: boolean;
  fulfillmentPolicyId?: string;
  paymentPolicyId?: string;
  returnPolicyId?: string;
  categoryId?: string;
  storeCategoryId?: string;
}

export interface EbayListingResult {
  listingId: string;
  offerId?: string;
  url: string;
  warnings?: string[];
}

export interface EbayInventoryItem {
  availability: {
    shipToLocationAvailability: {
      quantity: number;
    };
  };
  condition: string;
  conditionDescription?: string;
  product: {
    title: string;
    description: string;
    imageUrls: string[];
    aspects?: Record<string, string[]>;
  };
}

export interface EbayOffer {
  sku: string;
  marketplaceId: string;
  format: "AUCTION" | "FIXED_PRICE";
  listingPolicies: {
    fulfillmentPolicyId?: string;
    paymentPolicyId?: string;
    returnPolicyId?: string;
  };
  pricingSummary: {
    price: { value: string; currency: string };
    auctionStartPrice?: { value: string; currency: string };
    auctionReservePrice?: { value: string; currency: string };
  };
  categoryId: string;
  storeCategoryNames?: string[];
  listingDuration?: string;
}

// =============================================================================
// Comparable Sales Types
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

export interface PricingStats {
  average: number;
  median: number;
  low: number;
  high: number;
  count: number;
}

export interface MarketPricingData {
  soldStats?: PricingStats;
  activeStats?: PricingStats;
  suggestedPrice?: number;
}

// =============================================================================
// Order/Sync Types
// =============================================================================

export interface EbayOrder {
  orderId: string;
  creationDate: string;
  orderFulfillmentStatus: string;
  orderPaymentStatus: string;
  pricingSummary: {
    total: { value: string; currency: string };
    priceSubtotal: { value: string; currency: string };
  };
  buyer: {
    username: string;
  };
  lineItems: EbayLineItem[];
}

export interface EbayLineItem {
  lineItemId: string;
  sku: string;
  title: string;
  quantity: number;
  lineItemCost: { value: string; currency: string };
  total: { value: string; currency: string };
}

export interface SyncResult {
  synced: number;
  updated: number;
  errors: string[];
}

export interface SyncStatus {
  lastSync: Date | null;
  activeListings: number;
  pendingSync: number;
}

// =============================================================================
// API Response Types
// =============================================================================

export interface EbayApiError {
  errorId: number;
  domain: string;
  category: string;
  message: string;
  longMessage?: string;
  parameters?: Record<string, string>;
}

export interface EbayApiWarning {
  warningId: number;
  domain: string;
  category: string;
  message: string;
}

// =============================================================================
// Category Constants
// =============================================================================

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

export type EbayCoinCategory = keyof typeof EBAY_COIN_CATEGORIES;

// =============================================================================
// Condition Mappings
// =============================================================================

export const EBAY_CONDITION_IDS = {
  NEW: "1000",
  NEW_OTHER: "1500",
  NEW_WITH_DEFECTS: "1750",
  MANUFACTURER_REFURBISHED: "2000",
  SELLER_REFURBISHED: "2500",
  LIKE_NEW: "2750",
  USED_EXCELLENT: "3000",
  USED_VERY_GOOD: "4000",
  USED_GOOD: "5000",
  USED_ACCEPTABLE: "6000",
  FOR_PARTS: "7000",
} as const;

export type EbayConditionId = (typeof EBAY_CONDITION_IDS)[keyof typeof EBAY_CONDITION_IDS];
