# TASK 02: Wire Market Data to ProductIntelligence

## Objective
Connect the new market-data service to ProductIntelligence so AI analysis includes real pricing.

## Current State
- `src/lib/services/market-data/` - NEW unified price aggregation (4 providers)
- `src/lib/services/product-intelligence.ts` - AI identification service
- They are NOT connected

## The Integration

### 1. First, test market-data works
```bash
cd /Users/capitalpawn/Documents/GitHub/client-commerce-platform
npx tsx src/lib/services/market-data/index.ts check
npx tsx src/lib/services/market-data/index.ts search "morgan dollar"
```

### 2. Update ProductIntelligence to use MarketData

In `src/lib/services/product-intelligence.ts`, add:

```typescript
import { MarketData, MarketPrice } from './market-data';

// In the analyze function, after AI identification:
async function getMarketPricing(identification: Identification): Promise<MarketPrice[]> {
  const searchTerms = buildSearchTerms(identification);
  const results = await MarketData.search(searchTerms.join(' '), {
    category: mapCategory(identification.category),
    limit: 5,
  });
  return results;
}

function buildSearchTerms(id: Identification): string[] {
  const terms: string[] = [];
  if (id.year) terms.push(String(id.year));
  if (id.name) terms.push(id.name);
  if (id.mint) terms.push(id.mint);
  if (id.denomination) terms.push(id.denomination);
  // etc
  return terms;
}

function mapCategory(cat: string): CollectibleCategory {
  const map: Record<string, CollectibleCategory> = {
    'coin': 'coin',
    'currency': 'coin', 
    'sports-card': 'sports-card',
    'pokemon': 'pokemon',
    'comic': 'comic',
  };
  return map[cat] || 'other';
}
```

### 3. Update the Response Type

The ProductIntelligence response should include market data:

```typescript
interface AnalysisResult {
  identification: Identification;
  grade: GradeEstimate;
  marketData: {
    sources: MarketPrice[];
    estimatedValue: {
      low: number;
      mid: number;
      high: number;
    };
    lastUpdated: string;
  };
}
```

### 4. Calculate Estimated Value

Aggregate across sources:
```typescript
function calculateEstimatedValue(prices: MarketPrice[]): { low: number; mid: number; high: number } {
  if (prices.length === 0) return { low: 0, mid: 0, high: 0 };
  
  const allMids = prices
    .map(p => p.prices.raw?.mid || Object.values(p.prices.graded || {})[0]?.mid)
    .filter((v): v is number => v !== undefined);
  
  if (allMids.length === 0) return { low: 0, mid: 0, high: 0 };
  
  const avg = allMids.reduce((a, b) => a + b, 0) / allMids.length;
  return {
    low: Math.round(avg * 0.8),
    mid: Math.round(avg),
    high: Math.round(avg * 1.2),
  };
}
```

## Success Criteria
- [ ] Market data service runs without errors
- [ ] ProductIntelligence imports MarketData
- [ ] AI analysis returns real price data (not mocks)
- [ ] Portal submission shows estimated value

## Files to Modify
- `src/lib/services/product-intelligence.ts` - add market data integration
- `src/lib/services/market-data/index.ts` - may need adjustments

## Test
```bash
# After changes, test the full flow:
npx tsx -e "
import { ProductIntelligence } from './src/lib/services/product-intelligence';
// Test with a coin image or description
"
```
