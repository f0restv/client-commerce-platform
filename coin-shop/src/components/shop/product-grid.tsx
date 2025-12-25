'use client';

import { useState } from 'react';
import { Grid3X3, LayoutGrid, List, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ProductCard } from './product-card';
import type { Product } from '@/types';

interface ProductGridProps {
  products: Product[];
  title?: string;
  showViewToggle?: boolean;
  showFilters?: boolean;
  defaultView?: 'grid' | 'instagram' | 'list';
  columns?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };
}

export function ProductGrid({
  products,
  title,
  showViewToggle = true,
  showFilters = false,
  defaultView = 'instagram',
  columns = { mobile: 3, tablet: 3, desktop: 3 },
}: ProductGridProps) {
  const [view, setView] = useState<'grid' | 'instagram' | 'list'>(defaultView);

  const gridClasses = {
    instagram: 'instagram-grid',
    grid: cn(
      'grid gap-4 md:gap-6',
      `grid-cols-${columns.mobile}`,
      `md:grid-cols-${columns.tablet}`,
      `lg:grid-cols-${columns.desktop}`
    ),
    list: 'flex flex-col gap-4',
  };

  return (
    <div>
      {/* Header */}
      {(title || showViewToggle || showFilters) && (
        <div className="flex items-center justify-between mb-6">
          {title && (
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {title}
            </h2>
          )}

          <div className="flex items-center gap-2">
            {showFilters && (
              <Button variant="outline" size="sm">
                <SlidersHorizontal className="w-4 h-4 mr-2" />
                Filters
              </Button>
            )}

            {showViewToggle && (
              <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <button
                  onClick={() => setView('instagram')}
                  className={cn(
                    'p-2 transition-colors',
                    view === 'instagram'
                      ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                      : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                  )}
                  title="Instagram Grid"
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setView('grid')}
                  className={cn(
                    'p-2 transition-colors',
                    view === 'grid'
                      ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                      : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                  )}
                  title="Card Grid"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setView('list')}
                  className={cn(
                    'p-2 transition-colors',
                    view === 'list'
                      ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                      : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                  )}
                  title="List View"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Products */}
      {products.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">No products found</p>
        </div>
      ) : (
        <div className={gridClasses[view]}>
          {products.map((product) => (
            <ProductCard key={product.id} product={product} view={view} />
          ))}
        </div>
      )}
    </div>
  );
}
