/**
 * Product Identification Service
 * Uses Claude Vision to identify coins, cards, and collectibles from images
 */

import Anthropic from "@anthropic-ai/sdk";
import type {
  ProductCategory,
  ProductIdentificationResult,
  CoinIdentification,
  CardIdentification,
  ImageAnalysisResult,
} from "./types";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Analyze image quality and characteristics
 */
export async function analyzeImage(imageBase64: string): Promise<ImageAnalysisResult> {
  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
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
              text: `Analyze this image of a collectible item (coin, card, or similar). Evaluate the image quality and characteristics.

Respond with JSON only:
{
  "quality": "poor" | "fair" | "good" | "excellent",
  "lighting": "underexposed" | "good" | "overexposed",
  "focus": "blurry" | "acceptable" | "sharp",
  "angle": "obverse" | "reverse" | "edge" | "slab" | "multiple" | "unknown",
  "hasHolder": boolean,
  "holderType": "raw" | "flip" | "slab" | "capsule" | "album" | null,
  "visibleText": ["any text visible on item or holder"],
  "suggestions": ["suggestions to improve image for better identification"]
}`,
            },
          ],
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    return JSON.parse(content.text) as ImageAnalysisResult;
  } catch (error) {
    console.error("Image analysis error:", error);
    return {
      quality: "fair",
      lighting: "good",
      focus: "acceptable",
      angle: "unknown",
      hasHolder: false,
      holderType: null,
      visibleText: [],
      suggestions: ["Unable to analyze image quality"],
    };
  }
}

/**
 * Identify a coin from images
 */
export async function identifyCoin(
  images: string[],
  existingInfo?: { title?: string; description?: string }
): Promise<{ identification: CoinIdentification; confidence: number }> {
  const imageContent = images.slice(0, 4).map((img) => ({
    type: "image" as const,
    source: {
      type: "base64" as const,
      media_type: "image/jpeg" as const,
      data: img,
    },
  }));

  const contextText = existingInfo
    ? `\n\nExisting information:\nTitle: ${existingInfo.title || "N/A"}\nDescription: ${existingInfo.description || "N/A"}`
    : "";

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: [
            ...imageContent,
            {
              type: "text",
              text: `You are an expert numismatist. Identify this coin from the provided images.${contextText}

Analyze the coin and provide identification in JSON format:
{
  "country": "country of origin",
  "denomination": "face value and currency",
  "year": number or null,
  "mint": "mint name" or null,
  "mintMark": "mint mark letter/symbol" or null,
  "variety": "any notable variety" or null,
  "composition": "metal composition",
  "metalType": "gold" | "silver" | "platinum" | "palladium" | "copper" | "none",
  "weight": weight in grams or null,
  "diameter": diameter in mm or null,
  "catalogNumber": "Krause KM# or similar" or null,
  "pcgsNumber": "PCGS coin number" or null,
  "ngcNumber": "NGC coin number" or null,
  "commonName": "common collector name for this coin",
  "series": "coin series name" or null,
  "confidence": 0.0-1.0
}

Be specific about the exact type, date, and variety. If you can see certification holder text, include that information.`,
            },
          ],
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    const result = JSON.parse(content.text);
    const { confidence, ...identification } = result;

    return {
      identification: identification as CoinIdentification,
      confidence: confidence || 0.5,
    };
  } catch (error) {
    console.error("Coin identification error:", error);
    return {
      identification: {
        country: "Unknown",
        denomination: "Unknown",
        year: null,
        mint: null,
        mintMark: null,
        variety: null,
        composition: null,
        metalType: "none",
        weight: null,
        diameter: null,
        catalogNumber: null,
        pcgsNumber: null,
        ngcNumber: null,
        commonName: "Unidentified Coin",
        series: null,
      },
      confidence: 0,
    };
  }
}

/**
 * Identify a trading card from images
 */
export async function identifyCard(
  images: string[],
  existingInfo?: { title?: string; description?: string }
): Promise<{ identification: CardIdentification; confidence: number }> {
  const imageContent = images.slice(0, 4).map((img) => ({
    type: "image" as const,
    source: {
      type: "base64" as const,
      media_type: "image/jpeg" as const,
      data: img,
    },
  }));

  const contextText = existingInfo
    ? `\n\nExisting information:\nTitle: ${existingInfo.title || "N/A"}\nDescription: ${existingInfo.description || "N/A"}`
    : "";

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: [
            ...imageContent,
            {
              type: "text",
              text: `You are an expert trading card collector and grader. Identify this card from the provided images.${contextText}

Analyze the card and provide identification in JSON format:
{
  "sport": "baseball" | "basketball" | "football" | "hockey" | "pokemon" | "magic" | "yugioh" | "other" | null,
  "year": number or null,
  "manufacturer": "Topps" | "Panini" | "Upper Deck" | etc. or null,
  "setName": "exact set name" or null,
  "cardNumber": "card number in set" or null,
  "playerName": "player/character name" or null,
  "team": "team name" or null,
  "parallel": "parallel variant name" or null,
  "insert": "insert set name" or null,
  "autograph": boolean,
  "memorabilia": boolean,
  "serialNumber": "serial number like 25/99" or null,
  "rookieCard": boolean,
  "confidence": 0.0-1.0
}

Be specific about the exact set, parallel, and any special features. Look for RC logos, serial numbers, and autographs.`,
            },
          ],
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    const result = JSON.parse(content.text);
    const { confidence, ...identification } = result;

    return {
      identification: identification as CardIdentification,
      confidence: confidence || 0.5,
    };
  } catch (error) {
    console.error("Card identification error:", error);
    return {
      identification: {
        sport: null,
        year: null,
        manufacturer: null,
        setName: null,
        cardNumber: null,
        playerName: null,
        team: null,
        parallel: null,
        insert: null,
        autograph: false,
        memorabilia: false,
        serialNumber: null,
        rookieCard: false,
      },
      confidence: 0,
    };
  }
}

/**
 * Detect product category from images
 */
export async function detectCategory(
  images: string[]
): Promise<{ category: ProductCategory; confidence: number }> {
  const imageContent = images.slice(0, 2).map((img) => ({
    type: "image" as const,
    source: {
      type: "base64" as const,
      media_type: "image/jpeg" as const,
      data: img,
    },
  }));

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: [
            ...imageContent,
            {
              type: "text",
              text: `Categorize this collectible item. Respond with JSON only:
{
  "category": "coin" | "card" | "bullion" | "currency" | "collectible",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}

Categories:
- coin: Numismatic coins (collectible coins, not bullion)
- card: Trading cards, sports cards, TCG cards
- bullion: Precious metal bars, rounds, or modern bullion coins
- currency: Paper money, banknotes
- collectible: Other collectibles`,
            },
          ],
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    const result = JSON.parse(content.text);
    return {
      category: result.category as ProductCategory,
      confidence: result.confidence || 0.5,
    };
  } catch (error) {
    console.error("Category detection error:", error);
    return {
      category: "collectible",
      confidence: 0,
    };
  }
}

/**
 * Main identification function - detects category and identifies product
 */
export async function identifyProduct(
  images: string[],
  existingInfo?: { title?: string; description?: string; category?: ProductCategory }
): Promise<ProductIdentificationResult> {
  if (images.length === 0) {
    return {
      category: "collectible",
      confidence: 0,
      coin: null,
      card: null,
      rawDescription: "",
      suggestedTitle: "Unknown Item",
      suggestedCategory: "Collectibles",
      keyFeatures: [],
      warnings: ["No images provided for identification"],
    };
  }

  // Determine category
  let category: ProductCategory = existingInfo?.category || "collectible";
  let categoryConfidence = existingInfo?.category ? 1 : 0;

  if (!existingInfo?.category) {
    const detected = await detectCategory(images);
    category = detected.category;
    categoryConfidence = detected.confidence;
  }

  // Identify based on category
  let coinIdentification: CoinIdentification | null = null;
  let cardIdentification: CardIdentification | null = null;
  let itemConfidence = 0;

  if (category === "coin" || category === "bullion") {
    const result = await identifyCoin(images, existingInfo);
    coinIdentification = result.identification;
    itemConfidence = result.confidence;
  } else if (category === "card") {
    const result = await identifyCard(images, existingInfo);
    cardIdentification = result.identification;
    itemConfidence = result.confidence;
  }

  // Generate suggested title and features
  const { title, features, warnings } = generateTitleAndFeatures(
    category,
    coinIdentification,
    cardIdentification
  );

  return {
    category,
    confidence: Math.min(categoryConfidence, itemConfidence) || itemConfidence || categoryConfidence,
    coin: coinIdentification,
    card: cardIdentification,
    rawDescription: existingInfo?.description || "",
    suggestedTitle: existingInfo?.title || title,
    suggestedCategory: mapCategoryToStore(category),
    keyFeatures: features,
    warnings,
  };
}

/**
 * Generate title and key features from identification
 */
function generateTitleAndFeatures(
  category: ProductCategory,
  coin: CoinIdentification | null,
  card: CardIdentification | null
): { title: string; features: string[]; warnings: string[] } {
  const features: string[] = [];
  const warnings: string[] = [];

  if (category === "coin" && coin) {
    const parts: string[] = [];
    if (coin.year) parts.push(coin.year.toString());
    if (coin.mintMark) parts.push(`${coin.mintMark}`);
    parts.push(coin.commonName || coin.denomination);
    if (coin.variety) parts.push(coin.variety);

    const title = parts.join(" ");

    if (coin.metalType && coin.metalType !== "none") features.push(`${coin.metalType.toUpperCase()} coin`);
    if (coin.mint) features.push(`Minted at ${coin.mint}`);
    if (coin.catalogNumber) features.push(`Catalog: ${coin.catalogNumber}`);
    if (coin.series) features.push(`Series: ${coin.series}`);
    if (coin.weight) features.push(`Weight: ${coin.weight}g`);

    if (!coin.year) warnings.push("Date not identified");
    if (!coin.mintMark && coin.country === "United States") {
      warnings.push("Mint mark not identified - verify manually");
    }

    return { title, features, warnings };
  }

  if (category === "card" && card) {
    const parts: string[] = [];
    if (card.year) parts.push(card.year.toString());
    if (card.manufacturer) parts.push(card.manufacturer);
    if (card.setName) parts.push(card.setName);
    if (card.playerName) parts.push(card.playerName);
    if (card.cardNumber) parts.push(`#${card.cardNumber}`);
    if (card.parallel) parts.push(card.parallel);

    const title = parts.join(" ");

    if (card.rookieCard) features.push("ROOKIE CARD");
    if (card.autograph) features.push("AUTOGRAPHED");
    if (card.memorabilia) features.push("GAME-USED MEMORABILIA");
    if (card.serialNumber) features.push(`Serial: ${card.serialNumber}`);
    if (card.parallel) features.push(`Parallel: ${card.parallel}`);
    if (card.insert) features.push(`Insert: ${card.insert}`);

    if (!card.year) warnings.push("Year not identified");
    if (!card.setName) warnings.push("Set not identified");

    return { title, features, warnings };
  }

  return {
    title: "Unidentified Item",
    features: [],
    warnings: ["Unable to identify item - manual review required"],
  };
}

/**
 * Map internal category to store category name
 */
function mapCategoryToStore(category: ProductCategory): string {
  const categoryMap: Record<ProductCategory, string> = {
    coin: "US Coins",
    card: "Trading Cards",
    bullion: "Bullion",
    currency: "Currency",
    collectible: "Collectibles",
  };
  return categoryMap[category] || "Collectibles";
}

/**
 * Verify certification from slab images
 */
export async function verifyCertification(
  images: string[]
): Promise<{
  hasCertification: boolean;
  service: string | null;
  certNumber: string | null;
  grade: string | null;
  confidence: number;
}> {
  const imageContent = images.slice(0, 2).map((img) => ({
    type: "image" as const,
    source: {
      type: "base64" as const,
      media_type: "image/jpeg" as const,
      data: img,
    },
  }));

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: [
            ...imageContent,
            {
              type: "text",
              text: `Look for any third-party certification holder (slab) on this collectible.

If you see a certification holder, extract the information. Common services:
- Coins: PCGS, NGC, ANACS, ICG
- Cards: PSA, BGS, SGC, CGC

Respond with JSON only:
{
  "hasCertification": boolean,
  "service": "PCGS" | "NGC" | "PSA" | "BGS" | etc. or null,
  "certNumber": "certification number" or null,
  "grade": "grade shown on label" or null,
  "confidence": 0.0-1.0
}`,
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
    console.error("Certification verification error:", error);
    return {
      hasCertification: false,
      service: null,
      certNumber: null,
      grade: null,
      confidence: 0,
    };
  }
}
