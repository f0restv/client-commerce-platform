/**
 * eBay Listings API Route
 *
 * POST /api/integrations/ebay/listings - Create a new eBay listing
 * GET /api/integrations/ebay/listings - Get all active eBay listings
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  createListingWithPlatformAuth,
  getActiveListings,
} from "@/lib/integrations/ebay/listings";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !["ADMIN", "STAFF"].includes(session.user.role as string)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { productId, options } = body;

    if (!productId) {
      return NextResponse.json(
        { error: "Product ID is required" },
        { status: 400 }
      );
    }

    // Fetch product with images
    const product = await db.product.findUnique({
      where: { id: productId },
      include: { images: true },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Create the eBay listing
    const result = await createListingWithPlatformAuth(product, options || {});

    return NextResponse.json({
      success: true,
      listingId: result.listingId,
      url: result.url,
      warnings: result.warnings,
    });
  } catch (err) {
    console.error("eBay listing creation error:", err);
    return NextResponse.json(
      {
        error: "Failed to create eBay listing",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET(_request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !["ADMIN", "STAFF"].includes(session.user.role as string)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const listings = await getActiveListings();

    return NextResponse.json({ listings });
  } catch (err) {
    console.error("eBay listings fetch error:", err);
    return NextResponse.json(
      {
        error: "Failed to fetch eBay listings",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
