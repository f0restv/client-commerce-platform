import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { analyzeMarketValue, identifyCoin } from "@/lib/claude";
import { searchComparables, calculateMarketStats } from "@/lib/scraper";

interface CoinIdentification {
  possibleIdentification?: string;
  confidence?: number;
  suggestedCategory?: string;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { images, title, description, category, year, mint, grade, certification } = body;

    // Step 1: If we have images but no title, try to identify the coin
    let identification: CoinIdentification | null = null;
    if (images?.length > 0 && !title) {
      // In production, convert image URL to base64
      // For now, skip image identification
    }

    // Step 2: Search for comparables
    const searchQuery = title || (identification as CoinIdentification | null)?.possibleIdentification || "";
    let comparables: Array<{ title: string; soldPrice: number; soldDate: string }> = [];

    if (searchQuery) {
      const scrapedItems = await searchComparables(searchQuery);
      comparables = scrapedItems.slice(0, 10).map((item) => ({
        title: item.title,
        soldPrice: item.price,
        soldDate: new Date().toISOString(),
      }));
    }

    // Step 3: Get AI market analysis
    const analysis = await analyzeMarketValue(
      {
        title: title || (identification as CoinIdentification | null)?.possibleIdentification || "Unknown Item",
        description,
        year,
        mint,
        grade,
        certification,
        category: category || (identification as CoinIdentification | null)?.suggestedCategory,
      },
      comparables
    );

    // Step 4: Calculate market stats from scraped data
    const scrapedItems = await searchComparables(searchQuery);
    const marketStats = calculateMarketStats(scrapedItems);

    return NextResponse.json({
      analysis: {
        possibleIdentification: (identification as CoinIdentification | null)?.possibleIdentification || title,
        confidence: (identification as CoinIdentification | null)?.confidence || analysis.confidence,
        suggestedCategory: (identification as CoinIdentification | null)?.suggestedCategory || category,
        estimatedValue: analysis.estimatedValue,
        marketTrend: analysis.marketTrend,
        avgDaysToSell: analysis.avgDaysToSell,
        demandLevel: analysis.demandLevel,
        recommendedPrice: analysis.recommendedPrice,
        pricingStrategy: analysis.pricingStrategy,
        keyFactors: analysis.keyFactors,
      },
      marketStats,
      comparables: comparables.slice(0, 5),
    });
  } catch (error) {
    console.error("Error analyzing item:", error);
    return NextResponse.json(
      { error: "Analysis failed" },
      { status: 500 }
    );
  }
}
