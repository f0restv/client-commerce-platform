import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Admins/staff can see all orders, users see their own
    const isAdmin = ["ADMIN", "STAFF"].includes(session.user.role || "");

    const where: Record<string, unknown> = {};
    if (!isAdmin) {
      where.userId = session.user.id;
    }
    if (status) {
      where.status = status;
    }

    const [orders, total] = await Promise.all([
      db.order.findMany({
        where,
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  title: true,
                  images: { take: 1 },
                },
              },
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          address: true,
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      db.order.count({ where }),
    ]);

    return NextResponse.json({ orders, total });
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}
