export type CollectibleCategory =
  | 'coin'
  | 'sports-card'
  | 'trading-card'
  | 'comic'
  | 'stamp'
  | 'currency'
  | 'memorabilia'
  | 'vinyl-record'
  | 'sneakers'
  | 'watch'
  | 'vintage-toy'
  | 'art'
  | 'antique'
  | 'wine'
  | 'autograph'
  | 'video-game'
  | 'pokemon'
  | 'jewelry'
  | 'militaria'
  | 'sports-memorabilia'
  | 'unknown';

export interface IdentificationResult {
  category: CollectibleCategory;
  name: string;
  year: number | null;
  mint: string | null;
  player: string | null;
  set: string | null;
  certNumber: string | null;
  searchTerms: string[];
  rawDescription: string;
  confidence: number;
}

export interface GradeEstimate {
  grade: string;
  numericGrade: number | null;
  confidence: number;
  notes: string;
  surfaces: string;
  centering: string;
  corners?: string;
  edges?: string;
  strike?: string;
  luster?: string;
}

export interface MarketComparable {
  source: 'ebay-sold' | 'ebay-active' | 'heritage' | 'comc' | 'other';
  title: string;
  price: number;
  url: string;
  sold: boolean;
  soldDate: Date | null;
  condition: string | null;
}

export interface MarketData {
  ebayStats: {
    soldCount: number;
    soldAverage: number;
    soldMedian: number;
    soldLow: number;
    soldHigh: number;
    activeListings: number;
    comparables: MarketComparable[];
  } | null;
  redbookPrice: number | null;
  greysheetPrice: {
    bid: number;
    ask: number;
  } | null;
  buyNow: {
    price: number;
    url: string;
    seller: string;
  } | null;
  /** Unified market data from multiple price guide providers */
  unifiedPrices: UnifiedMarketPrice[] | null;
  /** Aggregated estimated value from all sources */
  estimatedValue: {
    low: number;
    mid: number;
    high: number;
  } | null;
  fetchedAt: Date;
}

export interface UnifiedMarketPrice {
  itemId: string;
  name: string;
  category: string;
  source: string;
  sourceUrl?: string;
  prices: {
    raw?: { low: number; mid: number; high: number };
    graded?: Record<string, { low: number; mid: number; high: number }>;
  };
  lastUpdated: string;
}

export type EvaluationRecommendation = 'accept' | 'decline' | 'review';

export interface EvaluationResult {
  suggestedPrice: number;
  clientPayout: number;
  margin: number;
  marginPercent: number;
  recommendation: EvaluationRecommendation;
  reasoning: string;
  risks: string[];
  marketConfidence: 'high' | 'medium' | 'low';
}

export interface AnalysisResult {
  identification: IdentificationResult;
  grade: GradeEstimate;
  marketData: MarketData;
  evaluation: EvaluationResult | null;
}

export interface AnalysisOptions {
  clientPayout?: number;
  skipMarketData?: boolean;
  imageUrls?: string[];
  imageBase64?: string[];
}
