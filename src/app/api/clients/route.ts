import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { ClientStatus } from '@prisma/client';

/**
 * GET /api/clients
 * List all clients with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !['ADMIN', 'STAFF'].includes(session.user.role || '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as ClientStatus | null;
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [clients, total] = await Promise.all([
      db.client.findMany({
        where,
        include: {
          sources: {
            select: {
              id: true,
              name: true,
              type: true,
              isActive: true,
              lastScrapedAt: true,
            },
          },
          _count: {
            select: {
              products: true,
              users: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.client.count({ where }),
    ]);

    return NextResponse.json({
      clients,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching clients:', error);
    return NextResponse.json(
      { error: 'Failed to fetch clients' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/clients
 * Create a new client
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !['ADMIN', 'STAFF'].includes(session.user.role || '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      email,
      phone,
      address,
      city,
      state,
      zip,
      website,
      commissionRate = 15,
      notes,
    } = body;

    if (!name || !email) {
      return NextResponse.json(
        { error: 'Name and email are required' },
        { status: 400 }
      );
    }

    // Generate slug from name
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Check for existing slug and make unique if needed
    let slug = baseSlug;
    let counter = 1;
    while (await db.client.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Check for existing email
    const existingEmail = await db.client.findUnique({ where: { email } });
    if (existingEmail) {
      return NextResponse.json(
        { error: 'A client with this email already exists' },
        { status: 400 }
      );
    }

    const client = await db.client.create({
      data: {
        name,
        slug,
        email,
        phone,
        address,
        city,
        state,
        zip,
        website,
        commissionRate,
        notes,
        status: ClientStatus.PENDING,
      },
      include: {
        sources: true,
        _count: {
          select: {
            products: true,
            users: true,
          },
        },
      },
    });

    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    console.error('Error creating client:', error);
    return NextResponse.json(
      { error: 'Failed to create client' },
      { status: 500 }
    );
  }
}
