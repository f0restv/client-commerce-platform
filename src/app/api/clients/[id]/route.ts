import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { ClientStatus } from '@prisma/client';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/clients/[id]
 * Get a single client by ID
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    // Staff/Admin can view any client, clients can only view their own
    const isStaff = ['ADMIN', 'STAFF'].includes(session.user.role || '');
    const isOwnClient = session.user.clientId === id;

    if (!isStaff && !isOwnClient) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const client = await db.client.findUnique({
      where: { id },
      include: {
        sources: {
          include: {
            scrapeHistory: {
              orderBy: { createdAt: 'desc' },
              take: 5,
            },
          },
        },
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        products: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            sku: true,
            title: true,
            price: true,
            status: true,
            createdAt: true,
          },
        },
        payouts: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        _count: {
          select: {
            products: true,
            users: true,
            sources: true,
            payouts: true,
          },
        },
      },
    });

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    return NextResponse.json(client);
  } catch (error) {
    console.error('Error fetching client:', error);
    return NextResponse.json(
      { error: 'Failed to fetch client' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/clients/[id]
 * Update a client
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user || !['ADMIN', 'STAFF'].includes(session.user.role || '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    const existing = await db.client.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
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
      commissionRate,
      status,
      notes,
    } = body;

    // If email is being changed, check for duplicates
    if (email && email !== existing.email) {
      const emailExists = await db.client.findUnique({ where: { email } });
      if (emailExists) {
        return NextResponse.json(
          { error: 'A client with this email already exists' },
          { status: 400 }
        );
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (address !== undefined) updateData.address = address;
    if (city !== undefined) updateData.city = city;
    if (state !== undefined) updateData.state = state;
    if (zip !== undefined) updateData.zip = zip;
    if (website !== undefined) updateData.website = website;
    if (commissionRate !== undefined) updateData.commissionRate = commissionRate;
    if (status !== undefined && Object.values(ClientStatus).includes(status)) {
      updateData.status = status;
    }
    if (notes !== undefined) updateData.notes = notes;

    const client = await db.client.update({
      where: { id },
      data: updateData,
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

    return NextResponse.json(client);
  } catch (error) {
    console.error('Error updating client:', error);
    return NextResponse.json(
      { error: 'Failed to update client' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/clients/[id]
 * Delete a client (soft delete by setting status to TERMINATED)
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    const existing = await db.client.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Soft delete - set status to TERMINATED
    await db.client.update({
      where: { id },
      data: { status: ClientStatus.TERMINATED },
    });

    return NextResponse.json({ success: true, message: 'Client terminated' });
  } catch (error) {
    console.error('Error deleting client:', error);
    return NextResponse.json(
      { error: 'Failed to delete client' },
      { status: 500 }
    );
  }
}
