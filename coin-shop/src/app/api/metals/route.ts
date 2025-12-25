import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import type { MetalPrices } from '@/types';

// Cache prices for 5 minutes
let cachedPrices: MetalPrices | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function GET() {
  const now = Date.now();

  // Return cached prices if still valid
  if (cachedPrices && now - cacheTimestamp < CACHE_DURATION) {
    return NextResponse.json(cachedPrices);
  }

  try {
    // Try to fetch from metals API
    const prices = await fetchMetalPrices();

    // Cache the result
    cachedPrices = prices;
    cacheTimestamp = now;

    // Store in database for historical tracking
    const supabase = await createAdminClient();
    await supabase.from('metal_prices').insert({
      gold: prices.gold,
      silver: prices.silver,
      platinum: prices.platinum,
      palladium: prices.palladium,
    });

    return NextResponse.json(prices);
  } catch (error) {
    console.error('Error fetching metal prices:', error);

    // Return last known prices from database
    const supabase = await createAdminClient();
    const { data } = await supabase
      .from('metal_prices')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (data) {
      return NextResponse.json({
        gold: data.gold,
        silver: data.silver,
        platinum: data.platinum,
        palladium: data.palladium,
        timestamp: data.created_at,
        currency: 'USD',
      });
    }

    // Fallback to mock prices if no data available
    return NextResponse.json({
      gold: 2045.50,
      silver: 24.15,
      platinum: 1015.00,
      palladium: 1050.00,
      timestamp: new Date().toISOString(),
      currency: 'USD',
    });
  }
}

async function fetchMetalPrices(): Promise<MetalPrices> {
  const apiKey = process.env.METALS_API_KEY;

  if (!apiKey) {
    // Return mock prices if no API key
    return {
      gold: 2045.50,
      silver: 24.15,
      platinum: 1015.00,
      palladium: 1050.00,
      timestamp: new Date().toISOString(),
      currency: 'USD',
    };
  }

  // Using Metals.live API (or similar)
  // Note: Replace with actual API endpoint
  const response = await fetch(`https://api.metals.live/v1/spot`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch metal prices');
  }

  const data = await response.json();

  return {
    gold: data.gold || 2045.50,
    silver: data.silver || 24.15,
    platinum: data.platinum || 1015.00,
    palladium: data.palladium || 1050.00,
    timestamp: new Date().toISOString(),
    currency: 'USD',
  };
}
