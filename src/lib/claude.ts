import Anthropic from "@anthropic-ai/sdk";
import { createLogger } from "./logger";

const log = createLogger({ service: "claude" });

// ============================================================================
// LAZY INITIALIZATION
// ============================================================================

let _anthropic: Anthropic | null = null;

/**
 * Get the Anthropic client with lazy initialization.
 * Throws if ANTHROPIC_API_KEY is not set.
 */
export function getAnthropic(): Anthropic {
  if (!_anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY is not set. Please add it to your environment variables."
      );
    }
    _anthropic = new Anthropic({ apiKey });
    log.info("Anthropic client initialized");
  }
  return _anthropic;
}

/**
 * Check if Anthropic is configured (without throwing).
 */
export function isAnthropicConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

// ============================================================================
// TYPES
// ============================================================================

export interface MarketAnalysisResult {
  estimatedValue: {
    low: number;
    mid: number;
    high: number;
  };
  marketTrend: "rising" | "stable" | "declining";
  avgDaysToSell: number;
  demandLevel: "high" | "medium" | "low";
  recommendedPrice: number;
  pricingStrategy: string;
  keyFactors: string[];
  comparableDescription: string;
  confidence: number;
}

export interface CoinAnalysisInput {
  title: string;
  description?: string;
  year?: number;
  mint?: string;
  grade?: string;
  certification?: string;
  metalType?: string;
  metalWeight?: number;
  category?: string;
  imageUrls?: string[];
}

// ============================================================================
// MARKET ANALYSIS
// ============================================================================

export async function analyzeMarketValue(
  input: CoinAnalysisInput,
  recentComparables?: Array<{ title: string; soldPrice: number; soldDate: string }>
): Promise<MarketAnalysisResult> {
  const comparablesText = recentComparables?.length
    ? `\n\nRecent comparable sales:\n${recentComparables
        .map((c) => `- ${c.title}: $${c.soldPrice} (${c.soldDate})`)
        .join("\n")}`
    : "";

  const prompt = `You are an expert numismatist and coin market analyst. Analyze the following coin/collectible and provide market valuation insights.

Item Details:
- Title: ${input.title}
- Description: ${input.description || "Not provided"}
- Year: ${input.year || "Unknown"}
- Mint: ${input.mint || "Unknown"}
- Grade: ${input.grade || "Ungraded"}
- Certification: ${input.certification || "Uncertified"}
- Metal Type: ${input.metalType || "Unknown"}
- Metal Weight: ${input.metalWeight ? `${input.metalWeight} oz` : "Unknown"}
- Category: ${input.category || "General"}
${comparablesText}

Please provide a detailed market analysis in the following JSON format:
{
  "estimatedValue": {
    "low": <number>,
    "mid": <number>,
    "high": <number>
  },
  "marketTrend": "<rising|stable|declining>",
  "avgDaysToSell": <number>,
  "demandLevel": "<high|medium|low>",
  "recommendedPrice": <number>,
  "pricingStrategy": "<brief recommendation for pricing approach>",
  "keyFactors": ["<factor 1>", "<factor 2>", ...],
  "comparableDescription": "<brief description of what comparables were considered>",
  "confidence": <0.0-1.0 representing confidence in this analysis>
}

Consider:
1. Current market conditions for this type of item
2. Rarity and population data if applicable
3. Grade significance and price jumps between grades
4. Historical price trends
5. Seasonal demand patterns
6. Certification premium if applicable

Respond ONLY with the JSON object, no additional text.`;

  try {
    const anthropic = getAnthropic();
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    const result = JSON.parse(content.text) as MarketAnalysisResult;
    log.debug({ input: input.title }, "Market analysis completed");
    return result;
  } catch (error) {
    log.error({ error, input: input.title }, "Claude analysis error");
    // Return default analysis on error
    return {
      estimatedValue: { low: 0, mid: 0, high: 0 },
      marketTrend: "stable",
      avgDaysToSell: 30,
      demandLevel: "medium",
      recommendedPrice: 0,
      pricingStrategy: "Unable to analyze - please review manually",
      keyFactors: ["Analysis unavailable"],
      comparableDescription: "No comparables analyzed",
      confidence: 0,
    };
  }
}

// ============================================================================
// PRODUCT DESCRIPTION
// ============================================================================

export async function generateProductDescription(
  input: CoinAnalysisInput
): Promise<string> {
  const prompt = `Write a compelling, professional product description for an online coin/collectibles shop. The description should be informative yet engaging, suitable for collectors.

Item Details:
- Title: ${input.title}
- Year: ${input.year || "Unknown"}
- Mint: ${input.mint || "Unknown"}
- Grade: ${input.grade || "Ungraded"}
- Certification: ${input.certification || "Uncertified"}
- Metal Type: ${input.metalType || "Unknown"}
- Metal Weight: ${input.metalWeight ? `${input.metalWeight} oz` : "Unknown"}
- Category: ${input.category || "General"}
- Additional Info: ${input.description || "None"}

Write a 2-3 paragraph description that:
1. Highlights the key features and appeal of this item
2. Mentions any historical significance
3. Notes the condition/grade benefits
4. Appeals to both new and experienced collectors

Keep it professional, accurate, and under 200 words.`;

  try {
    const anthropic = getAnthropic();
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    return content.text;
  } catch (error) {
    log.error({ error, input: input.title }, "Claude description error");
    return input.description || "";
  }
}

// ============================================================================
// COIN IDENTIFICATION
// ============================================================================

export async function identifyCoin(imageBase64: string): Promise<{
  possibleIdentification: string;
  confidence: number;
  suggestedCategory: string;
  additionalNotes: string;
  estimatedGrade: string;
  gradeConfidence: number;
  year?: number;
  mint?: string;
  certification?: string;
}> {
  try {
    const anthropic = getAnthropic();
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: imageBase64,
              },
            },
            {
              type: "text",
              text: `You are an expert numismatist and coin grader. Analyze this coin/collectible image carefully.

IMPORTANT: If you see a PCGS, NGC, or other grading service holder/slab, read the label to get the exact grade. If the coin is raw (not in a holder), estimate the grade based on wear, luster, and surface preservation.

Grading scale for reference:
- AG3, G4, G6: Heavy wear, major features visible
- VG8, VG10: Moderate wear, some detail visible
- F12, F15: Even wear, all lettering visible
- VF20-VF35: Light wear on high points
- EF40, EF45: Slight wear on highest points only
- AU50-AU58: Trace wear, nearly full luster
- MS60-MS70: Uncirculated (MS60=many marks, MS65=gem, MS67+=superb)
- PF60-PF70: Proof coins

Provide your analysis in JSON format:
{
  "possibleIdentification": "<full identification: e.g. '1921 Morgan Silver Dollar'>",
  "year": <year as number or null if unknown>,
  "mint": "<mint mark: P, D, S, O, CC, W, or null>",
  "estimatedGrade": "<grade: e.g. 'MS65', 'VF30', 'AU58'>",
  "gradeConfidence": <0.0-1.0 confidence in grade estimate>,
  "certification": "<PCGS, NGC, ANACS, ICG, or null if raw>",
  "confidence": <0.0-1.0 overall confidence>,
  "suggestedCategory": "<category: 'US Coins', 'World Coins', 'Bullion', 'Trading Cards', 'Collectibles'>",
  "additionalNotes": "<observations: toning, problems, eye appeal, CAC sticker, etc.>"
}

Respond ONLY with the JSON object.`,
            },
          ],
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    return JSON.parse(content.text);
  } catch (error) {
    log.error({ error }, "Claude identification error");
    return {
      possibleIdentification: "Unable to identify",
      confidence: 0,
      suggestedCategory: "Unknown",
      additionalNotes: "Image analysis failed",
      estimatedGrade: "Unknown",
      gradeConfidence: 0,
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  getAnthropic,
  isAnthropicConfigured,
  analyzeMarketValue,
  generateProductDescription,
  identifyCoin,
};
