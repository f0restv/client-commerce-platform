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
    include: { client: true },
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
  const removals = [];

  if (item.shopifyProductId) {
    removals.push(
      removeFromShopify(item.shopifyProductId)
        .then(() => removedFrom.push('shopify'))
        .catch((e) => errors.push(`Shopify: ${e.message}`))
    );
  }

  if (item.ebayListingId) {
    removals.push(
      removeFromEbay(item.ebayListingId)
        .then(() => removedFrom.push('ebay'))
        .catch((e) => errors.push(`eBay: ${e.message}`))
    );
  }

  if (item.etsyListingId) {
    removals.push(
      removeFromEtsy(item.etsyListingId)
        .then(() => removedFrom.push('etsy'))
        .catch((e) => errors.push(`Etsy: ${e.message}`))
    );
  }

  await Promise.allSettled(removals);

  // Update database
  await prisma.product.update({
    where: { id: itemId },
    data: {
      status: actor === 'shop' ? 'REMOVED_BY_CLIENT' : 'REMOVED_BY_ADMIN',
      removedAt: new Date(),
      removalReason: reason,
    },
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
  saleDetails: {
    soldPrice: number;
    buyerInfo?: any;
    platform: 'shopify' | 'ebay' | 'etsy';
  }
) {
  return prisma.product.update({
    where: { id: itemId },
    data: {
      status: 'SOLD',
      soldAt: new Date(),
      soldPrice: saleDetails.soldPrice,
      soldPlatform: saleDetails.platform,
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
