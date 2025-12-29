/**
 * eBay Listing Service
 *
 * Handles creating, updating, and managing eBay listings using the Inventory API.
 */

import { db } from "@/lib/db";
import type { Product, ProductImage } from "@prisma/client";
import { getPlatformAccessToken, getConfig, getApiBaseUrl } from "./auth";

// =============================================================================
// Types
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

interface InventoryItem {
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

interface OfferRequest {
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
// Condition Mapping
// =============================================================================

const CONDITION_MAP: Record<string, string> = {
  new: "NEW",
  "like new": "LIKE_NEW",
  "very good": "VERY_GOOD",
  good: "GOOD",
  acceptable: "ACCEPTABLE",
  used: "USED_EXCELLENT",
  excellent: "USED_EXCELLENT",
  "near mint": "USED_EXCELLENT",
  "very fine": "USED_VERY_GOOD",
  fine: "USED_GOOD",
  "very good condition": "USED_VERY_GOOD",
};

function mapCondition(condition?: string | null): string {
  if (!condition) return "USED_EXCELLENT";
  return CONDITION_MAP[condition.toLowerCase()] || "USED_EXCELLENT";
}

// =============================================================================
// Category Mapping
// =============================================================================

// Default eBay category IDs for coins
const CATEGORY_MAP: Record<string, string> = {
  coins: "11116",
  "us coins": "11116",
  "world coins": "11117",
  currency: "11118",
  bullion: "39482",
  "gold bullion": "179028",
  "silver bullion": "179022",
  "ancient coins": "4733",
  medals: "11094",
  tokens: "11093",
  default: "11116",
};

async function getCategoryId(product: Product): Promise<string> {
  // Try to map from product category
  const category = await db.category.findUnique({
    where: { id: product.categoryId },
  });

  if (category?.name) {
    const categoryName = category.name.toLowerCase();
    for (const [key, value] of Object.entries(CATEGORY_MAP)) {
      if (categoryName.includes(key)) {
        return value;
      }
    }
  }

  return CATEGORY_MAP.default;
}

// =============================================================================
// Product Aspects
// =============================================================================

function buildAspects(product: Product): Record<string, string[]> {
  const aspects: Record<string, string[]> = {};

  if (product.year) aspects["Year"] = [product.year.toString()];
  if (product.mint) aspects["Mint Location"] = [product.mint];
  if (product.grade) aspects["Grade"] = [product.grade];
  if (product.certification) aspects["Certification"] = [product.certification];
  if (product.certNumber) aspects["Certification Number"] = [product.certNumber];
  if (product.metalType && product.metalType !== "NONE") {
    aspects["Composition"] = [product.metalType];
  }
  if (product.condition) aspects["Condition"] = [product.condition];

  return aspects;
}

// =============================================================================
// Main Listing Functions
// =============================================================================

/**
 * Create a new eBay listing for a product
 */
export async function createListing(
  accessToken: string,
  product: Product & { images: ProductImage[] },
  options: ListingOptions = {}
): Promise<EbayListingResult> {
  const config = getConfig();
  const baseUrl = getApiBaseUrl(config.sandbox);

  const warnings: string[] = [];

  // 1. Create/Update inventory item
  const inventoryItem: InventoryItem = {
    availability: {
      shipToLocationAvailability: {
        quantity: product.quantity || 1,
      },
    },
    condition: mapCondition(product.condition),
    product: {
      title: product.title.slice(0, 80), // eBay title limit
      description: product.description || "",
      imageUrls: product.images.map((img) => img.url).slice(0, 12), // eBay image limit
      aspects: buildAspects(product),
    },
  };

  const inventoryResponse = await fetch(
    `${baseUrl}/sell/inventory/v1/inventory_item/${product.sku}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Content-Language": "en-US",
      },
      body: JSON.stringify(inventoryItem),
    }
  );

  if (!inventoryResponse.ok && inventoryResponse.status !== 204) {
    const errorText = await inventoryResponse.text();
    throw new Error(`Failed to create inventory item: ${errorText}`);
  }

  // 2. Create offer
  const categoryId = options.categoryId || (await getCategoryId(product));
  const isAuction = options.auction || product.listingType === "AUCTION";

  const offer: OfferRequest = {
    sku: product.sku,
    marketplaceId: "EBAY_US",
    format: isAuction ? "AUCTION" : "FIXED_PRICE",
    listingPolicies: {
      fulfillmentPolicyId:
        options.fulfillmentPolicyId || process.env.EBAY_FULFILLMENT_POLICY_ID,
      paymentPolicyId:
        options.paymentPolicyId || process.env.EBAY_PAYMENT_POLICY_ID,
      returnPolicyId:
        options.returnPolicyId || process.env.EBAY_RETURN_POLICY_ID,
    },
    pricingSummary: {
      price: {
        value: product.price?.toString() || "0",
        currency: "USD",
      },
    },
    categoryId,
  };

  if (isAuction) {
    offer.listingDuration = "DAYS_7";
  }

  const offerResponse = await fetch(`${baseUrl}/sell/inventory/v1/offer`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Content-Language": "en-US",
    },
    body: JSON.stringify(offer),
  });

  if (!offerResponse.ok) {
    const errorText = await offerResponse.text();
    throw new Error(`Failed to create offer: ${errorText}`);
  }

  const offerData = await offerResponse.json();

  // Check for warnings
  if (offerData.warnings) {
    warnings.push(
      ...offerData.warnings.map(
        (w: { message: string }) => w.message
      )
    );
  }

  // 3. Publish offer
  const publishResponse = await fetch(
    `${baseUrl}/sell/inventory/v1/offer/${offerData.offerId}/publish`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!publishResponse.ok) {
    const errorText = await publishResponse.text();
    throw new Error(`Failed to publish offer: ${errorText}`);
  }

  const publishData = await publishResponse.json();
  const listingId = publishData.listingId;

  // 4. Store in database
  const connection = await db.platformConnection.findUnique({
    where: { platform: "EBAY" },
  });

  if (connection) {
    await db.platformListing.upsert({
      where: {
        productId_connectionId: {
          productId: product.id,
          connectionId: connection.id,
        },
      },
      create: {
        productId: product.id,
        connectionId: connection.id,
        externalId: listingId,
        externalUrl: `https://www.ebay.com/itm/${listingId}`,
        status: "ACTIVE",
        lastSyncAt: new Date(),
      },
      update: {
        externalId: listingId,
        externalUrl: `https://www.ebay.com/itm/${listingId}`,
        status: "ACTIVE",
        lastSyncAt: new Date(),
      },
    });
  }

  return {
    listingId,
    offerId: offerData.offerId,
    url: `https://www.ebay.com/itm/${listingId}`,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Create a listing using the platform's stored credentials
 */
export async function createListingWithPlatformAuth(
  product: Product & { images: ProductImage[] },
  options: ListingOptions = {}
): Promise<EbayListingResult> {
  const accessToken = await getPlatformAccessToken();
  return createListing(accessToken, product, options);
}

/**
 * Update an existing eBay listing
 */
export async function updateListing(
  accessToken: string,
  product: Product & { images: ProductImage[] },
  offerId: string
): Promise<void> {
  const config = getConfig();
  const baseUrl = getApiBaseUrl(config.sandbox);

  // Update inventory item
  const inventoryItem: InventoryItem = {
    availability: {
      shipToLocationAvailability: {
        quantity: product.quantity || 1,
      },
    },
    condition: mapCondition(product.condition),
    product: {
      title: product.title.slice(0, 80),
      description: product.description || "",
      imageUrls: product.images.map((img) => img.url).slice(0, 12),
      aspects: buildAspects(product),
    },
  };

  const inventoryResponse = await fetch(
    `${baseUrl}/sell/inventory/v1/inventory_item/${product.sku}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Content-Language": "en-US",
      },
      body: JSON.stringify(inventoryItem),
    }
  );

  if (!inventoryResponse.ok && inventoryResponse.status !== 204) {
    const errorText = await inventoryResponse.text();
    throw new Error(`Failed to update inventory item: ${errorText}`);
  }

  // Update offer price if needed
  const offerUpdate = {
    pricingSummary: {
      price: {
        value: product.price?.toString() || "0",
        currency: "USD",
      },
    },
  };

  const offerResponse = await fetch(
    `${baseUrl}/sell/inventory/v1/offer/${offerId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(offerUpdate),
    }
  );

  if (!offerResponse.ok) {
    const errorText = await offerResponse.text();
    throw new Error(`Failed to update offer: ${errorText}`);
  }

  // Update sync timestamp
  await db.platformListing.updateMany({
    where: {
      productId: product.id,
      connection: { platform: "EBAY" },
    },
    data: {
      lastSyncAt: new Date(),
    },
  });
}

/**
 * End/withdraw an eBay listing
 */
export async function endListing(
  accessToken: string,
  listingId: string
): Promise<void> {
  const config = getConfig();
  const baseUrl = getApiBaseUrl(config.sandbox);

  // Find the offer ID from listing
  const platformListing = await db.platformListing.findFirst({
    where: { externalId: listingId },
  });

  if (!platformListing) {
    throw new Error(`Listing ${listingId} not found in database`);
  }

  // Withdraw the offer
  const response = await fetch(
    `${baseUrl}/sell/inventory/v1/offer/${listingId}/withdraw`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to end listing: ${errorText}`);
  }

  // Update database
  await db.platformListing.update({
    where: { id: platformListing.id },
    data: { status: "REMOVED" },
  });
}

/**
 * End a listing using platform credentials
 */
export async function endListingWithPlatformAuth(
  listingId: string
): Promise<void> {
  const accessToken = await getPlatformAccessToken();
  return endListing(accessToken, listingId);
}

/**
 * Get all active listings from the database
 */
export async function getActiveListings(): Promise<
  {
    id: string;
    productId: string;
    externalId: string;
    externalUrl: string | null;
    lastSyncAt: Date | null;
  }[]
> {
  return db.platformListing.findMany({
    where: {
      status: "ACTIVE",
      connection: { platform: "EBAY" },
    },
    select: {
      id: true,
      productId: true,
      externalId: true,
      externalUrl: true,
      lastSyncAt: true,
    },
  });
}

/**
 * Bulk update listing prices
 */
export async function bulkUpdatePrices(
  accessToken: string,
  updates: { sku: string; price: number }[]
): Promise<{ success: number; failed: number; errors: string[] }> {
  const config = getConfig();
  const baseUrl = getApiBaseUrl(config.sandbox);

  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const update of updates) {
    try {
      const response = await fetch(
        `${baseUrl}/sell/inventory/v1/bulk_update_price_quantity`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            requests: [
              {
                sku: update.sku,
                shipToLocationAvailability: {
                  quantity: 1,
                },
                offers: [
                  {
                    price: {
                      value: update.price.toString(),
                      currency: "USD",
                    },
                  },
                ],
              },
            ],
          }),
        }
      );

      if (response.ok) {
        success++;
      } else {
        failed++;
        const errorText = await response.text();
        errors.push(`SKU ${update.sku}: ${errorText}`);
      }
    } catch (err) {
      failed++;
      errors.push(
        `SKU ${update.sku}: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  }

  return { success, failed, errors };
}
