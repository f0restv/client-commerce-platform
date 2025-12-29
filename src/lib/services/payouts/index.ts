import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";

export async function createPayout(clientId: string, amount: number) {
  const client = await db.client.findUnique({
    where: { id: clientId },
  });

  if (!client?.stripeAccountId) {
    throw new Error("Client not connected to Stripe");
  }

  if (client.stripeAccountStatus !== "complete") {
    throw new Error("Client Stripe account not fully onboarded");
  }

  // Create transfer to connected account
  const transfer = await stripe.transfers.create({
    amount: Math.round(amount * 100), // cents
    currency: "usd",
    destination: client.stripeAccountId,
    metadata: { clientId },
  });

  // Record payout
  const payout = await db.stripePayout.create({
    data: {
      clientId,
      amount,
      stripeTransferId: transfer.id,
      status: "PENDING",
    },
  });

  return { transfer, payout };
}

export async function processOrderPayout(orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          product: {
            include: { client: true },
          },
        },
      },
    },
  });

  if (!order) throw new Error("Order not found");
  if (order.status !== "PAID") throw new Error("Order not yet paid");

  // Group by client
  const clientAmounts = new Map<string, number>();

  for (const item of order.items) {
    const clientId = item.product.clientId;
    if (!clientId) continue; // Skip non-consignment items

    const client = item.product.client;
    if (!client) continue;

    const amount = Number(item.price) * item.quantity;
    const commissionRate = Number(client.commissionRate) / 100;
    const commission = amount * commissionRate;
    const payout = amount - commission;

    clientAmounts.set(
      clientId,
      (clientAmounts.get(clientId) || 0) + payout
    );
  }

  const results: Array<{
    clientId: string;
    amount: number;
    success: boolean;
    error?: string;
  }> = [];

  // Process each payout
  for (const [clientId, amount] of clientAmounts) {
    try {
      await createPayout(clientId, amount);
      results.push({ clientId, amount, success: true });
    } catch (error) {
      results.push({
        clientId,
        amount,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return results;
}

export async function getClientPayoutHistory(clientId: string) {
  return db.stripePayout.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getClientPayoutSummary(clientId: string) {
  const payouts = await db.stripePayout.findMany({
    where: { clientId },
  });

  const summary = {
    total: 0,
    pending: 0,
    paid: 0,
    failed: 0,
  };

  for (const payout of payouts) {
    const amount = Number(payout.amount);
    summary.total += amount;

    switch (payout.status) {
      case "PENDING":
      case "IN_TRANSIT":
        summary.pending += amount;
        break;
      case "PAID":
        summary.paid += amount;
        break;
      case "FAILED":
      case "CANCELLED":
        summary.failed += amount;
        break;
    }
  }

  return summary;
}
