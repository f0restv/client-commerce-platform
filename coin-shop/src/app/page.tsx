import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Shield, Truck, Award, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProductGrid, CategoryNav, MetalsTicker } from '@/components/shop';
import type { Product, Category } from '@/types';

// Mock data - in production, fetch from Supabase
const mockProducts: Product[] = [
  {
    id: '1',
    sku: 'CV-001',
    title: '1921 Morgan Silver Dollar MS-65 PCGS',
    description: 'Beautiful gem uncirculated Morgan dollar with exceptional luster.',
    category_id: '1',
    price: 425.00,
    metal_type: 'silver',
    metal_weight_oz: 0.77,
    metal_purity: 0.900,
    year: 1921,
    mint: 'Philadelphia',
    grade: 'MS-65',
    certification: 'PCGS',
    listing_type: 'buy_now',
    status: 'active',
    quantity: 1,
    is_consignment: false,
    images: [{ id: '1', product_id: '1', url: 'https://images.unsplash.com/photo-1621981386829-9b458a2cddde?w=400', is_primary: true, position: 0 }],
    tags: ['morgan', 'silver dollar', 'pcgs'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '2',
    sku: 'CV-002',
    title: '1oz American Gold Eagle 2024 BU',
    description: 'Brand new 2024 American Gold Eagle in brilliant uncirculated condition.',
    category_id: '4',
    price: 2150.00,
    metal_type: 'gold',
    metal_weight_oz: 1.0,
    metal_purity: 0.9167,
    year: 2024,
    mint: 'West Point',
    grade: 'BU',
    listing_type: 'buy_now',
    status: 'active',
    quantity: 5,
    is_consignment: false,
    images: [{ id: '2', product_id: '2', url: 'https://images.unsplash.com/photo-1610375461246-83df859d849d?w=400', is_primary: true, position: 0 }],
    tags: ['gold eagle', 'bullion', '1oz'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '3',
    sku: 'CV-003',
    title: '10oz Silver Bar - PAMP Suisse',
    description: 'PAMP Suisse 10 oz .999 fine silver bar with assay certificate.',
    category_id: '4',
    price: 285.00,
    metal_type: 'silver',
    metal_weight_oz: 10.0,
    metal_purity: 0.999,
    listing_type: 'buy_now',
    status: 'active',
    quantity: 12,
    is_consignment: false,
    images: [{ id: '3', product_id: '3', url: 'https://images.unsplash.com/photo-1574607383476-f517f260d30b?w=400', is_primary: true, position: 0 }],
    tags: ['silver bar', 'bullion', 'pamp'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '4',
    sku: 'CV-004',
    title: '1893-S Morgan Dollar VG-8 - Key Date',
    description: 'The famous key date Morgan dollar. A must for any serious collector.',
    category_id: '1',
    price: 4850.00,
    metal_type: 'silver',
    metal_weight_oz: 0.77,
    metal_purity: 0.900,
    year: 1893,
    mint: 'San Francisco',
    grade: 'VG-8',
    listing_type: 'auction',
    auction_end_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'active',
    quantity: 1,
    is_consignment: true,
    images: [{ id: '4', product_id: '4', url: 'https://images.unsplash.com/photo-1621981386829-9b458a2cddde?w=400', is_primary: true, position: 0 }],
    tags: ['morgan', 'key date', '1893-s'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '5',
    sku: 'CV-005',
    title: '2024 Silver Eagle MS-70 NGC First Releases',
    description: 'Perfect grade 2024 American Silver Eagle with First Releases designation.',
    category_id: '1',
    price: 85.00,
    metal_type: 'silver',
    metal_weight_oz: 1.0,
    metal_purity: 0.999,
    year: 2024,
    mint: 'West Point',
    grade: 'MS-70',
    certification: 'NGC',
    listing_type: 'buy_now',
    status: 'active',
    quantity: 20,
    is_consignment: false,
    images: [{ id: '5', product_id: '5', url: 'https://images.unsplash.com/photo-1610375461246-83df859d849d?w=400', is_primary: true, position: 0 }],
    tags: ['silver eagle', 'ms-70', 'ngc'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '6',
    sku: 'CV-006',
    title: '1oz Gold Krugerrand 1980',
    description: 'Classic South African gold bullion coin. 22k gold.',
    category_id: '2',
    price: 2100.00,
    metal_type: 'gold',
    metal_weight_oz: 1.0,
    metal_purity: 0.9167,
    year: 1980,
    listing_type: 'buy_now',
    status: 'active',
    quantity: 3,
    is_consignment: false,
    images: [{ id: '6', product_id: '6', url: 'https://images.unsplash.com/photo-1610375461246-83df859d849d?w=400', is_primary: true, position: 0 }],
    tags: ['krugerrand', 'gold', 'bullion'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const mockCategories: Category[] = [
  { id: '1', name: 'US Coins', slug: 'us-coins', position: 1 },
  { id: '2', name: 'World Coins', slug: 'world-coins', position: 2 },
  { id: '3', name: 'Ancient Coins', slug: 'ancient-coins', position: 3 },
  { id: '4', name: 'Bullion', slug: 'bullion', position: 4 },
  { id: '5', name: 'Paper Money', slug: 'paper-money', position: 5 },
];

const features = [
  {
    icon: Shield,
    title: 'Authenticated',
    description: 'Every item verified by experts',
  },
  {
    icon: Truck,
    title: 'Insured Shipping',
    description: 'Free shipping on orders $500+',
  },
  {
    icon: Award,
    title: 'Quality Guaranteed',
    description: '30-day return policy',
  },
  {
    icon: Users,
    title: 'Consignment Program',
    description: 'Sell your collection with us',
  },
];

export default function HomePage() {
  return (
    <div>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(251,191,36,0.3),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(148,163,184,0.3),transparent_50%)]" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 py-20 md:py-32">
          <div className="max-w-2xl">
            <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
              Discover Rare
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold-400 to-gold-600">
                {' '}Coins{' '}
              </span>
              & Collectibles
            </h1>
            <p className="text-xl text-gray-300 mb-8">
              Your trusted source for authenticated numismatic treasures.
              Buy, sell, and consign with confidence.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/shop">
                <Button variant="gold" size="lg">
                  Shop Collection
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Link href="/consign">
                <Button variant="outline" size="lg" className="text-white border-white hover:bg-white/10">
                  Sell Your Coins
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-gray-200 dark:divide-gray-800">
            {features.map((feature) => (
              <div key={feature.title} className="p-6 md:p-8 text-center">
                <feature.icon className="w-8 h-8 mx-auto mb-3 text-gold-500" />
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                  {feature.title}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Shop Profile Section (Instagram Style) */}
      <section className="max-w-4xl mx-auto px-4 py-12">
        {/* Profile Header */}
        <div className="flex items-start gap-8 mb-8">
          <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-3xl md:text-4xl">CV</span>
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-4 mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                coinvault_official
              </h2>
              <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">
                Verified
              </span>
            </div>

            <div className="flex gap-6 text-sm mb-4">
              <div>
                <span className="font-bold text-gray-900 dark:text-white">1,247</span>{' '}
                <span className="text-gray-500">posts</span>
              </div>
              <div>
                <span className="font-bold text-gray-900 dark:text-white">52.3K</span>{' '}
                <span className="text-gray-500">followers</span>
              </div>
              <div>
                <span className="font-bold text-gray-900 dark:text-white">98%</span>{' '}
                <span className="text-gray-500">rating</span>
              </div>
            </div>

            <p className="text-gray-600 dark:text-gray-300 text-sm">
              <strong>CoinVault - Premium Numismatics</strong>
              <br />
              🪙 Rare Coins | Gold & Silver Bullion
              <br />
              ✨ Authenticated & Graded
              <br />
              📦 Free Insured Shipping $500+
              <br />
              💼 Consignment Services Available
            </p>
          </div>
        </div>

        {/* Category Pills */}
        <div className="mb-8">
          <CategoryNav categories={mockCategories} variant="horizontal" />
        </div>

        {/* Product Grid (Instagram Style) */}
        <ProductGrid
          products={mockProducts}
          defaultView="instagram"
          showViewToggle={true}
        />

        {/* Load More */}
        <div className="text-center mt-8">
          <Link href="/shop">
            <Button variant="outline" size="lg">
              View All Products
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Metal Prices Detail Section */}
      <section className="bg-gray-50 dark:bg-gray-800/50 py-12">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">
            Live Precious Metal Prices
          </h2>
          <MetalsTicker variant="detailed" />
        </div>
      </section>

      {/* Consignment CTA */}
      <section className="max-w-4xl mx-auto px-4 py-16">
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-8 md:p-12 text-white text-center">
          <h2 className="text-3xl font-bold mb-4">
            Have Coins to Sell?
          </h2>
          <p className="text-gray-300 mb-8 max-w-xl mx-auto">
            Our consignment program offers competitive rates, professional photography,
            and exposure to thousands of collectors. Get AI-powered valuations instantly.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/client-portal/submissions">
              <Button variant="gold" size="lg">
                Submit Your Items
              </Button>
            </Link>
            <Link href="/consign">
              <Button variant="outline" size="lg" className="text-white border-white hover:bg-white/10">
                Learn More
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
