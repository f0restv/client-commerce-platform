import type { MarketData, EvaluationResult, EvaluationRecommendation, GradeEstimate } from './types';

interface EvaluationInput {
  clientPayout: number;
  marketData: MarketData;
  grade?: GradeEstimate;
}

const MARGIN_THRESHOLDS = {
  accept: 0.15,
  decline: 0.05,
};

export function evaluate(input: EvaluationInput): EvaluationResult {
  const { clientPayout, marketData, grade } = input;

  const suggestedPrice = calculateSuggestedPrice(marketData);
  const margin = suggestedPrice - clientPayout;
  const marginPercent = suggestedPrice > 0 ? margin / suggestedPrice : 0;

  const recommendation = determineRecommendation(marginPercent, marketData, grade);
  const risks = identifyRisks(marketData, grade, marginPercent);
  const marketConfidence = assessMarketConfidence(marketData);
  const reasoning = generateReasoning(suggestedPrice, clientPayout, marginPercent, marketData, recommendation);

  return {
    suggestedPrice: Math.round(suggestedPrice * 100) / 100,
    clientPayout,
    margin: Math.round(margin * 100) / 100,
    marginPercent: Math.round(marginPercent * 10000) / 100,
    recommendation,
    reasoning,
    risks,
    marketConfidence,
  };
}

function calculateSuggestedPrice(marketData: MarketData): number {
  const prices: number[] = [];
  const weights: number[] = [];

  if (marketData.ebayStats) {
    prices.push(marketData.ebayStats.soldMedian);
    weights.push(3);

    if (marketData.ebayStats.soldCount >= 10) {
      prices.push(marketData.ebayStats.soldAverage);
      weights.push(2);
    }
  }

  if (marketData.greysheetPrice) {
    const midpoint = (marketData.greysheetPrice.bid + marketData.greysheetPrice.ask) / 2;
    prices.push(midpoint);
    weights.push(2);
  }

  if (marketData.redbookPrice) {
    prices.push(marketData.redbookPrice);
    weights.push(1);
  }

  if (marketData.buyNow) {
    prices.push(marketData.buyNow.price * 0.9);
    weights.push(1);
  }

  if (prices.length === 0) {
    return 0;
  }

  const weightedSum = prices.reduce((sum, price, i) => sum + price * weights[i], 0);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  return weightedSum / totalWeight;
}

function determineRecommendation(
  marginPercent: number,
  marketData: MarketData,
  grade?: GradeEstimate
): EvaluationRecommendation {
  if (marginPercent >= MARGIN_THRESHOLDS.accept) {
    const confidence = assessMarketConfidence(marketData);
    if (confidence === 'low' && marginPercent < 0.25) {
      return 'review';
    }
    return 'accept';
  }

  if (marginPercent < MARGIN_THRESHOLDS.decline) {
    return 'decline';
  }

  if (grade && grade.confidence < 0.6) {
    return 'review';
  }

  return 'review';
}

function identifyRisks(
  marketData: MarketData,
  grade?: GradeEstimate,
  marginPercent?: number
): string[] {
  const risks: string[] = [];

  if (!marketData.ebayStats || marketData.ebayStats.soldCount < 5) {
    risks.push('Limited sales data - price volatility risk');
  }

  if (marketData.ebayStats) {
    const spread = marketData.ebayStats.soldHigh - marketData.ebayStats.soldLow;
    const spreadPercent = spread / marketData.ebayStats.soldMedian;
    if (spreadPercent > 0.5) {
      risks.push('High price variance in comparables');
    }
  }

  if (grade && grade.confidence < 0.7) {
    risks.push('Grade estimate has low confidence - consider professional grading');
  }

  if (!marketData.greysheetPrice && !marketData.redbookPrice) {
    risks.push('No dealer pricing available - relying solely on eBay data');
  }

  if (marginPercent !== undefined && marginPercent < 0.1) {
    risks.push('Thin margin leaves little room for error');
  }

  if (marketData.ebayStats && marketData.ebayStats.activeListings > marketData.ebayStats.soldCount * 2) {
    risks.push('High supply - many active listings relative to sales');
  }

  return risks;
}

function assessMarketConfidence(marketData: MarketData): 'high' | 'medium' | 'low' {
  let score = 0;

  if (marketData.ebayStats) {
    if (marketData.ebayStats.soldCount >= 20) score += 3;
    else if (marketData.ebayStats.soldCount >= 10) score += 2;
    else if (marketData.ebayStats.soldCount >= 5) score += 1;
  }

  if (marketData.greysheetPrice) score += 2;
  if (marketData.redbookPrice) score += 1;
  if (marketData.buyNow) score += 1;

  if (score >= 5) return 'high';
  if (score >= 3) return 'medium';
  return 'low';
}

function generateReasoning(
  suggestedPrice: number,
  clientPayout: number,
  marginPercent: number,
  marketData: MarketData,
  recommendation: EvaluationRecommendation
): string {
  const parts: string[] = [];

  parts.push(`Suggested sale price: $${suggestedPrice.toFixed(2)} based on`);

  const sources: string[] = [];
  if (marketData.ebayStats) {
    sources.push(`eBay median of $${marketData.ebayStats.soldMedian.toFixed(2)} (${marketData.ebayStats.soldCount} sales)`);
  }
  if (marketData.greysheetPrice) {
    sources.push(`Greysheet bid/ask of $${marketData.greysheetPrice.bid}/$${marketData.greysheetPrice.ask}`);
  }
  if (marketData.redbookPrice) {
    sources.push(`Redbook value of $${marketData.redbookPrice}`);
  }
  parts.push(sources.join(', ') + '.');

  parts.push(`Client payout of $${clientPayout.toFixed(2)} yields ${(marginPercent * 100).toFixed(1)}% margin.`);

  switch (recommendation) {
    case 'accept':
      parts.push('Margin exceeds 15% threshold - recommended to accept.');
      break;
    case 'decline':
      parts.push('Margin below 5% threshold - recommended to decline.');
      break;
    case 'review':
      parts.push('Margin between 5-15% or risk factors present - manual review recommended.');
      break;
  }

  return parts.join(' ');
}

export function quickEvaluate(clientPayout: number, estimatedValue: number): EvaluationRecommendation {
  const margin = estimatedValue - clientPayout;
  const marginPercent = estimatedValue > 0 ? margin / estimatedValue : 0;

  if (marginPercent >= MARGIN_THRESHOLDS.accept) return 'accept';
  if (marginPercent < MARGIN_THRESHOLDS.decline) return 'decline';
  return 'review';
}
