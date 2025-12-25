import Stripe from 'stripe';
import type { Invoice, Order, User } from '@/types';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-10-28.acacia',
});

export { stripe };

/**
 * Customer management
 */
export async function createCustomer(user: User): Promise<string> {
  const customer = await stripe.customers.create({
    email: user.email,
    name: user.full_name,
    phone: user.phone,
    metadata: {
      user_id: user.id,
    },
  });

  return customer.id;
}

export async function getOrCreateCustomer(user: User): Promise<string> {
  if (user.stripe_customer_id) {
    return user.stripe_customer_id;
  }

  return createCustomer(user);
}

/**
 * Payment intents for orders
 */
export async function createPaymentIntent(order: Order, customerId: string): Promise<{
  clientSecret: string;
  paymentIntentId: string;
}> {
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(order.total * 100), // Convert to cents
    currency: 'usd',
    customer: customerId,
    metadata: {
      order_id: order.id,
      order_number: order.order_number,
    },
    automatic_payment_methods: {
      enabled: true,
    },
  });

  return {
    clientSecret: paymentIntent.client_secret!,
    paymentIntentId: paymentIntent.id,
  };
}

export async function confirmPaymentIntent(paymentIntentId: string): Promise<boolean> {
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  return paymentIntent.status === 'succeeded';
}

/**
 * Invoice management for consignment clients
 */
export async function createInvoice(invoice: Invoice, customerId: string): Promise<{
  stripeInvoiceId: string;
  paymentLink: string;
}> {
  // Create invoice items
  for (const item of invoice.items) {
    await stripe.invoiceItems.create({
      customer: customerId,
      description: item.description,
      amount: Math.round(item.net_amount * 100),
      currency: 'usd',
      metadata: {
        invoice_id: invoice.id,
        product_id: item.product_id || '',
      },
    });
  }

  // Create the invoice
  const stripeInvoice = await stripe.invoices.create({
    customer: customerId,
    auto_advance: true,
    collection_method: 'send_invoice',
    days_until_due: 30,
    metadata: {
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
    },
    footer: 'Thank you for consigning with CoinVault!',
  });

  // Finalize the invoice
  const finalizedInvoice = await stripe.invoices.finalizeInvoice(stripeInvoice.id);

  return {
    stripeInvoiceId: finalizedInvoice.id,
    paymentLink: finalizedInvoice.hosted_invoice_url || '',
  };
}

export async function sendInvoice(stripeInvoiceId: string): Promise<void> {
  await stripe.invoices.sendInvoice(stripeInvoiceId);
}

export async function voidInvoice(stripeInvoiceId: string): Promise<void> {
  await stripe.invoices.voidInvoice(stripeInvoiceId);
}

export async function getInvoiceStatus(stripeInvoiceId: string): Promise<{
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  amountPaid: number;
  amountDue: number;
}> {
  const invoice = await stripe.invoices.retrieve(stripeInvoiceId);

  return {
    status: invoice.status as 'draft' | 'open' | 'paid' | 'void' | 'uncollectible',
    amountPaid: invoice.amount_paid / 100,
    amountDue: invoice.amount_due / 100,
  };
}

/**
 * Checkout sessions for e-commerce
 */
export async function createCheckoutSession(
  order: Order,
  customerId: string,
  successUrl: string,
  cancelUrl: string
): Promise<string> {
  const lineItems = order.items.map((item) => ({
    price_data: {
      currency: 'usd',
      product_data: {
        name: item.product_id, // In production, fetch product title
      },
      unit_amount: Math.round(item.unit_price * 100),
    },
    quantity: item.quantity,
  }));

  // Add shipping if present
  if (order.shipping > 0) {
    lineItems.push({
      price_data: {
        currency: 'usd',
        product_data: {
          name: 'Shipping & Handling',
        },
        unit_amount: Math.round(order.shipping * 100),
      },
      quantity: 1,
    });
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    line_items: lineItems,
    mode: 'payment',
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      order_id: order.id,
      order_number: order.order_number,
    },
    shipping_address_collection: {
      allowed_countries: ['US', 'CA'],
    },
    shipping_options: [
      {
        shipping_rate_data: {
          type: 'fixed_amount',
          fixed_amount: {
            amount: 599,
            currency: 'usd',
          },
          display_name: 'USPS Priority Mail',
          delivery_estimate: {
            minimum: {
              unit: 'business_day',
              value: 2,
            },
            maximum: {
              unit: 'business_day',
              value: 5,
            },
          },
        },
      },
      {
        shipping_rate_data: {
          type: 'fixed_amount',
          fixed_amount: {
            amount: 1499,
            currency: 'usd',
          },
          display_name: 'FedEx Overnight',
          delivery_estimate: {
            minimum: {
              unit: 'business_day',
              value: 1,
            },
            maximum: {
              unit: 'business_day',
              value: 1,
            },
          },
        },
      },
    ],
  });

  return session.url!;
}

/**
 * Webhook handlers
 */
export function constructWebhookEvent(payload: string, signature: string): Stripe.Event {
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!
  );
}

export async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<{
  orderId?: string;
  invoiceId?: string;
}> {
  const metadata = paymentIntent.metadata;

  return {
    orderId: metadata.order_id,
    invoiceId: metadata.invoice_id,
  };
}

export async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<{
  invoiceId: string;
  amountPaid: number;
}> {
  return {
    invoiceId: invoice.metadata?.invoice_id || '',
    amountPaid: invoice.amount_paid / 100,
  };
}

/**
 * Payouts to consignment clients (via Stripe Connect or manual)
 */
export async function createPayout(
  amount: number,
  description: string,
  metadata: Record<string, string>
): Promise<string> {
  const payout = await stripe.payouts.create({
    amount: Math.round(amount * 100),
    currency: 'usd',
    description,
    metadata,
  });

  return payout.id;
}

/**
 * Product management for recurring items
 */
export async function createProduct(
  name: string,
  description: string,
  images: string[]
): Promise<string> {
  const product = await stripe.products.create({
    name,
    description,
    images,
  });

  return product.id;
}

export async function createPrice(
  productId: string,
  amount: number
): Promise<string> {
  const price = await stripe.prices.create({
    product: productId,
    unit_amount: Math.round(amount * 100),
    currency: 'usd',
  });

  return price.id;
}
