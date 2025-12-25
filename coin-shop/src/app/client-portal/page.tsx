import Link from 'next/link';
import { Package, FileText, DollarSign, Clock, Plus, ArrowRight, TrendingUp } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils/format';

// Mock data - in production, fetch from Supabase
const mockStats = {
  totalSubmissions: 12,
  pendingReview: 3,
  activeListed: 7,
  soldItems: 2,
  totalEarnings: 2450.00,
  pendingPayment: 850.00,
};

const mockRecentSubmissions = [
  { id: '1', title: '1921 Morgan Dollar MS-65', status: 'listed', value: 425 },
  { id: '2', title: '10oz Silver Bar PAMP', status: 'pending', value: 285 },
  { id: '3', title: '1893-S Morgan Key Date', status: 'reviewing', value: 4850 },
];

const mockRecentInvoices = [
  { id: '1', number: 'INV-20241201-0001', status: 'paid', amount: 1200 },
  { id: '2', number: 'INV-20241215-0002', status: 'sent', amount: 850 },
];

export default function ClientPortalDashboard() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Welcome Back!
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Here&apos;s an overview of your consignment activity.
          </p>
        </div>
        <Link href="/client-portal/submissions/new">
          <Button variant="gold">
            <Plus className="w-4 h-4 mr-2" />
            Submit Item
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{mockStats.totalSubmissions}</p>
                <p className="text-sm text-gray-500">Total Submissions</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{mockStats.pendingReview}</p>
                <p className="text-sm text-gray-500">Pending Review</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{mockStats.activeListed}</p>
                <p className="text-sm text-gray-500">Active Listings</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gold-100 dark:bg-gold-900/30 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-gold-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(mockStats.totalEarnings)}</p>
                <p className="text-sm text-gray-500">Total Earnings</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Two Column Layout */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent Submissions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Submissions</CardTitle>
            <Link href="/client-portal/submissions" className="text-sm text-gold-600 hover:text-gold-700">
              View All
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockRecentSubmissions.map((submission) => (
                <div key={submission.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {submission.title}
                    </p>
                    <p className="text-sm text-gray-500">
                      Est. {formatCurrency(submission.value)}
                    </p>
                  </div>
                  <Badge
                    variant={
                      submission.status === 'listed'
                        ? 'success'
                        : submission.status === 'pending'
                        ? 'warning'
                        : 'default'
                    }
                  >
                    {submission.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Invoices */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Invoices</CardTitle>
            <Link href="/client-portal/invoices" className="text-sm text-gold-600 hover:text-gold-700">
              View All
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockRecentInvoices.map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {invoice.number}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatCurrency(invoice.amount)}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={invoice.status === 'paid' ? 'success' : 'warning'}
                  >
                    {invoice.status}
                  </Badge>
                </div>
              ))}

              {mockStats.pendingPayment > 0 && (
                <div className="pt-4">
                  <div className="bg-gold-50 dark:bg-gold-900/20 rounded-lg p-4">
                    <p className="text-sm text-gold-800 dark:text-gold-200">
                      You have{' '}
                      <span className="font-bold">{formatCurrency(mockStats.pendingPayment)}</span>
                      {' '}pending payment
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              href="/client-portal/submissions/new"
              className="flex items-center gap-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-gold-500 hover:bg-gold-50 dark:hover:bg-gold-900/10 transition-colors"
            >
              <Plus className="w-8 h-8 text-gold-500" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Submit New Item</p>
                <p className="text-sm text-gray-500">Add coins for consignment</p>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400 ml-auto" />
            </Link>

            <Link
              href="/client-portal/estimates"
              className="flex items-center gap-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-gold-500 hover:bg-gold-50 dark:hover:bg-gold-900/10 transition-colors"
            >
              <TrendingUp className="w-8 h-8 text-blue-500" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Get AI Estimate</p>
                <p className="text-sm text-gray-500">Value your collection</p>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400 ml-auto" />
            </Link>

            <Link
              href="/client-portal/settings"
              className="flex items-center gap-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-gold-500 hover:bg-gold-50 dark:hover:bg-gold-900/10 transition-colors"
            >
              <DollarSign className="w-8 h-8 text-green-500" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Payment Settings</p>
                <p className="text-sm text-gray-500">Update payment method</p>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400 ml-auto" />
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
