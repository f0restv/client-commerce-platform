import Anthropic from '@anthropic-ai/sdk';
import type { CollectibleCategory, GradeEstimate } from './types';
import {
  generateAdaptiveGradingPrompt,
  generateQuickGradingPrompt,
  detectCoinType,
  type CoinType,
} from './grading-criteria';
import {
  hasReferenceImages,
  loadReferenceImages,
  selectComparisonImages,
  buildReferenceImageBlocks,
  generateReferenceComparisonSection,
  type ReferenceImageSet,
} from './reference-images';

const anthropic = new Anthropic();

const GRADING_PROMPTS: Record<string, string> = {
  // Coin grading now uses the adaptive system from grading-criteria.ts
  // This is kept as a fallback for generic coins
  coin: generateQuickGradingPrompt(),

  'sports-card': `You are an expert sports card grader familiar with PSA, BGS, and SGC standards.

Analyze the provided card image(s) and estimate the grade. Consider:
- CENTERING: Left/right and top/bottom alignment
- CORNERS: Sharpness, wear, dings
- EDGES: Chipping, roughness, wear
- SURFACES: Print quality, scratches, creases, staining

Provide your assessment as JSON:
{
  "grade": "PSA 9" or "BGS 9.5" etc.,
  "numericGrade": 9 (numeric only),
  "confidence": 0.0 to 1.0,
  "notes": "Detailed explanation of grade factors",
  "surfaces": "Print quality, scratches, creases assessment",
  "centering": "50/50 or 60/40 etc. for both axes",
  "corners": "Assessment of all four corners",
  "edges": "Assessment of edge condition"
}`,

  default: `You are an expert collectibles grader.

Analyze the provided image(s) and estimate the condition grade. Consider all visible flaws, wear, and condition factors relevant to this type of item.

Provide your assessment as JSON:
{
  "grade": "Near Mint" or "Very Fine" or appropriate grade for item type,
  "numericGrade": numeric equivalent if applicable, or null,
  "confidence": 0.0 to 1.0,
  "notes": "Detailed explanation of condition factors",
  "surfaces": "Assessment of surface condition",
  "centering": "If applicable, otherwise 'N/A'"
}`,
};

export interface GradeOptions {
  /** For coins: provide identification string to get coin-specific grading criteria */
  coinIdentification?: string;
  /** Enable visual comparison against reference images (default: true if available) */
  useVisualComparison?: boolean;
  /** Preliminary grade estimate for selecting optimal reference images */
  preliminaryGrade?: number;
}

export async function estimateGrade(
  images: Array<{ type: 'url'; url: string } | { type: 'base64'; data: string; mediaType: string }>,
  category: CollectibleCategory,
  options?: GradeOptions
): Promise<GradeEstimate> {
  if (images.length === 0) {
    throw new Error('At least one image is required for grading');
  }

  // Determine coin type and whether to use visual comparison
  let coinType: CoinType | null = null;
  let referenceSet: ReferenceImageSet | null = null;

  if (category === 'coin' && options?.coinIdentification) {
    coinType = detectCoinType(options.coinIdentification);

    // Load reference images if visual comparison is enabled and available
    const useVisual = options?.useVisualComparison !== false;
    if (useVisual && hasReferenceImages(coinType)) {
      if (options?.preliminaryGrade) {
        // Use preliminary grade to select optimal comparison images
        referenceSet = selectComparisonImages(coinType, options.preliminaryGrade, 6);
      } else {
        // Load general reference images spanning key grades
        referenceSet = loadReferenceImages(coinType, {
          gradeRange: 'all',
          maxImages: 6,
          includeBase64: true,
        });
      }
    }
  }

  // Build prompt with or without visual comparison
  let prompt: string;
  if (category === 'coin' && options?.coinIdentification) {
    prompt = generateAdaptiveGradingPrompt(options.coinIdentification);

    // Add visual comparison instructions if reference images are available
    if (referenceSet && referenceSet.referenceImages.length > 0) {
      prompt = generateVisualComparisonPrompt(options.coinIdentification, referenceSet);
    }
  } else {
    prompt = GRADING_PROMPTS[category] || GRADING_PROMPTS.default;
  }

  // Build image content array
  const contentBlocks: Anthropic.ContentBlockParam[] = [];

  // Add reference images first (if available) with labels
  if (referenceSet && referenceSet.referenceImages.length > 0) {
    const refBlocks = buildReferenceImageBlocks(referenceSet);

    // Add a text label before reference images
    contentBlocks.push({
      type: 'text',
      text: `=== PCGS PHOTOGRADE REFERENCE IMAGES (${referenceSet.displayName}) ===\nThe following are authenticated reference images at known grades:`,
    });

    for (const refBlock of refBlocks) {
      contentBlocks.push({
        type: 'text',
        text: refBlock.label,
      });
      contentBlocks.push(refBlock.imageBlock as Anthropic.ContentBlockParam);
    }

    contentBlocks.push({
      type: 'text',
      text: `\n=== COIN TO GRADE (SUBMITTED BY USER) ===\nNow examine the following coin and compare it to the reference images above:`,
    });
  }

  // Add submitted coin images
  for (const img of images) {
    if (img.type === 'url') {
      contentBlocks.push({
        type: 'image' as const,
        source: {
          type: 'url' as const,
          url: img.url,
        },
      });
    } else {
      contentBlocks.push({
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: img.mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
          data: img.data,
        },
      });
    }
  }

  // Add the grading prompt
  contentBlocks.push({
    type: 'text',
    text: prompt,
  });

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    messages: [
      {
        role: 'user',
        content: contentBlocks,
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response received from Claude');
  }

  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse grading response as JSON');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    grade: parsed.grade || 'Unknown',
    numericGrade: typeof parsed.numericGrade === 'number' ? parsed.numericGrade : null,
    confidence: typeof parsed.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : 0.5,
    notes: parsed.notes || '',
    surfaces: parsed.surfaces || '',
    centering: parsed.centering || 'N/A',
    corners: parsed.corners,
    edges: parsed.edges,
    strike: parsed.strike,
    luster: parsed.luster,
    // Add visual comparison metadata
    visualComparisonUsed: referenceSet !== null && referenceSet.referenceImages.length > 0,
    referenceGradesCompared: referenceSet?.selectedGrades || [],
  };
}

/**
 * Generate a prompt that incorporates visual comparison with reference images
 */
function generateVisualComparisonPrompt(identification: string, referenceSet: ReferenceImageSet): string {
  const coinType = detectCoinType(identification);
  const basePrompt = generateAdaptiveGradingPrompt(identification);
  const comparisonSection = generateReferenceComparisonSection(referenceSet);

  return `${basePrompt}

${comparisonSection}

IMPORTANT: You have been provided with authenticated PCGS Photograde reference images above.
Use these as your PRIMARY grading benchmark. Compare the submitted coin's wear, luster, and
surface quality DIRECTLY to these references.

Your response should include:
- Which reference grade the submitted coin most closely resembles
- Whether it's slightly better or worse than that reference
- Specific visual comparisons (e.g., "wear on cheek matches VF-30 reference")

Provide your assessment as JSON:
{
  "grade": "VF-30" etc. (Sheldon scale designation),
  "numericGrade": 30 (numeric only, 1-70),
  "confidence": 0.0 to 1.0,
  "closestReference": "VF-30" (which reference image is closest match),
  "comparisonNotes": "Detailed comparison to reference images",
  "notes": "Overall grading explanation",
  "surfaces": "Surface condition assessment",
  "strike": "Strike quality (weak, average, strong, full)",
  "luster": "Luster assessment (percentage and quality)",
  "eyeAppeal": "Overall visual impression",
  "wearPoints": {
    "obverse": "Specific observations on obverse wear points",
    "reverse": "Specific observations on reverse wear points"
  },
  "problems": [] or ["cleaned", "whizzed", etc.],
  "detailsGrade": null or "Cleaned" etc. if problems detected
}`;
}

/**
 * Two-pass grading: first get a quick estimate, then do detailed comparison
 * with reference images around that grade
 */
export async function estimateGradeWithTwoPass(
  images: Array<{ type: 'url'; url: string } | { type: 'base64'; data: string; mediaType: string }>,
  category: CollectibleCategory,
  options?: Omit<GradeOptions, 'preliminaryGrade'>
): Promise<GradeEstimate> {
  // First pass: quick grade estimate without reference images
  const quickEstimate = await estimateGrade(images, category, {
    ...options,
    useVisualComparison: false,
  });

  // If not a coin or no valid grade, return quick estimate
  if (category !== 'coin' || !quickEstimate.numericGrade) {
    return quickEstimate;
  }

  // Second pass: detailed comparison with reference images around the estimated grade
  const detailedEstimate = await estimateGrade(images, category, {
    ...options,
    useVisualComparison: true,
    preliminaryGrade: quickEstimate.numericGrade,
  });

  return detailedEstimate;
}
