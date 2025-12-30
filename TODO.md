# Client Commerce Platform - TODO

**Updated:** Dec 29, 2024 @ 7:30 PM PST

## ✅ DONE

### Core Platform
- [x] Database schema (37 tables, Prisma synced)
- [x] Platform API (`/api/v1/analyze`, `/inventory`, `/pricing`, `/auth/token`)
- [x] ProductIntelligence service (21 categories)
- [x] 70+ tests passing
- [x] Build passes
- [x] PostgreSQL running (postgresql@15)

### Integrations
- [x] eBay OAuth + listings + sync + comps
- [x] Stripe Checkout + Connect + webhooks
- [x] CollektIQ wired to platform API

### Market Data - **3,288 COINS PRICED**
- [x] CDN Exchange scraper built
- [x] 43 catalogs scraped (11MB data)
- [x] All catalog IDs mapped (150+ series)
- [x] Morgan Dollars (411)
- [x] Peace Dollars
- [x] Lincoln Wheat Cents (471)
- [x] Jefferson Nickels (438)
- [x] Mercury Dimes (168)
- [x] Walking Liberty Halves
- [x] Kennedy Halves (143)
- [x] Silver Eagles (106)
- [x] Gold coins ($5, $10, $20)

### Grading System (scaffolded)
- [x] Grading criteria module
- [x] Training data capture UI (`/train-grading`)
- [x] Reference photo directory structure

### Deployment
- [x] Vercel project configured
- [x] Build script fixed (prisma generate)

---

## 🟡 IN PROGRESS

| Task | Status |
|------|--------|
| Vercel deployment | Building... |

---

## ❌ TODO

### Deploy (waiting on build)
- [ ] Verify Vercel deploy succeeds
- [ ] Set env vars in Vercel dashboard
- [ ] Test production endpoints

### Grading AI
- [ ] Collect 1000+ TrueView photos
- [ ] Collect Reddit GTG data
- [ ] Build visual comparison prompt
- [ ] Test grading accuracy

### Data Expansion
- [ ] Scrape remaining CDN catalogs (proofs, commemoratives)
- [ ] Add VAM varieties for Morgans
- [ ] Historical price tracking

### Features
- [ ] Real-time auction WebSocket
- [ ] Push notifications for price alerts
- [ ] Mobile scan UX
- [ ] Dealer network/inventory sync

---

## Key Files

| File | Purpose |
|------|---------|
| `data/cdn-exchange-cache.json` | 3,288 coins, 11MB |
| `data/cdn-catalog-ids.md` | All 150+ catalog IDs |
| `src/lib/services/market-data/providers/cdn-exchange.ts` | CDN scraper |
| `src/lib/services/product-intelligence/grading-criteria.ts` | Grading prompts |
| `ARCHITECTURE_REVIEW.md` | Build analysis + top 10 recs |
| `RESUME_INSTRUCTIONS.md` | Setup on new machine |

---

## Commands

```bash
# Dev
npm run dev

# Test CDN data
cat data/cdn-exchange-cache.json | jq '.catalogs | keys | length'  # 43 catalogs
cat data/cdn-exchange-cache.json | jq '[.catalogs[].coins | keys | length] | add'  # 3288 coins

# Deploy
git push  # Auto-deploys via Vercel GitHub integration
```

---

## Env Vars Needed in Vercel

```
DATABASE_URL=postgresql://...
ANTHROPIC_API_KEY=sk-ant-...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=https://client-commerce-platform.vercel.app
EBAY_CLIENT_ID=...
EBAY_CLIENT_SECRET=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
```
