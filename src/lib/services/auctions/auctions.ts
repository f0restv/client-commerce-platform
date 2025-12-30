import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

export interface AuctionBidInput {
  auctionId: string;
  amount: number;
}

export interface CreateAuctionInput {
  productId: string;
  startingPrice: number;
  reservePrice?: number;
  buyNowPrice?: number;
  endTime: Date;
  bidIncrement?: number;
}

// Helper to convert Decimal to number
function toNumber(val: Prisma.Decimal | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  return typeof val === 'number' ? val : Number(val);
}

// Create an auction for a product
export async function createAuction(userId: string, input: CreateAuctionInput) {
  const product = await prisma.product.findUnique({
    where: { id: input.productId },
    select: { clientId: true, listingType: true },
  });

  if (!product) {
    throw new Error("Product not found");
  }

  // Check authorization - user must be associated with the product's client
  // For platform-owned products, this would need admin check
  if (product.clientId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { clientId: true, role: true },
    });
    if (!user || (user.clientId !== product.clientId && !['ADMIN', 'STAFF'].includes(user.role))) {
      throw new Error("You can only create auctions for your own products");
    }
  }

  // Validate end time
  if (input.endTime <= new Date()) {
    throw new Error("End time must be in the future");
  }

  // Check if auction already exists
  const existing = await prisma.auction.findFirst({
    where: {
      productId: input.productId,
      status: "ACTIVE",
    },
  });

  if (existing) {
    throw new Error("Active auction already exists for this product");
  }

  // Create auction and update product
  const [auction] = await prisma.$transaction([
    prisma.auction.create({
      data: {
        productId: input.productId,
        startingPrice: input.startingPrice,
        currentBid: input.startingPrice,
        reservePrice: input.reservePrice,
        buyNowPrice: input.buyNowPrice,
        endTime: input.endTime,
        bidIncrement: input.bidIncrement || calculateDefaultIncrement(input.startingPrice),
        status: "ACTIVE",
      },
    }),
    prisma.product.update({
      where: { id: input.productId },
      data: { listingType: "AUCTION" },
    }),
  ]);

  return auction;
}

// Calculate default bid increment based on price
function calculateDefaultIncrement(price: number): number {
  if (price < 25) return 1;
  if (price < 100) return 5;
  if (price < 500) return 10;
  if (price < 1000) return 25;
  if (price < 5000) return 50;
  return 100;
}

// Get auction with bid history
export async function getAuction(auctionId: string) {
  return prisma.auction.findUnique({
    where: { id: auctionId },
    include: {
      product: {
        include: {
          images: true,
          client: {
            select: { id: true, name: true },
          },
        },
      },
      bids: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          bidder: {
            select: { id: true, name: true },
          },
        },
      },
      highBidder: {
        select: { id: true, name: true },
      },
      _count: {
        select: { bids: true },
      },
    },
  });
}

// Get auction by product ID
export async function getAuctionByProduct(productId: string) {
  return prisma.auction.findFirst({
    where: {
      productId,
      status: "ACTIVE",
    },
    include: {
      bids: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
      highBidder: {
        select: { id: true, name: true },
      },
      _count: {
        select: { bids: true },
      },
    },
  });
}

// Place a bid
export async function placeBid(bidderId: string, input: AuctionBidInput) {
  const auction = await prisma.auction.findUnique({
    where: { id: input.auctionId },
    include: {
      product: { select: { clientId: true, title: true } },
    },
  });

  if (!auction) {
    throw new Error("Auction not found");
  }

  if (auction.status !== "ACTIVE") {
    throw new Error("Auction is not active");
  }

  if (auction.endTime <= new Date()) {
    throw new Error("Auction has ended");
  }

  // Check if bidder owns the product via client relationship
  if (auction.product.clientId) {
    const bidder = await prisma.user.findUnique({
      where: { id: bidderId },
      select: { clientId: true },
    });
    if (bidder?.clientId === auction.product.clientId) {
      throw new Error("You cannot bid on your own auction");
    }
  }

  // Calculate minimum bid
  const currentBid = toNumber(auction.currentBid);
  const bidIncrement = toNumber(auction.bidIncrement);
  const minimumBid = currentBid + bidIncrement;
  
  if (input.amount < minimumBid) {
    throw new Error(`Minimum bid is $${minimumBid.toFixed(2)}`);
  }

  // Check if this is a Buy Now bid
  const buyNowPrice = toNumber(auction.buyNowPrice);
  const isBuyNow = buyNowPrice > 0 && input.amount >= buyNowPrice;

  // Create bid and update auction
  const [bid] = await prisma.$transaction([
    prisma.auctionBid.create({
      data: {
        auctionId: input.auctionId,
        bidderId,
        amount: input.amount,
        isBuyNow,
      },
    }),
    prisma.auction.update({
      where: { id: input.auctionId },
      data: {
        currentBid: input.amount,
        highBidderId: bidderId,
        ...(isBuyNow && { status: "SOLD" }),
      },
    }),
  ]);

  // If Buy Now, also update product
  if (isBuyNow) {
    await prisma.product.update({
      where: { id: auction.productId },
      data: { status: "SOLD" },
    });
  }

  return {
    bid,
    isBuyNow,
    newCurrentBid: input.amount,
    minimumNextBid: input.amount + bidIncrement,
  };
}

// Get user's active bids
export async function getUserBids(userId: string) {
  return prisma.auctionBid.findMany({
    where: {
      bidderId: userId,
      auction: {
        status: "ACTIVE",
      },
    },
    include: {
      auction: {
        include: {
          product: {
            include: { images: { take: 1 } },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

// Get user's won auctions
export async function getUserWonAuctions(userId: string) {
  return prisma.auction.findMany({
    where: {
      highBidderId: userId,
      status: { in: ["ENDED", "SOLD"] },
    },
    include: {
      product: {
        include: { images: { take: 1 } },
      },
    },
    orderBy: { endTime: "desc" },
  });
}

// End expired auctions (run via cron)
export async function endExpiredAuctions() {
  const now = new Date();

  // Find expired auctions
  const expiredAuctions = await prisma.auction.findMany({
    where: {
      status: "ACTIVE",
      endTime: { lte: now },
    },
    include: {
      product: true,
      highBidder: true,
    },
  });

  const results = [];

  for (const auction of expiredAuctions) {
    const currentBid = toNumber(auction.currentBid);
    const reservePrice = toNumber(auction.reservePrice);
    const hasMetReserve = !auction.reservePrice || currentBid >= reservePrice;

    const hasWinner = auction.highBidderId && hasMetReserve;

    // Update auction status
    await prisma.auction.update({
      where: { id: auction.id },
      data: {
        status: hasWinner ? "ENDED" : "EXPIRED",
      },
    });

    // Update product status
    await prisma.product.update({
      where: { id: auction.productId },
      data: {
        status: hasWinner ? "SOLD" : "ACTIVE",
        // If no winner, revert to buy now
        listingType: hasWinner ? "AUCTION" : "BUY_NOW",
      },
    });

    results.push({
      auctionId: auction.id,
      productId: auction.productId,
      hasWinner,
      finalBid: currentBid,
    });
  }

  return results;
}

// Watch/follow an auction
export async function watchAuction(userId: string, auctionId: string) {
  // This would typically use a separate table for watching
  // For now, we'll use the saved search mechanism or create a watch list
  // Implementation depends on your notification system
  return { watching: true };
}

// Get active auctions for homepage/discovery
export async function getActiveAuctions(
  page = 1,
  perPage = 12,
  sortBy: "ending-soon" | "newest" | "most-bids" = "ending-soon"
) {
  const orderBy = {
    "ending-soon": { endTime: "asc" as const },
    "newest": { createdAt: "desc" as const },
    "most-bids": { _count: { bids: "desc" as const } },
  }[sortBy] || { endTime: "asc" as const };

  const [auctions, total] = await Promise.all([
    prisma.auction.findMany({
      where: {
        status: "ACTIVE",
        endTime: { gt: new Date() },
      },
      include: {
        product: {
          include: {
            images: { take: 1 },
            client: {
              select: { id: true, name: true },
            },
          },
        },
        _count: {
          select: { bids: true },
        },
      },
      orderBy: sortBy === "most-bids" 
        ? { bids: { _count: "desc" } }
        : orderBy,
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.auction.count({
      where: {
        status: "ACTIVE",
        endTime: { gt: new Date() },
      },
    }),
  ]);

  return {
    auctions,
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  };
}
