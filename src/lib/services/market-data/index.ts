/**
 * Unified Market Data Service
 *
 * Aggregates pricing data from multiple collectibles price guides.
 * Weekly cache refresh, local JSON storage.
 *
 * Usage:
 *   import { MarketData } from '@/lib/services/market-data';
 *   const price = await MarketData.search('charizard base set');
 */

import * as fs from 'fs';
import * as path from 'path';

// Import providers
import * as Greysheet from './providers/greysheet';
import * as GreysheetHTML from './providers/greysheet-html';
import * as PriceCharting from './providers/pricecharting';
import * as PokemonTracker from './providers/pokemon-tracker';
import * as PSACards from './providers/psa-cards';

// Import and re-export shared types
export type {
  CollectibleCategory,
  MarketPrice,
  ProviderStatus,
  PriceRange,
  MarketDataProvider,
  SearchOptions,
} from './types';

import type { CollectibleCategory, MarketPrice, ProviderStatus } from './types';

// ============================================================================
// CONFIGURATION
// ============================================================================

const STATUS_FILE = path.join(process.cwd(), 'data', 'provider-status.json');

// ============================================================================
// STATUS TRACKING
// ============================================================================

function loadStatus(): Record<string, ProviderStatus> {
  try {
    if (fs.existsSync(STATUS_FILE)) {
      return JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8'));
    }
  } catch { /* ignore */ }
  return {};
}

function saveStatus(status: Record<string, ProviderStatus>): void {
  const dir = path.dirname(STATUS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2));
}

function updateProviderStatus(
  name: string, 
  available: boolean, 
  extra: Partial<ProviderStatus> = {}
): void {
  const status = loadStatus();
  status[name] = {
    name,
    available,
    lastCheck: new Date().toISOString(),
    ...extra,
  };
  saveStatus(status);
}

// ============================================================================
// UNIFIED SEARCH
// ============================================================================

/**
 * Search across all available providers
 */
export async function search(
  query: string,
  options: {
    category?: CollectibleCategory;
    limit?: number;
  } = {}
): Promise<MarketPrice[]> {
  const { category, limit = 20 } = options;
  const results: MarketPrice[] = [];

  // Determine which providers to search based on category
  const searchPromises: Promise<MarketPrice[]>[] = [];

  // Coins - use Greysheet (both API and HTML scraper)
  if (!category || category === 'coin') {
    searchPromises.push(searchGreysheet(query));
    searchPromises.push(searchGreysheetHTML(query));
  }

  // Pokemon - use Pokemon Tracker and PriceCharting
  if (!category || category === 'pokemon' || category === 'tcg') {
    if (PokemonTracker.isAvailable()) {
      searchPromises.push(searchPokemonTracker(query));
    }
    searchPromises.push(searchPriceCharting(query, 'pokemon'));
  }

  // Sports cards - use both PSA Cards and PriceCharting
  if (!category || category === 'sports-card') {
    searchPromises.push(searchPSACards(query));
    searchPromises.push(searchPriceCharting(query, 'sports'));
  }

  // Comics
  if (!category || category === 'comic') {
    searchPromises.push(searchPriceCharting(query, 'comics'));
  }

  // Funko
  if (!category || category === 'funko') {
    searchPromises.push(searchPriceCharting(query, 'funko'));
  }

  // Run all searches in parallel
  const allResults = await Promise.allSettled(searchPromises);
  
  allResults.forEach(result => {
    if (result.status === 'fulfilled') {
      results.push(...result.value);
    }
  });

  // Sort by relevance (exact matches first) and limit
  return results
    .sort((a, b) => {
      const aExact = a.name.toLowerCase().includes(query.toLowerCase()) ? 0 : 1;
      const bExact = b.name.toLowerCase().includes(query.toLowerCase()) ? 0 : 1;
      return aExact - bExact;
    })
    .slice(0, limit);
}

// ============================================================================
// PROVIDER ADAPTERS
// ============================================================================

async function searchGreysheet(query: string): Promise<MarketPrice[]> {
  try {
    const results = Greysheet.searchPrices(query);

    return results.map(coin => ({
      itemId: coin.slug,
      name: coin.name,
      category: 'coin' as const,
      source: 'Greysheet',
      sourceUrl: `https://www.greysheet.com/coin-prices/item/${coin.slug}`,
      prices: {
        graded: Object.fromEntries(
          Object.entries(coin.grades).map(([grade, { bid, ask }]) => [
            grade,
            { low: bid, mid: (bid + ask) / 2, high: ask }
          ])
        ),
      },
      lastUpdated: coin.lastUpdated,
    }));
  } catch (error) {
    updateProviderStatus('Greysheet', false, {
      error: error instanceof Error ? error.message : 'Search failed'
    });
    return [];
  }
}

async function searchGreysheetHTML(query: string): Promise<MarketPrice[]> {
  try {
    // Search cached HTML-scraped data
    const results = GreysheetHTML.searchCached(query);

    return results.map(coin => GreysheetHTML.toMarketPrice(coin));
  } catch (error) {
    updateProviderStatus('Greysheet HTML', false, {
      error: error instanceof Error ? error.message : 'Search failed'
    });
    return [];
  }
}

async function searchPokemonTracker(query: string): Promise<MarketPrice[]> {
  try {
    const cards = await PokemonTracker.searchCards(query);

    return cards.map(card => {
      // Get best raw price from various sources
      const rawPrice = PokemonTracker.getCardPrice(card);
      // Get PSA graded prices from eBay data
      const psaPrices = PokemonTracker.getPSAPrices(card);

      const setName = card.setName || card.set?.name || '';

      return {
        itemId: card.id,
        name: `${card.name} (${setName} #${card.number})`,
        category: 'pokemon' as const,
        source: 'PokemonPriceTracker',
        prices: {
          raw: rawPrice ? {
            low: rawPrice.low || rawPrice.market! * 0.8,
            mid: rawPrice.market || 0,
            high: rawPrice.high || rawPrice.market! * 1.2,
          } : undefined,
          graded: Object.keys(psaPrices).length > 0 ? Object.fromEntries(
            Object.entries(psaPrices).map(([grade, price]) => [
              `PSA ${grade}`,
              { low: price * 0.9, mid: price, high: price * 1.1 }
            ])
          ) : undefined,
        },
        lastUpdated: card.lastUpdated,
      };
    });
  } catch (error) {
    updateProviderStatus('PokemonTracker', false, {
      error: error instanceof Error ? error.message : 'Search failed'
    });
    return [];
  }
}

async function searchPriceCharting(
  query: string, 
  category: 'pokemon' | 'sports' | 'comics' | 'funko'
): Promise<MarketPrice[]> {
  try {
    const items = await PriceCharting.search(query, category);
    
    const categoryMap: Record<string, CollectibleCategory> = {
      pokemon: 'pokemon',
      sports: 'sports-card',
      comics: 'comic',
      funko: 'funko',
    };

    return items.map(item => ({
      itemId: item.id,
      name: item.name,
      category: categoryMap[category],
      source: 'PriceCharting',
      sourceUrl: item.url,
      prices: {
        raw: item.prices.ungraded ? {
          low: item.prices.ungraded * 0.8,
          mid: item.prices.ungraded,
          high: item.prices.ungraded * 1.2,
        } : undefined,
        graded: item.prices.graded ? Object.fromEntries(
          Object.entries(item.prices.graded).map(([grade, price]) => [
            grade,
            { low: price * 0.9, mid: price, high: price * 1.1 }
          ])
        ) : undefined,
      },
      lastUpdated: item.lastUpdated,
    }));
  } catch (error) {
    updateProviderStatus('PriceCharting', false, {
      error: error instanceof Error ? error.message : 'Search failed'
    });
    return [];
  }
}

async function searchPSACards(query: string): Promise<MarketPrice[]> {
  try {
    // First check cached results
    const cachedResults = PSACards.searchCached(query);
    if (cachedResults.length > 0) {
      return cachedResults.map(card => ({
        itemId: card.id,
        name: card.name,
        category: 'sports-card' as const,
        source: 'PSA Cards',
        sourceUrl: card.url,
        prices: {
          graded: Object.keys(card.grades).length > 0 ? Object.fromEntries(
            Object.entries(card.grades).map(([grade, price]) => [
              `PSA ${grade}`,
              { low: price * 0.9, mid: price, high: price * 1.1 }
            ])
          ) : undefined,
        },
        lastUpdated: card.lastUpdated,
      }));
    }

    // Try live search (may fail due to Cloudflare)
    const results = await PSACards.search(query);
    return results.map(card => ({
      itemId: card.id,
      name: card.name,
      category: 'sports-card' as const,
      source: 'PSA Cards',
      sourceUrl: card.url,
      prices: {
        graded: Object.keys(card.grades).length > 0 ? Object.fromEntries(
          Object.entries(card.grades).map(([grade, price]) => [
            `PSA ${grade}`,
            { low: price * 0.9, mid: price, high: price * 1.1 }
          ])
        ) : undefined,
      },
      lastUpdated: card.lastUpdated,
    }));
  } catch (error) {
    updateProviderStatus('PSACards', false, {
      error: error instanceof Error ? error.message : 'Search failed'
    });
    return [];
  }
}

// ============================================================================
// GET SPECIFIC ITEM
// ============================================================================

export async function getPrice(
  itemId: string,
  source: string
): Promise<MarketPrice | null> {
  switch (source.toLowerCase()) {
    case 'greysheet':
      const coin = await Greysheet.getCoinPrice(itemId);
      if (coin) {
        return {
          itemId: coin.slug,
          name: coin.name,
          category: 'coin',
          source: 'Greysheet',
          prices: {
            graded: Object.fromEntries(
              Object.entries(coin.grades).map(([grade, { bid, ask }]) => [
                grade,
                { low: bid, mid: (bid + ask) / 2, high: ask }
              ])
            ),
          },
          lastUpdated: coin.lastUpdated,
        };
      }
      break;

    case 'greysheet html':
    case 'greysheet-html':
    case 'greysheethtmll':
      // itemId is the GSID for HTML scraper
      const gsid = parseInt(itemId, 10);
      if (!isNaN(gsid)) {
        const htmlCoin = await GreysheetHTML.fetchByGSID(gsid);
        if (htmlCoin) {
          return GreysheetHTML.toMarketPrice(htmlCoin);
        }
      }
      break;

    case 'pokemontracker':
      const card = await PokemonTracker.getCardPrices(itemId);
      if (card) {
        return {
          itemId: card.id,
          name: card.name,
          category: 'pokemon',
          source: 'PokemonTracker',
          prices: {
            raw: card.prices?.tcgplayer ? {
              low: card.prices.tcgplayer.low,
              mid: card.prices.tcgplayer.market,
              high: card.prices.tcgplayer.high,
            } : undefined,
          },
          lastUpdated: card.lastUpdated,
        };
      }
      break;

    case 'pricecharting':
      const item = await PriceCharting.getItem(`https://www.pricecharting.com/game/${itemId}`);
      if (item) {
        return {
          itemId: item.id,
          name: item.name,
          category: item.category as CollectibleCategory,
          source: 'PriceCharting',
          sourceUrl: item.url,
          prices: {
            raw: item.prices.ungraded ? {
              low: item.prices.ungraded * 0.8,
              mid: item.prices.ungraded,
              high: item.prices.ungraded * 1.2,
            } : undefined,
          },
          lastUpdated: item.lastUpdated,
        };
      }
      break;

    case 'psacards':
    case 'psa':
      const psaCard = await PSACards.getCardPrices(itemId);
      if (psaCard) {
        return {
          itemId: psaCard.id,
          name: psaCard.name,
          category: 'sports-card',
          source: 'PSA Cards',
          sourceUrl: psaCard.url,
          prices: {
            graded: Object.keys(psaCard.grades).length > 0 ? Object.fromEntries(
              Object.entries(psaCard.grades).map(([grade, price]) => [
                `PSA ${grade}`,
                { low: price * 0.9, mid: price, high: price * 1.1 }
              ])
            ) : undefined,
          },
          lastUpdated: psaCard.lastUpdated,
        };
      }
      break;
  }

  return null;
}

// ============================================================================
// STATUS & REFRESH
// ============================================================================

export function getProviderStatus(): Record<string, ProviderStatus> {
  return loadStatus();
}

export async function checkProviders(): Promise<Record<string, ProviderStatus>> {
  const status: Record<string, ProviderStatus> = {};

  // Greysheet (API-based)
  const greysheetCache = Greysheet.getCachedPrices();
  status['Greysheet'] = {
    name: 'Greysheet',
    available: true,
    lastCheck: new Date().toISOString(),
    itemCount: greysheetCache?.prices ? Object.keys(greysheetCache.prices).length : 0,
    lastRefresh: greysheetCache?.lastFetched,
  };

  // Greysheet HTML (scraper)
  const greysheetHTMLCache = GreysheetHTML.getAllCached();
  status['Greysheet HTML'] = {
    name: 'Greysheet HTML',
    available: true,
    lastCheck: new Date().toISOString(),
    itemCount: greysheetHTMLCache?.items ? Object.keys(greysheetHTMLCache.items).length : 0,
    lastRefresh: greysheetHTMLCache?.lastFetched,
  };

  // Pokemon Tracker
  status['PokemonTracker'] = {
    name: 'PokemonTracker',
    available: PokemonTracker.isAvailable(),
    lastCheck: new Date().toISOString(),
  };

  // PriceCharting (always available - no auth needed)
  status['PriceCharting'] = {
    name: 'PriceCharting',
    available: true,
    lastCheck: new Date().toISOString(),
  };

  // PSA Cards (free public data, but may be blocked by Cloudflare)
  const psaCache = PSACards.getCachedCards();
  status['PSACards'] = {
    name: 'PSA Cards',
    available: true,
    lastCheck: new Date().toISOString(),
    itemCount: psaCache?.cards ? Object.keys(psaCache.cards).length : 0,
    lastRefresh: psaCache?.lastFetched,
  };

  saveStatus(status);
  return status;
}

export async function refreshAll(): Promise<{ provider: string; success: boolean; error?: string }[]> {
  const results: { provider: string; success: boolean; error?: string }[] = [];

  // Refresh Greysheet
  if (Greysheet.needsRefresh()) {
    try {
      const result = await Greysheet.refreshAllPrices();
      results.push({
        provider: 'Greysheet',
        success: result.failed === 0,
        error: result.errors.length > 0 ? result.errors.join('; ') : undefined,
      });
    } catch (error) {
      results.push({
        provider: 'Greysheet',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Other providers refresh on-demand via cache TTL

  return results;
}

// ============================================================================
// EXPORTS
// ============================================================================

export const MarketData = {
  search,
  getPrice,
  getProviderStatus,
  checkProviders,
  refreshAll,
};

// Re-export Greysheet HTML provider for direct access
export { GreysheetHTML } from './providers/greysheet-html';
export type {
  GreysheetCoinData,
  GreysheetGradePrice,
  GreysheetAuctionResult,
  GreysheetHTMLCache,
} from './providers/greysheet-html';

export default MarketData;

// ============================================================================
// CLI
// ============================================================================

async function main() {
  console.log('='.repeat(60));
  console.log('Unified Market Data Service');
  console.log('='.repeat(60));

  const args = process.argv.slice(2);
  const command = args[0] || 'status';

  switch (command) {
    case 'search':
      const query = args.slice(1).join(' ');
      if (!query) {
        console.log('Usage: npx tsx index.ts search <query>');
        return;
      }
      console.log(`\nSearching for "${query}"...\n`);
      const results = await search(query);
      console.log(`Found ${results.length} results:\n`);
      results.forEach(r => {
        const price = r.prices.raw?.mid || 
          (r.prices.graded ? Object.values(r.prices.graded)[0]?.mid : undefined);
        console.log(`[${r.category}] ${r.name}`);
        console.log(`  Source: ${r.source}`);
        console.log(`  Price: $${price?.toFixed(2) || 'N/A'}`);
        console.log('');
      });
      break;

    case 'check':
      console.log('\nChecking providers...\n');
      const status = await checkProviders();
      Object.values(status).forEach(p => {
        const icon = p.available ? '✓' : '✗';
        console.log(`${icon} ${p.name}`);
        if (p.itemCount) console.log(`  Items: ${p.itemCount}`);
        if (p.lastRefresh) console.log(`  Last refresh: ${p.lastRefresh}`);
        if (p.error) console.log(`  Error: ${p.error}`);
      });
      break;

    case 'refresh':
      console.log('\nRefreshing all providers...\n');
      const refreshResults = await refreshAll();
      refreshResults.forEach(r => {
        const icon = r.success ? '✓' : '✗';
        console.log(`${icon} ${r.provider}`);
        if (r.error) console.log(`  Error: ${r.error}`);
      });
      break;

    case 'status':
    default:
      const currentStatus = getProviderStatus();
      console.log('\nProvider Status:');
      if (Object.keys(currentStatus).length === 0) {
        console.log('  No status recorded. Run: npx tsx index.ts check');
      } else {
        Object.values(currentStatus).forEach(p => {
          const icon = p.available ? '✓' : '✗';
          console.log(`  ${icon} ${p.name}`);
        });
      }

      console.log('\nCommands:');
      console.log('  status   - Show provider status (default)');
      console.log('  check    - Check all providers');
      console.log('  search   - Search across all providers');
      console.log('  refresh  - Refresh all provider caches');
      break;
  }
}

if (process.argv[1]?.includes('index.ts') || process.argv[1]?.includes('market-data')) {
  main().catch(console.error);
}
