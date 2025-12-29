import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  createSellerReview,
  getSellerReviews,
  getPendingReviews,
} from "@/lib/services/reviews";

// GET /api/reviews - Get reviews (for seller or pending reviews to write)
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const sellerId = searchParams.get("sellerId");
  const pending = searchParams.get("pending") === "true";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const perPage = parseInt(searchParams.get("perPage") || "10", 10);

  try {
    if (pending) {
      // Get orders user can review
      const orders = await getPendingReviews(session.user.id);
      return NextResponse.json({ orders });
    }

    if (sellerId) {
      const result = await getSellerReviews(sellerId, page, perPage);
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: "Either sellerId or pending=true is required" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error fetching reviews:", error);
    return NextResponse.json(
      { error: "Failed to fetch reviews" },
      { status: 500 }
    );
  }
}

// POST /api/reviews - Create a new review
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { orderId, rating, itemAsDescribed, shipping, communication, comment } = body;

    if (!orderId || !rating || !itemAsDescribed || !shipping || !communication) {
      return NextResponse.json(
        { error: "All rating fields are required" },
        { status: 400 }
      );
    }

    const review = await createSellerReview(session.user.id, {
      orderId,
      rating,
      itemAsDescribed,
      shipping,
      communication,
      comment,
    });

    return NextResponse.json({ review }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create review";
    console.error("Error creating review:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
