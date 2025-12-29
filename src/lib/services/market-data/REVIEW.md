# Market Data Service Review

**Reviewed:** 2025-12-28
**Reviewer:** Claude Code

---

## Summary

The market data service provides a solid foundation for aggregating pricing from multiple collectibles sources. The architecture is sound, but there are critical issues preventing the scrapers from working in production.

---

## What Works Well

1. **Strong TypeScript** - No `any` types found. Well-defined interfaces for all data structures.

2. **Error Handling in Unified Service** - Uses `Promise.allSettled` for parallel searches (`index.ts:146`), gracefully handling provider failures without crashing.

3. **Consistent Cache Pattern** - All providers use the same cache structure with TTL validation.

4. **Rate Limiting** - Greysheet (500ms) and Pokemon API (1000ms) have proper rate limiting to avoid being blocked.

5. **Good CLI Interfaces** - Each provider has a helpful CLI for testing and debugging.

6. **Status Tracking** - Provider status is tracked to `data/provider-status.json` with error messages.

---

## Critical Issues

### 1. PriceCharting Scraper Selectors Are Wrong
**File:** `providers/pricecharting.ts:155-172`
**Priority:** CRITICAL

The scraper looks for `table.results tr` but the actual HTML uses:
- Table container: `#offer_list table`
- Row class: `tr.offer`
- Product name: `h2.product_name`
- Links: `a[href^="/offers"]` or `a[href^="/game"]`

**Result:** Search returns 0 results despite successful HTTP response.

**Fix Required:** Update selectors to match current site structure.

---

### 2. PSA Cards Site Blocked by Cloudflare
**File:** `providers/psa-cards.ts:85-94`
**Priority:** CRITICAL

PSA's website uses Cloudflare bot protection. Simple fetch requests receive a JavaScript challenge page instead of actual content.

**Result:** All PSA searches/fetches fail.

**Fix Required:** Use Playwright with proper browser context (like Greysheet does).

---

### 3. types.ts File Missing
**File:** Referenced in requirements but doesn't exist
**Priority:** HIGH

The architecture doc (`CLAUDE_TASK_PRICE_GUIDES.md:66`) specifies a shared `types.ts` file, but types are defined inline in `index.ts:24-55`. This causes:
- Types not importable by other services
- Duplication if providers need shared types

**Fix Required:** Extract types to `types.ts` and export from index.

---

## High Priority Issues

### 4. Greysheet Returns Empty Price Data
**File:** `providers/greysheet.ts` + `data/greysheet-cache.json`
**Priority:** HIGH

The cache shows:
```json
"1881-s-1-ms": {
  "name": "Greysheet: U.S. & World Currency Values For Dealers & Collectors",
  "grades": {}  // Empty!
}
```

The scraper extracted the homepage title, not the coin name, and found no grade prices. This indicates:
1. Authentication isn't working (page redirects to login)
2. Selectors may be outdated for current Greysheet HTML

---

### 5. PokemonTracker Requires API Key
**File:** `providers/pokemon-tracker.ts:55`
**Priority:** HIGH (expected)

This is documented behavior - the API requires `POKEMON_TRACKER_API_KEY` env var. Status correctly shows as unavailable.

---

## Medium Priority Issues

### 6. No Rate Limiting in PriceCharting for Parallel Searches
**File:** `providers/pricecharting.ts:186-193`
**Priority:** MEDIUM

When searching all categories, there's only a 300ms delay between categories. If many searches run concurrently, this could trigger rate limiting.

**Recommendation:** Add request queuing or increase delay.

---

### 7. Hardcoded Configuration Values
**Files:** All providers
**Priority:** MEDIUM

TTL, rate limits, and URLs are hardcoded:
- `CACHE_TTL_DAYS = 7` (appears in 4 files)
- Rate limit delays scattered throughout
- Base URLs hardcoded

**Recommendation:** Create shared config file or use environment variables.

---

### 8. Inconsistent Import of PSA Cards
**File:** `index.ts`
**Priority:** MEDIUM

PSA Cards provider exists but is NOT imported or used in the unified service. The `index.ts` only imports:
- Greysheet
- PriceCharting
- PokemonTracker

Sports cards category falls back to PriceCharting only.

---

## Low Priority Issues

### 9. Fragile CLI Entry Point Detection
**Files:** All provider files
**Priority:** LOW

CLI detection uses string matching:
```typescript
if (process.argv[1]?.includes('greysheet.ts'))
```

This could fail with symlinks or different execution contexts.

**Recommendation:** Use `import.meta.url` comparison.

---

### 10. Empty Catch Blocks
**Files:** `greysheet.ts:30`, `pokemon-tracker.ts:121`, `psa-cards.ts:66`
**Priority:** LOW

Some cache loading functions silently swallow errors:
```typescript
catch { /* ignore */ }
```

Consider logging at debug level.

---

### 11. Potential Race Condition in Cache Updates
**Files:** All providers
**Priority:** LOW

Multiple concurrent requests could read/write cache simultaneously:
```typescript
const cache = loadCache();  // Read
// ... async operation ...
cache.prices[slug] = price;  // Modify
saveCache(cache);           // Write - could overwrite concurrent changes
```

Not critical for weekly refresh pattern, but worth noting.

---

## Functionality Test Results

| Command | Result | Notes |
|---------|--------|-------|
| `index.ts status` | ✓ Works | Shows provider status |
| `index.ts check` | ✓ Works | Correctly identifies available/unavailable |
| `index.ts search "charizard"` | ✗ Fails | Returns 0 results (scraper issue) |
| `pricecharting.ts search "pokemon"` | ✗ Fails | Returns 0 results (selector issue) |
| `psa-cards.ts status` | ✓ Works | Shows empty cache |
| `psa-cards.ts search` | ✗ Fails | Cloudflare blocks request |

---

## Integration Assessment

### Will this integrate with ProductIntelligence?
**Partially.** The `MarketPrice` interface is well-designed, but:
1. The service currently returns empty results
2. PSA integration is incomplete (not imported)
3. No types.ts export means other services can't import types cleanly

### Is MarketPrice type compatible?
**Yes.** The type covers necessary fields. Minor improvement: add optional `confidence` score for estimated prices.

### Can the portal UI consume this easily?
**Yes, once working.** The normalized `MarketPrice` structure with consistent `prices.raw` and `prices.graded` format is UI-friendly.

---

## Recommendations Priority

1. **CRITICAL:** Fix PriceCharting selectors (blocks all Pokemon/sports/comic/funko searches)
2. **CRITICAL:** Add Playwright to PSA Cards (blocks sports card pricing)
3. **HIGH:** Extract types.ts for clean imports
4. **HIGH:** Import and integrate PSA Cards in unified service
5. **MEDIUM:** Fix Greysheet authentication detection
6. **MEDIUM:** Add shared configuration

---

## Fixes Applied

### 1. Fixed PriceCharting Scraper Selectors
**File:** `providers/pricecharting.ts:145-197`

Updated selectors to match current site structure:
- Changed from `table.results tr` to `#offer_list table tr.offer`
- Product name: `h2.product_name`
- Proper URL extraction from `/offers?product=ID` and `/game/slug` formats
- Better price extraction from `<p>` tags containing `$`

**Result:** Search now returns results correctly.

### 2. Created types.ts
**File:** `types.ts` (new)

Extracted shared types to dedicated file:
- `CollectibleCategory`
- `MarketPrice`
- `ProviderStatus`
- `PriceRange`
- `MarketDataProvider` interface
- `SearchOptions`
- `BaseCache<T>` generic

Types are now properly exported from `index.ts` for use by other services.

### 3. Integrated PSA Cards Provider
**File:** `index.ts`

- Added `PSACards` import
- Created `searchPSACards()` adapter function
- Added PSA Cards to sports-card category search
- Added `psacards` and `psa` cases to `getPrice()`
- Added PSA Cards to `checkProviders()`

**Result:** Sports card searches now query both PriceCharting and PSA Cards.

---

## Files Changed

| File | Change |
|------|--------|
| `providers/pricecharting.ts` | Fixed scraper selectors for current site structure |
| `types.ts` | Created - shared type definitions |
| `index.ts` | Import types, integrate PSA Cards provider |
| `REVIEW.md` | Created - this review document |

---

## Verification

```bash
# Search now works
$ npx tsx src/lib/services/market-data/index.ts search "charizard"
Found 20 results:
[pokemon] Charizard ex Pokemon Scarlet & Violet 151
  Source: PriceCharting
  Price: $300.00
...

# All providers show in status
$ npx tsx src/lib/services/market-data/index.ts check
✓ Greysheet
✓ PriceCharting
✓ PSA Cards
✗ PokemonTracker (needs API key)
```

---

## Remaining Work

1. **PSA Cards Cloudflare bypass** - Live searches blocked; consider adding Playwright
2. **Greysheet authentication** - Ensure browser session or cookies are configured
3. **PokemonTracker API key** - Set `POKEMON_TRACKER_API_KEY` environment variable
4. **Shared configuration** - Extract hardcoded values to config file
