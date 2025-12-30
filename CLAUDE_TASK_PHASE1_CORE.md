# Task: Build Phase 1 Core Loop

## Objective
Create unified /api/v1/analyze endpoint that powers: Scan → ID → Grade → Price → List

## Steps
1. Create /api/v1/analyze endpoint that:
   - Accepts image upload (base64 or multipart)
   - Identifies coin type (Morgan, Peace, etc.)
   - Estimates grade using grading-criteria.ts
   - Fetches pricing from CDN cache (data/cdn-exchange-cache.json - 3,288 coins)
   - Returns structured response with all data

2. Wire up existing services:
   - src/lib/services/product-intelligence/grading-criteria.ts
   - src/lib/services/product-intelligence/coin-identification.ts (create if missing)
   - CDN pricing lookup

3. Create /scan UI page for testing:
   - Image upload component
   - Display: identified coin, grade estimate, pricing across grades
   - "Create Listing" button (draft to inventory)

4. Aggregate pricing sources:
   - CDN Exchange (primary - we have data)
   - eBay sold comps (if available)

## Key Files
- data/cdn-exchange-cache.json (11MB, 3,288 coins)
- src/lib/services/product-intelligence/
- prisma/schema.prisma (Inventory, Listing models)
