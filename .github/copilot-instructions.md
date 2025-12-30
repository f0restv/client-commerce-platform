# Copilot Instructions for Client Commerce Platform

## Project Overview
- **Purpose:** Scalable e-commerce platform for small businesses, handling inventory, pricing, multi-channel listings, and payments.
- **Tech Stack:** Next.js (App Router), TypeScript, Prisma, PostgreSQL, NextAuth.js, Stripe, Anthropic Claude, Inngest (planned), Twilio/SendGrid (planned).

## Architecture & Key Patterns
- **Major Components:**
  - Client Portal: Item submission, AI pricing, sales tracking
  - Multi-Platform Listing: eBay, Etsy, AuctionFlex, Whatnot, HiBid, Proxibid
  - Pricing Intelligence: Market data aggregation, AI analysis, dynamic pricing
  - Admin Dashboard: Submission review, inventory sync, invoicing
- **Service Boundaries:**
  - Market data providers are routed via a unified `MarketDataService` facade
  - Category-based provider selection and caching
- **Data Flow:**
  - Inventory → AI analysis → Listings → Sale → Payout

## Critical Workflows
- **Build:**
  - `npm install`
  - `npm run db:generate` (Prisma schema sync)
  - `npm run dev`
- **Deploy:**
  - `git push` (auto-deploys via Vercel)
- **Test CDN Data:**
  - `cat data/cdn-exchange-cache.json | jq '.catalogs | keys | length'`
  - `cat data/cdn-exchange-cache.json | jq '[.catalogs[].coins | keys | length] | add'`

## Project-Specific Conventions
- **Authentication:**
  - Use `auth()` session checks; prefer middleware/wrapper (`lib/api/withAuth.ts`) over inline checks
- **Error Handling:**
  - Use unified error handler with structured logging; avoid repetitive try/catch blocks
- **Price Parsing:**
  - Use single utility (`lib/utils/price.ts`) for price parsing across providers
- **API Design:**
  - RESTful endpoints, standardize pagination as `{ page, pageSize }`
  - Use Zod schemas for request validation (middleware recommended)
- **Database:**
  - Add indexes for frequent queries (see `ARCHITECTURE_REVIEW.md`)
  - Avoid N+1 query patterns; batch queries where possible

## Integration Points
- **External Services:**
  - Stripe, eBay, Greysheet, PriceCharting, PSACards, CDN Exchange
  - Market data providers integrated via `src/lib/services/market-data/providers/`
- **Background Jobs:**
  - Planned: Inngest for async scraping, data refresh
- **Notifications:**
  - Planned: Twilio SMS, SendGrid Email

## Key Files & Directories
- `ARCHITECTURE_REVIEW.md`: Architecture, priorities, and code review notes
- `TODO.md`: Current priorities, commands, and key files
- `src/lib/services/market-data/providers/`: Market data integrations
- `src/lib/api/withAuth.ts`: Auth middleware pattern
- `lib/utils/price.ts`: Price parsing utility
- `data/cdn-exchange-cache.json`: Main coin catalog data
- `prisma/schema.prisma`: Database schema

## Immediate Priorities
- Add missing database indexes
- Implement request validation middleware
- Consolidate authentication logic
- Add error monitoring (Sentry/LogRocket)
- Create test suite for core flows

---
_Reference: ARCHITECTURE_REVIEW.md, TODO.md, README.md_
