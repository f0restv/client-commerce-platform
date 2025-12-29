import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  addToCollection,
  removeFromCollection,
  updateCollectionItem,
} from "@/lib/services/collections";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/collections/[id]/items - Add item to collection
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: collectionId } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { productId, customItem } = body;

    if (!productId && !customItem) {
      return NextResponse.json(
        { error: "Either productId or customItem is required" },
        { status: 400 }
      );
    }

    const item = await addToCollection(session.user.id, {
      collectionId,
      productId,
      customItem,
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to add item";
    console.error("Error adding to collection:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// PATCH /api/collections/[id]/items - Update a collection item
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  await params; // Consume params for this route context
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { itemId, currentValue, customDescription, metadata } = body;

    if (!itemId) {
      return NextResponse.json(
        { error: "Item ID is required" },
        { status: 400 }
      );
    }

    const item = await updateCollectionItem(itemId, session.user.id, {
      currentValue,
      customDescription,
      metadata,
    });

    return NextResponse.json({ item });
  } catch (error) {
    console.error("Error updating collection item:", error);
    return NextResponse.json(
      { error: "Failed to update item" },
      { status: 500 }
    );
  }
}

// DELETE /api/collections/[id]/items - Remove item from collection
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get("itemId");

    if (!itemId) {
      return NextResponse.json(
        { error: "Item ID is required" },
        { status: 400 }
      );
    }

    await removeFromCollection(itemId, session.user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing from collection:", error);
    return NextResponse.json(
      { error: "Failed to remove item" },
      { status: 500 }
    );
  }
}
