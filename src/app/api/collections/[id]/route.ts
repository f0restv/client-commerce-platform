import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getCollection,
  updateCollection,
  deleteCollection,
  getCollectionStats,
} from "@/lib/services/collections";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/collections/[id] - Get a single collection
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const session = await auth();

  const collection = await getCollection(id, session?.user?.id);

  if (!collection) {
    return NextResponse.json(
      { error: "Collection not found" },
      { status: 404 }
    );
  }

  // Include stats for owner
  let stats = null;
  if (session?.user?.id === collection.userId) {
    stats = await getCollectionStats(id);
  }

  return NextResponse.json({ collection, stats });
}

// PATCH /api/collections/[id] - Update a collection
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { name, description, isPublic } = body;

    const collection = await updateCollection(id, session.user.id, {
      name: name?.trim(),
      description: description?.trim(),
      isPublic,
    });

    return NextResponse.json({ collection });
  } catch (error) {
    console.error("Error updating collection:", error);
    return NextResponse.json(
      { error: "Failed to update collection" },
      { status: 500 }
    );
  }
}

// DELETE /api/collections/[id] - Delete a collection
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  try {
    await deleteCollection(id, session.user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting collection:", error);
    return NextResponse.json(
      { error: "Failed to delete collection" },
      { status: 500 }
    );
  }
}
