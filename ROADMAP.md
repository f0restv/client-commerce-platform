# CollektIQ Platform Roadmap

> Single source of truth for project status and priorities.
> Last updated: December 30, 2025

---

## Quick Status

| Phase | Status | Completion |
|-------|--------|------------|
| Phase 1: Core Infrastructure | Done | 100% |
| Phase 2: Integrations | Done | 100% |
| Phase 3: Deployment | In Progress | 80% |
| Phase 4: Consumer UI | Not Started | 0% |
| Phase 5: Polish & Launch | Not Started | 0% |

**Overall: ~70% complete**

---

## Phase 1: Core Infrastructure

### Database & Schema
- [x] PostgreSQL 15 setup (local + Neon serverless)
- [x] Prisma 7 with pg adapter
- [x] 38 database tables defined
- [x] All migrations applied

### Authentication
- [x] NextAuth.js 5 (beta) configured
- [x] Google OAuth provider
- [x] Email/password with bcrypt
- [x] Session management
- [x] User roles: ADMIN, STAFF, CLIENT, BUYER
- [ ] Email verification flow
- [ ] Password reset flow

### Market Data Pipeline
- [x] CDN Exchange scraper (3,288 coins, 11MB cache)
- [x] Greysheet HTML scraper (partial - auth issues)
- [x] PriceCharting scraper (selectors fixed)
- [x] PSA Cards (blocked by Cloudflare - needs Playwright)
- [x] PokemonTracker API client (needs API key)
- [x] Unified MarketDataService with 4 providers
- [x] 7-day cache TTL strategy

### Product Intelligence (AI)
- [x] Claude Vision integration
- [x] 21 collectible categories
- [x] Coin identification from images
- [x] Grade estimation with grading-criteria.ts
- [x] Market evaluation with comparables
- [ ] Grading training data pipeline (scripts exist, need execution)

---

## Phase 2: Integrations

### eBay
- [x] OAuth 2.0 flow
- [x] Token refresh mechanism
- [x] Inventory API integration
- [x] Listing creation/update/delete
- [x] Sold comparables search
- [x] Price sync
- [ ] Production credentials (sandbox only)

### Stripe
- [x] Stripe Checkout
- [x] Stripe Connect for client payouts
- [x] Webhook handlers (5 events)
- [x] Payment intent creation
- [x] Refund handling
- [ ] Subscription products (Free/Pro tiers)

### Platform API (`/api/v1/`)
- [x] `POST /api/v1/analyze` - AI analysis
- [x] `GET /api/v1/inventory` - Inventory listing
- [x] `POST /api/v1/pricing` - Price lookup
- [x] `POST /api/v1/auth/token` - Token generation
- [x] API key authentication
- [x] Request validation
- [ ] Rate limiting per key
- [ ] `/api/health` endpoint

### Other Integrations
- [x] Twilio SMS notifications
- [x] SendGrid email notifications
- [x] UploadThing file uploads
- [x] Inngest background jobs
- [ ] Etsy (scaffolded, not wired)
- [ ] AuctionFlex 360 (scaffolded)

---

## Phase 3: Deployment

### Vercel
- [x] Project configured
- [x] GitHub integration active
- [x] Build script fixed (`prisma generate && next build`)
- [x] TypeScript errors fixed
- [ ] Environment variables set in dashboard
- [ ] Production domain configured
- [ ] Verify production endpoints

### Environment Variables Required
```
DATABASE_URL=postgresql://...
ANTHROPIC_API_KEY=sk-ant-...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=https://collektiq.com
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
EBAY_CLIENT_ID=...
EBAY_CLIENT_SECRET=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
POKEMON_TRACKER_API_KEY=...
```

### Testing
- [x] Vitest configured
- [x] 65+ tests passing
- [ ] Fix 5 failing tests (margin logic, eBay stats, timeouts)
- [ ] Playwright E2E tests
- [ ] Core flow test: scan -> analyze -> save -> list

---

## Phase 4: Consumer UI

### `/scan` Page (Priority 1)
- [ ] Camera/image upload component
- [ ] Loading state during analysis
- [ ] Results display: coin ID, grade, pricing table
- [ ] "Save to Inventory" button
- [ ] Mobile-first design

### `/inventory` Dashboard (Priority 2)
- [ ] List view with filters
- [ ] Item detail pages
- [ ] Bulk actions
- [ ] Status workflow: draft -> listed -> sold -> paid

### `/dashboard` Overview
- [ ] Stats summary
- [ ] Recent activity
- [ ] Quick actions

### Auth Pages
- [ ] Sign in page
- [ ] Sign up page
- [ ] Password reset

### Homepage Rebrand (CollektIQ)
- [ ] Apple-minimal design
- [ ] "Know what it's worth" headline
- [ ] Single CTA: "Start Scanning"
- [ ] Remove CoinVault branding

---

## Phase 5: Polish & Launch

### Code Quality
- [ ] Add structured logging (Pino)
- [ ] Replace JSON file caches with Redis
- [ ] Create BaseScraper class for all scrapers
- [ ] Standardize lazy initialization
- [ ] Add soft deletes to key tables
- [ ] Improve API key auth with per-key rate limits

### Security
- [ ] Input validation audit (Zod everywhere)
- [ ] Rate limiting on public endpoints
- [ ] CSRF protection
- [ ] Content Security Policy headers

### Performance
- [ ] Image optimization pipeline
- [ ] Database query optimization
- [ ] Edge caching for price data
- [ ] Lazy loading for product grids

### SEO & Marketing
- [ ] Meta tags and OG images
- [ ] Sitemap generation
- [ ] Schema.org markup for products
- [ ] Analytics integration

### Legal
- [ ] Terms of Service
- [ ] Privacy Policy
- [ ] Cookie consent banner

---

## Known Issues

### Critical
1. **PSA Cards scraper blocked** - Cloudflare protection requires Playwright browser context
2. **Greysheet returning empty data** - Auth/selectors need fixing

### High Priority
3. **5 failing tests** - Margin logic, eBay stats counting, timeouts
4. **Missing PokemonTracker API key** - Set `POKEMON_TRACKER_API_KEY`

### Medium Priority
5. **JSON file caches** - Should migrate to Redis for production
6. **No structured logging** - Hard to debug in production
7. **Inconsistent error handling** - Some services swallow errors silently

---

## File Reference

### Key Directories
```
src/
├── app/api/v1/          # Platform API endpoints
├── lib/services/        # Core business logic
│   ├── product-intelligence/  # AI grading/ID
│   ├── market-data/          # Price aggregation
│   ├── notifications/        # Email/SMS
│   └── ...
├── lib/integrations/    # External platforms
│   └── ebay/           # eBay OAuth, listings
└── components/          # React UI
```

### Data Files
```
data/
├── cdn-exchange-cache.json   # 11MB, 3,288 coins
├── greysheet-cache.json      # Coin prices
├── training/                 # AI training data
└── grading-reference/        # Grade examples
```

---

## Commands

```bash
# Development
npm run dev              # Start dev server
npm run build           # Production build
npm run type-check      # TypeScript check
npm run lint            # ESLint

# Database
npm run db:generate     # Generate Prisma client
npm run db:push         # Push schema changes
npm run db:studio       # Visual DB browser

# Testing
npm run test            # Run all tests
npm run test:watch      # Watch mode

# Market Data CLI
npx tsx src/lib/services/market-data/index.ts status
npx tsx src/lib/services/market-data/index.ts search "morgan dollar"
```

---

## Architecture Decisions

### Why Next.js App Router?
- Server components reduce client bundle
- Built-in API routes
- Vercel deployment optimized
- React 19 support

### Why Prisma with pg adapter?
- Type-safe database access
- Works with Neon serverless
- Easy migrations
- Prisma Studio for debugging

### Why JSON file caches (for now)?
- Fast to implement
- Works without Redis in dev
- **Should migrate to Redis for production**

### Why Claude for AI?
- Best vision model for collectibles
- Structured output support
- Consistent quality

---

## Next Actions

1. **Set Vercel env vars** - Unblock production deployment
2. **Build `/scan` page** - Core user flow
3. **Fix failing tests** - CI/CD stability
4. **Add `/api/health`** - Monitoring readiness
5. **Migrate to Redis caching** - Production readiness
