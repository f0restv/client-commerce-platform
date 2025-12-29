import { NextRequest, NextResponse } from 'next/server';
import { validateRequest, extractApiKey, getApiKeyInfo } from '@/lib/api-keys';
import { db } from '@/lib/db';
import type { ProductStatus } from '@prisma/client';

/**
 * GET /api/v1/inventory
 *
 * Browse available inventory.
 *
 * Query parameters:
 * - category: Filter by category slug (optional)
 * - q: Search query (optional)
 * - limit: Max results (default: 20, max: 100)
 * - cursor: Pagination cursor (optional)
 * - minPrice: Minimum price filter (optional)
 * - maxPrice: Maximum price filter (optional)
 * - status: Filter by status (default: ACTIVE)
 */
export async function GET(request: NextRequest) {
  // Validate API key
  const validation = validateRequest(request.headers);
  if (!validation.valid) {
    return validation.error;
  }

  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const query = searchParams.get('q');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const cursor = searchParams.get('cursor');
    const minPrice = searchParams.get('minPrice')
      ? parseFloat(searchParams.get('minPrice')!)
      : undefined;
    const maxPrice = searchParams.get('maxPrice')
      ? parseFloat(searchParams.get('maxPrice')!)
      : undefined;
    const status = searchParams.get('status') || 'ACTIVE';

    // Build where clause
    const where: {
      status?: ProductStatus;
      category?: { slug: string };
      OR?: { title?: { contains: string; mode: 'insensitive' }; description?: { contains: string; mode: 'insensitive' }; sku?: { contains: string; mode: 'insensitive' } }[];
      price?: { gte?: number; lte?: number };
    } = {
      status: status as ProductStatus,
    };

    // Category filter
    if (category) {
      where.category = {
        slug: category,
      };
    }

    // Search query
    if (query) {
      where.OR = [
        { title: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { sku: { contains: query, mode: 'insensitive' } },
      ];
    }

    // Price filters
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) {
        where.price.gte = minPrice;
      }
      if (maxPrice !== undefined) {
        where.price.lte = maxPrice;
      }
    }

    // Fetch products
    const products = await db.product.findMany({
      where,
      include: {
        images: {
          take: 1,
          orderBy: { order: 'asc' },
          where: { isPrimary: true },
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        client: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        auction: {
          select: {
            id: true,
            currentBid: true,
            endTime: true,
            status: true,
          },
        },
      },
      take: limit + 1, // Fetch one extra to check if there are more
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
      orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
    });

    // Check if there are more results
    const hasMore = products.length > limit;
    const items = hasMore ? products.slice(0, -1) : products;
    const nextCursor = hasMore ? items[items.length - 1]?.id : null;

    // Log API usage
    const keyInfo = getApiKeyInfo(extractApiKey(request.headers));
    console.log(
      `[API v1] inventory called by ${keyInfo.name || 'unknown'}: ${items.length} items`
    );

    return NextResponse.json({
      success: true,
      count: items.length,
      hasMore,
      nextCursor,
      items: items.map((product) => ({
        id: product.id,
        sku: product.sku,
        title: product.title,
        description: product.shortDescription || product.description?.slice(0, 200),
        category: product.category,
        price: product.price ? Number(product.price) : null,
        listingType: product.listingType,
        condition: product.condition,
        grade: product.grade,
        certification: product.certification,
        year: product.year,
        image: product.images[0]?.url || null,
        client: product.client
          ? {
              name: product.client.name,
              slug: product.client.slug,
            }
          : null,
        auction: product.auction
          ? {
              currentBid: Number(product.auction.currentBid),
              endTime: product.auction.endTime,
              status: product.auction.status,
            }
          : null,
        featured: product.featured,
        createdAt: product.createdAt,
      })),
    });
  } catch (error) {
    console.error('[API v1] inventory error:', error);

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
 * GET /api/v1/inventory/[id]
 * Note: This is a separate route file, but we can also handle ID lookups via POST
 */
export async function POST(request: NextRequest) {
  // Validate API key
  const validation = validateRequest(request.headers);
  if (!validation.valid) {
    return validation.error;
  }

  try {
    const body = await request.json();
    const { id, sku } = body;

    if (!id && !sku) {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'Either id or sku is required',
        },
        { status: 400 }
      );
    }

    const product = await db.product.findFirst({
      where: id ? { id } : { sku },
      include: {
        images: {
          orderBy: { order: 'asc' },
        },
        category: true,
        client: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        auction: {
          include: {
            bids: {
              take: 5,
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        priceHistory: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        marketAnalysis: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!product) {
      return NextResponse.json(
        {
          error: 'Not Found',
          message: `Product not found`,
        },
        { status: 404 }
      );
    }

    // Log API usage
    const keyInfo = getApiKeyInfo(extractApiKey(request.headers));
    console.log(`[API v1] inventory lookup by ${keyInfo.name || 'unknown'}: ${product.id}`);

    return NextResponse.json({
      success: true,
      product: {
        id: product.id,
        sku: product.sku,
        title: product.title,
        description: product.description,
        shortDescription: product.shortDescription,
        category: product.category,
        price: product.price ? Number(product.price) : null,
        costBasis: product.costBasis ? Number(product.costBasis) : null,
        listingType: product.listingType,
        status: product.status,
        condition: product.condition,
        grade: product.grade,
        certification: product.certification,
        certNumber: product.certNumber,
        year: product.year,
        mint: product.mint,
        metalType: product.metalType,
        metalWeight: product.metalWeight ? Number(product.metalWeight) : null,
        quantity: product.quantity,
        images: product.images.map((img) => ({
          url: img.url,
          alt: img.alt,
          isPrimary: img.isPrimary,
        })),
        client: product.client,
        auction: product.auction
          ? {
              id: product.auction.id,
              startingPrice: Number(product.auction.startingPrice),
              currentBid: Number(product.auction.currentBid),
              reservePrice: product.auction.reservePrice
                ? Number(product.auction.reservePrice)
                : null,
              buyNowPrice: product.auction.buyNowPrice
                ? Number(product.auction.buyNowPrice)
                : null,
              bidIncrement: Number(product.auction.bidIncrement),
              startTime: product.auction.startTime,
              endTime: product.auction.endTime,
              status: product.auction.status,
              bidCount: product.auction.bids.length,
            }
          : null,
        priceHistory: product.priceHistory.map((ph) => ({
          price: Number(ph.price),
          reason: ph.reason,
          date: ph.createdAt,
        })),
        marketAnalysis: product.marketAnalysis[0]
          ? {
              avgPrice: product.marketAnalysis[0].avgPrice
                ? Number(product.marketAnalysis[0].avgPrice)
                : null,
              lowPrice: product.marketAnalysis[0].lowPrice
                ? Number(product.marketAnalysis[0].lowPrice)
                : null,
              highPrice: product.marketAnalysis[0].highPrice
                ? Number(product.marketAnalysis[0].highPrice)
                : null,
              salesCount: product.marketAnalysis[0].salesCount,
              avgDaysToSell: product.marketAnalysis[0].avgDaysToSell,
              aiSummary: product.marketAnalysis[0].aiSummary,
              confidence: product.marketAnalysis[0].confidence
                ? Number(product.marketAnalysis[0].confidence)
                : null,
              createdAt: product.marketAnalysis[0].createdAt,
            }
          : null,
        featured: product.featured,
        views: product.views,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      },
    });
  } catch (error) {
    console.error('[API v1] inventory lookup error:', error);

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
