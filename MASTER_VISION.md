# CollektIQ - Master Vision

## One App, Three Revenue Streams

### The Product
A single app that is:
- The most useful tool for collectors and dealers
- The most accurate grading AI
- A marketplace where supply meets demand

### The Moat: Aggregated Data
Dealers currently pay $500+/year across multiple services:
- Greysheet ($200+)
- CDN ($150+)
- PCGS CoinFacts ($100+)
- eBay Terapeak ($360)
- NGC, Heritage, auction archives...

**We combine ALL sources into ONE scan.**

---

## Revenue Streams

### 1. Pro Subscriptions (Recurring)
| Tier | Price | Features |
|------|-------|----------|
| Free | $0 | Scan, basic ID, grade estimate |
| Pro | $15/mo | All pricing sources, auction history, trends |
| Dealer | $50/mo | Bulk scans, API access, inventory management |

### 2. Marketplace Commission (Transactional)
- Buyers and sellers meet in-app
- 8-12% commission on sales
- Instant cash offers (buy at 70%, sell at market)

### 3. Client Portal Fees (B2B)
- Coin shops outsource their ecommerce
- We list, sell, ship, handle payments
- 15-25% of sale price

---

## User Flows

### Collector: "What's this worth?"
1. Scan coin/card/currency
2. AI identifies + grades
3. See prices from ALL sources (Greysheet, eBay solds, auctions)
4. Options:
   - Save to collection
   - List for sale
   - Get instant cash offer

### Dealer: "Price my inventory"
1. Bulk scan or upload
2. Get market pricing across all sources
3. Track price trends
4. List to marketplace or export to own site

### Shop Client: "Sell my stuff"
1. Submit photos
2. We handle everything
3. Get paid when it sells

### Buyer: "I want this"
1. Browse marketplace
2. Filter by grade, price, type
3. Purchase with confidence (AI-verified)
4. Items from: clients, dealers, dropship suppliers

---

## The Flywheel

```
Scan (free) → Hooked on accuracy → Pro subscription
     ↓
Every scan = training data → AI gets better
     ↓
Better AI → More users → More scans → Better AI
     ↓
Users want to buy/sell → Marketplace
     ↓
Marketplace volume → Attract shops → More inventory
     ↓
More inventory → More buyers → More volume
```

---

## Data Sources to Aggregate

### Pricing
- [x] CDN Exchange (3,288 coins scraped)
- [ ] Greysheet (API or scrape)
- [x] eBay sold comps
- [ ] Heritage auction results
- [ ] Great Collections results
- [ ] PCGS price guide
- [ ] NGC price guide
- [ ] Redbook values

### Grading Training
- [ ] PCGS TrueView images
- [ ] NGC images
- [ ] CAC images
- [ ] Reddit GTG posts
- [ ] User submissions (every scan!)

---

## Build Priority

### Phase 1: Core Loop (NOW)
1. Scan → ID → Grade → Price (all sources)
2. User accounts + saved collection
3. Basic marketplace (list/buy)

### Phase 2: Monetization
4. Pro subscription tier
5. Client portal (shop submission)
6. Payment processing

### Phase 3: Scale
7. Bulk upload tools
8. Dropship supplier integration
9. Dealer API
10. Mobile app (native)

---

## Tech Stack
- **Frontend:** Next.js (CollektIQ app)
- **Backend:** Next.js API + Prisma (client-commerce-platform)
- **Database:** Neon (PostgreSQL)
- **AI:** Claude Vision for grading
- **Payments:** Stripe Connect
- **Hosting:** Vercel

Both repos should be ONE app or tightly integrated via API.
