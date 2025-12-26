/**
 * Product Intelligence Service Types
 * Interfaces for coins, cards, and collectible analysis
 */

// ============================================================================
// Product Categories
// ============================================================================

export type ProductCategory = "coin" | "card" | "bullion" | "currency" | "collectible";

export type MetalType = "gold" | "silver" | "platinum" | "palladium" | "copper" | "none";

// ============================================================================
// Coin Types
// ============================================================================

export interface CoinIdentification {
  country: string;
  denomination: string;
  year: number | null;
  mint: string | null;
  mintMark: string | null;
  variety: string | null;
  composition: string | null;
  metalType: MetalType;
  weight: number | null;
  diameter: number | null;
  catalogNumber: string | null; // e.g., KM#, Krause number
  pcgsNumber: string | null;
  ngcNumber: string | null;
  commonName: string;
  series: string | null;
}

export interface CoinGrade {
  numericGrade: number | null; // 1-70 Sheldon scale
  adjectivalGrade: string; // e.g., "MS65", "VF30", "PR69DCAM"
  details: string | null; // e.g., "Cleaned", "Scratched"
  isDetailsGrade: boolean;
  strike: "weak" | "average" | "strong" | "full" | null;
  luster: "poor" | "below_average" | "average" | "above_average" | "exceptional" | null;
  surfaces: "impaired" | "average" | "above_average" | "exceptional" | null;
  eyeAppeal: "negative" | "neutral" | "positive" | "exceptional" | null;
  color: string | null; // For toned coins
  cameo: "none" | "cameo" | "deep_cameo" | null; // For proofs
}

export interface CoinCertification {
  service: "PCGS" | "NGC" | "ANACS" | "ICG" | "CAC" | "other" | "raw";
  certNumber: string | null;
  grade: string | null;
  variety: string | null;
  designation: string | null; // e.g., "First Strike", "Early Releases"
  verified: boolean;
  verificationUrl: string | null;
}

// ============================================================================
// Card Types
// ============================================================================

export interface CardIdentification {
  sport: string | null; // "baseball", "basketball", "football", "hockey", "pokemon", etc.
  year: number | null;
  manufacturer: string | null; // e.g., "Topps", "Panini", "Upper Deck"
  setName: string | null;
  cardNumber: string | null;
  playerName: string | null;
  team: string | null;
  parallel: string | null; // e.g., "Refractor", "Gold", "1/1"
  insert: string | null;
  autograph: boolean;
  memorabilia: boolean;
  serialNumber: string | null; // e.g., "25/99"
  rookieCard: boolean;
}

export interface CardGrade {
  numericGrade: number | null; // 1-10 scale
  subgrades: {
    centering: number | null;
    corners: number | null;
    edges: number | null;
    surface: number | null;
  } | null;
  qualifier: "authentic" | "altered" | "trimmed" | null;
  auto: number | null; // Autograph grade
}

export interface CardCertification {
  service: "PSA" | "BGS" | "SGC" | "CGC" | "other" | "raw";
  certNumber: string | null;
  grade: string | null;
  verified: boolean;
  verificationUrl: string | null;
  population: {
    thisGrade: number;
    higher: number;
  } | null;
}

// ============================================================================
// Unified Product Interface
// ============================================================================

export interface ProductIdentificationResult {
  category: ProductCategory;
  confidence: number;
  coin: CoinIdentification | null;
  card: CardIdentification | null;
  rawDescription: string;
  suggestedTitle: string;
  suggestedCategory: string;
  keyFeatures: string[];
  warnings: string[];
}

export interface ProductGradeResult {
  category: ProductCategory;
  confidence: number;
  coinGrade: CoinGrade | null;
  cardGrade: CardGrade | null;
  estimatedGrade: string;
  gradeRange: { low: string; high: string };
  conditionNotes: string[];
  certificationRecommended: boolean;
  certificationService: string | null;
}

export interface ProductCertificationResult {
  category: ProductCategory;
  certification: CoinCertification | CardCertification | null;
  isAuthentic: boolean | null;
  authenticationNotes: string[];
}

// ============================================================================
// Market Data Types
// ============================================================================

export interface MarketDataSource {
  name: "ebay" | "heritage" | "greatcollections" | "pcgs" | "ngc" | "psa" | "beckett" | "redbook" | "greysheet";
  lastUpdated: Date;
  reliability: number; // 0-1
}

export interface ComparableSale {
  title: string;
  price: number;
  soldDate: Date | null;
  source: string;
  url: string | null;
  grade: string | null;
  certification: string | null;
  imageUrl: string | null;
  relevanceScore: number; // 0-1 how similar to our item
}

export interface PriceGuideData {
  source: MarketDataSource;
  grade: string;
  price: number;
  population: number | null;
  trend: "rising" | "stable" | "declining" | null;
  lastSaleDate: Date | null;
  lastSalePrice: number | null;
}

export interface MarketDataResult {
  comparableSales: ComparableSale[];
  priceGuideData: PriceGuideData[];
  marketStats: {
    avgPrice: number;
    medianPrice: number;
    lowPrice: number;
    highPrice: number;
    sampleSize: number;
    dateRange: { from: Date | null; to: Date | null };
  };
  spotPrice: number | null; // For bullion/precious metals
  meltValue: number | null;
  premiumOverMelt: number | null;
  errors: string[];
}

// ============================================================================
// Evaluation Types
// ============================================================================

export interface CostBasis {
  purchasePrice: number;
  shippingCost: number;
  certification: number;
  consignmentFee: number;
  otherCosts: number;
  total: number;
}

export interface PricingRecommendation {
  listPrice: number;
  minimumPrice: number;
  buyNowPrice: number;
  auctionStartPrice: number | null;
  wholesalePrice: number;
  confidence: number;
  strategy: "aggressive" | "competitive" | "premium" | "holdback";
  rationale: string;
}

export interface MarginAnalysis {
  estimatedSalePrice: number;
  grossProfit: number;
  grossMarginPercent: number;
  platformFees: {
    ebay: number;
    etsy: number;
    auctionflex: number;
    direct: number;
  };
  netProfit: {
    ebay: number;
    etsy: number;
    auctionflex: number;
    direct: number;
  };
  netMarginPercent: {
    ebay: number;
    etsy: number;
    auctionflex: number;
    direct: number;
  };
  bestPlatform: string;
  breakEvenPrice: number;
}

export interface EvaluationResult {
  productId: string | null;
  identification: ProductIdentificationResult;
  grade: ProductGradeResult;
  certification: ProductCertificationResult | null;
  marketData: MarketDataResult;
  costBasis: CostBasis | null;
  pricing: PricingRecommendation;
  margin: MarginAnalysis | null;
  overallConfidence: number;
  recommendedActions: string[];
  generatedAt: Date;
}

// ============================================================================
// Pipeline Input/Output Types
// ============================================================================

export interface ProductIntelligenceInput {
  images: string[]; // Base64 encoded or URLs
  existingTitle?: string;
  existingDescription?: string;
  purchasePrice?: number;
  certNumber?: string;
  knownGrade?: string;
  category?: ProductCategory;
  skipMarketData?: boolean;
  skipGrading?: boolean;
}

export interface ProductIntelligenceOptions {
  maxComparables?: number;
  marketDataSources?: MarketDataSource["name"][];
  includeWholesale?: boolean;
  targetMargin?: number;
  platformFeeOverrides?: Partial<MarginAnalysis["platformFees"]>;
}

export interface ProductIntelligencePipelineResult {
  success: boolean;
  evaluation: EvaluationResult | null;
  errors: string[];
  processingTime: number;
  tokensUsed: number;
}

// ============================================================================
// Image Analysis Types
// ============================================================================

export interface ImageAnalysisResult {
  quality: "poor" | "fair" | "good" | "excellent";
  lighting: "underexposed" | "good" | "overexposed";
  focus: "blurry" | "acceptable" | "sharp";
  angle: "obverse" | "reverse" | "edge" | "slab" | "multiple" | "unknown";
  hasHolder: boolean;
  holderType: "raw" | "flip" | "slab" | "capsule" | "album" | null;
  visibleText: string[];
  suggestions: string[];
}
