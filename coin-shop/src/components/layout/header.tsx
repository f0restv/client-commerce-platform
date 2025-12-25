'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  Search,
  ShoppingCart,
  User,
  Menu,
  X,
  Heart,
  Bell,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useCartStore, useAuthStore, useUIStore } from '@/store';
import { formatCurrency } from '@/lib/utils/format';

export function Header() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const itemCount = useCartStore((state) => state.getItemCount());
  const total = useCartStore((state) => state.getTotal());
  const user = useAuthStore((state) => state.user);
  const toggleCart = useUIStore((state) => state.toggleCart);

  const navLinks = [
    { label: 'Shop', href: '/shop' },
    { label: 'Auctions', href: '/shop?type=auction' },
    { label: 'Categories', href: '/shop/category' },
    { label: 'New Arrivals', href: '/shop?sort=newest' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
      {/* Main Header */}
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-gold-400 to-gold-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-xl">CV</span>
            </div>
            <span className="text-xl font-bold text-gray-900 dark:text-white hidden sm:block">
              CoinVault
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            {/* Search */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSearchOpen(!searchOpen)}
              className="text-gray-600"
            >
              <Search className="w-5 h-5" />
            </Button>

            {/* Wishlist */}
            <Link href="/wishlist">
              <Button variant="ghost" size="icon" className="text-gray-600 hidden sm:flex">
                <Heart className="w-5 h-5" />
              </Button>
            </Link>

            {/* Cart */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleCart}
              className="text-gray-600 relative"
            >
              <ShoppingCart className="w-5 h-5" />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-gold-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                  {itemCount}
                </span>
              )}
            </Button>

            {/* User Menu */}
            {user ? (
              <div className="relative group">
                <Button variant="ghost" size="icon" className="text-gray-600">
                  <User className="w-5 h-5" />
                </Button>
                <div className="absolute right-0 top-full mt-2 w-48 py-2 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                  <Link
                    href="/client-portal"
                    className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/client-portal/submissions"
                    className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    My Submissions
                  </Link>
                  <Link
                    href="/client-portal/invoices"
                    className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Invoices
                  </Link>
                  <hr className="my-2 border-gray-200 dark:border-gray-700" />
                  <button className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700">
                    Sign Out
                  </button>
                </div>
              </div>
            ) : (
              <Link href="/auth/login">
                <Button size="sm" variant="gold">
                  Sign In
                </Button>
              </Link>
            )}

            {/* Mobile Menu Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-gray-600"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      {searchOpen && (
        <div className="border-t border-gray-200 dark:border-gray-800 py-4 animate-slide-down">
          <div className="max-w-3xl mx-auto px-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search coins, collectibles, bullion..."
                className="w-full h-12 pl-12 pr-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gold-500"
                autoFocus
              />
            </div>
          </div>
        </div>
      )}

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 animate-slide-down">
          <nav className="py-4 px-4 space-y-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block py-2 text-gray-700 dark:text-gray-300 font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <hr className="my-4 border-gray-200 dark:border-gray-700" />
            <Link
              href="/wishlist"
              className="block py-2 text-gray-700 dark:text-gray-300"
              onClick={() => setMobileMenuOpen(false)}
            >
              Wishlist
            </Link>
            {user && (
              <>
                <Link
                  href="/client-portal"
                  className="block py-2 text-gray-700 dark:text-gray-300"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Dashboard
                </Link>
                <Link
                  href="/client-portal/submissions"
                  className="block py-2 text-gray-700 dark:text-gray-300"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Submit Items
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
