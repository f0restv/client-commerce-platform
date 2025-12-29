/**
 * Pokemon Price Tracker API Client
 * 
 * https://www.pokemonpricetracker.com/pokemon-card-price-api
 * 
 * Free tier: 100 calls/day
 * Provides: TCGPlayer prices, PSA graded values, historical data
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// TYPES
// ============================================================================

export interface PokemonCard {
  id: string;
  name: string;
  number: string;
  rarity: string;
  // Set info - can be nested or flat
  set?: {
    id: string;
    name: string;
  };
  setId?: string;
  setName?: string;
  // Prices from various sources
  tcgplayer?: {
    prices?: {
      normal?: { market?: number; low?: number; high?: number };
      holofoil?: { market?: number; low?: number; high?: number };
      reverseHolofoil?: { market?: number; low?: number; high?: number };
    };
  };
  cardmarket?: {
    prices?: {
      averageSellPrice?: number;
      lowPrice?: number;
      trendPrice?: number;
    };
  };
  ebay?: {
    prices?: Record<string, { stats?: { average?: number; median?: number } }>;
  };
  images?: { small?: string };
  lastUpdated: string;
  // Legacy format support
  prices?: {
    tcgplayer?: {
      market: number;
      low: number;
      mid: number;
      high: number;
    };
    psa?: Record<string, number>;
  };
}

export interface PokemonSet {
  id: string;
  name: string;
  releaseDate: string;
  totalCards: number;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_BASE = 'https://www.pokemonpricetracker.com/api';
const API_KEY = process.env.POKEMON_TRACKER_API_KEY || '';
const CACHE_FILE = path.join(process.cwd(), 'data', 'pokemon-cache.json');
const CACHE_TTL_DAYS = 7;

// Rate limiting
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000; // 1 second between requests

// ============================================================================
// HELPERS
// ============================================================================

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL) {
    await new Promise(r => setTimeout(r, MIN_REQUEST_INTERVAL - elapsed));
  }
  lastRequestTime = Date.now();
}

async function apiRequest<T>(endpoint: string, params: Record<string, string> = {}): Promise<ApiResponse<T>> {
  await rateLimit();

  const url = new URL(`${API_BASE}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  try {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };
    if (API_KEY) {
      headers['Authorization'] = `Bearer ${API_KEY}`;
    }

    const response = await fetch(url.toString(), { headers });

    if (!response.ok) {
      if (response.status === 429) {
        return { success: false, error: 'Rate limit exceeded. Free tier: 100 calls/day.' };
      }
      return { success: false, error: `HTTP ${response.status}` };
    }

    const json = await response.json();
    // API returns { data: [...] } - extract the data array
    const data = json.data !== undefined ? json.data : json;
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ============================================================================
// CACHE
// ============================================================================

interface PokemonCache {
  cards: Record<string, PokemonCard>;
  sets: PokemonSet[];
  lastFetched: string;
}

function loadCache(): PokemonCache | null {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    }
  } catch { /* ignore */ }
  return null;
}

function saveCache(cache: PokemonCache): void {
  const dir = path.dirname(CACHE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Check if API is available (key is set)
 */
export function isAvailable(): boolean {
  return !!API_KEY;
}

/**
 * Get list of all Pokemon TCG sets
 */
export async function getSets(): Promise<PokemonSet[]> {
  const cache = loadCache();
  if (cache?.sets && cache.sets.length > 0) {
    return cache.sets;
  }

  const response = await apiRequest<PokemonSet[]>('/sets', { 
    sortBy: 'releaseDate', 
    sortOrder: 'desc' 
  });

  if (response.success && response.data) {
    const newCache: PokemonCache = {
      cards: cache?.cards || {},
      sets: response.data,
      lastFetched: new Date().toISOString(),
    };
    saveCache(newCache);
    return response.data;
  }

  return [];
}

/**
 * Get prices for a specific card
 */
export async function getCardPrices(cardId: string, includeGraded = true): Promise<PokemonCard | null> {
  const cache = loadCache();
  
  // Check cache
  if (cache?.cards[cardId]) {
    const cached = cache.cards[cardId];
    const age = (Date.now() - new Date(cached.lastUpdated).getTime()) / (1000 * 60 * 60 * 24);
    if (age < CACHE_TTL_DAYS) return cached;
  }

  const params: Record<string, string> = { id: cardId };
  if (includeGraded) params.includeGraded = 'true';

  const response = await apiRequest<PokemonCard>('/prices', params);

  if (response.success && response.data) {
    const card = {
      ...response.data,
      lastUpdated: new Date().toISOString(),
    };

    // Update cache
    const newCache: PokemonCache = {
      cards: { ...(cache?.cards || {}), [cardId]: card },
      sets: cache?.sets || [],
      lastFetched: new Date().toISOString(),
    };
    saveCache(newCache);

    return card;
  }

  return null;
}

/**
 * Search for cards by name and optional set
 */
export async function searchCards(
  name: string,
  setId?: string
): Promise<PokemonCard[]> {
  const params: Record<string, string> = { name };
  if (setId) params.setId = setId;

  const response = await apiRequest<PokemonCard[]>('/prices', params);

  if (response.success && response.data && Array.isArray(response.data)) {
    return response.data.map(card => ({
      ...card,
      // Normalize set info
      setId: card.set?.id || card.setId,
      setName: card.set?.name || card.setName,
      lastUpdated: card.lastUpdated || new Date().toISOString(),
    }));
  }

  return [];
}

/**
 * Helper to extract best price from card data
 */
export function getCardPrice(card: PokemonCard): { market?: number; low?: number; high?: number } | undefined {
  // Try TCGPlayer holofoil first (most common for Pokemon)
  if (card.tcgplayer?.prices?.holofoil?.market) {
    return card.tcgplayer.prices.holofoil;
  }
  // Try normal
  if (card.tcgplayer?.prices?.normal?.market) {
    return card.tcgplayer.prices.normal;
  }
  // Try cardmarket
  if (card.cardmarket?.prices?.averageSellPrice) {
    return {
      market: card.cardmarket.prices.averageSellPrice,
      low: card.cardmarket.prices.lowPrice,
      high: card.cardmarket.prices.trendPrice,
    };
  }
  // Legacy format
  if (card.prices?.tcgplayer) {
    return card.prices.tcgplayer;
  }
  return undefined;
}

/**
 * Helper to extract PSA graded prices from eBay data
 */
export function getPSAPrices(card: PokemonCard): Record<string, number> {
  const psaPrices: Record<string, number> = {};
  if (card.ebay?.prices) {
    for (const [grade, data] of Object.entries(card.ebay.prices)) {
      if (data.stats?.average) {
        psaPrices[grade] = data.stats.average;
      } else if (data.stats?.median) {
        psaPrices[grade] = data.stats.median;
      }
    }
  }
  // Legacy format
  if (card.prices?.psa) {
    Object.assign(psaPrices, card.prices.psa);
  }
  return psaPrices;
}

/**
 * Get popular/valuable cards
 */
export async function getPopularCards(limit = 20): Promise<PokemonCard[]> {
  // This endpoint might not exist - would need to verify with actual API
  const response = await apiRequest<PokemonCard[]>('/prices/popular', { limit: String(limit) });
  return response.success && response.data ? response.data : [];
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  console.log('Pokemon Price Tracker Client');
  console.log('API Key:', API_KEY ? 'Set ✓' : 'Not set (set POKEMON_TRACKER_API_KEY)');
  console.log('');

  const args = process.argv.slice(2);
  const command = args[0];

  if (!API_KEY && command !== 'status') {
    console.log('⚠ No API key set. Get one at: https://www.pokemonpricetracker.com/pokemon-card-price-api');
    console.log('Then set: export POKEMON_TRACKER_API_KEY=your_key');
    return;
  }

  switch (command) {
    case 'sets':
      console.log('Fetching sets...');
      const sets = await getSets();
      console.log(`Found ${sets.length} sets:`);
      sets.slice(0, 10).forEach(s => console.log(`  ${s.name} (${s.id}) - ${s.totalCards} cards`));
      break;

    case 'search':
      const query = args.slice(1).join(' ');
      if (!query) {
        console.log('Usage: npx tsx pokemon-tracker.ts search <card name>');
        return;
      }
      console.log(`Searching for "${query}"...`);
      const cards = await searchCards(query);
      console.log(`Found ${cards.length} cards:`);
      cards.slice(0, 10).forEach(c => {
        const priceData = getCardPrice(c);
        const price = priceData?.market ? `$${priceData.market.toFixed(2)}` : 'N/A';
        const setName = c.setName || c.set?.name || 'Unknown Set';
        console.log(`  ${c.name} (${setName} #${c.number}): ${price}`);
      });
      break;

    case 'get':
      const cardId = args[1];
      if (!cardId) {
        console.log('Usage: npx tsx pokemon-tracker.ts get <card-id>');
        console.log('Example: npx tsx pokemon-tracker.ts get base1-4');
        return;
      }
      console.log(`Fetching ${cardId}...`);
      const card = await getCardPrices(cardId);
      if (card) {
        console.log('Card:', card.name);
        console.log('Set:', card.setName);
        if (card.prices.tcgplayer) {
          console.log('TCGPlayer Prices:');
          console.log(`  Market: $${card.prices.tcgplayer.market}`);
          console.log(`  Low: $${card.prices.tcgplayer.low}`);
          console.log(`  High: $${card.prices.tcgplayer.high}`);
        }
        if (card.prices.psa) {
          console.log('PSA Graded:');
          Object.entries(card.prices.psa).forEach(([grade, price]) => {
            console.log(`  PSA ${grade}: $${price}`);
          });
        }
      } else {
        console.log('Card not found or API error');
      }
      break;

    case 'status':
    default:
      const cache = loadCache();
      console.log('Cache Status:');
      if (cache) {
        console.log(`  Cards cached: ${Object.keys(cache.cards).length}`);
        console.log(`  Sets cached: ${cache.sets.length}`);
        console.log(`  Last fetched: ${cache.lastFetched}`);
      } else {
        console.log('  No cache found');
      }
      console.log('');
      console.log('Commands:');
      console.log('  sets           - List all Pokemon TCG sets');
      console.log('  search <name>  - Search for cards');
      console.log('  get <card-id>  - Get card prices (e.g., base1-4)');
      break;
  }
}

if (process.argv[1]?.includes('pokemon-tracker')) {
  main().catch(console.error);
}
