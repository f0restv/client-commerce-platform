import { db } from "../db";
import type { Product, ProductImage, Auction } from "@prisma/client";

interface AuctionFlexConfig {
  apiKey: string;
  companyId: string;
  apiUrl: string;
}

const getConfig = (): AuctionFlexConfig => ({
  apiKey: process.env.AUCTIONFLEX_API_KEY!,
  companyId: process.env.AUCTIONFLEX_COMPANY_ID!,
  apiUrl: process.env.AUCTIONFLEX_API_URL || "https://api.auctionflex.com",
});

interface AuctionFlexLot {
  lot_number?: string;
  title: string;
  description: string;
  category_id?: number;
  starting_bid: number;
  reserve_price?: number;
  buy_now_price?: number;
  quantity: number;
  images: string[];
  attributes?: Record<string, string>;
}

export async function createAuctionFlexEvent(
  eventName: string,
  startDate: Date,
  endDate: Date
): Promise<{ eventId: string }> {
  const config = getConfig();

  const response = await fetch(`${config.apiUrl}/v1/auctions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      "X-Company-Id": config.companyId,
    },
    body: JSON.stringify({
      name: eventName,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      type: "timed",
      status: "draft",
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create AuctionFlex event: ${response.status}`);
  }

  const data = await response.json();
  return { eventId: data.auction_id };
}

export async function addLotToAuction(
  eventId: string,
  product: Product & { images: ProductImage[]; auction?: Auction | null }
): Promise<{ lotId: string; url: string }> {
  const config = getConfig();

  const lot: AuctionFlexLot = {
    title: product.title,
    description: product.description,
    starting_bid: product.auction?.startingPrice
      ? Number(product.auction.startingPrice)
      : Number(product.price) || 1,
    reserve_price: product.auction?.reservePrice
      ? Number(product.auction.reservePrice)
      : undefined,
    buy_now_price: product.auction?.buyNowPrice
      ? Number(product.auction.buyNowPrice)
      : Number(product.price),
    quantity: product.quantity,
    images: product.images.map((img) => img.url),
    attributes: buildAttributes(product),
  };

  const response = await fetch(`${config.apiUrl}/v1/auctions/${eventId}/lots`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      "X-Company-Id": config.companyId,
    },
    body: JSON.stringify(lot),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to add lot to AuctionFlex: ${error}`);
  }

  const data = await response.json();
  const lotId = data.lot_id.toString();

  // Store in database
  const connection = await db.platformConnection.findUnique({
    where: { platform: "AUCTIONFLEX360" },
  });

  if (connection) {
    await db.platformListing.create({
      data: {
        productId: product.id,
        connectionId: connection.id,
        externalId: lotId,
        externalUrl: `${config.apiUrl}/auctions/${eventId}/lots/${lotId}`,
        status: "ACTIVE",
        lastSyncAt: new Date(),
      },
    });
  }

  return {
    lotId,
    url: `${config.apiUrl}/auctions/${eventId}/lots/${lotId}`,
  };
}

export async function publishAuction(eventId: string): Promise<void> {
  const config = getConfig();

  await fetch(`${config.apiUrl}/v1/auctions/${eventId}/publish`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "X-Company-Id": config.companyId,
    },
  });
}

export async function syncAuctionResults(eventId: string): Promise<void> {
  const config = getConfig();

  const response = await fetch(`${config.apiUrl}/v1/auctions/${eventId}/results`, {
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "X-Company-Id": config.companyId,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get auction results: ${response.status}`);
  }

  const data = await response.json();

  for (const lot of data.lots || []) {
    if (lot.status === "sold") {
      // Update platform listing
      await db.platformListing.updateMany({
        where: { externalId: lot.lot_id.toString() },
        data: { status: "SOLD" },
      });

      // Find and update product
      const listing = await db.platformListing.findFirst({
        where: { externalId: lot.lot_id.toString() },
      });

      if (listing) {
        await db.product.update({
          where: { id: listing.productId },
          data: { status: "SOLD" },
        });

        // Update auction if exists
        await db.auction.updateMany({
          where: { productId: listing.productId },
          data: {
            status: "SOLD",
            finalPrice: lot.winning_bid,
          },
        });
      }
    }
  }
}

export async function getAuctionFlexCategories(): Promise<
  Array<{ id: number; name: string; parent_id?: number }>
> {
  const config = getConfig();

  const response = await fetch(`${config.apiUrl}/v1/categories`, {
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "X-Company-Id": config.companyId,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get categories: ${response.status}`);
  }

  const data = await response.json();
  return data.categories || [];
}

export async function removeLot(lotId: string): Promise<void> {
  const config = getConfig();

  await fetch(`${config.apiUrl}/v1/lots/${lotId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "X-Company-Id": config.companyId,
    },
  });

  await db.platformListing.updateMany({
    where: { externalId: lotId },
    data: { status: "REMOVED" },
  });
}

function buildAttributes(product: Product): Record<string, string> {
  const attrs: Record<string, string> = {};

  if (product.year) attrs["Year"] = product.year.toString();
  if (product.mint) attrs["Mint"] = product.mint;
  if (product.grade) attrs["Grade"] = product.grade;
  if (product.certification) attrs["Certification"] = product.certification;
  if (product.certNumber) attrs["Cert Number"] = product.certNumber;
  if (product.metalType) attrs["Metal"] = product.metalType;
  if (product.metalWeight) attrs["Weight"] = `${product.metalWeight} oz`;
  if (product.condition) attrs["Condition"] = product.condition;

  return attrs;
}

// Validate AuctionFlex connection
export async function validateConnection(): Promise<boolean> {
  const config = getConfig();

  try {
    const response = await fetch(`${config.apiUrl}/v1/account`, {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "X-Company-Id": config.companyId,
      },
    });

    return response.ok;
  } catch {
    return false;
  }
}
