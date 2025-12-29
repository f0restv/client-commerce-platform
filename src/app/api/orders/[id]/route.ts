import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  notifyOrderShipped,
  notifyOrderDelivered,
} from "@/lib/services/notifications";

type OrderStatus = "PENDING" | "PAID" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "REFUNDED";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const order = await db.order.findUnique({
      where: { id },
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
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Users can only view their own orders
    const isAdmin = ["ADMIN", "STAFF"].includes(session.user.role || "");
    if (!isAdmin && order.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error("Error fetching order:", error);
    return NextResponse.json(
      { error: "Failed to fetch order" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins/staff can update orders
    const isAdmin = ["ADMIN", "STAFF"].includes(session.user.role || "");
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { status, trackingNumber, carrier, shippingMethod } = body;

    // Fetch current order
    const currentOrder = await db.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: {
              select: { title: true },
            },
          },
        },
        user: true,
        address: true,
      },
    });

    if (!currentOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Build update data
    const updateData: {
      status?: OrderStatus;
      shippedAt?: Date;
      deliveredAt?: Date;
      trackingNumber?: string;
      shippingMethod?: string;
    } = {};

    if (status) {
      updateData.status = status as OrderStatus;

      if (status === "SHIPPED") {
        updateData.shippedAt = new Date();
      } else if (status === "DELIVERED") {
        updateData.deliveredAt = new Date();
      }
    }

    if (trackingNumber) updateData.trackingNumber = trackingNumber;
    if (carrier) updateData.shippingMethod = carrier;
    if (shippingMethod) updateData.shippingMethod = shippingMethod;

    // Update the order
    const updatedOrder = await db.order.update({
      where: { id },
      data: updateData,
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
        user: true,
        address: true,
      },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.example.com";

    // Send notifications based on status change
    if (status === "SHIPPED" && currentOrder.status !== "SHIPPED") {
      // Notify buyer of shipment
      if (currentOrder.user && trackingNumber) {
        await notifyOrderShipped({
          buyer: {
            name: currentOrder.user.name || "Customer",
            email: currentOrder.user.email,
            phone: currentOrder.user.phone || undefined,
          },
          order: {
            orderNumber: currentOrder.orderNumber,
            trackingNumber: trackingNumber || updatedOrder.trackingNumber || "",
            carrier: carrier || updatedOrder.shippingMethod || "USPS",
            items: currentOrder.items.map((item: { product: { title: string }; quantity: number }) => ({
              title: item.product.title,
              quantity: item.quantity,
            })),
          },
          appUrl,
        });
      }
    }

    if (status === "DELIVERED" && currentOrder.status !== "DELIVERED") {
      // Notify buyer of delivery
      if (currentOrder.user) {
        await notifyOrderDelivered({
          buyer: {
            name: currentOrder.user.name || "Customer",
            email: currentOrder.user.email,
            phone: currentOrder.user.phone || undefined,
          },
          order: {
            orderNumber: currentOrder.orderNumber,
          },
          appUrl,
        });
      }
    }

    return NextResponse.json(updatedOrder);
  } catch (error) {
    console.error("Error updating order:", error);
    return NextResponse.json(
      { error: "Failed to update order" },
      { status: 500 }
    );
  }
}
