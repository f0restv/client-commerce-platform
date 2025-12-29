/**
 * Market Data Service - Shared Types
 *
 * Central type definitions for the unified market data service.
 * Import these types in other services for integration.
 */

// ============================================================================
// CORE TYPES
// ============================================================================

/**
 * Categories of collectibles supported by the service
 */
export type CollectibleCategory =
  | 'coin'
  | 'pokemon'
  | 'sports-card'
  | 'comic'
  | 'funko'
  | 'tcg'
  | 'other';

/**
 * Price range with low/mid/high values
 */
export interface PriceRange {
  low: number;
  mid: number;
  high: number;
}

/**
 * Unified market price data from any provider
 */
export interface MarketPrice {
  /** Unique identifier from the source */
  itemId: string;
  /** Display name of the item */
  name: string;
  /** Category of collectible */
  category: CollectibleCategory;
  /** Source provider name */
  source: string;
  /** URL to the source listing (optional) */
  sourceUrl?: string;
  /** Price data */
  prices: {
    /** Raw/ungraded price range */
    raw?: PriceRange;
    /** Graded prices by grade (e.g., 'MS65', 'PSA 10') */
    graded?: Record<string, PriceRange>;
  };
  /** Most recent sale information */
  lastSale?: {
    price: number;
    date: string;
    venue: string;
  };
  /** Population count for graded items */
  population?: number;
  /** ISO timestamp of last data update */
  lastUpdated: string;
}

/**
 * Provider health/status information
 */
export interface ProviderStatus {
  /** Provider name */
  name: string;
  /** Whether the provider is currently available */
  available: boolean;
  /** ISO timestamp of last status check */
  lastCheck: string;
  /** ISO timestamp of last data refresh */
  lastRefresh?: string;
  /** Number of items in cache */
  itemCount?: number;
  /** Error message if unavailable */
  error?: string;
}

// ============================================================================
// PROVIDER INTERFACE
// ============================================================================

/**
 * Standard interface for market data providers
 */
export interface MarketDataProvider {
  /** Provider display name */
  name: string;
  /** Categories this provider supports */
  categories: CollectibleCategory[];
  /** Check if provider is available (has auth, is online, etc.) */
  isAvailable(): boolean | Promise<boolean>;
  /** Search for items matching query */
  search(query: string, options?: { limit?: number }): Promise<MarketPrice[]>;
  /** Get price for a specific item by ID */
  getPrice(itemId: string): Promise<MarketPrice | null>;
  /** Check if cache needs refresh */
  needsRefresh?(): boolean;
  /** Refresh cached data */
  refreshCache?(): Promise<void>;
}

// ============================================================================
// CACHE TYPES
// ============================================================================

/**
 * Base cache structure used by all providers
 */
export interface BaseCache<T> {
  /** Cache format version */
  version: string;
  /** ISO timestamp of last fetch */
  lastFetched: string;
  /** Cache TTL in days */
  ttlDays: number;
  /** Cached data */
  items: Record<string, T>;
}

/**
 * Search options for unified search
 */
export interface SearchOptions {
  /** Filter by category */
  category?: CollectibleCategory;
  /** Maximum results to return */
  limit?: number;
  /** Specific providers to search (default: all available) */
  providers?: string[];
}
