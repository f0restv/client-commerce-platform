import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { placeBid } from "@/lib/services/auctions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/auctions/[id]/bids - Place a bid
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: auctionId } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { amount } = body;

    if (typeof amount !== "number" || amount <= 0) {
      return NextResponse.json(
        { error: "Valid bid amount is required" },
        { status: 400 }
      );
    }

    const result = await placeBid(session.user.id, {
      auctionId,
      amount,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to place bid";
    console.error("Error placing bid:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// GET /api/auctions/[id]/bids - Get bid history
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id: auctionId } = await params;
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "20", 10);

  try {
    const { prisma } = await import("@/lib/db");
    
    const bids = await prisma.auctionBid.findMany({
      where: { auctionId },
      include: {
        bidder: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ bids });
  } catch (error) {
    console.error("Error fetching bids:", error);
    return NextResponse.json(
      { error: "Failed to fetch bids" },
      { status: 500 }
    );
  }
}
