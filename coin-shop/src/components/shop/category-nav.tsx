'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Category } from '@/types';

interface CategoryNavProps {
  categories: Category[];
  currentCategory?: string;
  variant?: 'horizontal' | 'vertical' | 'grid';
}

export function CategoryNav({
  categories,
  currentCategory,
  variant = 'horizontal',
}: CategoryNavProps) {
  // Filter to show only parent categories
  const parentCategories = categories.filter((cat) => !cat.parent_id);

  if (variant === 'grid') {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {parentCategories.map((category) => (
          <Link
            key={category.id}
            href={`/shop/category/${category.slug}`}
            className={cn(
              'group relative aspect-[4/3] rounded-xl overflow-hidden',
              'bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900'
            )}
          >
            {category.image_url && (
              <Image
                src={category.image_url}
                alt={category.name}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <h3 className="text-white font-bold text-lg group-hover:text-gold-400 transition-colors">
                {category.name}
              </h3>
              {category.product_count !== undefined && (
                <p className="text-white/70 text-sm">
                  {category.product_count} items
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    );
  }

  if (variant === 'vertical') {
    return (
      <nav className="space-y-1">
        <Link
          href="/shop"
          className={cn(
            'flex items-center justify-between px-4 py-2 rounded-lg transition-colors',
            !currentCategory
              ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
          )}
        >
          All Products
        </Link>
        {parentCategories.map((category) => {
          const isActive = currentCategory === category.slug;
          const subcategories = categories.filter(
            (cat) => cat.parent_id === category.id
          );

          return (
            <div key={category.id}>
              <Link
                href={`/shop/category/${category.slug}`}
                className={cn(
                  'flex items-center justify-between px-4 py-2 rounded-lg transition-colors',
                  isActive
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                )}
              >
                <span>{category.name}</span>
                {subcategories.length > 0 && (
                  <ChevronRight className="w-4 h-4" />
                )}
              </Link>
              {subcategories.length > 0 && (
                <div className="ml-4 mt-1 space-y-1">
                  {subcategories.map((sub) => (
                    <Link
                      key={sub.id}
                      href={`/shop/category/${sub.slug}`}
                      className={cn(
                        'block px-4 py-1.5 text-sm rounded-lg transition-colors',
                        currentCategory === sub.slug
                          ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                      )}
                    >
                      {sub.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    );
  }

  // Horizontal variant (default)
  return (
    <nav className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
      <Link
        href="/shop"
        className={cn(
          'px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-colors',
          !currentCategory
            ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
        )}
      >
        All
      </Link>
      {parentCategories.map((category) => (
        <Link
          key={category.id}
          href={`/shop/category/${category.slug}`}
          className={cn(
            'px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-colors',
            currentCategory === category.slug
              ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
          )}
        >
          {category.name}
        </Link>
      ))}
    </nav>
  );
}
