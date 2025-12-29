import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getUserCollections,
  createCollection,
  getPublicCollections,
} from "@/lib/services/collections";

// GET /api/collections - List user's collections or public collections
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const publicOnly = searchParams.get("public") === "true";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const perPage = parseInt(searchParams.get("perPage") || "12", 10);
  const category = searchParams.get("category") || undefined;

  if (publicOnly) {
    const result = await getPublicCollections(page, perPage, category);
    return NextResponse.json(result);
  }

  // User's collections require authentication
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  const collections = await getUserCollections(session.user.id);
  return NextResponse.json({ collections });
}

// POST /api/collections - Create a new collection
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
    const { name, description, visibility } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Collection name is required" },
        { status: 400 }
      );
    }

    const collection = await createCollection(session.user.id, {
      name: name.trim(),
      description: description?.trim(),
      visibility,
    });

    return NextResponse.json({ collection }, { status: 201 });
  } catch (error) {
    console.error("Error creating collection:", error);
    return NextResponse.json(
      { error: "Failed to create collection" },
      { status: 500 }
    );
  }
}
