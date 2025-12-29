import Anthropic from '@anthropic-ai/sdk';
import { ImageAnalysis, ImageIssue } from './types';

let anthropicClientInstance: Anthropic | null = null;

/**
 * Get or create Anthropic client with validation
 */
function getAnthropicClient(): Anthropic {
  if (anthropicClientInstance) {
    return anthropicClientInstance;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Missing ANTHROPIC_API_KEY environment variable. ' +
        'Please set this before using image analysis.'
    );
  }

  anthropicClientInstance = new Anthropic({ apiKey });
  return anthropicClientInstance;
}

/**
 * Validate Claude response matches ImageAnalysis schema
 */
function validateImageAnalysis(data: unknown): ImageAnalysis {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Invalid response: expected object');
  }

  const obj = data as Record<string, unknown>;

  if (!Array.isArray(obj.issues)) {
    throw new Error('Invalid response: issues must be an array');
  }

  if (
    !['poor', 'fair', 'good', 'excellent'].includes(
      obj.overallQuality as string
    )
  ) {
    throw new Error('Invalid response: overallQuality must be a valid value');
  }

  if (!Array.isArray(obj.recommendations)) {
    throw new Error('Invalid response: recommendations must be an array');
  }

  // Validate each issue
  const issues: ImageIssue[] = obj.issues.map((issue: unknown, idx: number) => {
    if (typeof issue !== 'object' || issue === null) {
      throw new Error(`Invalid issue at index ${idx}`);
    }

    const issueObj = issue as Record<string, unknown>;
    const validTypes = ['dust', 'scratch', 'lighting', 'background', 'color_cast'];
    const validSeverities = ['low', 'medium', 'high'];

    if (!validTypes.includes(issueObj.type as string)) {
      throw new Error(`Invalid issue type at index ${idx}: ${issueObj.type}`);
    }

    if (!validSeverities.includes(issueObj.severity as string)) {
      throw new Error(
        `Invalid issue severity at index ${idx}: ${issueObj.severity}`
      );
    }

    if (typeof issueObj.description !== 'string') {
      throw new Error(`Invalid issue description at index ${idx}`);
    }

    return {
      type: issueObj.type as ImageIssue['type'],
      severity: issueObj.severity as ImageIssue['severity'],
      description: issueObj.description,
    };
  });

  return {
    issues,
    overallQuality: obj.overallQuality as ImageAnalysis['overallQuality'],
    recommendations: obj.recommendations as string[],
  };
}

export interface AnalysisResult {
  success: boolean;
  data?: ImageAnalysis;
  error?: string;
}

/**
 * Analyze an image using Claude Vision to detect quality issues
 * IMPORTANT: Only identifies existing problems, never suggests adding details
 */
export async function analyzeImage(
  imageBuffer: Buffer,
  mimeType: string = 'image/jpeg'
): Promise<AnalysisResult> {
  try {
    const base64Image = imageBuffer.toString('base64');
    const anthropic = getAnthropicClient();

    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                data: base64Image,
              },
            },
            {
              type: 'text',
              text: `Analyze this product image for quality issues. Focus ONLY on problems that exist in the image:

1. **Dust spots** - visible dust, dirt, or debris on the item or lens
2. **Scratches** - visible scratches, scuffs, or damage to the item
3. **Poor lighting** - harsh shadows, overexposure, underexposure, uneven lighting
4. **Busy/distracting background** - cluttered or distracting backgrounds that draw attention from the item
5. **Color cast** - unnatural color tints (too yellow, blue, green, etc.)

For each issue found, provide:
- Type: dust, scratch, lighting, background, or color_cast
- Severity: low, medium, or high
- Description: brief explanation of the specific issue

DO NOT suggest adding details, props, or elements that aren't present.
DO NOT critique composition or styling choices unless they significantly impact quality.

Respond ONLY with valid JSON in this exact format (no markdown, no code blocks):
{
  "issues": [
    {
      "type": "dust|scratch|lighting|background|color_cast",
      "severity": "low|medium|high",
      "description": "specific description"
    }
  ],
  "overallQuality": "poor|fair|good|excellent",
  "recommendations": ["specific fixes for existing issues only"]
}`,
            },
          ],
        },
      ],
    });

    // Extract text content
    const textContent = message.content.find((block) => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    // Parse JSON - try to extract if wrapped in markdown
    let jsonText = textContent.text.trim();
    
    // Remove markdown code blocks if present
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/,'');
    }

    const parsed = JSON.parse(jsonText);
    const analysis = validateImageAnalysis(parsed);

    return {
      success: true,
      data: analysis,
    };
  } catch (error) {
    console.error('Error analyzing image with Claude:', error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown analysis error',
    };
  }
}

/**
 * Determine which enhancements should be applied based on analysis
 */
export function recommendEnhancements(analysisResult: AnalysisResult) {
  const enhancements = {
    autoLevels: false,
    whiteBalance: false,
    denoise: false,
    sharpen: false,
    removeBackground: false,
  };

  // If analysis failed, only apply basic sharpening
  if (!analysisResult.success || !analysisResult.data) {
    return { ...enhancements, sharpen: true };
  }

  const analysis = analysisResult.data;

  for (const issue of analysis.issues) {
    switch (issue.type) {
      case 'lighting':
        enhancements.autoLevels = true;
        break;
      case 'color_cast':
        enhancements.whiteBalance = true;
        break;
      case 'dust':
        if (issue.severity === 'low') {
          enhancements.denoise = true;
        }
        break;
      case 'background':
        if (issue.severity === 'high' || issue.severity === 'medium') {
          enhancements.removeBackground = true;
        }
        break;
    }
  }

  // Always apply light sharpening for web display
  enhancements.sharpen = true;

  return enhancements;
}
