import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getProductCollectionStatus } from "@/lib/services/collections";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/products/[id]/collections - Check which collections contain this product
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id: productId } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  try {
    const collections = await getProductCollectionStatus(
      productId,
      session.user.id
    );
    return NextResponse.json({ collections });
  } catch (error) {
    console.error("Error fetching collection status:", error);
    return NextResponse.json(
      { error: "Failed to fetch collection status" },
      { status: 500 }
    );
  }
}
