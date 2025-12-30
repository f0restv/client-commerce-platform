import { NextRequest, NextResponse } from 'next/server';
import { validateRequest, extractApiKey, getApiKeyInfo } from '@/lib/api-keys';
import { MarketData } from '@/lib/services/market-data';
import type { CollectibleCategory } from '@/lib/services/market-data';

/**
 * GET /api/v1/pricing
 *
 * Get market pricing for a collectible item.
 *
 * Query parameters:
 * - q: Search query (required)
 * - category: Filter by category (optional)
 * - limit: Max results (default: 10)
 */
export async function GET(request: NextRequest) {
  // Validate API key with rate limiting
  const validation = await validateRequest(request.headers, { scope: 'pricing' });
  if (!validation.valid) {
    return validation.error;
  }

  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const category = searchParams.get('category') as CollectibleCategory | null;
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);

    if (!query) {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'Query parameter "q" is required',
        },
        { status: 400 }
      );
    }

    // Search market data
    const results = await MarketData.search(query, {
      category: category || undefined,
      limit,
    });

    // Log API usage
    const keyInfo = getApiKeyInfo(extractApiKey(request.headers));
    console.log(`[API v1] pricing called by ${keyInfo.name || 'unknown'}: "${query}"`);

    return NextResponse.json({
      success: true,
      query,
      category,
      count: results.length,
      results: results.map((r) => ({
        itemId: r.itemId,
        name: r.name,
        category: r.category,
        source: r.source,
        sourceUrl: r.sourceUrl,
        prices: r.prices,
        lastUpdated: r.lastUpdated,
      })),
    });
  } catch (error) {
    console.error('[API v1] pricing error:', error);

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
 * POST /api/v1/pricing
 *
 * Get market pricing for a specific item by ID.
 */
export async function POST(request: NextRequest) {
  // Validate API key with rate limiting
  const validation = await validateRequest(request.headers, { scope: 'pricing' });
  if (!validation.valid) {
    return validation.error;
  }

  try {
    const body = await request.json();
    const { itemId, source } = body;

    if (!itemId || !source) {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'itemId and source are required',
        },
        { status: 400 }
      );
    }

    // Get specific item price
    const result = await MarketData.getPrice(itemId, source);

    if (!result) {
      return NextResponse.json(
        {
          error: 'Not Found',
          message: `No pricing found for item ${itemId} from ${source}`,
        },
        { status: 404 }
      );
    }

    // Log API usage
    const keyInfo = getApiKeyInfo(extractApiKey(request.headers));
    console.log(`[API v1] pricing lookup by ${keyInfo.name || 'unknown'}: ${itemId}`);

    return NextResponse.json({
      success: true,
      result: {
        itemId: result.itemId,
        name: result.name,
        category: result.category,
        source: result.source,
        sourceUrl: result.sourceUrl,
        prices: result.prices,
        lastUpdated: result.lastUpdated,
      },
    });
  } catch (error) {
    console.error('[API v1] pricing error:', error);

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
