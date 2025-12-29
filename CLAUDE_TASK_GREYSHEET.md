# TASK: Greysheet Scraper Service

## Context
User has active greysheet.com subscription. Browser is logged in.

## URLs
- PDF: https://www.greysheet.com/pdfdl/gymo202601 (Jan 2026 Monthly Greysheet)
- Greensheet: https://www.greysheet.com/pdfdl/gygr202601
- Item pages: https://www.greysheet.com/coin-prices/item/{slug}
- Example slugs: 1881-s-1-ms, 1921-d-1-ms, 2024-1-silver-eagle-ms

## Deliverables
1. Create `src/lib/services/market-data/greysheet.ts`
2. Create `data/greysheet-cache.json` for storage
3. 7-day cache TTL
4. Focus on: Morgan Dollars, Peace Dollars, Silver Eagles, Gold Eagles, Walking Liberty Halves

## Data Structure Needed
```typescript
interface GreysheetPrice {
  slug: string;
  name: string;
  series: string;
  grades: Record<string, { bid: number; ask: number }>;
  lastUpdated: string;
}
```

## Approach Options
1. Use Playwright to scrape item pages (already in project)
2. Download and parse PDF
3. Use their API if one exists (check network tab)

## Run When Done
```bash
npx ts-node src/lib/services/market-data/greysheet.ts
```
