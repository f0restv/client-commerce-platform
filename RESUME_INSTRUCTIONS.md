# RESUME INSTRUCTIONS - Client Commerce Platform

## Quick Start on New Machine

```bash
# Clone repos
git clone https://github.com/f0restv/client-commerce-platform.git
git clone https://github.com/f0restv/collektiq.git

# Install dependencies
cd client-commerce-platform && npm install
cd ../collektiq && npm install
```

## Current State (Dec 29, 2025)

### ✅ COMPLETED (~85%)

**Core Platform:**
- 37 database tables (Prisma schema ready)
- 41 API routes built
- ProductIntelligence service (21 categories)
- Market data service (4 providers)
- Greysheet HTML scraper (965 lines)
- 70+ tests passing

**Integrations:**
- eBay OAuth + listings + sync + comps
- Stripe Checkout + Connect + webhooks
- Platform API (`/api/v1/analyze`, `/inventory`, `/pricing`, `/auth/token`)
- CollektIQ wired to call platform

**Data cached:**
- `data/greysheet-cache.json` - 12 coins, 604 prices
- `data/provider-status.json` - provider health

### ❌ TODO

1. **Fix build errors** - Run `npm run build`, fix TypeScript errors
2. **Deploy to Vercel** - `vercel --prod`
3. **Set env vars in Vercel dashboard**
4. **E2E tests** - Playwright config exists, needs test runs

---

## Environment Variables

Create `.env` with:

```env
# Database
DATABASE_URL="postgresql://user@localhost:5432/client_commerce_platform"

# AI
ANTHROPIC_API_KEY=sk-ant-...

# Market Data
POKEMON_TRACKER_API_KEY=pokeprice_free_90804cf5471f9c16c255194db1a054c8af4e713d03f7508b

# eBay (get from developer.ebay.com)
EBAY_CLIENT_ID=
EBAY_CLIENT_SECRET=
EBAY_DEV_ID=
EBAY_REDIRECT_URI=https://yourapp.com/api/integrations/ebay/callback
EBAY_SANDBOX=true

# Stripe (get from dashboard.stripe.com)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Notifications (optional)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
SENDGRID_API_KEY=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
COLLEKTIQ_API_KEY=ck_live_xxxxxxxxxxxxx
```

---

## Commands

```bash
# Database
npx prisma migrate dev    # Run migrations
npx prisma studio         # Visual DB browser

# Development
npm run dev               # Start dev server (port 3000)

# Testing
npx vitest run            # Run all tests
npx vitest run --reporter=verbose  # Detailed output

# Build & Deploy
npm run build             # Build for production
vercel                    # Deploy preview
vercel --prod             # Deploy production

# Market Data CLI
npx ts-node src/lib/services/market-data/index.ts status
npx ts-node src/lib/services/market-data/index.ts search "morgan dollar"
```

---

## Key Files

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Database schema (37 tables) |
| `src/lib/services/product-intelligence/` | AI analysis service |
| `src/lib/services/market-data/` | Unified price aggregation |
| `src/lib/services/market-data/providers/greysheet-html.ts` | Greysheet scraper |
| `src/lib/integrations/ebay/` | eBay OAuth, listings, comps |
| `src/lib/stripe.ts` | Stripe config |
| `src/app/api/v1/` | Platform API for CollektIQ |
| `CLAUDE_TASK_*.md` | Task files for Claude Code |

---

## CollektIQ Setup

```bash
cd collektiq

# Create .env.local
PLATFORM_API_URL=http://localhost:3000
PLATFORM_API_KEY=ck_live_xxxxxxxxxxxxx

# Run on different port
npm run dev -- -p 3001
```

---

## Resume with Claude Code

```bash
cd client-commerce-platform

# Fix build errors
claude --dangerously-skip-permissions 'Run npm run build and fix all TypeScript errors'

# Deploy
claude --dangerously-skip-permissions 'Deploy to Vercel with vercel --prod, then set up E2E tests with Playwright'

# Or read task files
claude --dangerously-skip-permissions 'Read and execute CLAUDE_TASK_06_DEPLOY.md'
```

---

## Known Issues

1. **Build errors** - Some TypeScript issues need fixing before deploy
2. **Prisma adapter** - Uses Prisma 7 adapter pattern, needs `DATABASE_URL` exported
3. **Test timeouts** - 2 tests may timeout without mocks
4. **Greysheet auth** - Cookies in `data/greysheet-cookies.txt` may expire

---

## Repos

- **Platform**: github.com/f0restv/client-commerce-platform
- **CollektIQ**: github.com/f0restv/collektiq
- **Marketing**: github.com/f0restv/45north-site

---

## Contact

All changes committed. Both repos pushed to GitHub. Ready to resume on any machine.
