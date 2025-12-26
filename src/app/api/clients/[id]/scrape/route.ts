import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { scrapeAndSync } from '@/lib/services/client-scraper';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/clients/[id]/scrape
 * Get scrape history for a client's sources
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: clientId } = await context.params;

    // Staff/Admin can view any client's scrape history
    const isStaff = ['ADMIN', 'STAFF'].includes(session.user.role || '');
    const isOwnClient = session.user.clientId === clientId;

    if (!isStaff && !isOwnClient) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const sourceId = searchParams.get('sourceId');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Get sources for this client
    const sources = await db.clientSource.findMany({
      where: { clientId },
      select: { id: true },
    });

    const sourceIds = sourceId ? [sourceId] : sources.map((s) => s.id);

    const history = await db.scrapeHistory.findMany({
      where: {
        sourceId: { in: sourceIds },
      },
      include: {
        source: {
          select: {
            id: true,
            name: true,
            type: true,
            url: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({ history });
  } catch (error) {
    console.error('Error fetching scrape history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scrape history' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/clients/[id]/scrape
 * Trigger a scrape job for a client's source
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user || !['ADMIN', 'STAFF'].includes(session.user.role || '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: clientId } = await context.params;

    // Verify client exists
    const client = await db.client.findUnique({ where: { id: clientId } });
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      sourceId,
      dryRun = false,
      markMissingSold = true,
      updatePrices = true,
      createNew = true,
    } = body;

    if (!sourceId) {
      return NextResponse.json(
        { error: 'sourceId is required' },
        { status: 400 }
      );
    }

    // Verify source exists and belongs to this client
    const source = await db.clientSource.findUnique({
      where: { id: sourceId },
    });

    if (!source) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    if (source.clientId !== clientId) {
      return NextResponse.json(
        { error: 'Source does not belong to this client' },
        { status: 403 }
      );
    }

    // Check if a scrape is already running for this source
    const runningJob = await db.scrapeHistory.findFirst({
      where: {
        sourceId,
        status: 'RUNNING',
      },
    });

    if (runningJob) {
      return NextResponse.json(
        {
          error: 'A scrape job is already running for this source',
          jobId: runningJob.id,
        },
        { status: 409 }
      );
    }

    // Run the scrape and sync
    const { scrapeResult, syncResult } = await scrapeAndSync(sourceId, {
      dryRun,
      markMissingSold,
      updatePrices,
      createNew,
    });

    return NextResponse.json({
      success: true,
      scrape: {
        status: scrapeResult.status,
        itemsFound: scrapeResult.itemsFound,
        duration: scrapeResult.duration,
        errors: scrapeResult.errors.length,
      },
      sync: {
        itemsNew: syncResult.itemsNew,
        itemsUpdated: syncResult.itemsUpdated,
        itemsRemoved: syncResult.itemsRemoved,
        duration: syncResult.duration,
        errors: syncResult.errors.length,
      },
    });
  } catch (error) {
    console.error('Error running scrape job:', error);
    return NextResponse.json(
      {
        error: 'Failed to run scrape job',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/clients/[id]/scrape/all
 * Trigger scrape for all active sources of a client
 * (Handled via query param ?all=true)
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user || !['ADMIN', 'STAFF'].includes(session.user.role || '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: clientId } = await context.params;

    // Verify client exists
    const client = await db.client.findUnique({ where: { id: clientId } });
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      dryRun = false,
      markMissingSold = true,
      updatePrices = true,
      createNew = true,
    } = body;

    // Get all active sources for this client
    const sources = await db.clientSource.findMany({
      where: {
        clientId,
        isActive: true,
      },
    });

    if (sources.length === 0) {
      return NextResponse.json(
        { error: 'No active sources found for this client' },
        { status: 404 }
      );
    }

    // Run scrapes sequentially to avoid overwhelming resources
    const results: Array<{
      sourceId: string;
      sourceName: string;
      success: boolean;
      scrape?: {
        status: string;
        itemsFound: number;
        duration: number;
        errors: number;
      };
      sync?: {
        itemsNew: number;
        itemsUpdated: number;
        itemsRemoved: number;
        duration: number;
        errors: number;
      };
      error?: string;
    }> = [];

    for (const source of sources) {
      try {
        // Check if already running
        const runningJob = await db.scrapeHistory.findFirst({
          where: {
            sourceId: source.id,
            status: 'RUNNING',
          },
        });

        if (runningJob) {
          results.push({
            sourceId: source.id,
            sourceName: source.name,
            success: false,
            error: 'Scrape already running',
          });
          continue;
        }

        const { scrapeResult, syncResult } = await scrapeAndSync(source.id, {
          dryRun,
          markMissingSold,
          updatePrices,
          createNew,
        });

        results.push({
          sourceId: source.id,
          sourceName: source.name,
          success: true,
          scrape: {
            status: scrapeResult.status,
            itemsFound: scrapeResult.itemsFound,
            duration: scrapeResult.duration,
            errors: scrapeResult.errors.length,
          },
          sync: {
            itemsNew: syncResult.itemsNew,
            itemsUpdated: syncResult.itemsUpdated,
            itemsRemoved: syncResult.itemsRemoved,
            duration: syncResult.duration,
            errors: syncResult.errors.length,
          },
        });
      } catch (err) {
        results.push({
          sourceId: source.id,
          sourceName: source.name,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: failed === 0,
      summary: {
        total: sources.length,
        successful,
        failed,
      },
      results,
    });
  } catch (error) {
    console.error('Error running bulk scrape:', error);
    return NextResponse.json(
      {
        error: 'Failed to run bulk scrape',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
