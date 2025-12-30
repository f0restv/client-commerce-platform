import { prisma } from "@/lib/db";

export interface ReviewInput {
  orderId: string;
  rating: number;
  itemAsDescribed: number;
  shipping: number;
  communication: number;
  comment?: string;
}

// Create a review for a seller
export async function createSellerReview(reviewerId: string, input: ReviewInput) {
  // Verify order exists and reviewer is the buyer
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: {
      items: {
        include: {
          product: {
            select: { clientId: true },
          },
        },
      },
    },
  });

  if (!order) {
    throw new Error("Order not found");
  }

  if (order.userId !== reviewerId) {
    throw new Error("You can only review orders you placed");
  }

  if (order.status !== "DELIVERED") {
    throw new Error("You can only review delivered orders");
  }

  // Get seller from order items
  const sellerId = order.items[0]?.product?.clientId;
  if (!sellerId) {
    throw new Error("Seller not found");
  }

  // Check if review already exists (orderId is unique)
  const existing = await prisma.sellerReview.findUnique({
    where: {
      orderId: input.orderId,
    },
  });

  if (existing) {
    throw new Error("You have already reviewed this order");
  }

  // Validate ratings
  const ratings = [input.rating, input.itemAsDescribed, input.shipping, input.communication];
  for (const r of ratings) {
    if (r < 1 || r > 5) {
      throw new Error("Ratings must be between 1 and 5");
    }
  }

  return prisma.sellerReview.create({
    data: {
      sellerId,
      buyerId: reviewerId,
      orderId: input.orderId,
      rating: input.rating,
      itemAsDescribed: input.itemAsDescribed,
      shipping: input.shipping,
      communication: input.communication,
      review: input.comment?.trim(),
    },
    include: {
      buyer: {
        select: { id: true, name: true, image: true },
      },
    },
  });
}

// Get seller reviews
export async function getSellerReviews(
  sellerId: string,
  page = 1,
  perPage = 10
) {
  const [reviews, total] = await Promise.all([
    prisma.sellerReview.findMany({
      where: { sellerId },
      include: {
        buyer: {
          select: { id: true, name: true, image: true },
        },
        order: {
          select: {
            items: {
              select: {
                product: {
                  select: { id: true, title: true },
                },
              },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.sellerReview.count({ where: { sellerId } }),
  ]);

  return {
    reviews,
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  };
}

// Get seller rating summary
export async function getSellerRatingSummary(sellerId: string) {
  const reviews = await prisma.sellerReview.findMany({
    where: { sellerId },
    select: {
      rating: true,
      itemAsDescribed: true,
      shipping: true,
      communication: true,
    },
  });

  if (reviews.length === 0) {
    return {
      totalReviews: 0,
      averageRating: 0,
      averageItemAsDescribed: 0,
      averageShipping: 0,
      averageCommunication: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    };
  }

  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
  const avg = (arr: number[]) => arr.length > 0 ? sum(arr) / arr.length : 0;

  const ratings = reviews.map((r) => r.rating);
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of ratings) {
    distribution[r as keyof typeof distribution]++;
  }

  // Filter out null values for nullable rating fields
  const itemAsDescribed = reviews.map((r) => r.itemAsDescribed).filter((v): v is number => v !== null);
  const shipping = reviews.map((r) => r.shipping).filter((v): v is number => v !== null);
  const communication = reviews.map((r) => r.communication).filter((v): v is number => v !== null);

  return {
    totalReviews: reviews.length,
    averageRating: avg(ratings),
    averageItemAsDescribed: avg(itemAsDescribed),
    averageShipping: avg(shipping),
    averageCommunication: avg(communication),
    ratingDistribution: distribution,
  };
}

// Mark review as helpful
export async function markReviewHelpful(reviewId: string, userId: string) {
  // In a real app, track who marked helpful to prevent duplicates
  return prisma.sellerReview.update({
    where: { id: reviewId },
    data: {
      helpful: { increment: 1 },
    },
  });
}

// Get pending reviews for a user (orders they can review)
export async function getPendingReviews(userId: string) {
  const orders = await prisma.order.findMany({
    where: {
      userId,
      status: "DELIVERED",
      review: null, // No review yet
    },
    include: {
      items: {
        include: {
          product: {
            include: {
              images: { take: 1 },
              client: {
                select: { id: true, name: true },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return orders;
}
