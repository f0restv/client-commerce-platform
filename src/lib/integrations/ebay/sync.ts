/**
 * eBay Sync Service
 *
 * Handles syncing sold items and order data from eBay.
 */

import { db } from "@/lib/db";
import {
  getPlatformAccessToken,
  getClientAccessToken,
  ensureValidToken,
  getConfig,
  getApiBaseUrl,
} from "./auth";

// =============================================================================
// Types
// =============================================================================

interface EbayOrder {
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

interface EbayLineItem {
  lineItemId: string;
  sku: string;
  title: string;
  quantity: number;
  lineItemCost: { value: string; currency: string };
  total: { value: string; currency: string };
}

interface SyncResult {
  synced: number;
  updated: number;
  errors: string[];
}

// =============================================================================
// Sold Items Sync
// =============================================================================

/**
 * Sync sold items from eBay for a specific client
 * @param clientId - The client ID to sync for
 */
export async function syncSoldItems(clientId: string): Promise<SyncResult> {
  const accessToken = await getClientAccessToken(clientId);
  return syncSoldItemsWithToken(accessToken, clientId);
}

/**
 * Sync sold items for the platform connection
 */
export async function syncPlatformSoldItems(): Promise<SyncResult> {
  const accessToken = await getPlatformAccessToken();
  return syncSoldItemsWithToken(accessToken);
}

/**
 * Core sync function with provided token
 */
async function syncSoldItemsWithToken(
  accessToken: string,
  clientId?: string
): Promise<SyncResult> {
  const config = getConfig();
  const baseUrl = getApiBaseUrl(config.sandbox);

  const result: SyncResult = {
    synced: 0,
    updated: 0,
    errors: [],
  };

  try {
    // Fetch recent orders (last 30 days, any status)
    const response = await fetch(
      `${baseUrl}/sell/fulfillment/v1/order?filter=creationdate:[${getDateFilter(30)}]&limit=200`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch orders: ${errorText}`);
    }

    const data = await response.json();
    const orders: EbayOrder[] = data.orders || [];

    for (const order of orders) {
      try {
        await processOrder(order, clientId);
        result.synced++;
      } catch (err) {
        result.errors.push(
          `Order ${order.orderId}: ${err instanceof Error ? err.message : "Unknown error"}`
        );
      }
    }

    // Handle pagination
    let offset = 200;
    while (data.total > offset) {
      const nextResponse = await fetch(
        `${baseUrl}/sell/fulfillment/v1/order?filter=creationdate:[${getDateFilter(30)}]&limit=200&offset=${offset}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (nextResponse.ok) {
        const nextData = await nextResponse.json();
        for (const order of nextData.orders || []) {
          try {
            await processOrder(order, clientId);
            result.synced++;
          } catch (err) {
            result.errors.push(
              `Order ${order.orderId}: ${err instanceof Error ? err.message : "Unknown error"}`
            );
          }
        }
      }
      offset += 200;
    }
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : "Unknown error");
  }

  return result;
}

/**
 * Process a single eBay order
 */
async function processOrder(order: EbayOrder, clientId?: string): Promise<void> {
  for (const lineItem of order.lineItems) {
    // Try to find the product by SKU
    const whereClause: {
      sku: string;
      clientId?: string;
    } = { sku: lineItem.sku };

    if (clientId) {
      whereClause.clientId = clientId;
    }

    const product = await db.product.findFirst({
      where: whereClause,
    });

    if (product) {
      // Check if already marked as sold with this order
      const existingListing = await db.platformListing.findFirst({
        where: {
          productId: product.id,
          connection: { platform: "EBAY" },
        },
      });

      // Update product status if not already sold
      if (product.status !== "SOLD") {
        await db.product.update({
          where: { id: product.id },
          data: {
            status: "SOLD",
          },
        });

        // Update platform listing status
        if (existingListing) {
          await db.platformListing.update({
            where: { id: existingListing.id },
            data: {
              status: "SOLD",
              lastSyncAt: new Date(),
            },
          });
        }

        // Create price history entry
        const soldPrice = parseFloat(lineItem.total.value);
        await db.priceHistory.create({
          data: {
            productId: product.id,
            price: soldPrice,
            reason: "ebay_sale",
          },
        });

        // Update client stats if consignment
        if (product.clientId) {
          await db.client.update({
            where: { id: product.clientId },
            data: {
              totalSold: { increment: 1 },
              totalEarnings: { increment: soldPrice },
            },
          });
        }
      }
    }
  }
}

// =============================================================================
// Active Listings Sync
// =============================================================================

/**
 * Sync active listings status from eBay
 */
export async function syncActiveListings(): Promise<SyncResult> {
  const accessToken = await getPlatformAccessToken();
  const config = getConfig();
  const baseUrl = getApiBaseUrl(config.sandbox);

  const result: SyncResult = {
    synced: 0,
    updated: 0,
    errors: [],
  };

  try {
    // Get all our active platform listings
    const platformListings = await db.platformListing.findMany({
      where: {
        status: "ACTIVE",
        connection: { platform: "EBAY" },
      },
      include: {
        product: true,
      },
    });

    for (const listing of platformListings) {
      try {
        // Check status via eBay API
        const response = await fetch(
          `${baseUrl}/sell/inventory/v1/inventory_item/${listing.product.sku}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (response.status === 404) {
          // Item no longer exists on eBay
          await db.platformListing.update({
            where: { id: listing.id },
            data: {
              status: "REMOVED",
              lastSyncAt: new Date(),
            },
          });
          result.updated++;
        } else if (response.ok) {
          const itemData = await response.json();
          await db.platformListing.update({
            where: { id: listing.id },
            data: {
              lastSyncAt: new Date(),
            },
          });
          result.synced++;
        }
      } catch (err) {
        result.errors.push(
          `Listing ${listing.externalId}: ${err instanceof Error ? err.message : "Unknown error"}`
        );
      }
    }
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : "Unknown error");
  }

  return result;
}

// =============================================================================
// Inventory Sync
// =============================================================================

/**
 * Sync inventory quantities from eBay
 */
export async function syncInventory(): Promise<SyncResult> {
  const accessToken = await getPlatformAccessToken();
  const config = getConfig();
  const baseUrl = getApiBaseUrl(config.sandbox);

  const result: SyncResult = {
    synced: 0,
    updated: 0,
    errors: [],
  };

  try {
    // Fetch all inventory items
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const response = await fetch(
        `${baseUrl}/sell/inventory/v1/inventory_item?limit=${limit}&offset=${offset}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch inventory: ${errorText}`);
      }

      const data = await response.json();
      const items = data.inventoryItems || [];

      for (const item of items) {
        try {
          const product = await db.product.findUnique({
            where: { sku: item.sku },
          });

          if (product) {
            const ebayQuantity =
              item.availability?.shipToLocationAvailability?.quantity || 0;

            if (product.quantity !== ebayQuantity) {
              await db.product.update({
                where: { id: product.id },
                data: { quantity: ebayQuantity },
              });
              result.updated++;
            } else {
              result.synced++;
            }
          }
        } catch (err) {
          result.errors.push(
            `SKU ${item.sku}: ${err instanceof Error ? err.message : "Unknown error"}`
          );
        }
      }

      hasMore = items.length === limit;
      offset += limit;

      // Safety limit
      if (offset > 10000) break;
    }
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : "Unknown error");
  }

  return result;
}

// =============================================================================
// Full Sync
// =============================================================================

/**
 * Run a full sync (orders, listings, inventory)
 */
export async function runFullSync(): Promise<{
  orders: SyncResult;
  listings: SyncResult;
  inventory: SyncResult;
}> {
  const orders = await syncPlatformSoldItems();
  const listings = await syncActiveListings();
  const inventory = await syncInventory();

  return { orders, listings, inventory };
}

// =============================================================================
// Helpers
// =============================================================================

function getDateFilter(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
}

/**
 * Get sync status for dashboard
 */
export async function getSyncStatus(): Promise<{
  lastSync: Date | null;
  activeListings: number;
  pendingSync: number;
}> {
  const connection = await db.platformConnection.findUnique({
    where: { platform: "EBAY" },
  });

  const activeListings = await db.platformListing.count({
    where: {
      status: "ACTIVE",
      connection: { platform: "EBAY" },
    },
  });

  // Find listings that haven't been synced in the last hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const pendingSync = await db.platformListing.count({
    where: {
      status: "ACTIVE",
      connection: { platform: "EBAY" },
      OR: [
        { lastSyncAt: null },
        { lastSyncAt: { lt: oneHourAgo } },
      ],
    },
  });

  return {
    lastSync: connection?.updatedAt || null,
    activeListings,
    pendingSync,
  };
}
