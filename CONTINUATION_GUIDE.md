# CollektIQ Project - Continuation Guide
**Generated:** Dec 30, 2024

## Quick Start
```bash
# Clone repos
cd ~/Documents/GitHub
git clone https://github.com/f0restv/client-commerce-platform.git
git clone https://github.com/f0restv/collektiq.git

# Install deps
cd client-commerce-platform && npm install
cd ../collektiq && npm install

# Run locally
cd client-commerce-platform && npm run dev  # port 3000
cd collektiq && npm run dev                 # port 3001
```

---

## Live URLs
| Service | URL |
|---------|-----|
| **Production** | https://collektiq.com |
| **Vercel Dashboard** | https://vercel.com/f0restvs-projects/client-commerce-platform |
| **Neon DB** | https://console.neon.tech |

---

## Database
**Neon PostgreSQL (38 tables deployed)**
```
postgresql://neondb_owner:npg_xmtu6U7pEMwV@ep-purple-bonus-adbta214-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require
```

Set in `.env.local`:
```env
DATABASE_URL="postgresql://neondb_owner:npg_xmtu6U7pEMwV@ep-purple-bonus-adbta214-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"
NEXTAUTH_URL="https://collektiq.com"
NEXTAUTH_SECRET="hqHpK2e9IujJsn8IFDPB5OTLHrVWzoaTEg31bqKjpdw="
ANTHROPIC_API_KEY="<get from Vercel dashboard or secure storage>"
```

---

## Repos
| Repo | Purpose | Status |
|------|---------|--------|
| `client-commerce-platform` | Backend API + Platform | ✅ Live |
| `collektiq` | Consumer app | ✅ Live |
| `45north-site` | Marketing | Low priority |
| `coinsite` | Legacy | Archive after merge |
| `clientpotal45NCC` | Obsolete | Delete |

---

## Tech Stack
- **Frontend/Backend:** Next.js 16
- **Database:** Neon (serverless Postgres)
- **ORM:** Prisma
- **Auth:** NextAuth.js
- **AI:** Claude API (Anthropic)
- **Payments:** Stripe Connect
- **Hosting:** Vercel

---

## What's Built
- [x] 38 database tables (Prisma schema)
- [x] Platform API (`/api/v1/analyze`, `/inventory`, `/pricing`)
- [x] ProductIntelligence service
- [x] eBay OAuth + listings + comps
- [x] Stripe Checkout + Connect
- [x] CDN Exchange data (3,288 coins priced)
- [x] Vercel deployment pipeline
- [x] Neon DB migration

---

## What's In Progress
| Task | Status |
|------|--------|
| Phase 1 core loop (Scan→ID→Grade→Price→List) | Delegated |
| Landing page redesign (premium look) | Delegated |
| Grading training data pipeline | Delegated |
| CollektIQ ↔ Platform DB unification | Delegated |

---

## The Vision (MASTER_VISION.md)

### One App, Three Revenue Streams
1. **Pro Subscriptions** - Aggregated pricing data ($15-50/mo)
2. **Marketplace Commission** - 8-12% on sales
3. **Client Portal Fees** - 15-25% for ecommerce management

### The Moat
Dealers pay $500+/yr across Greysheet, CDN, PCGS, eBay Terapeak.
**We aggregate ALL sources into ONE scan.**

### The Flywheel
```
Scan (free) → Hooked → Pro subscription
     ↓
Every scan = training data → AI improves
     ↓
Better AI → More users → Marketplace → Volume
```

---

## Data Sources
| Source | Status |
|--------|--------|
| CDN Exchange | ✅ 3,288 coins scraped |
| eBay solds | ✅ API working |
| Greysheet | ⏳ Need API/scrape |
| Heritage Auctions | ❌ Blocked |
| PCGS TrueView | ⏳ Partial |
| CAC | ⏳ Not started |

---

## Claude Code Patterns
```bash
# Delegate task with auto-permissions
claude --dangerously-skip-permissions 'Read TASK.md and complete it'

# Run multiple in parallel (separate terminals)
cd /path/to/repo && claude --dangerously-skip-permissions 'task 1'
cd /path/to/repo && claude --dangerously-skip-permissions 'task 2'
```

Create task files like:
```markdown
# CLAUDE_TASK_NAME.md
## Objective
What to accomplish

## Steps
1. First thing
2. Second thing

## When Complete
Report what was done
```

---

## Key Files
| File | Purpose |
|------|---------|
| `MASTER_VISION.md` | Product vision + strategy |
| `data/cdn-exchange-cache.json` | 3,288 coins, 11MB |
| `prisma/schema.prisma` | Database schema |
| `src/lib/services/product-intelligence/` | AI grading/pricing |
| `src/app/api/v1/` | Platform API endpoints |

---

## Environment Variables (Vercel)
Set in Vercel Dashboard → Settings → Environment Variables:
- `DATABASE_URL` ✅
- `NEXTAUTH_URL` ✅
- `NEXTAUTH_SECRET` ✅
- `ANTHROPIC_API_KEY` ✅
- `EBAY_CLIENT_ID` ⏳
- `EBAY_CLIENT_SECRET` ⏳
- `STRIPE_SECRET_KEY` ⏳
- `STRIPE_WEBHOOK_SECRET` ⏳

---

## Next Steps (Priority Order)
1. **Test production** - Visit collektiq.com, verify scan works
2. **Complete Phase 1** - Scan → ID → Grade → Price → List flow
3. **Add your inventory** - Forest has hundreds of coins ready
4. **Pro subscription tier** - Gate premium data behind paywall
5. **Grading data collection** - More sources = better AI

---

## Commands Reference
```bash
# Database
npx prisma studio              # Visual DB browser
npx prisma db push             # Push schema to Neon
npx prisma generate            # Generate client

# Development
npm run dev                    # Start local server
npm run build                  # Production build
npm test                       # Run tests

# Deployment
git push                       # Auto-deploys to Vercel
npx vercel --prod              # Manual production deploy
npx vercel env ls              # List env vars
```
