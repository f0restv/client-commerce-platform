import Anthropic from '@anthropic-ai/sdk';
import type { CollectibleCategory, GradeEstimate } from './types';

const anthropic = new Anthropic();

const GRADING_PROMPTS: Record<string, string> = {
  coin: `You are an expert numismatist with decades of experience grading coins using the Sheldon scale.

Analyze the provided coin image(s) and estimate the grade. Consider:
- SURFACES: Scratches, hairlines, cleaning, environmental damage, contact marks
- LUSTER: Original mint luster, cartwheel effect, toning
- STRIKE: Sharpness of details, weakness in high points
- EYE APPEAL: Overall visual impression

Provide your assessment as JSON:
{
  "grade": "MS-65" or "AU-58" etc. (Sheldon scale designation),
  "numericGrade": 65 (numeric only),
  "confidence": 0.0 to 1.0,
  "notes": "Detailed explanation of grade factors",
  "surfaces": "Description of surface condition",
  "centering": "N/A for coins",
  "strike": "Assessment of strike quality",
  "luster": "Assessment of remaining luster"
}`,

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

export async function estimateGrade(
  images: Array<{ type: 'url'; url: string } | { type: 'base64'; data: string; mediaType: string }>,
  category: CollectibleCategory
): Promise<GradeEstimate> {
  if (images.length === 0) {
    throw new Error('At least one image is required for grading');
  }

  const prompt = GRADING_PROMPTS[category] || GRADING_PROMPTS.default;

  const imageContent: Anthropic.ImageBlockParam[] = images.map((img) => {
    if (img.type === 'url') {
      return {
        type: 'image' as const,
        source: {
          type: 'url' as const,
          url: img.url,
        },
      };
    }
    return {
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: img.mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
        data: img.data,
      },
    };
  });

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          ...imageContent,
          {
            type: 'text',
            text: prompt,
          },
        ],
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
  };
}
