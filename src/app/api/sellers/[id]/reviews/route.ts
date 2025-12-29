import { NextRequest, NextResponse } from "next/server";
import { getSellerRatingSummary, getSellerReviews } from "@/lib/services/reviews";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/sellers/[id]/reviews - Get seller reviews and summary
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id: sellerId } = await params;
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const perPage = parseInt(searchParams.get("perPage") || "10", 10);
  const summaryOnly = searchParams.get("summary") === "true";

  try {
    const summary = await getSellerRatingSummary(sellerId);

    if (summaryOnly) {
      return NextResponse.json({ summary });
    }

    const reviews = await getSellerReviews(sellerId, page, perPage);

    return NextResponse.json({
      summary,
      ...reviews,
    });
  } catch (error) {
    console.error("Error fetching seller reviews:", error);
    return NextResponse.json(
      { error: "Failed to fetch seller reviews" },
      { status: 500 }
    );
  }
}
