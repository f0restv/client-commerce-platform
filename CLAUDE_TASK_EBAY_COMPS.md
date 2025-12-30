# Task: eBay Sold Comps Integration

## Objective
Fetch recent eBay sold listings for price comparison.

## Steps
1. Use existing eBay OAuth in src/lib/ebay/
2. Create /api/v1/comps endpoint:
   - Input: coin type, grade (e.g., "Morgan Dollar 1921 MS63")
   - Output: last 10 sold listings with prices, dates, images
3. Build eBay search query from coin identification
4. Cache results (1 hour TTL) to avoid rate limits
5. Display comps in scan results alongside CDN pricing
6. Store in database for historical analysis
