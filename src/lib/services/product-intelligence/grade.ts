/**
 * Condition Grading Service
 * Uses Claude Vision to estimate grades for coins and cards
 */

import Anthropic from "@anthropic-ai/sdk";
import type {
  ProductCategory,
  ProductGradeResult,
  CoinGrade,
  CardGrade,
  CoinIdentification,
  CardIdentification,
} from "./types";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Grade a coin from images using the Sheldon scale
 */
export async function gradeCoin(
  images: string[],
  identification?: CoinIdentification
): Promise<{ grade: CoinGrade; confidence: number }> {
  const imageContent = images.slice(0, 4).map((img) => ({
    type: "image" as const,
    source: {
      type: "base64" as const,
      media_type: "image/jpeg" as const,
      data: img,
    },
  }));

  const contextText = identification
    ? `\n\nCoin identified as: ${identification.commonName} (${identification.year || "date unknown"})`
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
              text: `You are an expert coin grader. Evaluate this coin's condition using the Sheldon 1-70 scale.${contextText}

Consider:
1. Wear patterns on high points
2. Luster remaining
3. Strike quality
4. Surface marks, scratches, or cleaning
5. Eye appeal

Grade Categories:
- Poor (P-1): Barely identifiable
- Fair (FR-2): Mostly worn smooth
- About Good (AG-3): Very heavily worn
- Good (G-4, G-6): Major design visible, details worn
- Very Good (VG-8, VG-10): Design clear, some detail
- Fine (F-12, F-15): Moderate wear on high points
- Very Fine (VF-20 to VF-35): Light wear on high points
- Extremely Fine (EF-40, EF-45): Slight wear on highest points
- About Uncirculated (AU-50 to AU-58): Trace wear, most luster
- Mint State (MS-60 to MS-70): No wear, varying quality
- Proof (PR/PF-60 to PR-70): Special strike, mirror fields

For Proofs, also evaluate:
- Cameo contrast (none, cameo, deep cameo)
- Hairlines and handling marks

Respond with JSON only:
{
  "numericGrade": number (1-70) or null if cannot determine,
  "adjectivalGrade": "e.g., MS65, VF30, PR69DCAM",
  "details": "Cleaned", "Scratched", etc. or null if problem-free,
  "isDetailsGrade": boolean (true if coin has issues preventing straight grade),
  "strike": "weak" | "average" | "strong" | "full" | null,
  "luster": "poor" | "below_average" | "average" | "above_average" | "exceptional" | null,
  "surfaces": "impaired" | "average" | "above_average" | "exceptional" | null,
  "eyeAppeal": "negative" | "neutral" | "positive" | "exceptional" | null,
  "color": "original", "toned", etc. or null,
  "cameo": "none" | "cameo" | "deep_cameo" | null (for proofs only),
  "confidence": 0.0-1.0,
  "gradeNotes": "brief explanation of grade determination"
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

    const result = JSON.parse(content.text);
    const { confidence, gradeNotes, ...grade } = result;

    return {
      grade: grade as CoinGrade,
      confidence: confidence || 0.5,
    };
  } catch (error) {
    console.error("Coin grading error:", error);
    return {
      grade: {
        numericGrade: null,
        adjectivalGrade: "Unable to grade",
        details: null,
        isDetailsGrade: false,
        strike: null,
        luster: null,
        surfaces: null,
        eyeAppeal: null,
        color: null,
        cameo: null,
      },
      confidence: 0,
    };
  }
}

/**
 * Grade a trading card from images
 */
export async function gradeCard(
  images: string[],
  identification?: CardIdentification
): Promise<{ grade: CardGrade; confidence: number }> {
  const imageContent = images.slice(0, 4).map((img) => ({
    type: "image" as const,
    source: {
      type: "base64" as const,
      media_type: "image/jpeg" as const,
      data: img,
    },
  }));

  const contextText = identification
    ? `\n\nCard identified as: ${identification.playerName || "Unknown"} - ${identification.setName || "Unknown Set"}`
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
              text: `You are an expert trading card grader. Evaluate this card's condition on a 1-10 scale.${contextText}

Consider these four components (each graded 1-10):
1. CENTERING: Border symmetry on front and back
   - 10: 50/50 or 55/45 all sides
   - 9: 55/45 to 60/40
   - 8: 65/35
   - 7: 70/30
   - Below 7: Significant off-center

2. CORNERS: Sharpness of all four corners
   - 10: Perfect, sharp corners
   - 9: Very slight wear
   - 8: Minor wear visible under magnification
   - 7: Slight fraying/wear visible to naked eye
   - Below 7: Noticeable wear, dings, or rounding

3. EDGES: Condition of all four edges
   - 10: Perfect, clean edges
   - 9: Very minor imperfections
   - 8: Minor chipping or wear
   - 7: Light wear or small chips
   - Below 7: Significant wear, chips, or damage

4. SURFACE: Front and back surface condition
   - 10: No print defects, scratches, or issues
   - 9: Very minor surface issues
   - 8: Light scratches or minor print issues
   - 7: Moderate surface wear
   - Below 7: Creases, stains, or significant damage

For autographed cards, also evaluate the auto quality (1-10).

Respond with JSON only:
{
  "numericGrade": number (1-10) or null,
  "subgrades": {
    "centering": number (1-10) or null,
    "corners": number (1-10) or null,
    "edges": number (1-10) or null,
    "surface": number (1-10) or null
  },
  "qualifier": "authentic" | "altered" | "trimmed" | null,
  "auto": number (1-10) or null if not autographed,
  "confidence": 0.0-1.0,
  "gradeNotes": "brief explanation of grade determination"
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

    const result = JSON.parse(content.text);
    const { confidence, gradeNotes, ...grade } = result;

    return {
      grade: grade as CardGrade,
      confidence: confidence || 0.5,
    };
  } catch (error) {
    console.error("Card grading error:", error);
    return {
      grade: {
        numericGrade: null,
        subgrades: null,
        qualifier: null,
        auto: null,
      },
      confidence: 0,
    };
  }
}

/**
 * Get grade range estimate with low/high bounds
 */
function getGradeRange(
  category: ProductCategory,
  coinGrade: CoinGrade | null,
  cardGrade: CardGrade | null,
  confidence: number
): { low: string; high: string } {
  if (category === "coin" && coinGrade?.numericGrade) {
    const grade = coinGrade.numericGrade;
    const variance = Math.round((1 - confidence) * 5); // Higher uncertainty = wider range
    const low = Math.max(1, grade - variance);
    const high = Math.min(70, grade + variance);
    return {
      low: formatCoinGrade(low, coinGrade.isDetailsGrade, coinGrade.cameo),
      high: formatCoinGrade(high, coinGrade.isDetailsGrade, coinGrade.cameo),
    };
  }

  if (category === "card" && cardGrade?.numericGrade) {
    const grade = cardGrade.numericGrade;
    const variance = Math.round((1 - confidence) * 1.5);
    const low = Math.max(1, grade - variance);
    const high = Math.min(10, grade + variance);
    return {
      low: low.toString(),
      high: high.toString(),
    };
  }

  return { low: "N/A", high: "N/A" };
}

/**
 * Format coin grade to standard notation
 */
function formatCoinGrade(
  numericGrade: number,
  isDetails: boolean,
  cameo: CoinGrade["cameo"]
): string {
  let prefix: string;

  if (numericGrade >= 60) {
    prefix = "MS";
  } else if (numericGrade >= 50) {
    prefix = "AU";
  } else if (numericGrade >= 40) {
    prefix = "EF";
  } else if (numericGrade >= 20) {
    prefix = "VF";
  } else if (numericGrade >= 12) {
    prefix = "F";
  } else if (numericGrade >= 8) {
    prefix = "VG";
  } else if (numericGrade >= 4) {
    prefix = "G";
  } else if (numericGrade >= 3) {
    prefix = "AG";
  } else if (numericGrade >= 2) {
    prefix = "FR";
  } else {
    prefix = "P";
  }

  let gradeStr = `${prefix}-${numericGrade}`;

  if (isDetails) {
    gradeStr += " Details";
  }

  if (cameo === "deep_cameo") {
    gradeStr = gradeStr.replace("MS", "PR") + "DCAM";
  } else if (cameo === "cameo") {
    gradeStr = gradeStr.replace("MS", "PR") + "CAM";
  }

  return gradeStr;
}

/**
 * Determine if certification is recommended
 */
function shouldRecommendCertification(
  category: ProductCategory,
  coinGrade: CoinGrade | null,
  cardGrade: CardGrade | null,
  identification: CoinIdentification | CardIdentification | null
): { recommended: boolean; service: string | null; reasoning: string } {
  if (category === "coin" && coinGrade) {
    const grade = coinGrade.numericGrade || 0;

    // High-grade coins benefit from certification
    if (grade >= 63) {
      return {
        recommended: true,
        service: "PCGS",
        reasoning: "High-grade coins command premium when certified",
      };
    }

    // Key date coins should be certified
    if (identification && "year" in identification) {
      const coin = identification as CoinIdentification;
      // This would ideally check against a key date database
      if (coin.year && coin.year < 1933 && grade >= 50) {
        return {
          recommended: true,
          service: "PCGS",
          reasoning: "Pre-1933 coins in AU+ condition benefit from authentication",
        };
      }
    }

    // Details coins may not be worth certifying
    if (coinGrade.isDetailsGrade) {
      return {
        recommended: false,
        service: null,
        reasoning: "Details grade coins have limited certification premium",
      };
    }
  }

  if (category === "card" && cardGrade) {
    const grade = cardGrade.numericGrade || 0;

    // High-grade cards benefit from certification
    if (grade >= 8) {
      return {
        recommended: true,
        service: "PSA",
        reasoning: "Cards grading 8+ command significant premium when slabbed",
      };
    }

    // Autographed cards should be certified
    if (cardGrade.auto && cardGrade.auto >= 7) {
      return {
        recommended: true,
        service: "PSA",
        reasoning: "Autographed cards benefit from authentication",
      };
    }
  }

  return {
    recommended: false,
    service: null,
    reasoning: "Certification may not provide sufficient return on investment",
  };
}

/**
 * Main grading function - grades product based on category
 */
export async function gradeProduct(
  images: string[],
  category: ProductCategory,
  identification?: CoinIdentification | CardIdentification
): Promise<ProductGradeResult> {
  if (images.length === 0) {
    return {
      category,
      confidence: 0,
      coinGrade: null,
      cardGrade: null,
      estimatedGrade: "Unable to grade - no images",
      gradeRange: { low: "N/A", high: "N/A" },
      conditionNotes: ["No images provided for grading"],
      certificationRecommended: false,
      certificationService: null,
    };
  }

  let coinGrade: CoinGrade | null = null;
  let cardGrade: CardGrade | null = null;
  let confidence = 0;
  const conditionNotes: string[] = [];

  if (category === "coin" || category === "bullion") {
    const result = await gradeCoin(images, identification as CoinIdentification);
    coinGrade = result.grade;
    confidence = result.confidence;

    // Add condition notes based on grade attributes
    if (coinGrade.details) {
      conditionNotes.push(`Problem: ${coinGrade.details}`);
    }
    if (coinGrade.strike && coinGrade.strike !== "average") {
      conditionNotes.push(`Strike: ${coinGrade.strike}`);
    }
    if (coinGrade.luster && coinGrade.luster !== "average") {
      conditionNotes.push(`Luster: ${coinGrade.luster.replace("_", " ")}`);
    }
    if (coinGrade.color) {
      conditionNotes.push(`Toning: ${coinGrade.color}`);
    }
    if (coinGrade.cameo && coinGrade.cameo !== "none") {
      conditionNotes.push(`Cameo: ${coinGrade.cameo.replace("_", " ")}`);
    }
  } else if (category === "card") {
    const result = await gradeCard(images, identification as CardIdentification);
    cardGrade = result.grade;
    confidence = result.confidence;

    // Add condition notes based on subgrades
    if (cardGrade.subgrades) {
      const { centering, corners, edges, surface } = cardGrade.subgrades;
      if (centering && centering < 8) conditionNotes.push(`Centering: ${centering}/10`);
      if (corners && corners < 8) conditionNotes.push(`Corners: ${corners}/10`);
      if (edges && edges < 8) conditionNotes.push(`Edges: ${edges}/10`);
      if (surface && surface < 8) conditionNotes.push(`Surface: ${surface}/10`);
    }
    if (cardGrade.qualifier) {
      conditionNotes.push(`Qualifier: ${cardGrade.qualifier}`);
    }
    if (cardGrade.auto) {
      conditionNotes.push(`Auto grade: ${cardGrade.auto}/10`);
    }
  }

  // Get grade range
  const gradeRange = getGradeRange(category, coinGrade, cardGrade, confidence);

  // Determine estimated grade string
  let estimatedGrade = "Unable to grade";
  if (coinGrade?.adjectivalGrade) {
    estimatedGrade = coinGrade.adjectivalGrade;
  } else if (cardGrade?.numericGrade) {
    estimatedGrade = cardGrade.numericGrade.toString();
  }

  // Check if certification is recommended
  const certRecommendation = shouldRecommendCertification(
    category,
    coinGrade,
    cardGrade,
    identification || null
  );

  if (certRecommendation.reasoning) {
    conditionNotes.push(`Certification note: ${certRecommendation.reasoning}`);
  }

  return {
    category,
    confidence,
    coinGrade,
    cardGrade,
    estimatedGrade,
    gradeRange,
    conditionNotes,
    certificationRecommended: certRecommendation.recommended,
    certificationService: certRecommendation.service,
  };
}

/**
 * Quick grade check - faster but less detailed
 */
export async function quickGradeCheck(
  images: string[],
  category: ProductCategory
): Promise<{ grade: string; confidence: number }> {
  const imageContent = images.slice(0, 2).map((img) => ({
    type: "image" as const,
    source: {
      type: "base64" as const,
      media_type: "image/jpeg" as const,
      data: img,
    },
  }));

  const gradeScale =
    category === "card"
      ? "1-10 scale (PSA/BGS style)"
      : "Sheldon 1-70 scale (MS65, VF30, etc.)";

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
              text: `Quick grade assessment. Use ${gradeScale}.

Respond with JSON only:
{
  "grade": "grade in standard notation",
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
    console.error("Quick grade check error:", error);
    return { grade: "Unknown", confidence: 0 };
  }
}
