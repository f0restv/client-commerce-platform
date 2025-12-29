# TASK 05: Stripe Payment Integration

## Objective
Complete Stripe integration for:
1. Customer payments (checkout)
2. Seller payouts (Connect)
3. Webhook handling (already started)

## Current State
- `src/lib/stripe.ts` exists (basic config)
- Webhook route exists with order processing
- No Connect onboarding
- No checkout flow

## Files to Create/Update

### 1. Stripe Client Setup
**File:** `src/lib/stripe.ts`

```typescript
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
});

// Helper to get or create customer
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
```

### 2. Checkout Session
**File:** `src/app/api/checkout/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { stripe, getOrCreateCustomer } from '@/lib/stripe';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { items } = await request.json();
  // items: [{ productId, quantity }]

  // Fetch products
  const products = await db.product.findMany({
    where: { id: { in: items.map((i: any) => i.productId) } },
    include: { images: { take: 1 } },
  });

  // Create line items
  const lineItems = products.map(product => ({
    price_data: {
      currency: 'usd',
      unit_amount: Math.round(product.price * 100),
      product_data: {
        name: product.title,
        images: product.images.map(i => i.url),
      },
    },
    quantity: 1,
  }));

  // Get or create customer
  const customer = await getOrCreateCustomer(session.user.email);

  // Create checkout session
  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customer.id,
    mode: 'payment',
    line_items: lineItems,
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/order/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/cart`,
    metadata: {
      userId: session.user.id,
      productIds: products.map(p => p.id).join(','),
    },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
```

### 3. Connect Onboarding (for sellers/clients)
**File:** `src/app/api/stripe/connect/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { stripe } from '@/lib/stripe';
import { db } from '@/lib/db';

// Create Connect account for a client
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { clientId } = await request.json();

  // Verify user owns this client
  const client = await db.client.findFirst({
    where: {
      id: clientId,
      users: { some: { id: session.user.id } },
    },
  });

  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  // Create or get Connect account
  let accountId = client.stripeAccountId;

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'US',
      email: client.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: 'individual',
      metadata: { clientId: client.id },
    });

    accountId = account.id;

    await db.client.update({
      where: { id: clientId },
      data: { stripeAccountId: accountId },
    });
  }

  // Create onboarding link
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/client-portal/settings?refresh=true`,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/client-portal/settings?connected=true`,
    type: 'account_onboarding',
  });

  return NextResponse.json({ url: accountLink.url });
}
```

### 4. Payout to Seller
**File:** `src/lib/services/payouts/index.ts`

```typescript
import { stripe } from '@/lib/stripe';
import { db } from '@/lib/db';

export async function createPayout(clientId: string, amount: number) {
  const client = await db.client.findUnique({
    where: { id: clientId },
  });

  if (!client?.stripeAccountId) {
    throw new Error('Client not connected to Stripe');
  }

  // Create transfer to connected account
  const transfer = await stripe.transfers.create({
    amount: Math.round(amount * 100), // cents
    currency: 'usd',
    destination: client.stripeAccountId,
    metadata: { clientId },
  });

  // Record payout
  await db.payout.create({
    data: {
      clientId,
      amount,
      stripeTransferId: transfer.id,
      status: 'PENDING',
    },
  });

  return transfer;
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

  if (!order) throw new Error('Order not found');

  // Group by client
  const clientAmounts = new Map<string, number>();

  for (const item of order.items) {
    const clientId = item.product.clientId;
    const amount = Number(item.price) * item.quantity;
    const commission = amount * 0.15; // 15% platform fee
    const payout = amount - commission;

    clientAmounts.set(
      clientId,
      (clientAmounts.get(clientId) || 0) + payout
    );
  }

  // Process each payout
  for (const [clientId, amount] of clientAmounts) {
    await createPayout(clientId, amount);
  }
}
```

### 5. Webhook Expansion
**Update:** `src/app/api/webhooks/stripe/route.ts`

Add these event handlers:
- `account.updated` - Track Connect account status
- `transfer.created` - Record payout initiated
- `payout.paid` - Record payout completed
- `payout.failed` - Handle payout failures

## Database Schema Addition

```prisma
model Payout {
  id               String       @id @default(cuid())
  clientId         String
  amount           Decimal      @db.Decimal(10, 2)
  stripeTransferId String?
  stripePayoutId   String?
  status           PayoutStatus @default(PENDING)
  failureReason    String?
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  client Client @relation(fields: [clientId], references: [id])

  @@index([clientId])
  @@index([status])
}

enum PayoutStatus {
  PENDING
  IN_TRANSIT
  PAID
  FAILED
  CANCELLED
}

// Update Client model
model Client {
  // ... existing fields
  stripeAccountId String?
  stripeAccountStatus String? // "pending", "complete", "restricted"
  payouts Payout[]
}
```

## Environment Variables
```env
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

## Success Criteria
- [ ] Checkout creates Stripe session
- [ ] Clients can onboard to Connect
- [ ] Order completion triggers payouts
- [ ] Webhook updates payout status
- [ ] Client portal shows payout history

## Testing
```bash
# Test webhook locally
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Trigger test events
stripe trigger checkout.session.completed
stripe trigger payout.paid
```
