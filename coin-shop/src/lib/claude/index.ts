import Anthropic from '@anthropic-ai/sdk';
import type { AIAnalysis } from '@/types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface AnalyzeItemParams {
  title: string;
  description: string;
  images: string[]; // Base64 or URLs
  category?: string;
}

export async function analyzeItem(params: AnalyzeItemParams): Promise<AIAnalysis> {
  const { title, description, images, category } = params;

  const systemPrompt = `You are an expert numismatist and coin dealer with decades of experience.
Your task is to analyze coin and collectible submissions to provide:
1. Item identification and authentication assessment
2. Grading estimate based on visible condition
3. Current market value estimates (low, average, high)
4. Average days to sell at various price points
5. Recent comparable sales data
6. Recommendations for the seller

Always be thorough but honest. If you cannot determine something from the images, say so.
Provide your response in valid JSON format.`;

  const userPrompt = `Please analyze this coin/collectible submission:

Title provided by seller: ${title}
Description: ${description}
Category: ${category || 'Not specified'}

Based on the images provided, please give me a comprehensive analysis in the following JSON format:
{
  "identified_item": "Full identification of the item",
  "confidence": 0.95,
  "estimated_value_low": 100,
  "estimated_value_high": 500,
  "estimated_value_avg": 300,
  "market_analysis": "Detailed analysis of current market conditions",
  "avg_days_to_sell": 14,
  "grading_estimate": "VF-35 to EF-40",
  "recent_sales": [
    {
      "platform": "eBay",
      "price": 275,
      "date": "2024-01-15",
      "condition": "VF-35"
    }
  ],
  "recommendations": [
    "Consider professional grading from PCGS or NGC",
    "Price competitively at $280-320 for quick sale"
  ]
}`;

  try {
    // Build content array with images
    const content: Anthropic.Messages.ContentBlockParam[] = [];

    // Add images first
    for (const image of images.slice(0, 4)) { // Max 4 images
      if (image.startsWith('data:')) {
        // Base64 image
        const [mediaType, base64Data] = parseBase64Image(image);
        content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
            data: base64Data,
          },
        });
      } else if (image.startsWith('http')) {
        // URL - fetch and convert to base64
        content.push({
          type: 'image',
          source: {
            type: 'url',
            url: image,
          },
        });
      }
    }

    // Add text prompt
    content.push({
      type: 'text',
      text: userPrompt,
    });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content,
        },
      ],
    });

    // Extract JSON from response
    const textContent = response.content.find((block) => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse JSON from response');
    }

    const analysis = JSON.parse(jsonMatch[0]) as AIAnalysis;
    analysis.raw_response = textContent.text;

    return analysis;
  } catch (error) {
    console.error('Claude analysis error:', error);
    throw new Error('Failed to analyze item with AI');
  }
}

function parseBase64Image(dataUrl: string): [string, string] {
  const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!matches) {
    throw new Error('Invalid base64 image format');
  }
  return [matches[1], matches[2]];
}

export async function generateListingDescription(
  item: { title: string; description: string; analysis?: AIAnalysis }
): Promise<string> {
  const prompt = `Generate a professional, engaging product listing description for a coin marketplace.

Item: ${item.title}
Seller's Description: ${item.description}
${item.analysis ? `AI Analysis: ${JSON.stringify(item.analysis)}` : ''}

Write a compelling description that:
1. Highlights key features and condition
2. Mentions any certifications or notable characteristics
3. Is professional yet engaging
4. Is SEO-friendly
5. Is 150-300 words

Do not make up facts. Only include information that is provided or can be inferred from the data.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const textContent = response.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  return textContent.text;
}

export async function comparePrices(
  item: { title: string; grade?: string; year?: number },
  currentPrice: number
): Promise<{
  recommendation: 'increase' | 'decrease' | 'maintain';
  suggestedPrice: number;
  reasoning: string;
}> {
  const prompt = `You are a coin pricing expert. Analyze this pricing:

Item: ${item.title}
Grade: ${item.grade || 'Unknown'}
Year: ${item.year || 'Unknown'}
Current Listed Price: $${currentPrice}

Based on your knowledge of the current coin market (as of late 2024), provide:
1. A recommendation to increase, decrease, or maintain the price
2. A suggested price
3. Brief reasoning

Respond in JSON format:
{
  "recommendation": "increase|decrease|maintain",
  "suggestedPrice": 350,
  "reasoning": "Brief explanation..."
}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const textContent = response.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not parse JSON from response');
  }

  return JSON.parse(jsonMatch[0]);
}
