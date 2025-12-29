# TASK: Collectibles Price Guide Scrapers

## Overview
Build a unified market data service that aggregates pricing from multiple collectibles price guides. Weekly cache refresh, local JSON storage.

---

## PRICE GUIDE SOURCES

### 🪙 COINS & CURRENCY
| Source | URL | Method | Notes |
|--------|-----|--------|-------|
| **Greysheet** | greysheet.com | Scrape (logged in) | User has subscription. PDFs at /pdfdl/gymo202601 |
| **PCGS Price Guide** | pcgs.com/prices | Scrape | Free public data |
| **NGC Price Guide** | ngccoin.com/price-guide | Scrape | Free public data |
| **Redbook** | Via Greysheet | PDF | Included in subscription |

### 🃏 POKEMON / TCG
| Source | URL | Method | Notes |
|--------|-----|--------|-------|
| **PokemonPriceTracker** | pokemonpricetracker.com/api | API | Free tier: 100 calls/day. PSA grades, TCGPlayer prices |
| **TCGPlayer** | api.tcgplayer.com | API | Requires partner application. Magic, Pokemon, Yu-Gi-Oh |
| **JustTCG** | justtcg.com | API | Multi-TCG: Pokemon, Magic, Yu-Gi-Oh, Lorcana |
| **PriceCharting** | pricecharting.com/category/pokemon-cards | Scrape | Free. eBay sales data |

### 🏈 SPORTS CARDS
| Source | URL | Method | Notes |
|--------|-----|--------|-------|
| **PSA Price Guide** | psacard.com/priceguide | Scrape | All sports, graded values |
| **Beckett** | beckett.com/price-guides | Subscription | OPG subscription required |
| **SportsCardsPro** | sportscardspro.com | Scrape | Free. Has API docs |
| **Card Ladder** | cardladder.com | Subscription | Pro subscription for full access |
| **VintageCardPrices** | vintagecardprices.com | Subscription | SGC, PSA, BGS graded data |

### 📚 COMICS
| Source | URL | Method | Notes |
|--------|-----|--------|-------|
| **GoCollect** | gocollect.com | Scrape | CGC/CBCS graded comics. FMV data |
| **GPAnalysis** | comics.gpanalysis.com | Subscription | CGC sales data, portfolio tracker |
| **PriceCharting** | pricecharting.com/category/comic-books | Scrape | Free. eBay-based |
| **CovrPrice** | covrprice.com | Subscription | Raw + graded sales |

### 🎭 FUNKO / TOYS
| Source | URL | Method | Notes |
|--------|-----|--------|-------|
| **hobbyDB/PPG** | hobbydb.com/home/funko | API available | Pop Price Guide. Contact for API access |
| **PriceCharting** | pricecharting.com | Scrape | Video games, Funko, LEGO |

### 🎸 OTHER COLLECTIBLES
| Source | URL | Method | Notes |
|--------|-----|--------|-------|
| **Discogs** | api.discogs.com | API | Vinyl records. Free API |
| **StockX** | stockx.com | Scrape | Sneakers, watches, collectibles |
| **Chrono24** | chrono24.com | Scrape | Watches |

---

## ARCHITECTURE

### Directory Structure
```
src/lib/services/market-data/
├── index.ts              # Unified MarketDataService
├── types.ts              # Shared types
├── cache.ts              # JSON cache manager (7-day TTL)
├── providers/
│   ├── greysheet.ts      # Coins (scraper)
│   ├── pcgs.ts           # Coins (scraper)
│   ├── pokemon-tracker.ts # Pokemon (API)
│   ├── tcgplayer.ts      # TCG (API)
│   ├── psa-cards.ts      # Sports (scraper)
│   ├── gocollect.ts      # Comics (scraper)
│   ├── hobbydb.ts        # Funko (API/scrape)
│   └── pricecharting.ts  # Multi-category (scraper)
└── README.md

data/
├── market-cache.json     # Unified cache file
└── provider-status.json  # Last update timestamps
```

### Unified Interface
```typescript
interface MarketPrice {
  itemId: string;
  name: string;
  category: 'coin' | 'pokemon' | 'sports-card' | 'comic' | 'funko' | 'other';
  source: string;
  grades: Record<string, { low: number; mid: number; high: number }>;
  lastSale?: { price: number; date: string; venue: string };
  population?: number;
  lastUpdated: string;
}

interface MarketDataProvider {
  name: string;
  categories: string[];
  isAvailable(): Promise<boolean>;
  search(query: string): Promise<MarketPrice[]>;
  getPrice(itemId: string): Promise<MarketPrice | null>;
  refreshCache(): Promise<void>;
}
```

---

## IMPLEMENTATION PRIORITY

### Phase 1 (Free/Easy)
1. **PriceCharting** - Multi-category, free, scrapeable
2. **PokemonPriceTracker** - Free API tier
3. **PSA Price Guide** - Free public data
4. **PCGS/NGC** - Free public coin data

### Phase 2 (Requires Keys/Subs)
1. **Greysheet** - User has subscription
2. **TCGPlayer** - Apply for partner API
3. **hobbyDB** - Contact for API access

### Phase 3 (Optional)
1. **Beckett** - Expensive subscription
2. **GoCollect** - Subscription for full data
3. **StockX/Discogs** - Sneakers/vinyl if needed

---

## CACHE STRATEGY

```typescript
// cache.ts
const CACHE_TTL_DAYS = 7;

interface CacheEntry {
  data: MarketPrice[];
  fetchedAt: string;
  expiresAt: string;
}

// Only refresh if older than 7 days
function needsRefresh(entry: CacheEntry): boolean {
  return new Date() > new Date(entry.expiresAt);
}
```

---

## RUN COMMANDS

```bash
# Test individual provider
npx ts-node src/lib/services/market-data/providers/pricecharting.ts

# Refresh all caches
npx ts-node src/lib/services/market-data/index.ts --refresh

# Search across all providers
npx ts-node src/lib/services/market-data/index.ts --search "charizard base set"
```

---

## NOTES
- Start with PriceCharting as it covers multiple categories
- Use Playwright (already in project) for scraping
- Respect rate limits - cache aggressively
- Log failed fetches to provider-status.json
- ProductIntelligence service will consume this data
