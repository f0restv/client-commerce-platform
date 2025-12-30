import { NextRequest, NextResponse } from 'next/server';
import { validateRequest, extractApiKey, getApiKeyInfo } from '@/lib/api-keys';
import { identify } from '@/lib/services/product-intelligence/identify';
import { estimateGrade } from '@/lib/services/product-intelligence/grade';
import { MarketData, type CollectibleCategory as MarketCategory } from '@/lib/services/market-data';
import type { CollectibleCategory } from '@/lib/services/product-intelligence/types';

interface AnalyzeRequest {
  images: string[]; // Array of image URLs or base64 data URIs
}

interface ImageInput {
  type: 'url' | 'base64';
  url?: string;
  data?: string;
  mediaType?: string;
}

/**
 * Parse image input from various formats
 */
function parseImages(images: string[]): ImageInput[] {
  return images.map((img) => {
    // Check if it's a data URI (base64)
    if (img.startsWith('data:')) {
      const match = img.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        return {
          type: 'base64' as const,
          data: match[2],
          mediaType: match[1],
        };
      }
    }

    // Otherwise treat as URL
    return {
      type: 'url' as const,
      url: img,
    };
  });
}

/**
 * Build a search query from identification result
 */
function buildSearchQuery(identification: {
  name: string;
  year?: number | null;
  category: string;
  searchTerms?: string[];
}): string {
  const terms: string[] = [];

  // Use search terms if available
  if (identification.searchTerms?.length) {
    return identification.searchTerms[0];
  }

  // Otherwise build from name and year
  terms.push(identification.name);
  if (identification.year) {
    terms.push(String(identification.year));
  }

  return terms.join(' ');
}

/**
 * Calculate estimated value from market data
 */
function calculateEstimate(
  marketPrices: { prices: { raw?: { mid?: number }; graded?: Record<string, { mid?: number }> } }[],
  grade: { grade: string; numericGrade: number | null }
): {
  low: number;
  mid: number;
  high: number;
  confidence: 'high' | 'medium' | 'low';
} {
  const prices: number[] = [];

  for (const item of marketPrices) {
    // Try to find graded price matching the estimated grade
    if (item.prices.graded && grade.grade) {
      const gradedPrice = Object.entries(item.prices.graded).find(([g]) =>
        g.toLowerCase().includes(grade.grade.toLowerCase()) ||
        (grade.numericGrade && g.includes(String(grade.numericGrade)))
      );
      if (gradedPrice?.[1]?.mid) {
        prices.push(gradedPrice[1].mid);
        continue;
      }
    }

    // Fall back to raw price
    if (item.prices.raw?.mid) {
      prices.push(item.prices.raw.mid);
    }
  }

  if (prices.length === 0) {
    return {
      low: 0,
      mid: 0,
      high: 0,
      confidence: 'low',
    };
  }

  prices.sort((a, b) => a - b);

  const mid = prices.reduce((sum, p) => sum + p, 0) / prices.length;
  const low = prices[0];
  const high = prices[prices.length - 1];

  // Determine confidence based on number of data points and variance
  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (prices.length >= 5) {
    const variance = prices.reduce((sum, p) => sum + Math.pow(p - mid, 2), 0) / prices.length;
    const coefficientOfVariation = Math.sqrt(variance) / mid;

    if (coefficientOfVariation < 0.2) {
      confidence = 'high';
    } else if (coefficientOfVariation < 0.4) {
      confidence = 'medium';
    }
  } else if (prices.length >= 3) {
    confidence = 'medium';
  }

  return {
    low: Math.round(low * 100) / 100,
    mid: Math.round(mid * 100) / 100,
    high: Math.round(high * 100) / 100,
    confidence,
  };
}

/**
 * POST /api/v1/analyze
 *
 * Analyze a collectible item from images.
 * Returns identification, grade estimate, and market pricing.
 */
export async function POST(request: NextRequest) {
  // Validate API key with rate limiting
  const validation = await validateRequest(request.headers, { scope: 'analyze' });
  if (!validation.valid) {
    return validation.error;
  }

  try {
    const body: AnalyzeRequest = await request.json();

    // Validate request body
    if (!body.images || !Array.isArray(body.images) || body.images.length === 0) {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'images array is required and must contain at least one image',
        },
        { status: 400 }
      );
    }

    // Parse images
    const parsedImages = parseImages(body.images);
    const imageInputs = parsedImages.map((img) => {
      if (img.type === 'base64') {
        return {
          type: 'base64' as const,
          data: img.data!,
          mediaType: img.mediaType!,
        };
      }
      return {
        type: 'url' as const,
        url: img.url!,
      };
    });

    // 1. Identify item
    const identification = await identify(imageInputs);

    // 2. Estimate grade
    const grade = await estimateGrade(imageInputs, identification.category);

    // 3. Get market pricing
    const searchQuery = buildSearchQuery(identification);
    // Map product-intelligence categories to market-data categories
    const categoryMap: Record<CollectibleCategory, MarketCategory | undefined> = {
      'coin': 'coin',
      'sports-card': 'sports-card',
      'trading-card': 'tcg',
      'comic': 'comic',
      'stamp': 'other',
      'currency': 'coin',
      'memorabilia': 'other',
      'vinyl-record': 'other',
      'sneakers': 'other',
      'watch': 'other',
      'vintage-toy': 'other',
      'art': 'other',
      'antique': 'other',
      'wine': 'other',
      'autograph': 'other',
      'video-game': 'other',
      'pokemon': 'pokemon',
      'jewelry': 'other',
      'militaria': 'other',
      'sports-memorabilia': 'other',
      'unknown': undefined,
    };
    const marketCategory = categoryMap[identification.category];
    const marketPrices = await MarketData.search(searchQuery, {
      category: marketCategory,
      limit: 10,
    });

    // 4. Calculate estimated value
    const estimatedValue = calculateEstimate(marketPrices, grade);

    // Log API usage
    const keyInfo = getApiKeyInfo(extractApiKey(request.headers));
    console.log(`[API v1] analyze called by ${keyInfo.name || 'unknown'}`);

    return NextResponse.json({
      success: true,
      identification: {
        category: identification.category,
        name: identification.name,
        year: identification.year,
        mint: identification.mint,
        player: identification.player,
        set: identification.set,
        certNumber: identification.certNumber,
        description: identification.rawDescription,
        confidence: identification.confidence,
      },
      grade: {
        grade: grade.grade,
        numericGrade: grade.numericGrade,
        confidence: grade.confidence,
        notes: grade.notes,
        details: {
          surfaces: grade.surfaces,
          centering: grade.centering,
          corners: grade.corners,
          edges: grade.edges,
          strike: grade.strike,
          luster: grade.luster,
        },
      },
      pricing: {
        sources: marketPrices.map((p) => ({
          name: p.name,
          source: p.source,
          sourceUrl: p.sourceUrl,
          prices: p.prices,
          lastUpdated: p.lastUpdated,
        })),
        estimated: estimatedValue,
      },
      searchTerms: identification.searchTerms,
    });
  } catch (error) {
    console.error('[API v1] analyze error:', error);

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'Invalid JSON in request body',
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/analyze
 *
 * Return API documentation
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/v1/analyze',
    method: 'POST',
    description: 'Analyze a collectible item from images',
    authentication: 'Required. Use x-api-key header or Authorization: Bearer token',
    request: {
      images: 'string[] - Array of image URLs or base64 data URIs',
    },
    response: {
      success: 'boolean',
      identification: {
        category: 'string - Item category (coin, sports-card, etc.)',
        name: 'string - Identified item name',
        year: 'number | null',
        mint: 'string | null',
        player: 'string | null - For sports cards',
        set: 'string | null',
        certNumber: 'string | null - Certification number if visible',
        description: 'string - Detailed description',
        confidence: 'number - 0 to 1',
      },
      grade: {
        grade: 'string - Grade designation (MS-65, PSA 9, etc.)',
        numericGrade: 'number | null',
        confidence: 'number - 0 to 1',
        notes: 'string',
        details: 'object - Category-specific grading details',
      },
      pricing: {
        sources: 'array - Market price data from various sources',
        estimated: {
          low: 'number',
          mid: 'number',
          high: 'number',
          confidence: 'string - high, medium, or low',
        },
      },
      searchTerms: 'string[] - Suggested search terms for finding comparable items',
    },
  });
}
