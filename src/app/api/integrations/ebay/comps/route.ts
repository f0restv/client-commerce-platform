/**
 * eBay Comparable Sales API Route
 *
 * GET /api/integrations/ebay/comps - Search for comparable sales
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getSoldComparables,
  getActiveComparables,
  getPricingStats,
  getMarketData,
} from "@/lib/integrations/ebay/comps";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");
    const type = searchParams.get("type") || "all"; // sold, active, all, stats
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    if (!query) {
      return NextResponse.json(
        { error: "Search query (q) is required" },
        { status: 400 }
      );
    }

    const searchTerms = query.split(",").map((t) => t.trim());

    let result;

    switch (type) {
      case "sold":
        result = { comps: await getSoldComparables(searchTerms, limit) };
        break;
      case "active":
        result = { comps: await getActiveComparables(searchTerms, limit) };
        break;
      case "stats":
        result = await getPricingStats(searchTerms);
        break;
      case "all":
      default:
        result = await getMarketData(searchTerms);
        break;
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("eBay comps search error:", err);
    return NextResponse.json(
      {
        error: "Failed to search eBay comparables",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
