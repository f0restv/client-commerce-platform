# TASK 04: eBay Integration

## Objective
Wire up real eBay API integration for:
1. OAuth authentication
2. Creating listings
3. Syncing sold items
4. Fetching comparable sales (for pricing)

## Current State
- `src/lib/integrations/ebay.ts` exists but is a stub
- No OAuth flow
- No real API calls

## eBay API Setup

### 1. Get API Credentials
1. Go to https://developer.ebay.com/
2. Create a developer account
3. Create an application (Production keys)
4. Get: App ID (Client ID), Cert ID (Client Secret), Dev ID

### 2. Environment Variables
```env
EBAY_CLIENT_ID=your_app_id
EBAY_CLIENT_SECRET=your_cert_id
EBAY_DEV_ID=your_dev_id
EBAY_REDIRECT_URI=https://yourapp.com/api/integrations/ebay/callback
EBAY_SANDBOX=false
```

## Files to Create/Update

### 1. eBay OAuth Flow
**File:** `src/lib/integrations/ebay/auth.ts`

```typescript
const EBAY_AUTH_URL = 'https://auth.ebay.com/oauth2/authorize';
const EBAY_TOKEN_URL = 'https://api.ebay.com/identity/v1/oauth2/token';

export function getAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.EBAY_CLIENT_ID!,
    redirect_uri: process.env.EBAY_REDIRECT_URI!,
    response_type: 'code',
    scope: [
      'https://api.ebay.com/oauth/api_scope',
      'https://api.ebay.com/oauth/api_scope/sell.inventory',
      'https://api.ebay.com/oauth/api_scope/sell.marketing',
      'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
    ].join(' '),
    state,
  });
  return `${EBAY_AUTH_URL}?${params}`;
}

export async function exchangeCodeForToken(code: string): Promise<EbayTokens> {
  const credentials = Buffer.from(
    `${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`
  ).toString('base64');

  const response = await fetch(EBAY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.EBAY_REDIRECT_URI!,
    }),
  });

  return response.json();
}

export async function refreshToken(refreshToken: string): Promise<EbayTokens> {
  // Similar to above but with grant_type: 'refresh_token'
}
```

### 2. OAuth Callback Route
**File:** `src/app/api/integrations/ebay/callback/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForToken } from '@/lib/integrations/ebay/auth';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // Contains clientId
  
  if (!code || !state) {
    return NextResponse.redirect('/error?msg=missing_params');
  }

  const tokens = await exchangeCodeForToken(code);
  
  // Store tokens for this client
  await db.clientIntegration.upsert({
    where: { clientId_platform: { clientId: state, platform: 'EBAY' } },
    create: {
      clientId: state,
      platform: 'EBAY',
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    },
    update: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    },
  });

  return NextResponse.redirect('/admin/integrations?connected=ebay');
}
```

### 3. Listing Service
**File:** `src/lib/integrations/ebay/listings.ts`

```typescript
const EBAY_API = 'https://api.ebay.com';

export async function createListing(
  accessToken: string,
  product: Product,
  options: ListingOptions
): Promise<EbayListingResult> {
  // Use Inventory API for managed payments
  const inventoryItem = {
    availability: {
      shipToLocationAvailability: {
        quantity: 1,
      },
    },
    condition: mapCondition(product.condition),
    product: {
      title: product.title,
      description: product.description,
      imageUrls: product.images.map(i => i.url),
      aspects: buildAspects(product),
    },
  };

  // 1. Create/update inventory item
  await fetch(`${EBAY_API}/sell/inventory/v1/inventory_item/${product.sku}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(inventoryItem),
  });

  // 2. Create offer
  const offer = {
    sku: product.sku,
    marketplaceId: 'EBAY_US',
    format: options.auction ? 'AUCTION' : 'FIXED_PRICE',
    listingPolicies: {
      fulfillmentPolicyId: options.fulfillmentPolicyId,
      paymentPolicyId: options.paymentPolicyId,
      returnPolicyId: options.returnPolicyId,
    },
    pricingSummary: {
      price: { value: product.price.toString(), currency: 'USD' },
    },
    categoryId: options.categoryId,
  };

  const offerResponse = await fetch(`${EBAY_API}/sell/inventory/v1/offer`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(offer),
  });

  const offerData = await offerResponse.json();

  // 3. Publish offer
  const publishResponse = await fetch(
    `${EBAY_API}/sell/inventory/v1/offer/${offerData.offerId}/publish`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}` },
    }
  );

  return publishResponse.json();
}
```

### 4. Sold Items Sync (Webhook or Poll)
**File:** `src/lib/integrations/ebay/sync.ts`

```typescript
export async function syncSoldItems(clientId: string): Promise<void> {
  const integration = await db.clientIntegration.findUnique({
    where: { clientId_platform: { clientId, platform: 'EBAY' } },
  });

  const accessToken = await ensureValidToken(integration);

  // Fetch recent orders
  const response = await fetch(
    `${EBAY_API}/sell/fulfillment/v1/order?filter=orderfulfillmentstatus:{NOT_STARTED|IN_PROGRESS}`,
    {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    }
  );

  const { orders } = await response.json();

  for (const order of orders) {
    // Match to our products by SKU
    for (const lineItem of order.lineItems) {
      const product = await db.product.findFirst({
        where: { sku: lineItem.sku, clientId },
      });

      if (product && product.status !== 'SOLD') {
        await db.product.update({
          where: { id: product.id },
          data: { 
            status: 'SOLD',
            soldAt: new Date(order.creationDate),
            soldPrice: parseFloat(lineItem.total.value),
            ebayOrderId: order.orderId,
          },
        });

        // Create internal order record
        // Notify client
        // etc.
      }
    }
  }
}
```

### 5. Comparable Sales (for pricing)
**File:** `src/lib/integrations/ebay/comps.ts`

```typescript
export async function getComparableSales(
  searchTerms: string[],
  options: { sold?: boolean; limit?: number } = {}
): Promise<EbayCompSale[]> {
  const query = searchTerms.join(' ');
  const filter = options.sold ? 'itemEndDate:[NOW-90DAYS TO NOW]' : '';

  // Use Browse API (doesn't require user auth)
  const response = await fetch(
    `${EBAY_API}/buy/browse/v1/item_summary/search?` +
    new URLSearchParams({
      q: query,
      filter,
      limit: String(options.limit || 20),
    }),
    {
      headers: {
        'Authorization': `Bearer ${await getAppToken()}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
      },
    }
  );

  const data = await response.json();
  return data.itemSummaries.map(mapToCompSale);
}

// App-level token (no user auth needed)
async function getAppToken(): Promise<string> {
  // Use client_credentials grant
}
```

## Database Schema Addition

```prisma
model ClientIntegration {
  id           String   @id @default(cuid())
  clientId     String
  platform     Platform // EBAY, SHOPIFY, ETSY
  accessToken  String
  refreshToken String?
  expiresAt    DateTime
  settings     Json?    // Platform-specific settings
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  client Client @relation(fields: [clientId], references: [id])

  @@unique([clientId, platform])
}

enum Platform {
  EBAY
  SHOPIFY
  ETSY
}
```

## Success Criteria
- [ ] Client can connect eBay account via OAuth
- [ ] Products can be listed to eBay
- [ ] Sold items sync back to platform
- [ ] Comparable sales feed into pricing

## Test Flow
1. Go to `/admin/integrations`
2. Click "Connect eBay"
3. Complete OAuth flow
4. Create a test listing
5. Verify it appears on eBay
