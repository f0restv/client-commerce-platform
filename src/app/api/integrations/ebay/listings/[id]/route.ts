/**
 * eBay Individual Listing API Route
 *
 * DELETE /api/integrations/ebay/listings/[id] - End/withdraw a listing
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { endListingWithPlatformAuth } from "@/lib/integrations/ebay/listings";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || !["ADMIN", "STAFF"].includes(session.user.role as string)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: listingId } = await params;

    await endListingWithPlatformAuth(listingId);

    return NextResponse.json({
      success: true,
      message: "Listing ended successfully",
    });
  } catch (err) {
    console.error("eBay listing end error:", err);
    return NextResponse.json(
      {
        error: "Failed to end eBay listing",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
