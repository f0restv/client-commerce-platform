# Task: Build /scan Page

## Context
/api/v1/analyze ALREADY EXISTS and does: identify coin, estimate grade, fetch pricing.

## Objective
Build mobile-friendly /scan UI that uses the existing API.

## Steps
1. Create src/app/scan/page.tsx
2. Components needed:
   - Camera/image upload (use device camera on mobile)
   - Loading state while analyzing
   - Results display: coin ID, grade estimate, pricing table
   - "Save to Inventory" button
3. Call /api/v1/analyze with base64 image
4. Style with Tailwind, mobile-first
5. Add to navigation

## Existing code to reference
- src/app/api/v1/analyze/route.ts (the API)
- src/app/train-grading/page.tsx (has image upload)
