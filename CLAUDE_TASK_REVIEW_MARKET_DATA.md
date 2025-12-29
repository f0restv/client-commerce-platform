# TASK: Review & Evaluate Market Data Service Implementation

## Your Mission
Review the newly created market-data service in `src/lib/services/market-data/`. Evaluate code quality, identify issues, suggest improvements, and fix any problems you find.

## What Was Built
A unified price guide aggregation system with 4 providers:
- Greysheet (coins)
- PriceCharting (multi-category)
- PokemonTracker (Pokemon API)
- PSA Cards (sports)

## Your Review Checklist

### 1. Code Quality Review
- [ ] Check TypeScript types - are they complete and correct?
- [ ] Look for any `any` types that should be specific
- [ ] Verify error handling in all async functions
- [ ] Check for proper null/undefined handling
- [ ] Ensure consistent code style across all provider files

### 2. Architecture Review
- [ ] Does the unified interface in `index.ts` make sense?
- [ ] Are the provider adapters converting data correctly?
- [ ] Is the caching strategy sound (7-day TTL)?
- [ ] Are imports/exports correct between files?

### 3. Functionality Testing
Run these commands and verify they work:
```bash
# Check provider status
npx tsx src/lib/services/market-data/index.ts status

# Test unified search
npx tsx src/lib/services/market-data/index.ts search "charizard"

# Test individual providers
npx tsx src/lib/services/market-data/providers/pricecharting.ts search "pokemon"
npx tsx src/lib/services/market-data/providers/psa-cards.ts status
```

### 4. Issues to Look For
- Missing error boundaries
- Race conditions in parallel searches
- Memory leaks in caching
- Hardcoded values that should be configurable
- Missing rate limiting
- Incomplete scraping selectors (cheerio)

### 5. Integration Check
- [ ] Will this integrate cleanly with `src/lib/services/product-intelligence.ts`?
- [ ] Is the MarketPrice type compatible with existing platform types?
- [ ] Can the portal UI consume this data easily?

## Deliverables

1. **REVIEW.md** - Document your findings:
   - What works well
   - What needs fixing (with file:line references)
   - Suggested improvements
   - Priority ranking (critical/high/medium/low)

2. **Fix Critical Issues** - If you find bugs that would break functionality, fix them

3. **Improve One Thing** - Pick the highest-impact improvement and implement it

## Files to Review
```
src/lib/services/market-data/
├── index.ts              # Main unified service
├── types.ts              # Shared types
└── providers/
    ├── greysheet.ts      # Coin prices (Playwright + cheerio)
    ├── pricecharting.ts  # Multi-category scraper
    ├── pokemon-tracker.ts # Pokemon API client
    └── psa-cards.ts      # Sports card prices
```

Also check:
- `data/greysheet-cache.json` - existing cache
- `CLAUDE_TASK_PRICE_GUIDES.md` - original requirements

## Context
This was rapidly built to aggregate pricing data. The goal is ProductIntelligence uses this to show market values when analyzing items. Quality matters - this affects pricing decisions.

## Start Here
1. Read all files in `src/lib/services/market-data/`
2. Run the test commands above
3. Document findings in REVIEW.md
4. Fix what you find
