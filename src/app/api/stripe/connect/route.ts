import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";

// Create or continue Connect account onboarding for a client
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { clientId } = await request.json();

    if (!clientId) {
      return NextResponse.json(
        { error: "Client ID required" },
        { status: 400 }
      );
    }

    // Verify user owns this client or is admin
    const client = await db.client.findFirst({
      where: {
        id: clientId,
        OR: [
          { users: { some: { id: session.user.id } } },
          // Allow admins
          ...(session.user.role === "ADMIN"
            ? [{ id: clientId }]
            : []),
        ],
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Create or get Connect account
    let accountId = client.stripeAccountId;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "US",
        email: client.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: "individual",
        metadata: { clientId: client.id },
      });

      accountId = account.id;

      await db.client.update({
        where: { id: clientId },
        data: {
          stripeAccountId: accountId,
          stripeAccountStatus: "pending",
        },
      });
    }

    // Create onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/client-portal/settings?refresh=true`,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/client-portal/settings?connected=true`,
      type: "account_onboarding",
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (error) {
    console.error("Connect onboarding error:", error);
    return NextResponse.json(
      { error: "Failed to create onboarding link" },
      { status: 500 }
    );
  }
}

// Get Connect account status
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");

  if (!clientId) {
    return NextResponse.json(
      { error: "Client ID required" },
      { status: 400 }
    );
  }

  try {
    // Verify user owns this client or is admin
    const client = await db.client.findFirst({
      where: {
        id: clientId,
        OR: [
          { users: { some: { id: session.user.id } } },
          ...(session.user.role === "ADMIN" ? [{ id: clientId }] : []),
        ],
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    if (!client.stripeAccountId) {
      return NextResponse.json({
        connected: false,
        status: null,
      });
    }

    // Get account details from Stripe
    const account = await stripe.accounts.retrieve(client.stripeAccountId);

    const status = account.details_submitted
      ? account.charges_enabled
        ? "complete"
        : "restricted"
      : "pending";

    // Update local status if changed
    if (status !== client.stripeAccountStatus) {
      await db.client.update({
        where: { id: clientId },
        data: { stripeAccountStatus: status },
      });
    }

    return NextResponse.json({
      connected: true,
      status,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
    });
  } catch (error) {
    console.error("Get Connect status error:", error);
    return NextResponse.json(
      { error: "Failed to get account status" },
      { status: 500 }
    );
  }
}
