# TODO - Client Commerce Platform + CollektIQ

## Current State Assessment (Updated)

### ✅ Complete
- **Schema**: Full Prisma schema with collector features (reviews, collections, offers, auctions, price alerts, search index)
- **ProductIntelligence**: Identify, grade, market data, evaluate - 21 collectible categories
- **Image Processor**: Lazy client init, safe key handling, proper error states
- **Client Scraper**: Firecrawl integration + Playwright fallback
- **Search Service**: Full-text, faceted, saved searches, suggestions
- **Collections**: Create/edit/delete, public/private, value tracking
- **Offers**: Make/accept/decline/counter with expiration
- **Auctions**: Real-time bidding, reserves, buy-now
- **Reviews**: Multi-category ratings, helpful votes
- **UI Components**: SearchBar, Filters, AuctionBidder, PriceHistoryChart, MakeOfferModal, CollectionModal, SellerRating, ReviewForm

### ⚠️ Needs Testing/Wiring
- Database not created - need `prisma migrate dev`
- API keys not configured (eBay, Firecrawl, Twilio, SendGrid, Stripe)
- Platform integrations (eBay/Etsy/Shopify) are stubs
- Real-time auction updates (WebSocket/Pusher not set up)
- Cron jobs for offer/auction expiration

---

## Phase 1: Get It Running
- [ ] Set up PostgreSQL (local or Supabase)
- [ ] Run `npx prisma migrate dev`
- [ ] Create `.env` with required keys
- [ ] Test one vertical flow: submit → analyze → list → view

## Phase 2: Real Integrations
- [ ] eBay OAuth + listing sync
- [ ] Stripe payments for orders
- [ ] Real-time bidding (Pusher or Socket.io)
- [ ] Cron jobs via Inngest for expiration

## Phase 3: CollektIQ Consumer App
- [ ] Connect to client-commerce-platform API (not duplicate code)
- [ ] Scan flow with real ProductIntelligence
- [ ] User accounts + collection sync

## Phase 4: Deployment
- [ ] Deploy to Vercel
- [ ] Production database
- [ ] Configure domains

---

## API Keys Needed
| Service | Env Var | Priority |
|---------|---------|----------|
| Anthropic | `ANTHROPIC_API_KEY` | ✅ Have |
| Firecrawl | `FIRECRAWL_API_KEY` | High |
| eBay | `EBAY_OAUTH_TOKEN` | High |
| Stripe | `STRIPE_*` | Medium |
| Twilio | `TWILIO_*` | Low |
| SendGrid | `SENDGRID_API_KEY` | Low |

## Repo Cleanup
- [ ] Delete `clientpotal45NCC` on GitHub
- [ ] Archive `coinsite`

---

## Backlog / Circle Back
- [ ] **Scraper Automation System** - Current approach (Firecrawl, Playwright, Greysheet) is fragmented. Consider:
  - Unified scraper orchestration layer
  - Scheduled jobs (Inngest/cron) for all market data sources
  - Central cache invalidation strategy
  - Better error handling / retry logic
  - Sources to unify: Greysheet, eBay comps, Redbook, PCGS/NGC price guides
  - Maybe: headless browser pool, or paid API alternatives
