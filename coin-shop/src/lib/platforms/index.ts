import { getEbayService, EbayService } from './ebay';
import { getEtsyService, EtsyService } from './etsy';
import { getAuctionFlexService, AuctionFlexService } from './auctionflex';
import type { Product, PlatformListing, Auction } from '@/types';

export { EbayService, EtsyService, AuctionFlexService };
export { getEbayService, getEtsyService, getAuctionFlexService };

export type Platform = 'ebay' | 'etsy' | 'auctionflex';

interface MultiPlatformResult {
  platform: Platform;
  success: boolean;
  listing?: PlatformListing;
  error?: string;
}

/**
 * Unified service for managing listings across multiple platforms
 */
export class MultiPlatformService {
  private ebay: EbayService;
  private etsy: EtsyService;
  private auctionFlex: AuctionFlexService;

  constructor() {
    this.ebay = getEbayService();
    this.etsy = getEtsyService();
    this.auctionFlex = getAuctionFlexService();
  }

  /**
   * Create listings on multiple platforms simultaneously
   */
  async createListings(
    product: Product,
    platforms: Platform[],
    auction?: Auction
  ): Promise<MultiPlatformResult[]> {
    const results: MultiPlatformResult[] = [];

    const promises = platforms.map(async (platform) => {
      try {
        let listing: PlatformListing;

        switch (platform) {
          case 'ebay':
            listing = await this.ebay.createListing(product);
            break;
          case 'etsy':
            listing = await this.etsy.createListing(product);
            break;
          case 'auctionflex':
            listing = await this.auctionFlex.createLot(product, auction);
            break;
        }

        return { platform, success: true, listing };
      } catch (error) {
        return {
          platform,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    const settled = await Promise.allSettled(promises);

    for (const result of settled) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({
          platform: 'ebay', // We don't know which one failed
          success: false,
          error: result.reason,
        });
      }
    }

    return results;
  }

  /**
   * Update listings on all platforms where the product is listed
   */
  async updateListings(
    product: Product,
    listings: PlatformListing[],
    auction?: Auction
  ): Promise<MultiPlatformResult[]> {
    const results: MultiPlatformResult[] = [];

    for (const listing of listings) {
      try {
        switch (listing.platform) {
          case 'ebay':
            await this.ebay.updateListing(listing.external_id, product);
            break;
          case 'etsy':
            await this.etsy.updateListing(listing.external_id, product);
            break;
          case 'auctionflex':
            await this.auctionFlex.updateLot(listing.external_id, product, auction);
            break;
        }

        results.push({
          platform: listing.platform,
          success: true,
          listing: { ...listing, last_synced_at: new Date().toISOString() },
        });
      } catch (error) {
        results.push({
          platform: listing.platform,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * End/delete listings when a product is sold or removed
   */
  async endListings(listings: PlatformListing[], reason: 'sold' | 'removed' = 'removed'): Promise<MultiPlatformResult[]> {
    const results: MultiPlatformResult[] = [];

    for (const listing of listings) {
      try {
        switch (listing.platform) {
          case 'ebay':
            await this.ebay.endListing(listing.external_id, reason === 'sold' ? 'Sold' : 'NotAvailable');
            break;
          case 'etsy':
            await this.etsy.deleteListing(listing.external_id);
            break;
          case 'auctionflex':
            await this.auctionFlex.deleteLot(listing.external_id);
            break;
        }

        results.push({
          platform: listing.platform,
          success: true,
          listing: { ...listing, status: reason === 'sold' ? 'sold' : 'ended' },
        });
      } catch (error) {
        results.push({
          platform: listing.platform,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Sync listing statuses from all platforms
   */
  async syncStatuses(listings: PlatformListing[]): Promise<Map<string, {
    status: 'active' | 'ended' | 'sold';
    currentBid?: number;
    bidCount?: number;
  }>> {
    const statuses = new Map();

    for (const listing of listings) {
      try {
        let status;

        switch (listing.platform) {
          case 'ebay':
            status = await this.ebay.getListingStatus(listing.external_id);
            break;
          case 'etsy':
            status = await this.etsy.getListingStatus(listing.external_id);
            break;
          case 'auctionflex':
            status = await this.auctionFlex.getLotStatus(listing.external_id);
            break;
        }

        statuses.set(listing.id, status);
      } catch (error) {
        console.error(`Failed to sync status for ${listing.platform} listing ${listing.external_id}:`, error);
      }
    }

    return statuses;
  }
}

// Singleton instance
let multiPlatformService: MultiPlatformService | null = null;

export function getMultiPlatformService(): MultiPlatformService {
  if (!multiPlatformService) {
    multiPlatformService = new MultiPlatformService();
  }
  return multiPlatformService;
}
