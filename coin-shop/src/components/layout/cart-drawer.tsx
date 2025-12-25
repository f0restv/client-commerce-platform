'use client';

import Image from 'next/image';
import Link from 'next/link';
import { X, Plus, Minus, Trash2, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useCartStore, useUIStore } from '@/store';
import { formatCurrency } from '@/lib/utils/format';

export function CartDrawer() {
  const { items, removeItem, updateQuantity, getTotal, clearCart } = useCartStore();
  const { cartOpen, toggleCart } = useUIStore();

  if (!cartOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-fade-in"
        onClick={toggleCart}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white dark:bg-gray-900 shadow-xl z-50 flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Shopping Cart
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({items.length} {items.length === 1 ? 'item' : 'items'})
            </span>
          </h2>
          <Button variant="ghost" size="icon" onClick={toggleCart}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Cart Items */}
        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <ShoppingBag className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Your cart is empty
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Add some coins to get started!
            </p>
            <Button onClick={toggleCart} variant="gold">
              Continue Shopping
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {items.map(({ product, quantity }) => {
                const primaryImage =
                  product.images?.find((img) => img.is_primary)?.url ||
                  product.images?.[0]?.url ||
                  '/images/placeholder-coin.jpg';

                return (
                  <div
                    key={product.id}
                    className="flex gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl"
                  >
                    <div className="relative w-20 h-20 flex-shrink-0">
                      <Image
                        src={primaryImage}
                        alt={product.title}
                        fill
                        className="object-cover rounded-lg"
                        sizes="80px"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/shop/product/${product.id}`}
                        onClick={toggleCart}
                        className="font-medium text-gray-900 dark:text-white hover:text-gold-600 line-clamp-2 text-sm"
                      >
                        {product.title}
                      </Link>

                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateQuantity(product.id, quantity - 1)}
                            className="w-7 h-7 rounded-md bg-gray-200 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-8 text-center text-sm font-medium">
                            {quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(product.id, quantity + 1)}
                            disabled={quantity >= product.quantity}
                            className="w-7 h-7 rounded-md bg-gray-200 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <button
                          onClick={() => removeItem(product.id)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <p className="text-sm font-semibold text-gray-900 dark:text-white mt-2">
                        {formatCurrency(product.price * quantity)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 dark:border-gray-800 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
                <span className="text-xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(getTotal())}
                </span>
              </div>

              <p className="text-sm text-gray-500 dark:text-gray-400">
                Shipping and taxes calculated at checkout
              </p>

              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" onClick={clearCart}>
                  Clear Cart
                </Button>
                <Link href="/checkout" onClick={toggleCart}>
                  <Button variant="gold" className="w-full">
                    Checkout
                  </Button>
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
