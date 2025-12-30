import { prisma } from "@/lib/db";

// Types
export interface CollectionInput {
  name: string;
  description?: string;
  isPublic?: boolean;
}

export interface CollectionItemInput {
  collectionId: string;
  productId?: string;
  // For custom items not in the marketplace
  customItem?: {
    title: string;
    description?: string;
    category?: string;
    acquiredPrice?: number;
    acquiredDate?: Date;
    currentValue?: number;
    imageUrls?: string[];
    metadata?: Record<string, unknown>;
  };
}

// Get all collections for a user
export async function getUserCollections(userId: string) {
  return prisma.collection.findMany({
    where: { userId },
    include: {
      items: {
        include: {
          product: {
            include: {
              images: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 4, // Preview images
      },
      _count: {
        select: { items: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

// Get a single collection with all items
export async function getCollection(collectionId: string, userId?: string) {
  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
    include: {
      user: {
        select: { id: true, name: true, image: true },
      },
      items: {
        include: {
          product: {
            include: {
              images: true,
              client: {
                select: { id: true, name: true },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      _count: {
        select: { items: true },
      },
    },
  });

  if (!collection) return null;

  // Check visibility - only owner can see private collections
  if (!collection.isPublic && collection.userId !== userId) {
    return null;
  }

  return collection;
}

// Create a new collection
export async function createCollection(userId: string, input: CollectionInput) {
  return prisma.collection.create({
    data: {
      userId,
      name: input.name,
      description: input.description,
      isPublic: input.isPublic ?? false,
    },
  });
}

// Update a collection
export async function updateCollection(
  collectionId: string,
  userId: string,
  input: Partial<CollectionInput>
) {
  return prisma.collection.update({
    where: {
      id: collectionId,
      userId, // Ensure ownership
    },
    data: {
      name: input.name,
      description: input.description,
      isPublic: input.isPublic,
    },
  });
}

// Delete a collection
export async function deleteCollection(collectionId: string, userId: string) {
  return prisma.collection.delete({
    where: {
      id: collectionId,
      userId,
    },
  });
}

// Add item to collection
export async function addToCollection(userId: string, input: CollectionItemInput) {
  // Verify collection ownership
  const collection = await prisma.collection.findUnique({
    where: { id: input.collectionId, userId },
  });

  if (!collection) {
    throw new Error("Collection not found or access denied");
  }

  // Check for duplicate if it's a marketplace product
  if (input.productId) {
    const existing = await prisma.collectionItem.findFirst({
      where: {
        collectionId: input.collectionId,
        productId: input.productId,
      },
    });

    if (existing) {
      throw new Error("Item already in collection");
    }
  }

  return prisma.collectionItem.create({
    data: {
      collectionId: input.collectionId,
      productId: input.productId,
      customTitle: input.customItem?.title,
      customDescription: input.customItem?.description,
      customCategory: input.customItem?.category,
      purchasePrice: input.customItem?.acquiredPrice,
      purchaseDate: input.customItem?.acquiredDate,
      currentValue: input.customItem?.currentValue,
      customImages: input.customItem?.imageUrls || [],
    },
  });
}

// Remove item from collection
export async function removeFromCollection(
  collectionItemId: string,
  userId: string
) {
  // Verify ownership through collection
  const item = await prisma.collectionItem.findUnique({
    where: { id: collectionItemId },
    include: { collection: true },
  });

  if (!item || item.collection.userId !== userId) {
    throw new Error("Item not found or access denied");
  }

  return prisma.collectionItem.delete({
    where: { id: collectionItemId },
  });
}

// Update collection item (value, notes, etc.)
export async function updateCollectionItem(
  collectionItemId: string,
  userId: string,
  updates: {
    currentValue?: number;
    customDescription?: string;
    metadata?: Record<string, unknown>;
  }
) {
  // Verify ownership
  const item = await prisma.collectionItem.findUnique({
    where: { id: collectionItemId },
    include: { collection: true },
  });

  if (!item || item.collection.userId !== userId) {
    throw new Error("Item not found or access denied");
  }

  return prisma.collectionItem.update({
    where: { id: collectionItemId },
    data: updates,
  });
}

// Calculate collection statistics
export async function getCollectionStats(collectionId: string) {
  const items = await prisma.collectionItem.findMany({
    where: { collectionId },
    include: {
      product: {
        select: { price: true },
      },
    },
  });

  let totalValue = 0;
  let totalAcquiredCost = 0;
  let itemsWithValue = 0;

  for (const item of items) {
    const value = item.currentValue || item.product?.price;
    if (value) {
      totalValue += parseFloat(value.toString());
      itemsWithValue++;
    }
    if (item.purchasePrice) {
      totalAcquiredCost += parseFloat(item.purchasePrice.toString());
    }
  }

  return {
    totalItems: items.length,
    totalValue,
    totalAcquiredCost,
    estimatedProfit: totalAcquiredCost > 0 ? totalValue - totalAcquiredCost : null,
    itemsWithValue,
    averageValue: itemsWithValue > 0 ? totalValue / itemsWithValue : 0,
  };
}

// Get public collections (for discovery)
export async function getPublicCollections(
  page = 1,
  perPage = 12,
  category?: string
) {
  const where = {
    visibility: "PUBLIC" as const,
    ...(category && {
      items: {
        some: {
          OR: [
            { customCategory: category },
            { product: { categoryId: category } },
          ],
        },
      },
    }),
  };

  const [collections, total] = await Promise.all([
    prisma.collection.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, image: true },
        },
        items: {
          include: {
            product: {
              include: { images: true },
            },
          },
          take: 4,
        },
        _count: {
          select: { items: true },
        },
      },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.collection.count({ where }),
  ]);

  return {
    collections,
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  };
}

// Check if product is in any of user's collections
export async function getProductCollectionStatus(
  productId: string,
  userId: string
) {
  const collections = await prisma.collection.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      items: {
        where: { productId },
        select: { id: true },
      },
    },
  });

  return collections.map((c) => ({
    id: c.id,
    name: c.name,
    hasProduct: c.items.length > 0,
  }));
}
