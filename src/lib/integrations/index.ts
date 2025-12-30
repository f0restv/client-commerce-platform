import { db } from "../db";
import type { Product, ProductImage, Auction, Platform } from "@prisma/client";
import { createEbayListing, endEbayListing } from "./ebay";
import { createEtsyListing, endEtsyListing } from "./etsy";
import { addLotToAuction } from "./auctionflex";

export * from "./ebay";
export * from "./etsy";
export * from "./auctionflex";

// Aliases used by inngest functions
export { createEbayListing as listToEbay } from "./ebay";
export { createEtsyListing as listToEtsy } from "./etsy";

type ProductWithRelations = Product & {
  images: ProductImage[];
  auction?: Auction | null;
};

interface CrossListResult {
  platform: Platform;
  success: boolean;
  listingId?: string;
  url?: string;
  error?: string;
}

/**
 * Cross-list a product to multiple platforms
 */
export async function crossListProduct(
  product: ProductWithRelations,
  platforms: Platform[],
  auctionFlexEventId?: string
): Promise<CrossListResult[]> {
  const results: CrossListResult[] = [];

  for (const platform of platforms) {
    try {
      // Check if connection exists and is active
      const connection = await db.platformConnection.findUnique({
        where: { platform },
      });

      if (!connection || !connection.isActive) {
        results.push({
          platform,
          success: false,
          error: `${platform} is not connected`,
        });
        continue;
      }

      // Check if already listed
      const existingListing = await db.platformListing.findUnique({
        where: {
          productId_connectionId: {
            productId: product.id,
            connectionId: connection.id,
          },
        },
      });

      if (existingListing && existingListing.status === "ACTIVE") {
        results.push({
          platform,
          success: true,
          listingId: existingListing.externalId,
          url: existingListing.externalUrl || undefined,
          error: "Already listed",
        });
        continue;
      }

      let result: { listingId: string; url: string };

      switch (platform) {
        case "EBAY":
          result = await createEbayListing(product);
          break;

        case "ETSY":
          result = await createEtsyListing(product);
          break;

        case "AUCTIONFLEX360":
          if (!auctionFlexEventId) {
            throw new Error("AuctionFlex event ID required");
          }
          const auctionFlexResult = await addLotToAuction(auctionFlexEventId, product);
          result = { listingId: auctionFlexResult.lotId, url: auctionFlexResult.url };
          break;

        default:
          throw new Error(`Platform ${platform} not supported`);
      }

      results.push({
        platform,
        success: true,
        listingId: result.listingId,
        url: result.url,
      });
    } catch (error) {
      results.push({
        platform,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return results;
}

/**
 * Remove a product listing from a platform
 */
export async function removeFromPlatform(
  productId: string,
  platform: Platform
): Promise<void> {
  const connection = await db.platformConnection.findUnique({
    where: { platform },
  });

  if (!connection) {
    throw new Error(`${platform} is not connected`);
  }

  const listing = await db.platformListing.findUnique({
    where: {
      productId_connectionId: {
        productId,
        connectionId: connection.id,
      },
    },
  });

  if (!listing) {
    throw new Error("Listing not found");
  }

  switch (platform) {
    case "EBAY":
      await endEbayListing(listing.externalId);
      break;

    case "ETSY":
      await endEtsyListing(listing.externalId);
      break;

    default:
      throw new Error(`Platform ${platform} not supported for removal`);
  }
}

/**
 * Sync listing status from all platforms
 */
export async function syncAllListings(): Promise<{
  synced: number;
  errors: number;
}> {
  const listings = await db.platformListing.findMany({
    where: { status: "ACTIVE" },
    include: { connection: true },
  });

  let synced = 0;
  let errors = 0;

  for (const listing of listings) {
    try {
      // Implementation would check each platform's API for current status
      // and update the local database accordingly
      synced++;
    } catch {
      errors++;
    }
  }

  return { synced, errors };
}

/**
 * Get all active platform connections
 */
export async function getActiveConnections(): Promise<Platform[]> {
  const connections = await db.platformConnection.findMany({
    where: { isActive: true },
    select: { platform: true },
  });

  return connections.map((c) => c.platform);
}

/**
 * Get listing status across all platforms for a product
 */
export async function getProductListings(productId: string): Promise<
  Array<{
    platform: Platform;
    status: string;
    externalId: string;
    url: string | null;
    lastSyncAt: Date | null;
  }>
> {
  const listings = await db.platformListing.findMany({
    where: { productId },
    include: { connection: true },
  });

  return listings.map((l) => ({
    platform: l.connection.platform,
    status: l.status,
    externalId: l.externalId,
    url: l.externalUrl,
    lastSyncAt: l.lastSyncAt,
  }));
}
