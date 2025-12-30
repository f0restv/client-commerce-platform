import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/products/[id]/price-history - Get price history for a product
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id: productId } = await params;
  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") || "90d";

  try {
    // Calculate date range
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "1y":
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      case "all":
      default:
        startDate = new Date(0);
    }

    // Fetch price history
    const history = await prisma.priceHistory.findMany({
      where: {
        productId,
        createdAt: { gte: startDate },
      },
      orderBy: { createdAt: "asc" },
      select: {
        price: true,
        reason: true,
        createdAt: true,
      },
    });

    // Also get current product price
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { price: true },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Format for chart
    const formattedHistory = history.map((h) => ({
      date: h.createdAt.toISOString(),
      price: h.price,
      source: h.reason || "manual",
    }));

    // If we have history, add current price as latest point if different
    if (formattedHistory.length > 0 && product.price) {
      const lastPrice = formattedHistory[formattedHistory.length - 1].price;
      if (lastPrice !== product.price) {
        formattedHistory.push({
          date: now.toISOString(),
          price: product.price,
          source: "current",
        });
      }
    }

    // Calculate stats
    let stats = null;
    if (formattedHistory.length > 0) {
      const prices = formattedHistory.map((h) => Number(h.price));
      const firstPrice = prices[0];
      const currentPrice = product.price ? Number(product.price) : prices[prices.length - 1];
      const change = currentPrice - firstPrice;
      const changePercent = firstPrice > 0 ? (change / firstPrice) * 100 : 0;

      stats = {
        current: currentPrice,
        high: Math.max(...prices),
        low: Math.min(...prices),
        average: prices.reduce((a, b) => a + b, 0) / prices.length,
        change,
        changePercent,
        trend: changePercent > 2 ? "up" : changePercent < -2 ? "down" : "stable",
      };
    }

    return NextResponse.json({
      history: formattedHistory,
      stats,
    });
  } catch (error) {
    console.error("Error fetching price history:", error);
    return NextResponse.json(
      { error: "Failed to fetch price history" },
      { status: 500 }
    );
  }
}
