import Anthropic from '@anthropic-ai/sdk';
import type { CollectibleCategory, IdentificationResult } from './types';

const anthropic = new Anthropic();

const IDENTIFICATION_PROMPT = `You are an expert collectibles appraiser specializing in coins, sports cards, trading cards, comics, stamps, and memorabilia.

Analyze the provided image(s) and identify the collectible item. Extract as much detail as possible.

Respond with a JSON object containing:
{
  "category": "coin" | "sports-card" | "trading-card" | "comic" | "stamp" | "currency" | "memorabilia" | "unknown",
  "name": "Full name/title of the item",
  "year": number or null,
  "mint": "Mint mark or manufacturer" or null,
  "player": "Player/character name if applicable" or null,
  "set": "Set or series name" or null,
  "certNumber": "Certification/serial number if visible" or null,
  "searchTerms": ["array", "of", "ebay", "search", "terms"],
  "rawDescription": "Detailed description of what you see",
  "confidence": 0.0 to 1.0
}

For coins: Include denomination, type (Morgan, Peace, etc.), mint mark, variety
For cards: Include brand (Topps, Panini), set name, card number, parallel/insert type
For graded items: Note the grading company (PSA, NGC, BGS, CGC) and cert number

Generate 3-5 specific eBay search terms that would find comparable items.`;

export async function identify(
  images: Array<{ type: 'url'; url: string } | { type: 'base64'; data: string; mediaType: string }>
): Promise<IdentificationResult> {
  if (images.length === 0) {
    throw new Error('At least one image is required for identification');
  }

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
            text: IDENTIFICATION_PROMPT,
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
    throw new Error('Failed to parse identification response as JSON');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    category: validateCategory(parsed.category),
    name: parsed.name || 'Unknown Item',
    year: typeof parsed.year === 'number' ? parsed.year : null,
    mint: parsed.mint || null,
    player: parsed.player || null,
    set: parsed.set || null,
    certNumber: parsed.certNumber || null,
    searchTerms: Array.isArray(parsed.searchTerms) ? parsed.searchTerms : [],
    rawDescription: parsed.rawDescription || '',
    confidence: typeof parsed.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : 0.5,
  };
}

function validateCategory(category: string): CollectibleCategory {
  const valid: CollectibleCategory[] = [
    'coin',
    'sports-card',
    'trading-card',
    'comic',
    'stamp',
    'currency',
    'memorabilia',
    'unknown',
  ];
  return valid.includes(category as CollectibleCategory) ? (category as CollectibleCategory) : 'unknown';
}
