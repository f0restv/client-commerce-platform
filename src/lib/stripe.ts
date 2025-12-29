import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-15.clover",
  typescript: true,
});

// Helper to get or create a Stripe customer by email
export async function getOrCreateCustomer(
  email: string,
  metadata?: Record<string, string>
): Promise<Stripe.Customer> {
  const existing = await stripe.customers.list({ email, limit: 1 });
  if (existing.data.length > 0) {
    return existing.data[0];
  }
  return stripe.customers.create({ email, metadata });
}

export async function createPaymentIntent(
  amount: number,
  currency = "usd",
  metadata?: Record<string, string>
) {
  return stripe.paymentIntents.create({
    amount: Math.round(amount * 100), // Convert to cents
    currency,
    metadata,
  });
}

export async function createInvoice(
  customerId: string,
  items: Array<{ description: string; amount: number; quantity?: number }>,
  dueDate?: Date
) {
  // Create invoice items
  for (const item of items) {
    await stripe.invoiceItems.create({
      customer: customerId,
      amount: Math.round(item.amount * 100),
      currency: "usd",
      description: item.description,
    });
  }

  // Create the invoice
  const invoice = await stripe.invoices.create({
    customer: customerId,
    collection_method: "send_invoice",
    days_until_due: dueDate
      ? Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : 30,
  });

  return stripe.invoices.finalizeInvoice(invoice.id);
}

export async function createCustomer(email: string, name?: string) {
  return stripe.customers.create({
    email,
    name,
  });
}

export async function getCustomerPortalSession(customerId: string, returnUrl: string) {
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}
