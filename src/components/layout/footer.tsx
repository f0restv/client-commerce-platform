import React from "react";
import Link from "next/link";
import { Facebook, Twitter, Instagram, Youtube } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-900">
                <span className="text-lg font-bold text-white">IQ</span>
              </div>
              <span className="text-xl font-bold tracking-tight">
                Collekt<span className="text-gray-900">IQ</span>
              </span>
            </Link>
            <p className="mt-4 text-sm text-gray-600">
              AI-powered collectibles pricing. Know what it&apos;s worth.
            </p>
            <div className="mt-4 flex gap-4">
              <Link href="#" className="text-gray-400 hover:text-amber-600">
                <Facebook className="h-5 w-5" />
              </Link>
              <Link href="#" className="text-gray-400 hover:text-amber-600">
                <Twitter className="h-5 w-5" />
              </Link>
              <Link href="#" className="text-gray-400 hover:text-amber-600">
                <Instagram className="h-5 w-5" />
              </Link>
              <Link href="#" className="text-gray-400 hover:text-amber-600">
                <Youtube className="h-5 w-5" />
              </Link>
            </div>
          </div>

          {/* Shop */}
          <div>
            <h3 className="font-semibold text-gray-900">Shop</h3>
            <ul className="mt-4 space-y-2">
              <li>
                <Link
                  href="/shop/category/us-coins"
                  className="text-sm text-gray-600 hover:text-amber-600"
                >
                  US Coins
                </Link>
              </li>
              <li>
                <Link
                  href="/shop/category/world-coins"
                  className="text-sm text-gray-600 hover:text-amber-600"
                >
                  World Coins
                </Link>
              </li>
              <li>
                <Link
                  href="/shop/category/bullion"
                  className="text-sm text-gray-600 hover:text-amber-600"
                >
                  Gold & Silver Bullion
                </Link>
              </li>
              <li>
                <Link
                  href="/shop/category/graded"
                  className="text-sm text-gray-600 hover:text-amber-600"
                >
                  Certified Coins
                </Link>
              </li>
              <li>
                <Link
                  href="/shop/auctions"
                  className="text-sm text-gray-600 hover:text-amber-600"
                >
                  Live Auctions
                </Link>
              </li>
            </ul>
          </div>

          {/* Services */}
          <div>
            <h3 className="font-semibold text-gray-900">Services</h3>
            <ul className="mt-4 space-y-2">
              <li>
                <Link
                  href="/portal"
                  className="text-sm text-gray-600 hover:text-amber-600"
                >
                  Sell Your Coins
                </Link>
              </li>
              <li>
                <Link
                  href="/appraisal"
                  className="text-sm text-gray-600 hover:text-amber-600"
                >
                  Free Appraisal
                </Link>
              </li>
              <li>
                <Link
                  href="/consignment"
                  className="text-sm text-gray-600 hover:text-amber-600"
                >
                  Consignment
                </Link>
              </li>
              <li>
                <Link
                  href="/grading"
                  className="text-sm text-gray-600 hover:text-amber-600"
                >
                  Grading Services
                </Link>
              </li>
              <li>
                <Link
                  href="/estate"
                  className="text-sm text-gray-600 hover:text-amber-600"
                >
                  Estate Services
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="font-semibold text-gray-900">Support</h3>
            <ul className="mt-4 space-y-2">
              <li>
                <Link
                  href="/help"
                  className="text-sm text-gray-600 hover:text-amber-600"
                >
                  Help Center
                </Link>
              </li>
              <li>
                <Link
                  href="/shipping"
                  className="text-sm text-gray-600 hover:text-amber-600"
                >
                  Shipping Info
                </Link>
              </li>
              <li>
                <Link
                  href="/returns"
                  className="text-sm text-gray-600 hover:text-amber-600"
                >
                  Returns & Refunds
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="text-sm text-gray-600 hover:text-amber-600"
                >
                  Contact Us
                </Link>
              </li>
              <li>
                <Link
                  href="/faq"
                  className="text-sm text-gray-600 hover:text-amber-600"
                >
                  FAQ
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t pt-8 sm:flex-row">
          <p className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()} CollektIQ. All rights reserved.
          </p>
          <div className="flex gap-6">
            <Link
              href="/privacy"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
