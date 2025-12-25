import Link from 'next/link';
import {
  DollarSign,
  Package,
  Users,
  TrendingUp,
  ShoppingCart,
  Clock,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils/format';

// Mock data
const stats = [
  {
    label: 'Revenue (30d)',
    value: '$24,850',
    change: '+12.5%',
    trend: 'up',
    icon: DollarSign,
  },
  {
    label: 'Active Listings',
    value: '347',
    change: '+23',
    trend: 'up',
    icon: Package,
  },
  {
    label: 'Active Clients',
    value: '52',
    change: '+5',
    trend: 'up',
    icon: Users,
  },
  {
    label: 'Conversion Rate',
    value: '3.2%',
    change: '-0.3%',
    trend: 'down',
    icon: TrendingUp,
  },
];

const recentOrders = [
  { id: 'ORD-001', customer: 'John Smith', items: 2, total: 845.00, status: 'paid' },
  { id: 'ORD-002', customer: 'Jane Doe', items: 1, total: 2150.00, status: 'shipped' },
  { id: 'ORD-003', customer: 'Bob Wilson', items: 3, total: 127.50, status: 'pending' },
];

const pendingSubmissions = [
  { id: '1', title: '1893-S Morgan Dollar', client: 'Mike J.', value: 4850, submitted: '2h ago' },
  { id: '2', title: '10oz Silver Bar PAMP', client: 'Sarah L.', value: 285, submitted: '5h ago' },
  { id: '3', title: 'Gold Eagle Set 2020-2024', client: 'Tom R.', value: 10500, submitted: '1d ago' },
];

const lowStockItems = [
  { id: '1', title: '2024 Silver Eagle MS-70', stock: 2, threshold: 5 },
  { id: '2', title: '1oz Gold Bar PAMP', stock: 1, threshold: 3 },
];

const endingAuctions = [
  { id: '1', title: '1921 Peace Dollar MS-65', bids: 12, current: 425, ends: '2h 15m' },
  { id: '2', title: '1878-CC Morgan XF-45', bids: 8, current: 890, ends: '4h 30m' },
];

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">Export</Button>
          <Button variant="gold" size="sm">Add Product</Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                    {stat.value}
                  </p>
                  <p className={`text-sm mt-1 flex items-center gap-1 ${
                    stat.trend === 'up' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {stat.trend === 'up' ? (
                      <ArrowUpRight className="w-4 h-4" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4" />
                    )}
                    {stat.change}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <stat.icon className="w-6 h-6 text-gray-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Orders */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Recent Orders
            </CardTitle>
            <Link href="/admin/orders" className="text-sm text-gold-600 hover:text-gold-700">
              View All
            </Link>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-500 border-b border-gray-200 dark:border-gray-700">
                    <th className="pb-3 font-medium">Order</th>
                    <th className="pb-3 font-medium">Customer</th>
                    <th className="pb-3 font-medium">Items</th>
                    <th className="pb-3 font-medium">Total</th>
                    <th className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {recentOrders.map((order) => (
                    <tr key={order.id} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-3 font-medium">{order.id}</td>
                      <td className="py-3">{order.customer}</td>
                      <td className="py-3">{order.items}</td>
                      <td className="py-3 font-medium">{formatCurrency(order.total)}</td>
                      <td className="py-3">
                        <Badge variant={
                          order.status === 'shipped' ? 'success' :
                          order.status === 'paid' ? 'default' : 'warning'
                        }>
                          {order.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Pending Submissions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Pending Review
            </CardTitle>
            <Badge variant="warning">{pendingSubmissions.length}</Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingSubmissions.map((sub) => (
                <div key={sub.id} className="flex items-start gap-3 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                  <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Package className="w-5 h-5 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {sub.title}
                    </p>
                    <p className="text-sm text-gray-500">
                      {sub.client} • {sub.submitted}
                    </p>
                  </div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {formatCurrency(sub.value)}
                  </p>
                </div>
              ))}
              <Link href="/admin/submissions">
                <Button variant="outline" className="w-full">Review All</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Low Stock Alerts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              Low Stock Alert
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lowStockItems.length === 0 ? (
              <p className="text-gray-500 text-center py-4">All items well stocked</p>
            ) : (
              <div className="space-y-3">
                {lowStockItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{item.title}</p>
                      <p className="text-sm text-red-600">
                        Only {item.stock} left (min: {item.threshold})
                      </p>
                    </div>
                    <Button size="sm" variant="outline">Restock</Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ending Auctions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-gold-500" />
              Ending Soon
            </CardTitle>
            <Link href="/admin/auctions" className="text-sm text-gold-600 hover:text-gold-700">
              View All
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {endingAuctions.map((auction) => (
                <div key={auction.id} className="flex items-center justify-between p-3 bg-gold-50 dark:bg-gold-900/20 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{auction.title}</p>
                    <p className="text-sm text-gray-500">
                      {auction.bids} bids • Current: {formatCurrency(auction.current)}
                    </p>
                  </div>
                  <Badge variant="gold">{auction.ends}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
