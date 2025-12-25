'use client';

import { useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils/format';
import { useMetalPricesStore } from '@/store';

interface MetalsTickerProps {
  className?: string;
  variant?: 'bar' | 'compact' | 'detailed';
}

export function MetalsTicker({ className, variant = 'bar' }: MetalsTickerProps) {
  const { prices, loading, fetchPrices, lastUpdated } = useMetalPricesStore();

  useEffect(() => {
    fetchPrices();
    // Refresh every 5 minutes
    const interval = setInterval(fetchPrices, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  if (loading && !prices) {
    return (
      <div className={cn('bg-gray-900 text-white', className)}>
        <div className="animate-pulse flex items-center justify-center h-10">
          <span className="text-sm">Loading prices...</span>
        </div>
      </div>
    );
  }

  if (!prices) return null;

  const metals = [
    { name: 'Gold', symbol: 'XAU', price: prices.gold, icon: '🥇', change: 12.50 },
    { name: 'Silver', symbol: 'XAG', price: prices.silver, icon: '🥈', change: -0.25 },
    { name: 'Platinum', symbol: 'XPT', price: prices.platinum, icon: '⬜', change: 5.00 },
    { name: 'Palladium', symbol: 'XPD', price: prices.palladium, icon: '🔷', change: -8.00 },
  ];

  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-4 text-sm', className)}>
        {metals.slice(0, 2).map((metal) => (
          <div key={metal.symbol} className="flex items-center gap-2">
            <span className="font-medium">{metal.name}:</span>
            <span className="font-bold">{formatCurrency(metal.price)}</span>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'detailed') {
    return (
      <div className={cn('grid grid-cols-2 md:grid-cols-4 gap-4', className)}>
        {metals.map((metal) => (
          <div
            key={metal.symbol}
            className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">{metal.icon}</span>
              <span
                className={cn(
                  'flex items-center text-sm font-medium',
                  metal.change > 0 ? 'text-green-600' : metal.change < 0 ? 'text-red-600' : 'text-gray-500'
                )}
              >
                {metal.change > 0 ? (
                  <TrendingUp className="w-4 h-4 mr-1" />
                ) : metal.change < 0 ? (
                  <TrendingDown className="w-4 h-4 mr-1" />
                ) : (
                  <Minus className="w-4 h-4 mr-1" />
                )}
                {metal.change > 0 ? '+' : ''}{metal.change.toFixed(2)}%
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{metal.name}</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(metal.price)}
              <span className="text-sm font-normal text-gray-500">/oz</span>
            </p>
          </div>
        ))}
      </div>
    );
  }

  // Default ticker bar
  return (
    <div className={cn('bg-gray-900 text-white overflow-hidden', className)}>
      <div className="price-ticker py-2">
        <div className="price-ticker-content flex items-center gap-8 px-4">
          {/* Duplicate for seamless scroll */}
          {[...metals, ...metals].map((metal, index) => (
            <div key={`${metal.symbol}-${index}`} className="flex items-center gap-3 whitespace-nowrap">
              <span className="text-lg">{metal.icon}</span>
              <span className="font-medium">{metal.name}</span>
              <span className="font-bold text-gold-400">{formatCurrency(metal.price)}</span>
              <span
                className={cn(
                  'flex items-center text-sm',
                  metal.change > 0 ? 'text-green-400' : metal.change < 0 ? 'text-red-400' : 'text-gray-400'
                )}
              >
                {metal.change > 0 ? (
                  <TrendingUp className="w-3 h-3 mr-0.5" />
                ) : metal.change < 0 ? (
                  <TrendingDown className="w-3 h-3 mr-0.5" />
                ) : (
                  <Minus className="w-3 h-3 mr-0.5" />
                )}
                {metal.change > 0 ? '+' : ''}{metal.change.toFixed(2)}%
              </span>
              <span className="text-gray-500 mx-4">|</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
