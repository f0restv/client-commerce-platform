/**
 * Product Intelligence Types
 * Extensible type definitions for collectible identification, grading, and market analysis
 */

// =============================================================================
// Category Types
// =============================================================================

export type CollectibleCategory = "coin" | "currency" | "sports-card" | "pokemon";

export interface CategoryMetadata {
  category: CollectibleCategory;
  subcategory?: string;
  era?: string;
}

// =============================================================================
// Identification Result Types
// =============================================================================

/** Base identification fields common to all collectibles */
export interface BaseIdentificationResult {
  category: CollectibleCategory;
  name: string;
  year?: number;
  certNumber?: string;
  searchTerms: string[];
  confidence: number;
  rawText?: string;
}

/** Coin-specific identification fields */
export interface CoinIdentificationFields {
  mint?: string;
  mintMark?: string;
  denomination?: string;
  country?: string;
  composition?: string;
  variety?: string;
  designer?: string;
  pcgsNumber?: string;
  ngcNumber?: string;
}

/** Currency-specific identification fields */
export interface CurrencyIdentificationFields {
  denomination?: string;
  series?: string;
  serialNumber?: string;
  country?: string;
  issuer?: string;
  signatureVariety?: string;
  blockLetter?: string;
  starNote?: boolean;
}

/** Sports card-specific identification fields */
export interface SportsCardIdentificationFields {
  player: string;
  team?: string;
  sport?: string;
  set: string;
  cardNumber?: string;
  parallel?: string;
  insert?: string;
  autograph?: boolean;
  memorabilia?: boolean;
  serialNumbered?: string;
  manufacturer?: string;
}

/** Pokemon card-specific identification fields */
export interface PokemonCardIdentificationFields {
  pokemonName: string;
  set: string;
  setNumber?: string;
  cardNumber?: string;
  rarity?: string;
  holoType?: string;
  edition?: string;
  language?: string;
  variant?: string;
}

/** Union type for category-specific fields */
export type CategorySpecificFields =
  | CoinIdentificationFields
  | CurrencyIdentificationFields
  | SportsCardIdentificationFields
  | PokemonCardIdentificationFields;

/** Complete identification result combining base and category-specific fields */
export type IdentificationResult = BaseIdentificationResult &
  (
    | ({ category: "coin" } & CoinIdentificationFields)
    | ({ category: "currency" } & CurrencyIdentificationFields)
    | ({ category: "sports-card" } & SportsCardIdentificationFields)
    | ({ category: "pokemon" } & PokemonCardIdentificationFields)
  );

/** Helper type for creating category-specific identification results */
export type CoinIdentificationResult = BaseIdentificationResult &
  CoinIdentificationFields & { category: "coin" };

export type CurrencyIdentificationResult = BaseIdentificationResult &
  CurrencyIdentificationFields & { category: "currency" };

export type SportsCardIdentificationResult = BaseIdentificationResult &
  SportsCardIdentificationFields & { category: "sports-card" };

export type PokemonCardIdentificationResult = BaseIdentificationResult &
  PokemonCardIdentificationFields & { category: "pokemon" };

// =============================================================================
// Grade Estimate Types
// =============================================================================

/** Surface quality details for coins */
export interface CoinSurfaceDetails {
  obverse: {
    luster?: string;
    marks?: string;
    hairlines?: string;
    wear?: string;
  };
  reverse: {
    luster?: string;
    marks?: string;
    hairlines?: string;
    wear?: string;
  };
  edge?: string;
  eyeAppeal?: "positive" | "neutral" | "negative";
  colorDesignation?: string;
  cameoDesignation?: string;
}

/** Centering details for cards */
export interface CardCenteringDetails {
  frontLeftRight?: string;
  frontTopBottom?: string;
  backLeftRight?: string;
  backTopBottom?: string;
  overallCentering?: string;
}

/** Card surface/corner details */
export interface CardSurfaceDetails {
  corners?: string;
  edges?: string;
  surface?: string;
  print?: string;
}

/** Base grade estimate fields */
export interface BaseGradeEstimate {
  grade: string;
  numericGrade?: number;
  confidence: number;
  notes: string[];
  gradingService?: "PCGS" | "NGC" | "PSA" | "BGS" | "CGC" | "PMG" | "other";
}

/** Coin-specific grade estimate */
export interface CoinGradeEstimate extends BaseGradeEstimate {
  surfaces: CoinSurfaceDetails;
  strike?: "weak" | "average" | "strong" | "full";
  designations?: string[];
}

/** Card-specific grade estimate */
export interface CardGradeEstimate extends BaseGradeEstimate {
  centering: CardCenteringDetails;
  surfaces: CardSurfaceDetails;
  subgrades?: {
    centering?: number;
    corners?: number;
    edges?: number;
    surface?: number;
  };
  autoGrade?: number;
}

/** Currency-specific grade estimate */
export interface CurrencyGradeEstimate extends BaseGradeEstimate {
  surfaces: {
    folds?: string;
    tears?: string;
    stains?: string;
    margins?: string;
    centering?: string;
  };
  paperQuality?: string;
  designations?: string[];
}

/** Union type for all grade estimates */
export type GradeEstimate = CoinGradeEstimate | CardGradeEstimate | CurrencyGradeEstimate;

// =============================================================================
// Market Data Types
// =============================================================================

export type MarketSource =
  | "ebay"
  | "heritage"
  | "greatcollections"
  | "comc"
  | "pwcc"
  | "goldin"
  | "myslabs"
  | "tcgplayer"
  | "other";

/** Individual market comparable sale/listing */
export interface MarketComparable {
  source: MarketSource;
  price: number;
  url?: string;
  date: Date | string;
  sold: boolean;
  title?: string;
  grade?: string;
  imageUrl?: string;
  auctionHouse?: string;
  lotNumber?: string;
}

/** eBay-specific market statistics */
export interface EbayMarketStats {
  soldCount: number;
  soldAverage: number;
  soldMedian: number;
  soldLow: number;
  soldHigh: number;
  activeListings: number;
  activeAverage: number;
  activeLow: number;
  daysToSell?: number;
  sellThroughRate?: number;
  lastUpdated: Date | string;
}

/** Redbook pricing data (for coins) */
export interface RedbookPricing {
  vg?: number;
  fine?: number;
  vf?: number;
  xf?: number;
  au?: number;
  ms60?: number;
  ms63?: number;
  ms65?: number;
  ms67?: number;
  pr65?: number;
  pr67?: number;
  edition?: string;
  lastUpdated?: Date | string;
}

/** Greysheet pricing data (for coins/currency) */
export interface GreysheetPricing {
  bid?: number;
  ask?: number;
  cpo?: number;
  retail?: number;
  population?: number;
  popHigher?: number;
  lastUpdated?: Date | string;
}

/** Buy now / fixed price market data */
export interface BuyNowData {
  lowestPrice?: number;
  averagePrice?: number;
  listingCount: number;
  sources: Array<{
    source: MarketSource;
    price: number;
    url?: string;
  }>;
}

/** Complete market data aggregate */
export interface MarketData {
  category: CollectibleCategory;
  ebay?: EbayMarketStats;
  redbook?: RedbookPricing;
  greysheet?: GreysheetPricing;
  buyNow?: BuyNowData;
  comparables: MarketComparable[];
  auctionResults?: MarketComparable[];
  priceHistory?: Array<{
    date: Date | string;
    price: number;
    source: MarketSource;
  }>;
  lastUpdated: Date | string;
}

// =============================================================================
// Evaluation Result Types
// =============================================================================

export type EvaluationRecommendation = "accept" | "decline" | "review";

export interface PriceBreakdown {
  baseValue: number;
  gradeAdjustment?: number;
  certificationPremium?: number;
  varietyPremium?: number;
  conditionDeduction?: number;
  marketTrendAdjustment?: number;
}

export interface RiskFactors {
  authenticityRisk: "low" | "medium" | "high";
  gradingRisk: "low" | "medium" | "high";
  marketRisk: "low" | "medium" | "high";
  liquidityRisk: "low" | "medium" | "high";
  notes?: string[];
}

export interface EvaluationResult {
  category: CollectibleCategory;
  suggestedPrice: number;
  priceRange: {
    low: number;
    mid: number;
    high: number;
  };
  margin: number;
  marginPercent: number;
  recommendation: EvaluationRecommendation;
  confidence: number;
  reasoning: string[];
  priceBreakdown?: PriceBreakdown;
  riskFactors?: RiskFactors;
  comparableCount: number;
  dataQuality: "high" | "medium" | "low" | "insufficient";
  suggestedListingPrice?: number;
  quickFlipPrice?: number;
  holdValue?: number;
  timeToSell?: {
    estimated: number;
    unit: "days" | "weeks" | "months";
  };
}

// =============================================================================
// Composite Types for Full Processing Pipeline
// =============================================================================

export interface ProductIntelligenceResult {
  identification: IdentificationResult;
  gradeEstimate?: GradeEstimate;
  marketData?: MarketData;
  evaluation?: EvaluationResult;
  processedAt: Date | string;
  processingTimeMs?: number;
  errors?: string[];
  warnings?: string[];
}

export interface ProductIntelligenceInput {
  images: string[];
  category?: CollectibleCategory;
  knownDetails?: Partial<IdentificationResult>;
  purchasePrice?: number;
  targetMargin?: number;
}
