import type {
  ScrapedItem,
  SyncResult,
  SyncError,
  ItemComparison,
  ClientSourceData,
} from './types';
import prisma from '@/lib/db';
import { ProductStatus, Prisma } from '@prisma/client';

/**
 * Options for sync operation
 */
export interface SyncOptions {
  dryRun?: boolean;
  markMissingSold?: boolean;
  updatePrices?: boolean;
  createNew?: boolean;
  defaultCategoryId?: string;
}

const DEFAULT_SYNC_OPTIONS: SyncOptions = {
  dryRun: false,
  markMissingSold: true,
  updatePrices: true,
  createNew: true,
};

/**
 * Compare scraped items against existing products in the database
 */
export async function compareItems(
  items: ScrapedItem[],
  clientId: string
): Promise<ItemComparison[]> {
  const comparisons: ItemComparison[] = [];

  // Get all existing products for this client that were scraped (have sourceUrl)
  const existingProducts = await prisma.product.findMany({
    where: {
      clientId,
      sourceUrl: { not: null },
    },
    select: {
      id: true,
      sku: true,
      title: true,
      price: true,
      status: true,
      sourceUrl: true,
    },
  });

  // Create lookup maps
  const byUrl = new Map(existingProducts.map((p) => [p.sourceUrl!, p]));
  const bySku = new Map(existingProducts.filter((p) => p.sku).map((p) => [p.sku, p]));

  for (const item of items) {
    // Try to find existing product by URL first, then by SKU
    let existing = byUrl.get(item.sourceUrl);
    if (!existing && item.sku) {
      existing = bySku.get(item.sku);
    }

    if (existing) {
      // Check for changes
      const changes = detectChanges(item, existing);

      comparisons.push({
        scrapedItem: item,
        existingProduct: existing,
        action: changes.length > 0 ? 'update' : 'none',
        changes: changes.length > 0 ? changes : undefined,
      });
    } else {
      // New item
      comparisons.push({
        scrapedItem: item,
        existingProduct: null,
        action: 'create',
      });
    }
  }

  return comparisons;
}

/**
 * Detect changes between scraped item and existing product
 */
function detectChanges(
  item: ScrapedItem,
  existing: { price: Prisma.Decimal | null; title: string }
): { field: string; oldValue: unknown; newValue: unknown }[] {
  const changes: { field: string; oldValue: unknown; newValue: unknown }[] = [];

  // Price change
  const existingPrice = existing.price ? parseFloat(existing.price.toString()) : null;
  if (item.price !== existingPrice) {
    changes.push({
      field: 'price',
      oldValue: existingPrice,
      newValue: item.price,
    });
  }

  // Title change (significant difference)
  if (
    existing.title.toLowerCase().trim() !== item.title.toLowerCase().trim() &&
    !existing.title.includes(item.title) &&
    !item.title.includes(existing.title)
  ) {
    changes.push({
      field: 'title',
      oldValue: existing.title,
      newValue: item.title,
    });
  }

  return changes;
}

/**
 * Sync scraped items to the database
 */
export async function syncItems(
  items: ScrapedItem[],
  source: ClientSourceData,
  options: SyncOptions = {}
): Promise<SyncResult> {
  const opts = { ...DEFAULT_SYNC_OPTIONS, ...options };
  const startTime = Date.now();
  const errors: SyncError[] = [];
  let itemsNew = 0;
  let itemsUpdated = 0;
  let itemsRemoved = 0;

  // Get comparisons
  const comparisons = await compareItems(items, source.clientId);

  // Get all source URLs from scraped items
  const scrapedUrls = new Set(items.map((i) => i.sourceUrl));

  // Find products that exist in DB but weren't in scrape (potentially sold)
  const existingProducts = await prisma.product.findMany({
    where: {
      clientId: source.clientId,
      sourceUrl: { not: null },
      status: { in: ['ACTIVE', 'DRAFT', 'PENDING_REVIEW'] },
    },
    select: {
      id: true,
      sourceUrl: true,
      status: true,
    },
  });

  const missingProducts = existingProducts.filter(
    (p) => p.sourceUrl && !scrapedUrls.has(p.sourceUrl)
  );

  if (opts.dryRun) {
    // Return what would happen without making changes
    return {
      sourceId: source.id,
      itemsFound: items.length,
      itemsNew: comparisons.filter((c) => c.action === 'create').length,
      itemsUpdated: comparisons.filter((c) => c.action === 'update').length,
      itemsRemoved: opts.markMissingSold ? missingProducts.length : 0,
      errors,
      duration: Math.round((Date.now() - startTime) / 1000),
    };
  }

  // Process creates
  if (opts.createNew) {
    const toCreate = comparisons.filter((c) => c.action === 'create');

    for (const comparison of toCreate) {
      try {
        await createProduct(comparison.scrapedItem, source, opts.defaultCategoryId);
        itemsNew++;
      } catch (err) {
        errors.push({
          type: 'create',
          message: err instanceof Error ? err.message : 'Failed to create product',
          itemUrl: comparison.scrapedItem.sourceUrl,
        });
      }
    }
  }

  // Process updates
  if (opts.updatePrices) {
    const toUpdate = comparisons.filter((c) => c.action === 'update');

    for (const comparison of toUpdate) {
      try {
        await updateProduct(comparison);
        itemsUpdated++;
      } catch (err) {
        errors.push({
          type: 'update',
          message: err instanceof Error ? err.message : 'Failed to update product',
          itemUrl: comparison.scrapedItem.sourceUrl,
          productId: comparison.existingProduct?.id,
        });
      }
    }
  }

  // Process removals (mark as sold)
  if (opts.markMissingSold && missingProducts.length > 0) {
    try {
      const result = await prisma.product.updateMany({
        where: {
          id: { in: missingProducts.map((p) => p.id) },
        },
        data: {
          status: ProductStatus.SOLD,
        },
      });
      itemsRemoved = result.count;
    } catch (err) {
      errors.push({
        type: 'remove',
        message: err instanceof Error ? err.message : 'Failed to mark products as sold',
      });
    }
  }

  // Update scrape history with sync results
  const latestHistory = await prisma.scrapeHistory.findFirst({
    where: { sourceId: source.id },
    orderBy: { createdAt: 'desc' },
  });

  if (latestHistory) {
    await prisma.scrapeHistory.update({
      where: { id: latestHistory.id },
      data: {
        itemsNew,
        itemsUpdated,
        itemsRemoved,
      },
    });
  }

  return {
    sourceId: source.id,
    itemsFound: items.length,
    itemsNew,
    itemsUpdated,
    itemsRemoved,
    errors,
    duration: Math.round((Date.now() - startTime) / 1000),
  };
}

/**
 * Create a new product from scraped item
 */
async function createProduct(
  item: ScrapedItem,
  source: ClientSourceData,
  defaultCategoryId?: string
): Promise<string> {
  // Generate SKU if not provided
  const sku = item.sku || generateSku(source.clientId, item);

  // Find or create category
  let categoryId = defaultCategoryId;
  if (!categoryId) {
    // Try to find a default category or use the first one
    const defaultCategory = await prisma.category.findFirst({
      where: { slug: 'uncategorized' },
    });
    if (defaultCategory) {
      categoryId = defaultCategory.id;
    } else {
      // Create uncategorized category
      const category = await prisma.category.create({
        data: {
          name: 'Uncategorized',
          slug: 'uncategorized',
        },
      });
      categoryId = category.id;
    }
  }

  const product = await prisma.product.create({
    data: {
      sku,
      title: item.title,
      description: item.description || '',
      categoryId,
      price: item.price ? new Prisma.Decimal(item.price) : null,
      quantity: item.quantity,
      condition: item.condition,
      status: ProductStatus.DRAFT,
      clientId: source.clientId,
      sourceUrl: item.sourceUrl,
      isConsignment: true,
      // Create images
      images: {
        create: item.images.map((url, index) => ({
          url,
          order: index,
          isPrimary: index === 0,
        })),
      },
    },
  });

  // Update client stats
  await prisma.client.update({
    where: { id: source.clientId },
    data: {
      totalItems: { increment: 1 },
    },
  });

  return product.id;
}

/**
 * Update an existing product with scraped data
 */
async function updateProduct(comparison: ItemComparison): Promise<void> {
  if (!comparison.existingProduct || !comparison.changes) {
    return;
  }

  const updates: Prisma.ProductUpdateInput = {};

  for (const change of comparison.changes) {
    if (change.field === 'price' && change.newValue !== null) {
      updates.price = new Prisma.Decimal(change.newValue as number);

      // Record price history
      await prisma.priceHistory.create({
        data: {
          productId: comparison.existingProduct.id,
          price: new Prisma.Decimal(change.newValue as number),
          reason: 'scrape_update',
        },
      });
    }
  }

  if (Object.keys(updates).length > 0) {
    await prisma.product.update({
      where: { id: comparison.existingProduct.id },
      data: updates,
    });
  }
}

/**
 * Generate a SKU for a scraped item
 */
function generateSku(clientId: string, item: ScrapedItem): string {
  // Use external ID if available
  if (item.externalId) {
    return `${clientId.substring(0, 4).toUpperCase()}-${item.externalId}`;
  }

  // Generate from title hash
  const titleHash = hashString(item.title).toString(16).substring(0, 8).toUpperCase();
  const timestamp = Date.now().toString(36).toUpperCase();

  return `${clientId.substring(0, 4).toUpperCase()}-${titleHash}-${timestamp}`;
}

/**
 * Simple string hash function
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Run a full scrape and sync operation
 */
export async function scrapeAndSync(
  sourceId: string,
  options: SyncOptions = {}
): Promise<{ scrapeResult: import('./types').ScrapeResult; syncResult: SyncResult }> {
  const { runScrapeJob } = await import('./scraper');

  // Run scrape
  const scrapeResult = await runScrapeJob(sourceId);

  // Get source data
  const source = await prisma.clientSource.findUnique({
    where: { id: sourceId },
  });

  if (!source) {
    throw new Error(`Source not found: ${sourceId}`);
  }

  const sourceData: ClientSourceData = {
    id: source.id,
    clientId: source.clientId,
    name: source.name,
    type: source.type,
    url: source.url,
    isActive: source.isActive,
    scrapeFrequency: source.scrapeFrequency,
    selectors: source.selectors as ClientSourceData['selectors'],
    config: source.config as ClientSourceData['config'],
    lastScrapedAt: source.lastScrapedAt,
    lastItemCount: source.lastItemCount,
    lastError: source.lastError,
  };

  // Run sync
  const syncResult = await syncItems(scrapeResult.items, sourceData, options);

  return { scrapeResult, syncResult };
}

/**
 * Get sync preview without making changes
 */
export async function getSyncPreview(
  items: ScrapedItem[],
  clientId: string
): Promise<{
  toCreate: number;
  toUpdate: number;
  toMarkSold: number;
  comparisons: ItemComparison[];
}> {
  const comparisons = await compareItems(items, clientId);

  // Get all source URLs from scraped items
  const scrapedUrls = new Set(items.map((i) => i.sourceUrl));

  // Find products that exist in DB but weren't in scrape
  const existingProducts = await prisma.product.findMany({
    where: {
      clientId,
      sourceUrl: { not: null },
      status: { in: ['ACTIVE', 'DRAFT', 'PENDING_REVIEW'] },
    },
    select: {
      id: true,
      sourceUrl: true,
    },
  });

  const toMarkSold = existingProducts.filter(
    (p) => p.sourceUrl && !scrapedUrls.has(p.sourceUrl)
  ).length;

  return {
    toCreate: comparisons.filter((c) => c.action === 'create').length,
    toUpdate: comparisons.filter((c) => c.action === 'update').length,
    toMarkSold,
    comparisons,
  };
}
