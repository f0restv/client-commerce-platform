import { db } from '@/lib/db';
import type { SavedSearchInput, PriceAlertInput } from './types';

/**
 * Create a saved search for a user
 */
export async function createSavedSearch(
  userId: string,
  input: SavedSearchInput
) {
  return db.savedSearch.create({
    data: {
      userId,
      name: input.name,
      query: input.query,
      categoryIds: input.categoryIds || [],
      minPrice: input.minPrice,
      maxPrice: input.maxPrice,
      conditions: input.conditions || [],
      metalTypes: input.metalTypes || [],
      years: input.years,
      certifications: input.certifications || [],
      alertEnabled: input.alertEnabled ?? true,
      alertFrequency: input.alertFrequency || 'instant',
    },
  });
}

/**
 * Get all saved searches for a user
 */
export async function getSavedSearches(userId: string) {
  return db.savedSearch.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Update a saved search
 */
export async function updateSavedSearch(
  id: string,
  userId: string,
  input: Partial<SavedSearchInput>
) {
  return db.savedSearch.update({
    where: { id, userId },
    data: {
      ...(input.name && { name: input.name }),
      ...(input.query !== undefined && { query: input.query }),
      ...(input.categoryIds && { categoryIds: input.categoryIds }),
      ...(input.minPrice !== undefined && { minPrice: input.minPrice }),
      ...(input.maxPrice !== undefined && { maxPrice: input.maxPrice }),
      ...(input.conditions && { conditions: input.conditions }),
      ...(input.metalTypes && { metalTypes: input.metalTypes }),
      ...(input.years !== undefined && { years: input.years }),
      ...(input.certifications && { certifications: input.certifications }),
      ...(input.alertEnabled !== undefined && { alertEnabled: input.alertEnabled }),
      ...(input.alertFrequency && { alertFrequency: input.alertFrequency }),
    },
  });
}

/**
 * Delete a saved search
 */
export async function deleteSavedSearch(id: string, userId: string) {
  return db.savedSearch.delete({
    where: { id, userId },
  });
}

/**
 * Create a price alert
 */
export async function createPriceAlert(
  userId: string,
  input: PriceAlertInput
) {
  return db.priceAlert.create({
    data: {
      userId,
      productId: input.productId,
      searchQuery: input.searchQuery,
      alertType: input.alertType,
      targetPrice: input.targetPrice,
      notifyEmail: input.notifyEmail ?? true,
      notifyPush: input.notifyPush ?? true,
    },
  });
}

/**
 * Get all price alerts for a user
 */
export async function getPriceAlerts(userId: string) {
  return db.priceAlert.findMany({
    where: { userId, triggered: false },
    include: {
      product: {
        select: {
          id: true,
          title: true,
          price: true,
          images: { take: 1 },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Delete a price alert
 */
export async function deletePriceAlert(id: string, userId: string) {
  return db.priceAlert.delete({
    where: { id, userId },
  });
}

/**
 * Check and trigger price alerts for a product
 */
export async function checkPriceAlerts(productId: string, newPrice: number) {
  // Find all matching alerts
  const alerts = await db.priceAlert.findMany({
    where: {
      productId,
      triggered: false,
      OR: [
        { alertType: 'BELOW_PRICE', targetPrice: { gte: newPrice } },
        { alertType: 'ABOVE_PRICE', targetPrice: { lte: newPrice } },
      ],
    },
    include: {
      user: { select: { email: true, name: true } },
      product: { select: { title: true } },
    },
  });

  // Mark as triggered and queue notifications
  for (const alert of alerts) {
    await db.priceAlert.update({
      where: { id: alert.id },
      data: {
        triggered: true,
        triggeredAt: new Date(),
      },
    });

    // TODO: Send notification via notification service
    // await sendPriceAlertNotification(alert);
  }

  return alerts.length;
}

/**
 * Check saved searches for new matching products
 */
export async function checkSavedSearchMatches(productId: string) {
  const product = await db.product.findUnique({
    where: { id: productId },
    include: { category: true },
  });

  if (!product || product.status !== 'ACTIVE') return 0;

  // Find saved searches that match this product
  const savedSearches = await db.savedSearch.findMany({
    where: {
      alertEnabled: true,
      OR: [
        // Match by query
        product.title
          ? { query: { contains: product.title.split(' ')[0], mode: 'insensitive' } }
          : {},
        // Match by category
        { categoryIds: { has: product.categoryId } },
        // Match by metal type
        product.metalType ? { metalTypes: { has: product.metalType } } : {},
      ],
    },
    include: {
      user: { select: { email: true, name: true } },
    },
  });

  // Filter and notify
  let notified = 0;
  for (const search of savedSearches) {
    // Check price range
    if (search.minPrice && product.price && product.price.toNumber() < search.minPrice.toNumber()) {
      continue;
    }
    if (search.maxPrice && product.price && product.price.toNumber() > search.maxPrice.toNumber()) {
      continue;
    }

    // Check year range
    if (search.years && product.year) {
      const years = search.years as { min?: number; max?: number };
      if (years.min && product.year < years.min) continue;
      if (years.max && product.year > years.max) continue;
    }

    // Update match count and last alerted
    await db.savedSearch.update({
      where: { id: search.id },
      data: {
        matchCount: { increment: 1 },
        lastAlertedAt: new Date(),
      },
    });

    // TODO: Send notification
    // await sendSavedSearchAlert(search, product);
    notified++;
  }

  return notified;
}
