import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  createOffer,
  getBuyerOffers,
  getSellerOffers,
  type OfferStatus,
} from "@/lib/services/offers";

// GET /api/offers - Get user's offers (as buyer or seller)
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role") || "buyer"; // "buyer" or "seller"
  const status = searchParams.get("status") as OfferStatus | undefined;

  try {
    const offers =
      role === "seller"
        ? await getSellerOffers(session.user.id, status)
        : await getBuyerOffers(session.user.id, status);

    return NextResponse.json({ offers });
  } catch (error) {
    console.error("Error fetching offers:", error);
    return NextResponse.json(
      { error: "Failed to fetch offers" },
      { status: 500 }
    );
  }
}

// POST /api/offers - Create a new offer
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
    const { productId, amount, message, expiresInHours } = body;

    if (!productId || typeof amount !== "number") {
      return NextResponse.json(
        { error: "Product ID and amount are required" },
        { status: 400 }
      );
    }

    const offer = await createOffer(session.user.id, {
      productId,
      amount,
      message,
      expiresInHours,
    });

    return NextResponse.json({ offer }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create offer";
    console.error("Error creating offer:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
