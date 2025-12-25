'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  Search,
  Globe,
  Download,
  ExternalLink,
  Check,
  X,
  Loader2,
  Filter,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils/format';

interface ScrapedItem {
  id: string;
  source_url: string;
  source_platform: string;
  title: string;
  price?: number;
  images: string[];
  status: 'new' | 'imported' | 'ignored';
}

const mockResults: ScrapedItem[] = [
  {
    id: '1',
    source_url: 'https://www.ebay.com/itm/123456',
    source_platform: 'ebay',
    title: '1921 Morgan Silver Dollar MS-65 PCGS - Beautiful Luster',
    price: 425.00,
    images: ['https://images.unsplash.com/photo-1621981386829-9b458a2cddde?w=200'],
    status: 'new',
  },
  {
    id: '2',
    source_url: 'https://www.ebay.com/itm/789012',
    source_platform: 'ebay',
    title: '1oz Gold American Eagle 2024 BU - Direct from Mint',
    price: 2150.00,
    images: ['https://images.unsplash.com/photo-1610375461246-83df859d849d?w=200'],
    status: 'new',
  },
  {
    id: '3',
    source_url: 'https://coins.ha.com/lot/45678',
    source_platform: 'heritage',
    title: '1893-S Morgan Dollar VG-8 - Key Date Rarity',
    price: 4200.00,
    images: ['https://images.unsplash.com/photo-1621981386829-9b458a2cddde?w=200'],
    status: 'new',
  },
];

export default function ScraperPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ScrapedItem[]>(mockResults);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const handleSearch = async () => {
    if (!searchQuery) return;
    setLoading(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setResults(mockResults);
    setLoading(false);
  };

  const handleScrapeUrl = async () => {
    if (!scrapeUrl) return;
    setLoading(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));
    // Add result to list
    setResults((prev) => [
      {
        id: Date.now().toString(),
        source_url: scrapeUrl,
        source_platform: 'manual',
        title: 'Scraped Item from URL',
        price: 299.99,
        images: [],
        status: 'new',
      },
      ...prev,
    ]);
    setScrapeUrl('');
    setLoading(false);
  };

  const toggleSelect = (id: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const importSelected = async () => {
    setLoading(true);
    // Simulate import
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setResults((prev) =>
      prev.map((item) =>
        selectedItems.has(item.id)
          ? { ...item, status: 'imported' as const }
          : item
      )
    );
    setSelectedItems(new Set());
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Listing Scraper
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Search and import listings from external marketplaces.
          </p>
        </div>
      </div>

      {/* Search Cards */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Keyword Search */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              Search Marketplaces
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Search for coins, collectibles..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch} disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" defaultChecked className="rounded" />
                  eBay
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" defaultChecked className="rounded" />
                  Heritage
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="rounded" />
                  APMEX
                </label>
              </div>

              <div className="flex gap-2">
                <Input type="number" placeholder="Min $" className="w-24" />
                <Input type="number" placeholder="Max $" className="w-24" />
                <Button variant="outline" size="icon">
                  <Filter className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* URL Scrape */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Scrape URL
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                Paste a listing URL to import details directly.
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="https://www.ebay.com/itm/..."
                  value={scrapeUrl}
                  onChange={(e) => setScrapeUrl(e.target.value)}
                />
                <Button onClick={handleScrapeUrl} disabled={loading || !scrapeUrl}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                </Button>
              </div>

              <div className="text-sm text-gray-500">
                Supported: eBay, Heritage Auctions, APMEX, Great Collections
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Results */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            Results ({results.length})
          </CardTitle>
          {selectedItems.size > 0 && (
            <Button variant="gold" onClick={importSelected} disabled={loading}>
              <Download className="w-4 h-4 mr-2" />
              Import {selectedItems.size} Selected
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {results.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No results yet. Search or scrape a URL to get started.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {results.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${
                    selectedItems.has(item.id)
                      ? 'border-gold-500 bg-gold-50 dark:bg-gold-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  } ${item.status !== 'new' ? 'opacity-50' : ''}`}
                >
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={selectedItems.has(item.id)}
                    onChange={() => toggleSelect(item.id)}
                    disabled={item.status !== 'new'}
                    className="w-5 h-5 rounded border-gray-300"
                  />

                  {/* Image */}
                  <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 flex-shrink-0">
                    {item.images[0] ? (
                      <Image
                        src={item.images[0]}
                        alt={item.title}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        No img
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge size="sm">
                        {item.source_platform}
                      </Badge>
                      {item.status === 'imported' && (
                        <Badge variant="success" size="sm">Imported</Badge>
                      )}
                      {item.status === 'ignored' && (
                        <Badge variant="default" size="sm">Ignored</Badge>
                      )}
                    </div>
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {item.title}
                    </p>
                    <a
                      href={item.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                    >
                      View source
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  {/* Price */}
                  <div className="text-right">
                    {item.price && (
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {formatCurrency(item.price)}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  {item.status === 'new' && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-green-600"
                        onClick={() => {
                          setResults((prev) =>
                            prev.map((i) =>
                              i.id === item.id ? { ...i, status: 'imported' as const } : i
                            )
                          );
                        }}
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-600"
                        onClick={() => {
                          setResults((prev) =>
                            prev.map((i) =>
                              i.id === item.id ? { ...i, status: 'ignored' as const } : i
                            )
                          );
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
