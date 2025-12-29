import { prisma } from "@/lib/db";

export type OfferStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "COUNTERED" | "EXPIRED" | "WITHDRAWN";

export interface CreateOfferInput {
  productId: string;
  amount: number;
  message?: string;
  expiresInHours?: number;
}

export interface CounterOfferInput {
  offerId: string;
  amount: number;
  message?: string;
  expiresInHours?: number;
}

// Create a new offer
export async function createOffer(buyerId: string, input: CreateOfferInput) {
  const product = await prisma.product.findUnique({
    where: { id: input.productId },
    select: { id: true, sellerId: true, price: true, title: true, status: true },
  });

  if (!product) {
    throw new Error("Product not found");
  }

  if (product.status !== "ACTIVE") {
    throw new Error("Product is not available for offers");
  }

  if (product.sellerId === buyerId) {
    throw new Error("Cannot make an offer on your own product");
  }

  // Check if buyer has pending offer on this product
  const existingOffer = await prisma.offer.findFirst({
    where: {
      productId: input.productId,
      buyerId,
      status: "PENDING",
    },
  });

  if (existingOffer) {
    throw new Error("You already have a pending offer on this product");
  }

  // Validate offer amount
  if (input.amount <= 0) {
    throw new Error("Offer amount must be positive");
  }

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + (input.expiresInHours || 48));

  const offer = await prisma.offer.create({
    data: {
      productId: input.productId,
      buyerId,
      sellerId: product.sellerId,
      amount: input.amount,
      message: input.message,
      expiresAt,
      status: "PENDING",
    },
    include: {
      product: {
        select: { id: true, title: true, price: true },
      },
      buyer: {
        select: { id: true, name: true, image: true },
      },
    },
  });

  return offer;
}

// Get offers for a product (seller view)
export async function getProductOffers(productId: string, sellerId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { sellerId: true },
  });

  if (!product || product.sellerId !== sellerId) {
    throw new Error("Access denied");
  }

  return prisma.offer.findMany({
    where: { productId },
    include: {
      buyer: {
        select: { id: true, name: true, image: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

// Get offers made by a buyer
export async function getBuyerOffers(buyerId: string, status?: OfferStatus) {
  return prisma.offer.findMany({
    where: {
      buyerId,
      ...(status && { status }),
    },
    include: {
      product: {
        include: {
          images: { take: 1 },
          seller: {
            select: { id: true, name: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

// Get offers received by a seller
export async function getSellerOffers(sellerId: string, status?: OfferStatus) {
  return prisma.offer.findMany({
    where: {
      sellerId,
      ...(status && { status }),
    },
    include: {
      product: {
        include: { images: { take: 1 } },
      },
      buyer: {
        select: { id: true, name: true, image: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

// Accept an offer
export async function acceptOffer(offerId: string, sellerId: string) {
  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    include: { product: true },
  });

  if (!offer) {
    throw new Error("Offer not found");
  }

  if (offer.sellerId !== sellerId) {
    throw new Error("Access denied");
  }

  if (offer.status !== "PENDING") {
    throw new Error("Offer is no longer pending");
  }

  if (offer.expiresAt && offer.expiresAt < new Date()) {
    throw new Error("Offer has expired");
  }

  // Update offer and decline all other pending offers for this product
  const [updatedOffer] = await prisma.$transaction([
    prisma.offer.update({
      where: { id: offerId },
      data: { status: "ACCEPTED" },
    }),
    prisma.offer.updateMany({
      where: {
        productId: offer.productId,
        id: { not: offerId },
        status: "PENDING",
      },
      data: { status: "DECLINED" },
    }),
    // Optionally mark product as sold/pending
    prisma.product.update({
      where: { id: offer.productId },
      data: { status: "SOLD" },
    }),
  ]);

  return updatedOffer;
}

// Decline an offer
export async function declineOffer(offerId: string, sellerId: string) {
  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
  });

  if (!offer) {
    throw new Error("Offer not found");
  }

  if (offer.sellerId !== sellerId) {
    throw new Error("Access denied");
  }

  if (offer.status !== "PENDING") {
    throw new Error("Offer is no longer pending");
  }

  return prisma.offer.update({
    where: { id: offerId },
    data: { status: "DECLINED" },
  });
}

// Counter an offer
export async function counterOffer(sellerId: string, input: CounterOfferInput) {
  const offer = await prisma.offer.findUnique({
    where: { id: input.offerId },
  });

  if (!offer) {
    throw new Error("Offer not found");
  }

  if (offer.sellerId !== sellerId) {
    throw new Error("Access denied");
  }

  if (offer.status !== "PENDING") {
    throw new Error("Offer is no longer pending");
  }

  if (input.amount <= 0) {
    throw new Error("Counter offer amount must be positive");
  }

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + (input.expiresInHours || 48));

  return prisma.offer.update({
    where: { id: input.offerId },
    data: {
      status: "COUNTERED",
      counterAmount: input.amount,
      counterMessage: input.message,
      counterExpiresAt: expiresAt,
    },
  });
}

// Accept a counter offer (buyer)
export async function acceptCounterOffer(offerId: string, buyerId: string) {
  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
  });

  if (!offer) {
    throw new Error("Offer not found");
  }

  if (offer.buyerId !== buyerId) {
    throw new Error("Access denied");
  }

  if (offer.status !== "COUNTERED") {
    throw new Error("No counter offer to accept");
  }

  if (offer.counterExpiresAt && offer.counterExpiresAt < new Date()) {
    throw new Error("Counter offer has expired");
  }

  // Update offer and product
  const [updatedOffer] = await prisma.$transaction([
    prisma.offer.update({
      where: { id: offerId },
      data: { status: "ACCEPTED" },
    }),
    prisma.offer.updateMany({
      where: {
        productId: offer.productId,
        id: { not: offerId },
        status: "PENDING",
      },
      data: { status: "DECLINED" },
    }),
    prisma.product.update({
      where: { id: offer.productId },
      data: { status: "SOLD" },
    }),
  ]);

  return updatedOffer;
}

// Withdraw an offer (buyer)
export async function withdrawOffer(offerId: string, buyerId: string) {
  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
  });

  if (!offer) {
    throw new Error("Offer not found");
  }

  if (offer.buyerId !== buyerId) {
    throw new Error("Access denied");
  }

  if (!["PENDING", "COUNTERED"].includes(offer.status)) {
    throw new Error("Cannot withdraw this offer");
  }

  return prisma.offer.update({
    where: { id: offerId },
    data: { status: "WITHDRAWN" },
  });
}

// Expire old offers (run via cron)
export async function expireOldOffers() {
  const now = new Date();

  const expired = await prisma.offer.updateMany({
    where: {
      OR: [
        {
          status: "PENDING",
          expiresAt: { lt: now },
        },
        {
          status: "COUNTERED",
          counterExpiresAt: { lt: now },
        },
      ],
    },
    data: { status: "EXPIRED" },
  });

  return expired.count;
}
