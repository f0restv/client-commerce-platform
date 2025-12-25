'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Heart, ShoppingCart, Clock, Gavel } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatCountdown } from '@/lib/utils/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCartStore } from '@/store';
import type { Product } from '@/types';

interface ProductCardProps {
  product: Product;
  view?: 'grid' | 'instagram' | 'list';
  showQuickActions?: boolean;
}

export function ProductCard({
  product,
  view = 'grid',
  showQuickActions = true,
}: ProductCardProps) {
  const addItem = useCartStore((state) => state.addItem);
  const primaryImage = product.images?.find((img) => img.is_primary)?.url ||
                       product.images?.[0]?.url ||
                       '/images/placeholder-coin.jpg';

  const isAuction = product.listing_type === 'auction' || product.listing_type === 'both';
  const countdown = product.auction_end_date
    ? formatCountdown(product.auction_end_date)
    : null;

  if (view === 'instagram') {
    return (
      <Link href={`/shop/product/${product.id}`} className="product-card group aspect-square">
        <div className="relative w-full h-full">
          <Image
            src={primaryImage}
            alt={product.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 33vw, 300px"
          />

          {/* Overlay on hover */}
          <div className="overlay">
            <div className="flex items-center gap-6 text-white">
              <div className="flex items-center gap-2">
                <Heart className="w-6 h-6 fill-white" />
                <span className="font-semibold">24</span>
              </div>
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-6 h-6" />
                <span className="font-semibold">{formatCurrency(product.price)}</span>
              </div>
            </div>
          </div>

          {/* Badges */}
          <div className="absolute top-2 left-2 flex flex-col gap-1 z-20">
            {isAuction && (
              <Badge variant="gold" size="sm">
                <Gavel className="w-3 h-3 mr-1" />
                Auction
              </Badge>
            )}
            {product.metal_type && product.metal_type !== 'none' && (
              <Badge
                variant={product.metal_type === 'gold' ? 'gold' : 'silver'}
                size="sm"
              >
                {product.metal_type.charAt(0).toUpperCase() + product.metal_type.slice(1)}
              </Badge>
            )}
          </div>

          {/* Multiple images indicator */}
          {product.images && product.images.length > 1 && (
            <div className="absolute top-2 right-2 z-20">
              <div className="bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                +{product.images.length - 1}
              </div>
            </div>
          )}
        </div>
      </Link>
    );
  }

  if (view === 'list') {
    return (
      <div className="flex gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
        <Link href={`/shop/product/${product.id}`} className="relative w-32 h-32 flex-shrink-0">
          <Image
            src={primaryImage}
            alt={product.title}
            fill
            className="object-cover rounded-lg"
            sizes="128px"
          />
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Link
                href={`/shop/product/${product.id}`}
                className="font-semibold text-gray-900 dark:text-white hover:text-gold-600 line-clamp-1"
              >
                {product.title}
              </Link>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                {product.short_description || product.description}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="font-bold text-lg text-gray-900 dark:text-white">
                {formatCurrency(product.price)}
              </p>
              {isAuction && countdown && !countdown.expired && (
                <p className="text-xs text-gold-600 flex items-center justify-end gap-1 mt-1">
                  <Clock className="w-3 h-3" />
                  {countdown.days}d {countdown.hours}h
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 mt-3">
            {product.grade && <Badge size="sm">{product.grade}</Badge>}
            {product.year && <Badge size="sm">{product.year}</Badge>}
            {product.mint && <Badge size="sm">{product.mint}</Badge>}
          </div>

          {showQuickActions && (
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                onClick={() => addItem(product)}
                disabled={product.quantity < 1 || product.status !== 'active'}
              >
                Add to Cart
              </Button>
              <Button size="sm" variant="outline">
                <Heart className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Default grid view
  return (
    <div className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300">
      <Link href={`/shop/product/${product.id}`} className="block relative aspect-square">
        <Image
          src={primaryImage}
          alt={product.title}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1">
          {isAuction && (
            <Badge variant="gold" size="sm">
              <Gavel className="w-3 h-3 mr-1" />
              Auction
            </Badge>
          )}
          {product.status === 'sold' && (
            <Badge variant="danger" size="sm">Sold</Badge>
          )}
        </div>

        {/* Quick Actions */}
        {showQuickActions && product.status === 'active' && (
          <div className="absolute bottom-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="icon"
              variant="secondary"
              className="w-8 h-8 rounded-full shadow-lg"
              onClick={(e) => {
                e.preventDefault();
                addItem(product);
              }}
            >
              <ShoppingCart className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="secondary"
              className="w-8 h-8 rounded-full shadow-lg"
              onClick={(e) => e.preventDefault()}
            >
              <Heart className="w-4 h-4" />
            </Button>
          </div>
        )}
      </Link>

      <div className="p-4">
        <Link
          href={`/shop/product/${product.id}`}
          className="font-semibold text-gray-900 dark:text-white hover:text-gold-600 line-clamp-2 min-h-[2.5rem]"
        >
          {product.title}
        </Link>

        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {product.year && (
            <span className="text-xs text-gray-500">{product.year}</span>
          )}
          {product.grade && (
            <Badge size="sm" variant="default">{product.grade}</Badge>
          )}
        </div>

        <div className="flex items-end justify-between mt-3">
          <div>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(product.price)}
            </p>
            {isAuction && countdown && !countdown.expired && (
              <p className="text-xs text-gold-600 flex items-center gap-1 mt-1">
                <Clock className="w-3 h-3" />
                Ends in {countdown.days}d {countdown.hours}h
              </p>
            )}
          </div>
          {product.metal_type && product.metal_type !== 'none' && (
            <Badge
              variant={product.metal_type === 'gold' ? 'gold' : 'silver'}
              size="sm"
            >
              {product.metal_weight_oz}oz
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
