/**
 * Product Intelligence Service
 * Main pipeline for analyzing coins, cards, and collectibles
 *
 * This service combines image identification, grading, market data,
 * and profitability analysis into a unified evaluation pipeline.
 */

// ============================================================================
// Re-exports
// ============================================================================

export * from "./types";
export * from "./identify";
export * from "./grade";
export * from "./market-data";
export * from "./evaluate";

// ============================================================================
// Imports
// ============================================================================

import type {
  ProductIntelligenceInput,
  ProductIntelligenceOptions,
  ProductIntelligencePipelineResult,
  EvaluationResult,
  ProductCategory,
  CostBasis,
  MarketDataSource,
} from "./types";

import { identifyProduct, analyzeImage, verifyCertification } from "./identify";
import { gradeProduct, quickGradeCheck } from "./grade";
import { fetchMarketData, refineRelevanceScores } from "./market-data";
import {
  calculateCostBasis,
  analyzeMargins,
  generatePricingRecommendation,
  generateRecommendedActions,
} from "./evaluate";

// ============================================================================
// Main Pipeline
// ============================================================================

/**
 * Run the full product intelligence pipeline
 *
 * Steps:
 * 1. Analyze image quality
 * 2. Identify product (coin/card/bullion)
 * 3. Estimate grade/condition
 * 4. Verify certification if present
 * 5. Fetch market data and comparables
 * 6. Calculate pricing and margins
 * 7. Generate recommendations
 */
export async function analyzeProduct(
  input: ProductIntelligenceInput,
  options?: ProductIntelligenceOptions
): Promise<ProductIntelligencePipelineResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let tokensUsed = 0; // Would track actual token usage in production

  try {
    // Validate input
    if (!input.images || input.images.length === 0) {
      return {
        success: false,
        evaluation: null,
        errors: ["No images provided for analysis"],
        processingTime: Date.now() - startTime,
        tokensUsed: 0,
      };
    }

    // Step 1: Analyze image quality (optional, for feedback)
    const imageAnalysis = await analyzeImage(input.images[0]);
    if (imageAnalysis.quality === "poor") {
      errors.push(
        `Image quality is poor. Suggestions: ${imageAnalysis.suggestions.join(", ")}`
      );
    }
    tokensUsed += 500; // Approximate

    // Step 2: Identify product
    const identification = await identifyProduct(input.images, {
      title: input.existingTitle,
      description: input.existingDescription,
      category: input.category,
    });
    tokensUsed += 1500;

    if (identification.confidence < 0.3) {
      errors.push("Low confidence in product identification - manual review recommended");
    }

    // Step 3: Grade product (unless skipped)
    let gradeResult = await (input.skipGrading
      ? Promise.resolve({
          category: identification.category,
          confidence: 0,
          coinGrade: null,
          cardGrade: null,
          estimatedGrade: input.knownGrade || "Unknown",
          gradeRange: { low: "N/A", high: "N/A" },
          conditionNotes: [],
          certificationRecommended: false,
          certificationService: null,
        })
      : gradeProduct(
          input.images,
          identification.category,
          identification.coin || identification.card || undefined
        ));
    tokensUsed += input.skipGrading ? 0 : 1500;

    // Use known grade if provided
    if (input.knownGrade) {
      gradeResult = {
        ...gradeResult,
        estimatedGrade: input.knownGrade,
        confidence: 1,
      };
    }

    // Step 4: Verify certification if cert number provided
    let certificationResult = null;
    if (input.certNumber || imageAnalysis.hasHolder) {
      const certVerification = await verifyCertification(input.images);
      tokensUsed += 500;

      if (certVerification.hasCertification) {
        certificationResult = {
          category: identification.category,
          certification: {
            service: certVerification.service as "PCGS" | "NGC" | "PSA" | "BGS" | "other" | "raw",
            certNumber: input.certNumber || certVerification.certNumber,
            grade: certVerification.grade,
            verified: certVerification.confidence > 0.8,
            verificationUrl: null,
          },
          isAuthentic: certVerification.confidence > 0.8 ? true : null,
          authenticationNotes: [],
        };
      }
    }

    // Step 5: Fetch market data (unless skipped)
    const marketSources = (options?.marketDataSources || ["ebay", "heritage"]) as MarketDataSource["name"][];

    const marketData = input.skipMarketData
      ? {
          comparableSales: [],
          priceGuideData: [],
          marketStats: {
            avgPrice: 0,
            medianPrice: 0,
            lowPrice: 0,
            highPrice: 0,
            sampleSize: 0,
            dateRange: { from: null, to: null },
          },
          spotPrice: null,
          meltValue: null,
          premiumOverMelt: null,
          errors: [],
        }
      : await fetchMarketData(
          identification.category,
          identification.coin || identification.card,
          gradeResult.estimatedGrade,
          {
            sources: marketSources,
            maxComparables: options?.maxComparables || 20,
            includeWholesale: options?.includeWholesale,
          }
        );

    errors.push(...marketData.errors);

    // Refine relevance scores based on grade
    if (gradeResult.estimatedGrade && marketData.comparableSales.length > 0) {
      marketData.comparableSales = refineRelevanceScores(
        marketData.comparableSales,
        gradeResult.estimatedGrade
      );
    }

    // Step 6: Calculate cost basis and margins
    let costBasis: CostBasis | null = null;
    if (input.purchasePrice !== undefined) {
      costBasis = calculateCostBasis({
        purchasePrice: input.purchasePrice,
      });
    }

    // Generate pricing recommendation
    const pricing = generatePricingRecommendation(marketData, gradeResult, costBasis, {
      targetMargin: options?.targetMargin,
    });

    // Calculate margin analysis if we have cost basis
    const margin = costBasis
      ? analyzeMargins(
          pricing.listPrice,
          costBasis,
          options?.platformFeeOverrides
            ? { ebay: options.platformFeeOverrides }
            : undefined
        )
      : null;

    // Step 7: Generate recommended actions
    const recommendedActions = generateRecommendedActions(
      identification,
      gradeResult,
      marketData,
      margin
    );

    // Build final evaluation result
    const evaluation: EvaluationResult = {
      productId: null, // Set by caller if saving to DB
      identification,
      grade: gradeResult,
      certification: certificationResult,
      marketData,
      costBasis,
      pricing,
      margin,
      overallConfidence: calculateOverallConfidence(
        identification.confidence,
        gradeResult.confidence,
        marketData.marketStats.sampleSize
      ),
      recommendedActions,
      generatedAt: new Date(),
    };

    return {
      success: true,
      evaluation,
      errors,
      processingTime: Date.now() - startTime,
      tokensUsed,
    };
  } catch (error) {
    console.error("Product intelligence pipeline error:", error);
    return {
      success: false,
      evaluation: null,
      errors: [
        ...errors,
        `Pipeline error: ${error instanceof Error ? error.message : "Unknown error"}`,
      ],
      processingTime: Date.now() - startTime,
      tokensUsed,
    };
  }
}

/**
 * Calculate overall confidence score
 */
function calculateOverallConfidence(
  identificationConfidence: number,
  gradeConfidence: number,
  marketDataSize: number
): number {
  // Weight factors
  const idWeight = 0.4;
  const gradeWeight = 0.3;
  const marketWeight = 0.3;

  // Market data confidence based on sample size
  const marketConfidence = Math.min(1, marketDataSize / 10);

  const overall =
    identificationConfidence * idWeight +
    gradeConfidence * gradeWeight +
    marketConfidence * marketWeight;

  return Math.round(overall * 100) / 100;
}

// ============================================================================
// Quick Analysis Functions
// ============================================================================

/**
 * Quick identification only - no grading or market data
 */
export async function quickIdentify(
  images: string[],
  existingTitle?: string
): Promise<{
  category: ProductCategory;
  title: string;
  confidence: number;
  keyFeatures: string[];
}> {
  const result = await identifyProduct(images, { title: existingTitle });

  return {
    category: result.category,
    title: result.suggestedTitle,
    confidence: result.confidence,
    keyFeatures: result.keyFeatures,
  };
}

/**
 * Quick grade check - returns estimated grade without full analysis
 */
export async function quickGrade(
  images: string[],
  category?: ProductCategory
): Promise<{
  grade: string;
  confidence: number;
}> {
  const cat = category || "coin";
  return quickGradeCheck(images, cat);
}

/**
 * Quick market check - get price range without full evaluation
 */
export async function quickMarketCheck(
  searchQuery: string,
  sources?: MarketDataSource["name"][]
): Promise<{
  avgPrice: number;
  lowPrice: number;
  highPrice: number;
  sampleSize: number;
}> {
  const { fetchEbaySoldListings, fetchHeritageAuctions } = await import("./market-data");

  const items: { price: number }[] = [];

  const sourceList = sources || ["ebay"];

  if (sourceList.includes("ebay")) {
    const result = await fetchEbaySoldListings(searchQuery, 10);
    items.push(...result.items);
  }

  if (sourceList.includes("heritage")) {
    const result = await fetchHeritageAuctions(searchQuery, 10);
    items.push(...result.items);
  }

  if (items.length === 0) {
    return { avgPrice: 0, lowPrice: 0, highPrice: 0, sampleSize: 0 };
  }

  const prices = items.map((i) => i.price).sort((a, b) => a - b);
  const sum = prices.reduce((acc, p) => acc + p, 0);

  return {
    avgPrice: Math.round((sum / prices.length) * 100) / 100,
    lowPrice: prices[0],
    highPrice: prices[prices.length - 1],
    sampleSize: prices.length,
  };
}

/**
 * Quick profitability check
 */
export async function quickProfitabilityCheck(
  images: string[],
  purchasePrice: number
): Promise<{
  estimatedValue: number;
  estimatedProfit: number;
  profitable: boolean;
  recommendation: string;
}> {
  // Quick identification
  const id = await quickIdentify(images);

  // Quick market check
  const market = await quickMarketCheck(id.title);

  if (market.sampleSize === 0) {
    return {
      estimatedValue: 0,
      estimatedProfit: 0,
      profitable: false,
      recommendation: "Unable to find market data - manual research required",
    };
  }

  const estimatedValue = market.avgPrice;
  const estimatedNetValue = estimatedValue * 0.85; // After fees
  const estimatedProfit = estimatedNetValue - purchasePrice;
  const marginPercent = (estimatedProfit / purchasePrice) * 100;

  let recommendation: string;
  let profitable: boolean;

  if (marginPercent >= 30) {
    profitable = true;
    recommendation = "Good opportunity";
  } else if (marginPercent >= 15) {
    profitable = true;
    recommendation = "Acceptable margins";
  } else if (marginPercent >= 0) {
    profitable = false;
    recommendation = "Thin margins - negotiate lower";
  } else {
    profitable = false;
    recommendation = "Not profitable at this price";
  }

  return {
    estimatedValue,
    estimatedProfit: Math.round(estimatedProfit * 100) / 100,
    profitable,
    recommendation,
  };
}

// ============================================================================
// Batch Processing
// ============================================================================

/**
 * Process multiple items in batch
 */
export async function batchAnalyze(
  items: Array<{
    id: string;
    images: string[];
    existingTitle?: string;
    purchasePrice?: number;
  }>,
  options?: ProductIntelligenceOptions & {
    concurrency?: number;
  }
): Promise<
  Array<{
    id: string;
    result: ProductIntelligencePipelineResult;
  }>
> {
  const concurrency = options?.concurrency || 3;
  const results: Array<{ id: string; result: ProductIntelligencePipelineResult }> = [];

  // Process in batches
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);

    const batchResults = await Promise.all(
      batch.map(async (item) => {
        const result = await analyzeProduct(
          {
            images: item.images,
            existingTitle: item.existingTitle,
            purchasePrice: item.purchasePrice,
          },
          options
        );

        return {
          id: item.id,
          result,
        };
      })
    );

    results.push(...batchResults);
  }

  return results;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format evaluation for display
 */
export function formatEvaluationSummary(evaluation: EvaluationResult): string {
  const lines: string[] = [];

  lines.push(`=== ${evaluation.identification.suggestedTitle} ===`);
  lines.push("");

  lines.push(`Category: ${evaluation.identification.suggestedCategory}`);
  lines.push(`Confidence: ${Math.round(evaluation.overallConfidence * 100)}%`);
  lines.push("");

  lines.push(`Estimated Grade: ${evaluation.grade.estimatedGrade}`);
  lines.push(`Grade Range: ${evaluation.grade.gradeRange.low} - ${evaluation.grade.gradeRange.high}`);
  lines.push("");

  lines.push(`Market Data:`);
  lines.push(`  Average Price: $${evaluation.marketData.marketStats.avgPrice.toFixed(2)}`);
  lines.push(`  Price Range: $${evaluation.marketData.marketStats.lowPrice.toFixed(2)} - $${evaluation.marketData.marketStats.highPrice.toFixed(2)}`);
  lines.push(`  Sample Size: ${evaluation.marketData.marketStats.sampleSize} comparables`);
  lines.push("");

  lines.push(`Pricing Recommendation:`);
  lines.push(`  List Price: $${evaluation.pricing.listPrice.toFixed(2)}`);
  lines.push(`  Minimum: $${evaluation.pricing.minimumPrice.toFixed(2)}`);
  lines.push(`  Strategy: ${evaluation.pricing.strategy}`);
  lines.push("");

  if (evaluation.margin) {
    lines.push(`Margin Analysis:`);
    lines.push(`  Gross Margin: ${evaluation.margin.grossMarginPercent.toFixed(1)}%`);
    lines.push(`  Best Platform: ${evaluation.margin.bestPlatform}`);
    lines.push(`  Net Profit (${evaluation.margin.bestPlatform}): $${evaluation.margin.netProfit[evaluation.margin.bestPlatform as keyof typeof evaluation.margin.netProfit]?.toFixed(2)}`);
    lines.push("");
  }

  if (evaluation.recommendedActions.length > 0) {
    lines.push(`Recommended Actions:`);
    for (const action of evaluation.recommendedActions) {
      lines.push(`  • ${action}`);
    }
  }

  return lines.join("\n");
}

/**
 * Export evaluation to JSON for API responses
 */
export function evaluationToJSON(evaluation: EvaluationResult): Record<string, unknown> {
  return {
    ...evaluation,
    generatedAt: evaluation.generatedAt.toISOString(),
    marketData: {
      ...evaluation.marketData,
      marketStats: {
        ...evaluation.marketData.marketStats,
        dateRange: {
          from: evaluation.marketData.marketStats.dateRange.from?.toISOString() || null,
          to: evaluation.marketData.marketStats.dateRange.to?.toISOString() || null,
        },
      },
      comparableSales: evaluation.marketData.comparableSales.map((sale) => ({
        ...sale,
        soldDate: sale.soldDate?.toISOString() || null,
      })),
      priceGuideData: evaluation.marketData.priceGuideData.map((data) => ({
        ...data,
        source: {
          ...data.source,
          lastUpdated: data.source.lastUpdated.toISOString(),
        },
        lastSaleDate: data.lastSaleDate?.toISOString() || null,
      })),
    },
  };
}
