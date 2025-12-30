/**
 * Unlisting Service - Remove items from all platforms
 * Supports: QR code, barcode, SMS, email, portal
 */

import { prisma } from '@/lib/db';

export interface UnlistingResult {
  success: boolean;
  itemId: string;
  removedFrom: string[];
  errors: string[];
}

/**
 * Remove an item from all platforms
 */
export async function unlistFromAllPlatforms(
  itemId: string,
  reason: string,
  actor: 'shop' | 'admin' | 'system' = 'shop'
): Promise<UnlistingResult> {
  const item = await prisma.product.findUnique({
    where: { id: itemId },
    include: {
      client: true,
      platformListings: {
        include: { connection: true }
      }
    },
  });

  if (!item) {
    throw new Error('Item not found');
  }

  if (item.status !== 'ACTIVE') {
    throw new Error('Item is not active');
  }

  const removedFrom: string[] = [];
  const errors: string[] = [];

  // Remove from all platforms in parallel
  const removals = item.platformListings.map(async (listing) => {
    const platform = listing.connection.platform.toLowerCase();
    try {
      switch (listing.connection.platform) {
        case 'EBAY':
          await removeFromEbay(listing.externalId);
          break;
        case 'ETSY':
          await removeFromEtsy(listing.externalId);
          break;
        // Other platforms can be added here as they're integrated
        default:
          // Generic removal - just mark as removed in DB
          break;
      }
      removedFrom.push(platform);
    } catch (e) {
      errors.push(`${platform}: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  });

  await Promise.allSettled(removals);

  // Update database - mark product as sold/removed
  await prisma.product.update({
    where: { id: itemId },
    data: {
      status: 'SOLD',
    },
  });

  // Update platform listings status
  await prisma.platformListing.updateMany({
    where: { productId: itemId },
    data: { status: 'REMOVED' },
  });

  return {
    success: errors.length === 0,
    itemId,
    removedFrom,
    errors,
  };
}

/**
 * Find item by various identifiers
 */
export async function findItemByIdentifier(identifier: {
  certNumber?: string;
  shortCode?: string;
  barcodeNumber?: string;
  unlistToken?: string;
  clientId?: string;
}) {
  const { certNumber, shortCode, barcodeNumber, unlistToken, clientId } = identifier;

  const where: any = {
    status: 'ACTIVE',
    OR: [] as any[],
  };

  if (certNumber) where.OR.push({ certNumber });
  if (shortCode) where.OR.push({ shortCode });
  if (barcodeNumber) where.OR.push({ barcodeNumber });
  if (unlistToken) where.OR.push({ unlistToken });

  if (where.OR.length === 0) return null;
  if (clientId) where.clientId = clientId;

  return prisma.product.findFirst({ where, include: { client: true } });
}

/**
 * Mark item as sold
 */
export async function markItemAsSold(
  itemId: string,
  _saleDetails: {
    soldPrice: number;
    buyerInfo?: unknown;
    platform: 'ebay' | 'etsy';
  }
) {
  // Update product status to SOLD
  return prisma.product.update({
    where: { id: itemId },
    data: {
      status: 'SOLD',
    },
  });
}

// Platform removal functions
async function removeFromShopify(productId: string): Promise<void> {
  // TODO: Implement with Shopify API
  console.log(`[Shopify] Removing product ${productId}`);
}

async function removeFromEbay(itemId: string): Promise<void> {
  // TODO: Implement with eBay API
  console.log(`[eBay] Ending listing ${itemId}`);
}

async function removeFromEtsy(listingId: string): Promise<void> {
  // TODO: Implement with Etsy API
  console.log(`[Etsy] Deactivating listing ${listingId}`);
}
