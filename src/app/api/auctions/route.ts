import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getActiveAuctions } from "@/lib/services/auctions";

// GET /api/auctions - Get active auctions
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const perPage = parseInt(searchParams.get("perPage") || "12", 10);
  const sortBy = (searchParams.get("sort") || "ending-soon") as
    | "ending-soon"
    | "newest"
    | "most-bids";

  try {
    const result = await getActiveAuctions(page, perPage, sortBy);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching auctions:", error);
    return NextResponse.json(
      { error: "Failed to fetch auctions" },
      { status: 500 }
    );
  }
}
