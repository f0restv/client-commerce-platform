import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { stripe, getOrCreateCustomer } from "@/lib/stripe";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { items } = await request.json();
    // items: [{ productId, quantity }]

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "No items provided" },
        { status: 400 }
      );
    }

    // Fetch products
    const products = await db.product.findMany({
      where: {
        id: { in: items.map((i: { productId: string }) => i.productId) },
        status: "ACTIVE",
      },
      include: { images: { take: 1 } },
    });

    if (products.length === 0) {
      return NextResponse.json(
        { error: "No valid products found" },
        { status: 400 }
      );
    }

    // Create line items for Stripe
    const lineItems = products.map((product) => ({
      price_data: {
        currency: "usd",
        unit_amount: Math.round(Number(product.price) * 100),
        product_data: {
          name: product.title,
          images: product.images
            .filter((i) => i.url)
            .map((i) => i.url),
        },
      },
      quantity: 1,
    }));

    // Get or create Stripe customer
    const customer = await getOrCreateCustomer(session.user.email, {
      userId: session.user.id,
    });

    // Create checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customer.id,
      mode: "payment",
      line_items: lineItems,
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/order/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/cart`,
      shipping_address_collection: {
        allowed_countries: ["US"],
      },
      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: {
              amount: 0,
              currency: "usd",
            },
            display_name: "Free shipping",
            delivery_estimate: {
              minimum: {
                unit: "business_day",
                value: 5,
              },
              maximum: {
                unit: "business_day",
                value: 7,
              },
            },
          },
        },
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: {
              amount: 1500,
              currency: "usd",
            },
            display_name: "Express shipping",
            delivery_estimate: {
              minimum: {
                unit: "business_day",
                value: 1,
              },
              maximum: {
                unit: "business_day",
                value: 3,
              },
            },
          },
        },
      ],
      metadata: {
        userId: session.user.id,
        productIds: products.map((p) => p.id).join(","),
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("Checkout session error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
