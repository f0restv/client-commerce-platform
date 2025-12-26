/**
 * Evaluation Service
 * Calculates margins, pricing recommendations, and profitability analysis
 */

import type {
  CostBasis,
  PricingRecommendation,
  MarginAnalysis,
  MarketDataResult,
  ProductGradeResult,
  ProductIdentificationResult,
  ProductCategory,
} from "./types";

// ============================================================================
// Platform Fee Configuration
// ============================================================================

interface PlatformFees {
  finalValueFee: number; // Percentage of sale price
  paymentProcessing: number; // Percentage for payment processing
  fixedFee: number; // Fixed fee per transaction
  promotionFee?: number; // Optional promoted listing fee
}

const PLATFORM_FEES: Record<string, PlatformFees> = {
  ebay: {
    finalValueFee: 0.1325, // 13.25% for coins
    paymentProcessing: 0.029, // 2.9%
    fixedFee: 0.30,
    promotionFee: 0.02, // 2% average ad rate
  },
  etsy: {
    finalValueFee: 0.065, // 6.5% transaction fee
    paymentProcessing: 0.03, // 3% + $0.25
    fixedFee: 0.45, // $0.20 listing + $0.25 payment
    promotionFee: 0.15, // 15% offsite ads (if applicable)
  },
  auctionflex: {
    finalValueFee: 0.10, // 10% buyer's premium typically
    paymentProcessing: 0.025,
    fixedFee: 0,
  },
  direct: {
    finalValueFee: 0,
    paymentProcessing: 0.029, // Credit card processing
    fixedFee: 0.30,
  },
};

// ============================================================================
// Cost Basis Calculation
// ============================================================================

/**
 * Calculate total cost basis for a product
 */
export function calculateCostBasis(costs: {
  purchasePrice: number;
  shippingCost?: number;
  certificationCost?: number;
  consignmentFee?: number;
  otherCosts?: number;
}): CostBasis {
  const purchasePrice = costs.purchasePrice || 0;
  const shippingCost = costs.shippingCost || 0;
  const certification = costs.certificationCost || 0;
  const consignmentFee = costs.consignmentFee || 0;
  const otherCosts = costs.otherCosts || 0;

  return {
    purchasePrice,
    shippingCost,
    certification,
    consignmentFee,
    otherCosts,
    total: purchasePrice + shippingCost + certification + consignmentFee + otherCosts,
  };
}

// ============================================================================
// Platform Fee Calculation
// ============================================================================

/**
 * Calculate fees for a given platform and sale price
 */
export function calculatePlatformFees(
  salePrice: number,
  platform: keyof typeof PLATFORM_FEES,
  options?: {
    usePromotion?: boolean;
    customFees?: Partial<PlatformFees>;
  }
): number {
  const fees = { ...PLATFORM_FEES[platform], ...options?.customFees };

  let totalFees = 0;

  // Final value fee
  totalFees += salePrice * fees.finalValueFee;

  // Payment processing
  totalFees += salePrice * fees.paymentProcessing + fees.fixedFee;

  // Promotion fee (if used)
  if (options?.usePromotion && fees.promotionFee) {
    totalFees += salePrice * fees.promotionFee;
  }

  return Math.round(totalFees * 100) / 100;
}

/**
 * Calculate net profit after fees for each platform
 */
export function calculateNetProfit(
  salePrice: number,
  costBasis: number,
  customFees?: Partial<Record<string, Partial<PlatformFees>>>
): Record<string, number> {
  const result: Record<string, number> = {};

  for (const platform of Object.keys(PLATFORM_FEES)) {
    const fees = calculatePlatformFees(salePrice, platform as keyof typeof PLATFORM_FEES, {
      customFees: customFees?.[platform],
    });
    result[platform] = Math.round((salePrice - fees - costBasis) * 100) / 100;
  }

  return result;
}

// ============================================================================
// Margin Analysis
// ============================================================================

/**
 * Perform comprehensive margin analysis
 */
export function analyzeMargins(
  estimatedSalePrice: number,
  costBasis: CostBasis,
  customFees?: Partial<Record<string, Partial<PlatformFees>>>
): MarginAnalysis {
  const grossProfit = estimatedSalePrice - costBasis.total;
  const grossMarginPercent =
    costBasis.total > 0 ? (grossProfit / costBasis.total) * 100 : 0;

  // Calculate platform fees
  const platformFees: MarginAnalysis["platformFees"] = {
    ebay: calculatePlatformFees(estimatedSalePrice, "ebay", { customFees: customFees?.ebay }),
    etsy: calculatePlatformFees(estimatedSalePrice, "etsy", { customFees: customFees?.etsy }),
    auctionflex: calculatePlatformFees(estimatedSalePrice, "auctionflex", {
      customFees: customFees?.auctionflex,
    }),
    direct: calculatePlatformFees(estimatedSalePrice, "direct", { customFees: customFees?.direct }),
  };

  // Calculate net profits
  const netProfit: MarginAnalysis["netProfit"] = {
    ebay: Math.round((estimatedSalePrice - platformFees.ebay - costBasis.total) * 100) / 100,
    etsy: Math.round((estimatedSalePrice - platformFees.etsy - costBasis.total) * 100) / 100,
    auctionflex: Math.round(
      (estimatedSalePrice - platformFees.auctionflex - costBasis.total) * 100
    ) / 100,
    direct: Math.round((estimatedSalePrice - platformFees.direct - costBasis.total) * 100) / 100,
  };

  // Calculate net margin percentages
  const netMarginPercent: MarginAnalysis["netMarginPercent"] = {
    ebay: costBasis.total > 0 ? Math.round((netProfit.ebay / costBasis.total) * 10000) / 100 : 0,
    etsy: costBasis.total > 0 ? Math.round((netProfit.etsy / costBasis.total) * 10000) / 100 : 0,
    auctionflex:
      costBasis.total > 0 ? Math.round((netProfit.auctionflex / costBasis.total) * 10000) / 100 : 0,
    direct:
      costBasis.total > 0 ? Math.round((netProfit.direct / costBasis.total) * 10000) / 100 : 0,
  };

  // Determine best platform
  const bestPlatform = Object.entries(netProfit).reduce((best, [platform, profit]) =>
    profit > (netProfit[best as keyof typeof netProfit] || 0) ? platform : best
  , "direct");

  // Calculate break-even price (where net profit = 0 on best platform)
  // salePrice - fees(salePrice) - costBasis = 0
  // For approximation, use average fee percentage
  const avgFeePercent = 0.15; // ~15% average across platforms
  const breakEvenPrice = Math.round((costBasis.total / (1 - avgFeePercent)) * 100) / 100;

  return {
    estimatedSalePrice,
    grossProfit: Math.round(grossProfit * 100) / 100,
    grossMarginPercent: Math.round(grossMarginPercent * 100) / 100,
    platformFees,
    netProfit,
    netMarginPercent,
    bestPlatform,
    breakEvenPrice,
  };
}

// ============================================================================
// Pricing Strategy
// ============================================================================

/**
 * Determine optimal pricing strategy based on market data and margins
 */
export function determinePricingStrategy(
  marketData: MarketDataResult,
  costBasis: CostBasis | null,
  targetMargin?: number
): {
  strategy: PricingRecommendation["strategy"];
  rationale: string;
} {
  const { marketStats, comparableSales } = marketData;
  const targetMarginPercent = targetMargin || 30; // Default 30% target margin

  // No cost basis - recommend competitive pricing
  if (!costBasis || costBasis.total === 0) {
    return {
      strategy: "competitive",
      rationale: "No cost basis provided - pricing based on market comparables",
    };
  }

  // Calculate what price would achieve target margin
  const avgFeePercent = 0.15;
  const targetPrice = costBasis.total * (1 + targetMarginPercent / 100) / (1 - avgFeePercent);

  // Compare to market prices
  if (marketStats.sampleSize === 0) {
    return {
      strategy: "competitive",
      rationale: "Limited market data - recommend conservative pricing",
    };
  }

  const marketMid = (marketStats.avgPrice + marketStats.medianPrice) / 2;

  if (targetPrice > marketStats.highPrice * 1.1) {
    // Target price is above market - consider holding or taking a loss
    return {
      strategy: "holdback",
      rationale: `Target margin requires $${targetPrice.toFixed(2)} but market tops at $${marketStats.highPrice.toFixed(2)}. Consider holding for better market or accepting lower margin.`,
    };
  }

  if (targetPrice > marketMid * 1.15) {
    // Target price is above market average - premium pricing needed
    return {
      strategy: "premium",
      rationale: `Position at premium end of market to achieve target margin. Emphasize quality and certification.`,
    };
  }

  if (targetPrice < marketStats.lowPrice) {
    // Can achieve great margins - aggressive pricing for quick sale
    return {
      strategy: "aggressive",
      rationale: `Strong margin available. Aggressive pricing can accelerate sale while maintaining profitability.`,
    };
  }

  return {
    strategy: "competitive",
    rationale: `Price competitively within market range to balance sale velocity and margin.`,
  };
}

/**
 * Generate pricing recommendation
 */
export function generatePricingRecommendation(
  marketData: MarketDataResult,
  gradeResult: ProductGradeResult,
  costBasis: CostBasis | null,
  options?: {
    targetMargin?: number;
    preferQuickSale?: boolean;
  }
): PricingRecommendation {
  const { marketStats, priceGuideData, comparableSales } = marketData;
  const confidence = gradeResult.confidence;

  // Determine strategy
  const { strategy, rationale } = determinePricingStrategy(
    marketData,
    costBasis,
    options?.targetMargin
  );

  // Calculate base price from market data
  let basePrice = marketStats.avgPrice;

  // If we have price guide data for this exact grade, weight it heavily
  const gradePrice = priceGuideData.find((p) => p.grade === gradeResult.estimatedGrade);
  if (gradePrice) {
    basePrice = (basePrice + gradePrice.price) / 2;
  }

  // Adjust for grade confidence
  if (confidence < 0.7) {
    basePrice *= 0.95; // Reduce price for uncertain grades
  }

  // Apply strategy multipliers
  let listPrice = basePrice;
  let minimumPrice = basePrice * 0.85;
  let buyNowPrice = basePrice;

  switch (strategy) {
    case "aggressive":
      listPrice = basePrice * 0.92;
      minimumPrice = basePrice * 0.85;
      buyNowPrice = basePrice * 0.95;
      break;
    case "competitive":
      listPrice = basePrice;
      minimumPrice = basePrice * 0.88;
      buyNowPrice = basePrice * 1.02;
      break;
    case "premium":
      listPrice = basePrice * 1.08;
      minimumPrice = basePrice * 0.95;
      buyNowPrice = basePrice * 1.1;
      break;
    case "holdback":
      listPrice = basePrice * 1.15;
      minimumPrice = basePrice;
      buyNowPrice = basePrice * 1.2;
      break;
  }

  // Calculate auction start price (typically 60-70% of expected)
  const auctionStartPrice =
    options?.preferQuickSale
      ? Math.round(basePrice * 0.6 * 100) / 100
      : Math.round(basePrice * 0.7 * 100) / 100;

  // Calculate wholesale price (typically 60-70% of retail)
  const wholesalePrice = Math.round(basePrice * 0.65 * 100) / 100;

  // Round all prices
  listPrice = Math.round(listPrice * 100) / 100;
  minimumPrice = Math.round(minimumPrice * 100) / 100;
  buyNowPrice = Math.round(buyNowPrice * 100) / 100;

  return {
    listPrice,
    minimumPrice,
    buyNowPrice,
    auctionStartPrice,
    wholesalePrice,
    confidence: Math.min(confidence, marketStats.sampleSize > 5 ? 0.9 : 0.6),
    strategy,
    rationale,
  };
}

// ============================================================================
// Recommended Actions
// ============================================================================

/**
 * Generate recommended actions based on evaluation
 */
export function generateRecommendedActions(
  identification: ProductIdentificationResult,
  gradeResult: ProductGradeResult,
  marketData: MarketDataResult,
  margin: MarginAnalysis | null
): string[] {
  const actions: string[] = [];

  // Certification recommendations
  if (gradeResult.certificationRecommended) {
    actions.push(
      `Submit for ${gradeResult.certificationService || "third-party"} certification - high-grade item would benefit`
    );
  }

  // Market timing
  if (margin && margin.grossMarginPercent < 15) {
    actions.push("Consider holding for better market conditions - current margins are thin");
  } else if (margin && margin.grossMarginPercent > 50) {
    actions.push("Strong margins available - prioritize quick sale");
  }

  // Platform recommendations
  if (margin) {
    actions.push(`List on ${margin.bestPlatform} for optimal net return`);
  }

  // Photography suggestions
  if (identification.confidence < 0.7) {
    actions.push("Improve listing photos - clearer images may improve identification accuracy");
  }

  // Verification warnings
  if (identification.warnings.length > 0) {
    actions.push(`Verify: ${identification.warnings[0]}`);
  }

  // Grade verification
  if (gradeResult.confidence < 0.6) {
    actions.push("Consider professional grading verification - estimated grade has low confidence");
  }

  // Market data suggestions
  if (marketData.marketStats.sampleSize < 5) {
    actions.push("Limited comparable sales found - consider additional market research");
  }

  // Price guide alignment
  if (marketData.priceGuideData.length > 0) {
    const guidePrice = marketData.priceGuideData[0]?.price || 0;
    const marketPrice = marketData.marketStats.avgPrice;
    if (guidePrice > 0 && Math.abs(guidePrice - marketPrice) / guidePrice > 0.3) {
      actions.push(
        "Price guide and market prices differ significantly - review for special factors"
      );
    }
  }

  return actions;
}

// ============================================================================
// Profitability Check
// ============================================================================

/**
 * Quick profitability check for a potential purchase
 */
export function checkProfitability(
  estimatedMarketValue: number,
  proposedPurchasePrice: number,
  additionalCosts?: {
    shipping?: number;
    certification?: number;
    repair?: number;
  }
): {
  profitable: boolean;
  estimatedProfit: number;
  marginPercent: number;
  recommendation: string;
} {
  const totalCost =
    proposedPurchasePrice +
    (additionalCosts?.shipping || 0) +
    (additionalCosts?.certification || 0) +
    (additionalCosts?.repair || 0);

  // Assume 15% selling fees
  const netSalePrice = estimatedMarketValue * 0.85;
  const estimatedProfit = netSalePrice - totalCost;
  const marginPercent = totalCost > 0 ? (estimatedProfit / totalCost) * 100 : 0;

  let recommendation: string;
  let profitable: boolean;

  if (marginPercent >= 40) {
    profitable = true;
    recommendation = "Excellent opportunity - strong margins available";
  } else if (marginPercent >= 25) {
    profitable = true;
    recommendation = "Good opportunity - healthy margins";
  } else if (marginPercent >= 15) {
    profitable = true;
    recommendation = "Acceptable margins - proceed with caution";
  } else if (marginPercent >= 5) {
    profitable = false;
    recommendation = "Thin margins - consider negotiating lower price";
  } else {
    profitable = false;
    recommendation = "Not recommended - insufficient profit potential";
  }

  return {
    profitable,
    estimatedProfit: Math.round(estimatedProfit * 100) / 100,
    marginPercent: Math.round(marginPercent * 100) / 100,
    recommendation,
  };
}

// ============================================================================
// Bulk Evaluation
// ============================================================================

/**
 * Evaluate profitability of a bulk lot
 */
export function evaluateBulkLot(
  items: Array<{
    estimatedValue: number;
    quantity: number;
  }>,
  lotPrice: number,
  additionalCosts?: number
): {
  totalRetailValue: number;
  totalItems: number;
  costPerItem: number;
  averageMargin: number;
  profitable: boolean;
  recommendation: string;
} {
  const totalRetailValue = items.reduce((sum, item) => sum + item.estimatedValue * item.quantity, 0);
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalCost = lotPrice + (additionalCosts || 0);
  const costPerItem = totalItems > 0 ? totalCost / totalItems : 0;

  // Estimate net after fees
  const netValue = totalRetailValue * 0.85;
  const profit = netValue - totalCost;
  const averageMargin = totalCost > 0 ? (profit / totalCost) * 100 : 0;

  let recommendation: string;
  let profitable: boolean;

  if (averageMargin >= 50) {
    profitable = true;
    recommendation = "Strong bulk opportunity - proceed";
  } else if (averageMargin >= 30) {
    profitable = true;
    recommendation = "Acceptable bulk margins - consider cherry-picking best items";
  } else if (averageMargin >= 15) {
    profitable = false;
    recommendation = "Marginal opportunity - negotiate lower price";
  } else {
    profitable = false;
    recommendation = "Pass on this lot - insufficient margins";
  }

  return {
    totalRetailValue: Math.round(totalRetailValue * 100) / 100,
    totalItems,
    costPerItem: Math.round(costPerItem * 100) / 100,
    averageMargin: Math.round(averageMargin * 100) / 100,
    profitable,
    recommendation,
  };
}
