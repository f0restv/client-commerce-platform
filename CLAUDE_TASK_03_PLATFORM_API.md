# TASK 03: Create Platform API for CollektIQ

## Objective
Build public API endpoints that CollektIQ (consumer app) will call. CollektIQ should NOT duplicate AI/pricing logic.

## Current State
- CollektIQ has its own `/api/analyze` that duplicates Claude calls
- CollektIQ returns MOCK pricing data (random numbers)
- No connection between the two apps

## API Routes to Create

```
src/app/api/v1/
├── analyze/route.ts       # Public item analysis endpoint
├── pricing/route.ts       # Get market pricing for item
├── inventory/route.ts     # Browse available inventory
└── auth/
    └── token/route.ts     # API key authentication
```

### 1. Public Analysis Endpoint
**File:** `src/app/api/v1/analyze/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { identify } from '@/lib/services/product-intelligence/identify';
import { estimateGrade } from '@/lib/services/product-intelligence/grade';
import { MarketData } from '@/lib/services/market-data';

export async function POST(request: NextRequest) {
  // Validate API key
  const apiKey = request.headers.get('x-api-key');
  if (!validateApiKey(apiKey)) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
  }

  const { images } = await request.json();
  
  // 1. Identify item
  const identification = await identify(images);
  
  // 2. Estimate grade
  const grade = await estimateGrade(images, identification);
  
  // 3. Get market pricing
  const searchQuery = buildSearchQuery(identification);
  const marketPrices = await MarketData.search(searchQuery, {
    category: identification.category,
    limit: 5,
  });
  
  // 4. Calculate estimated value
  const estimatedValue = calculateEstimate(marketPrices, grade);

  return NextResponse.json({
    identification,
    grade,
    pricing: {
      sources: marketPrices,
      estimated: estimatedValue,
    },
    searchTerms: identification.searchTerms,
  });
}
```

### 2. Inventory Browse Endpoint
**File:** `src/app/api/v1/inventory/route.ts`

```typescript
// GET /api/v1/inventory?category=coins&limit=20&cursor=xxx
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const limit = parseInt(searchParams.get('limit') || '20');
  const cursor = searchParams.get('cursor');
  const query = searchParams.get('q');

  const products = await db.product.findMany({
    where: {
      status: 'ACTIVE',
      ...(category && { category }),
      ...(query && { 
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ]
      }),
    },
    include: {
      images: { take: 1 },
      client: { select: { name: true, slug: true } },
    },
    take: limit,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({
    items: products,
    nextCursor: products.length === limit ? products[products.length - 1].id : null,
  });
}
```

### 3. API Key System
**File:** `src/lib/api-keys.ts`

```typescript
// Simple API key validation
// In production, store in database with rate limits

const VALID_KEYS = new Set([
  process.env.COLLEKTIQ_API_KEY,
  // Add more keys as needed
]);

export function validateApiKey(key: string | null): boolean {
  if (!key) return false;
  return VALID_KEYS.has(key);
}

export function getRateLimits(key: string) {
  // Return rate limits for this key
  return { requestsPerMinute: 60, requestsPerDay: 10000 };
}
```

## Update CollektIQ

After creating platform API, update CollektIQ to use it:

**File:** `collektiq/src/app/api/analyze/route.ts`

Replace the entire file with:
```typescript
import { NextRequest, NextResponse } from 'next/server';

const PLATFORM_URL = process.env.PLATFORM_API_URL || 'http://localhost:3000';
const API_KEY = process.env.PLATFORM_API_KEY;

export async function POST(request: NextRequest) {
  const body = await request.json();
  
  const response = await fetch(`${PLATFORM_URL}/api/v1/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY!,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  return NextResponse.json(data);
}
```

## Environment Variables

**client-commerce-platform/.env:**
```env
COLLEKTIQ_API_KEY=ck_live_xxxxxxxxxxxxx
```

**collektiq/.env:**
```env
PLATFORM_API_URL=http://localhost:3000
PLATFORM_API_KEY=ck_live_xxxxxxxxxxxxx
```

## Success Criteria
- [ ] `/api/v1/analyze` returns real identification + pricing
- [ ] `/api/v1/inventory` returns paginated products
- [ ] API key validation works
- [ ] CollektIQ calls platform instead of duplicating logic
- [ ] No more mock/random pricing data

## Test
```bash
# Test platform API directly
curl -X POST http://localhost:3000/api/v1/analyze \
  -H "Content-Type: application/json" \
  -H "x-api-key: ck_live_test" \
  -d '{"images": ["data:image/jpeg;base64,..."]}'
```
