import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { SourceType } from '@prisma/client';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/clients/[id]/sources
 * List all sources for a client
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: clientId } = await context.params;

    // Staff/Admin can view any client's sources, clients can only view their own
    const isStaff = ['ADMIN', 'STAFF'].includes(session.user.role || '');
    const isOwnClient = session.user.clientId === clientId;

    if (!isStaff && !isOwnClient) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify client exists
    const client = await db.client.findUnique({ where: { id: clientId } });
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const sources = await db.clientSource.findMany({
      where: { clientId },
      include: {
        scrapeHistory: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ sources });
  } catch (error) {
    console.error('Error fetching client sources:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sources' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/clients/[id]/sources
 * Create a new source for a client
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
      name,
      type,
      url,
      isActive = true,
      scrapeFrequency = 60,
      selectors,
      config,
    } = body;

    if (!name || !type || !url) {
      return NextResponse.json(
        { error: 'Name, type, and URL are required' },
        { status: 400 }
      );
    }

    // Validate source type
    if (!Object.values(SourceType).includes(type)) {
      return NextResponse.json(
        { error: `Invalid source type. Must be one of: ${Object.values(SourceType).join(', ')}` },
        { status: 400 }
      );
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    const source = await db.clientSource.create({
      data: {
        clientId,
        name,
        type,
        url,
        isActive,
        scrapeFrequency,
        selectors: selectors || undefined,
        config: config || undefined,
      },
      include: {
        scrapeHistory: true,
      },
    });

    return NextResponse.json(source, { status: 201 });
  } catch (error) {
    console.error('Error creating client source:', error);
    return NextResponse.json(
      { error: 'Failed to create source' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/clients/[id]/sources
 * Update an existing source (sourceId in body)
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user || !['ADMIN', 'STAFF'].includes(session.user.role || '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: clientId } = await context.params;

    const body = await request.json();
    const {
      sourceId,
      name,
      type,
      url,
      isActive,
      scrapeFrequency,
      selectors,
      config,
    } = body;

    if (!sourceId) {
      return NextResponse.json(
        { error: 'sourceId is required' },
        { status: 400 }
      );
    }

    // Verify source exists and belongs to this client
    const existing = await db.clientSource.findUnique({
      where: { id: sourceId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    if (existing.clientId !== clientId) {
      return NextResponse.json(
        { error: 'Source does not belong to this client' },
        { status: 403 }
      );
    }

    // Validate type if provided
    if (type && !Object.values(SourceType).includes(type)) {
      return NextResponse.json(
        { error: `Invalid source type. Must be one of: ${Object.values(SourceType).join(', ')}` },
        { status: 400 }
      );
    }

    // Validate URL if provided
    if (url) {
      try {
        new URL(url);
      } catch {
        return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) updateData.type = type;
    if (url !== undefined) updateData.url = url;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (scrapeFrequency !== undefined) updateData.scrapeFrequency = scrapeFrequency;
    if (selectors !== undefined) updateData.selectors = selectors;
    if (config !== undefined) updateData.config = config;

    const source = await db.clientSource.update({
      where: { id: sourceId },
      data: updateData,
      include: {
        scrapeHistory: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    return NextResponse.json(source);
  } catch (error) {
    console.error('Error updating client source:', error);
    return NextResponse.json(
      { error: 'Failed to update source' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/clients/[id]/sources
 * Delete a source (sourceId in body or query param)
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user || !['ADMIN', 'STAFF'].includes(session.user.role || '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: clientId } = await context.params;
    const { searchParams } = new URL(request.url);
    const sourceId = searchParams.get('sourceId');

    if (!sourceId) {
      return NextResponse.json(
        { error: 'sourceId query parameter is required' },
        { status: 400 }
      );
    }

    // Verify source exists and belongs to this client
    const existing = await db.clientSource.findUnique({
      where: { id: sourceId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    if (existing.clientId !== clientId) {
      return NextResponse.json(
        { error: 'Source does not belong to this client' },
        { status: 403 }
      );
    }

    await db.clientSource.delete({
      where: { id: sourceId },
    });

    return NextResponse.json({ success: true, message: 'Source deleted' });
  } catch (error) {
    console.error('Error deleting client source:', error);
    return NextResponse.json(
      { error: 'Failed to delete source' },
      { status: 500 }
    );
  }
}
