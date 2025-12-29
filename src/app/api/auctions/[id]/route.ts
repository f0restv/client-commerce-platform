import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAuction } from "@/lib/services/auctions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/auctions/[id] - Get auction details
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  try {
    const auction = await getAuction(id);

    if (!auction) {
      return NextResponse.json(
        { error: "Auction not found" },
        { status: 404 }
      );
    }

    // Check if current user is high bidder
    const session = await auth();
    const isHighBidder = session?.user?.id === auction.highBidderId;
    const reserveMet = !auction.reservePrice || 
      auction.currentBid >= auction.reservePrice;

    return NextResponse.json({
      auction,
      isHighBidder,
      reserveMet,
    });
  } catch (error) {
    console.error("Error fetching auction:", error);
    return NextResponse.json(
      { error: "Failed to fetch auction" },
      { status: 500 }
    );
  }
}
