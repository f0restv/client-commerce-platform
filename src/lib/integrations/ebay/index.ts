/**
 * eBay Integration Module
 *
 * Complete eBay API integration including:
 * - OAuth authentication
 * - Listing management
 * - Sold items sync
 * - Comparable sales for pricing
 */

// Authentication
export {
  getAuthUrl,
  exchangeCodeForToken,
  refreshToken,
  getAppToken,
  storePlatformTokens,
  storeClientTokens,
  getPlatformAccessToken,
  getClientAccessToken,
  forcePlatformTokenRefresh,
  deactivatePlatformConnection,
  ensureValidToken,
  getConfig,
  getApiBaseUrl,
  getAuthBaseUrl,
  OAUTH_SCOPES,
  type EbayTokens,
  type EbayConfig,
} from "./auth";

// Listings
export {
  createListing,
  createListingWithPlatformAuth,
  updateListing,
  endListing,
  endListingWithPlatformAuth,
  getActiveListings,
  bulkUpdatePrices,
  type ListingOptions,
  type EbayListingResult,
} from "./listings";

// Sync
export {
  syncSoldItems,
  syncPlatformSoldItems,
  syncActiveListings,
  syncInventory,
  runFullSync,
  getSyncStatus,
} from "./sync";

// Comparable Sales
export {
  getComparableSales,
  getSoldComparables,
  getActiveComparables,
  getPricingStats,
  searchCoinComparables,
  getMarketData,
  searchByCategory,
  EBAY_COIN_CATEGORIES,
  type EbayCompSale,
  type CompSearchOptions,
} from "./comps";
