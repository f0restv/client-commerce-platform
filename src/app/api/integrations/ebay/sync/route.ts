/**
 * eBay Sync API Route
 *
 * POST /api/integrations/ebay/sync - Trigger a sync operation
 * GET /api/integrations/ebay/sync - Get sync status
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  syncPlatformSoldItems,
  syncActiveListings,
  syncInventory,
  runFullSync,
  getSyncStatus,
} from "@/lib/integrations/ebay/sync";

type SyncType = "orders" | "listings" | "inventory" | "full";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !["ADMIN", "STAFF"].includes(session.user.role as string)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const syncType: SyncType = body.type || "full";

    let result;

    switch (syncType) {
      case "orders":
        result = { orders: await syncPlatformSoldItems() };
        break;
      case "listings":
        result = { listings: await syncActiveListings() };
        break;
      case "inventory":
        result = { inventory: await syncInventory() };
        break;
      case "full":
      default:
        result = await runFullSync();
        break;
    }

    return NextResponse.json({
      success: true,
      syncType,
      result,
    });
  } catch (err) {
    console.error("eBay sync error:", err);
    return NextResponse.json(
      {
        error: "Sync failed",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET(_request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !["ADMIN", "STAFF"].includes(session.user.role as string)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const status = await getSyncStatus();

    return NextResponse.json(status);
  } catch (err) {
    console.error("eBay sync status error:", err);
    return NextResponse.json(
      {
        error: "Failed to get sync status",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
