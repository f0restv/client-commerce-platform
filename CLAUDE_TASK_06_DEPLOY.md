# TASK 06: Deployment & E2E Testing

## Objective
Deploy to production and verify the complete flow works end-to-end.

## Prerequisites Checklist
Before deployment, ensure:
- [ ] Database is set up (TASK 01)
- [ ] Market data is wired (TASK 02)
- [ ] Platform API exists (TASK 03)
- [ ] At least one sales channel works (TASK 04 or 05)
- [ ] CollektIQ calls platform API

## Deployment Options

### Option A: Vercel (Recommended for Next.js)

1. **Connect GitHub repo**
   - Go to vercel.com
   - Import client-commerce-platform repo
   - Framework: Next.js (auto-detected)

2. **Environment Variables**
   Set in Vercel dashboard:
   ```
   DATABASE_URL=postgresql://...
   ANTHROPIC_API_KEY=sk-ant-...
   EBAY_CLIENT_ID=...
   EBAY_CLIENT_SECRET=...
   STRIPE_SECRET_KEY=...
   STRIPE_WEBHOOK_SECRET=...
   COLLEKTIQ_API_KEY=...
   TWILIO_ACCOUNT_SID=...
   TWILIO_AUTH_TOKEN=...
   SENDGRID_API_KEY=...
   INNGEST_EVENT_KEY=...
   INNGEST_SIGNING_KEY=...
   NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
   ```

3. **Database**
   - Use Vercel Postgres, Supabase, or Neon
   - Run migrations: `npx prisma migrate deploy`

4. **Deploy CollektIQ**
   - Same process, different repo
   - Set `PLATFORM_API_URL` to platform domain
   - Set `PLATFORM_API_KEY` matching platform's `COLLEKTIQ_API_KEY`

### Option B: Railway/Render

Similar process but configure build command:
```bash
npm run build && npx prisma migrate deploy
```

## E2E Test Scenarios

### Scenario 1: Item Submission & Analysis
```
1. Client logs into portal
2. Uploads coin images
3. AI identifies and grades
4. Market pricing appears
5. Client confirms submission
6. Admin sees in queue
```

### Scenario 2: Listing & Sale
```
1. Admin approves submission
2. Product listed to eBay
3. Customer purchases
4. Order syncs back
5. Client notified of sale
6. Payout processed
```

### Scenario 3: CollektIQ Scan
```
1. User opens CollektIQ
2. Takes photo of item
3. Gets identification
4. Gets REAL pricing (from platform)
5. Sees "Buy Now" option
6. Links to marketplace listing
```

### Scenario 4: Auction Flow
```
1. Product listed as auction
2. Users place bids
3. Outbid notifications sent
4. Auction ends
5. Winner charged
6. Seller paid
```

## Playwright E2E Tests

**File:** `e2e/submission.spec.ts`
```typescript
import { test, expect } from '@playwright/test';

test('client can submit item', async ({ page }) => {
  await page.goto('/client-portal');
  await page.click('text=Submit Item');
  
  // Upload image
  await page.setInputFiles('input[type="file"]', 'test-assets/coin.jpg');
  
  // Wait for AI analysis
  await expect(page.locator('[data-testid="ai-result"]')).toBeVisible({ timeout: 30000 });
  
  // Check pricing appeared
  await expect(page.locator('[data-testid="market-price"]')).toContainText('$');
  
  // Submit
  await page.click('text=Submit for Review');
  await expect(page).toHaveURL(/\/client-portal\/submissions/);
});

test('admin can approve submission', async ({ page }) => {
  await page.goto('/admin/submissions');
  await page.click('[data-testid="submission-row"]:first-child');
  await page.click('text=Approve');
  await expect(page.locator('[data-testid="status"]')).toContainText('APPROVED');
});
```

**File:** `e2e/collektiq-scan.spec.ts`
```typescript
test('scan returns real pricing', async ({ page }) => {
  await page.goto('http://localhost:3001/scan');
  
  // Upload image
  await page.setInputFiles('input[type="file"]', 'test-assets/coin.jpg');
  await page.click('text=Identify');
  
  // Wait for result
  await expect(page.locator('[data-testid="pricing"]')).toBeVisible({ timeout: 30000 });
  
  // Verify NOT random (price should be consistent)
  const price1 = await page.locator('[data-testid="price-mid"]').textContent();
  
  // Refresh and scan again
  await page.reload();
  await page.setInputFiles('input[type="file"]', 'test-assets/coin.jpg');
  await page.click('text=Identify');
  
  const price2 = await page.locator('[data-testid="price-mid"]').textContent();
  
  expect(price1).toBe(price2); // Same item = same price
});
```

## Monitoring Checklist

After deployment:
- [ ] Sentry or similar for error tracking
- [ ] Inngest dashboard for job monitoring
- [ ] Stripe webhook logs for payment issues
- [ ] Vercel logs for API errors

## Smoke Test Script

```bash
#!/bin/bash
# smoke-test.sh

BASE_URL=${1:-"https://your-app.vercel.app"}

echo "Testing health..."
curl -f "$BASE_URL/api/health" || exit 1

echo "Testing auth..."
curl -f "$BASE_URL/api/auth/providers" || exit 1

echo "Testing market data..."
curl -f "$BASE_URL/api/v1/inventory?limit=1" || exit 1

echo "All smoke tests passed!"
```

## Rollback Plan

If deployment fails:
1. Vercel: Click "Rollback" on previous deployment
2. Database: Keep migration history, use `prisma migrate resolve`
3. Feature flags: Consider adding for gradual rollout

## Success Criteria
- [ ] Platform deployed and accessible
- [ ] CollektIQ deployed and calling platform
- [ ] Full submission flow works
- [ ] Pricing is real (not mock)
- [ ] At least one payment path works
- [ ] No critical errors in logs
