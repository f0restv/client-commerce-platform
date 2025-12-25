'use client';

import { useState } from 'react';
import {
  Globe,
  Check,
  X,
  RefreshCw,
  Settings,
  ExternalLink,
  Upload,
  AlertCircle,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const platforms = [
  {
    id: 'ebay',
    name: 'eBay',
    logo: '🏷️',
    connected: true,
    lastSync: '5 minutes ago',
    activeListings: 127,
    totalSales: 45230,
    status: 'active',
  },
  {
    id: 'etsy',
    name: 'Etsy',
    logo: '🧡',
    connected: true,
    lastSync: '12 minutes ago',
    activeListings: 89,
    totalSales: 18450,
    status: 'active',
  },
  {
    id: 'auctionflex',
    name: 'AuctionFlex360',
    logo: '🔨',
    connected: true,
    lastSync: '1 hour ago',
    activeListings: 34,
    totalSales: 67890,
    status: 'active',
  },
  {
    id: 'heritage',
    name: 'Heritage Auctions',
    logo: '🏛️',
    connected: false,
    lastSync: null,
    activeListings: 0,
    totalSales: 0,
    status: 'disconnected',
  },
];

const recentActivity = [
  { platform: 'eBay', action: 'Listed', item: '1921 Morgan Dollar', time: '2m ago' },
  { platform: 'Etsy', action: 'Sold', item: '10oz Silver Bar', time: '15m ago' },
  { platform: 'eBay', action: 'Updated', item: 'Gold Eagle Set', time: '1h ago' },
  { platform: 'AuctionFlex', action: 'Bid received', item: '1893-S Morgan', time: '2h ago' },
];

export default function PlatformsPage() {
  const [syncing, setSyncing] = useState<string | null>(null);

  const handleSync = async (platformId: string) => {
    setSyncing(platformId);
    // Simulate sync
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setSyncing(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Platform Integrations
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Manage your marketplace connections and sync settings.
          </p>
        </div>
        <Button variant="gold">
          <Globe className="w-4 h-4 mr-2" />
          Connect Platform
        </Button>
      </div>

      {/* Platform Cards */}
      <div className="grid md:grid-cols-2 gap-6">
        {platforms.map((platform) => (
          <Card key={platform.id}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center text-2xl">
                    {platform.logo}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {platform.name}
                    </h3>
                    <Badge variant={platform.connected ? 'success' : 'default'}>
                      {platform.connected ? 'Connected' : 'Disconnected'}
                    </Badge>
                  </div>
                </div>
                <Button variant="ghost" size="icon">
                  <Settings className="w-4 h-4" />
                </Button>
              </div>

              {platform.connected ? (
                <>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <p className="text-sm text-gray-500">Active Listings</p>
                      <p className="text-xl font-bold">{platform.activeListings}</p>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <p className="text-sm text-gray-500">Total Sales</p>
                      <p className="text-xl font-bold">
                        ${platform.totalSales.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                    <span>Last synced: {platform.lastSync}</span>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleSync(platform.id)}
                      disabled={syncing === platform.id}
                    >
                      {syncing === platform.id ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Sync Now
                        </>
                      )}
                    </Button>
                    <Button variant="outline">
                      <Upload className="w-4 h-4 mr-2" />
                      Push All
                    </Button>
                    <Button variant="ghost" size="icon">
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-6">
                  <p className="text-gray-500 mb-4">
                    Connect your {platform.name} account to sync listings.
                  </p>
                  <Button variant="gold">Connect {platform.name}</Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Sync Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Auto-Sync Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div>
                <p className="font-medium">Auto-sync inventory</p>
                <p className="text-sm text-gray-500">
                  Automatically sync stock levels across all platforms
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-gold-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gold-500"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div>
                <p className="font-medium">Auto-post new listings</p>
                <p className="text-sm text-gray-500">
                  Automatically post new products to selected platforms
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-gold-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gold-500"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div>
                <p className="font-medium">End listings on sale</p>
                <p className="text-sm text-gray-500">
                  Automatically end listings on other platforms when sold
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-gold-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gold-500"></div>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Platform Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentActivity.map((activity, index) => (
              <div
                key={index}
                className="flex items-center gap-4 p-3 border-b border-gray-100 dark:border-gray-800 last:border-0"
              >
                <div className={`w-2 h-2 rounded-full ${
                  activity.action === 'Sold' ? 'bg-green-500' :
                  activity.action === 'Listed' ? 'bg-blue-500' :
                  activity.action === 'Bid received' ? 'bg-gold-500' :
                  'bg-gray-400'
                }`} />
                <div className="flex-1">
                  <p className="text-sm">
                    <span className="font-medium">{activity.platform}</span>
                    {' • '}
                    {activity.action}: {activity.item}
                  </p>
                </div>
                <span className="text-sm text-gray-500">{activity.time}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
