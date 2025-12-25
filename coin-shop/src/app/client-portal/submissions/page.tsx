import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SubmissionsList } from '@/components/portal';
import type { ClientSubmission } from '@/types';

// Mock data - in production, fetch from Supabase
const mockSubmissions: ClientSubmission[] = [
  {
    id: '1',
    client_id: 'user-1',
    status: 'listed',
    title: '1921 Morgan Silver Dollar MS-65 PCGS',
    description: 'Beautiful gem uncirculated Morgan dollar with exceptional luster.',
    category_id: '1',
    estimated_value: 400,
    desired_price: 450,
    ai_analysis: {
      identified_item: '1921 Morgan Silver Dollar',
      confidence: 0.95,
      estimated_value_low: 380,
      estimated_value_high: 480,
      estimated_value_avg: 425,
      market_analysis: 'Strong demand for high-grade Morgan dollars.',
      avg_days_to_sell: 14,
      grading_estimate: 'MS-64 to MS-66',
      recent_sales: [],
      recommendations: [],
    },
    images: ['https://images.unsplash.com/photo-1621981386829-9b458a2cddde?w=400'],
    product_id: 'product-1',
    created_at: '2024-12-01T10:00:00Z',
    updated_at: '2024-12-05T14:00:00Z',
    reviewed_at: '2024-12-03T09:00:00Z',
  },
  {
    id: '2',
    client_id: 'user-1',
    status: 'pending',
    title: '10oz Silver Bar - PAMP Suisse',
    description: 'PAMP Suisse 10 oz .999 fine silver bar with assay certificate.',
    images: ['https://images.unsplash.com/photo-1574607383476-f517f260d30b?w=400'],
    created_at: '2024-12-18T15:00:00Z',
    updated_at: '2024-12-18T15:00:00Z',
  },
  {
    id: '3',
    client_id: 'user-1',
    status: 'reviewing',
    title: '1893-S Morgan Dollar VG-8 - Key Date',
    description: 'The famous key date Morgan dollar. A must for any serious collector.',
    ai_analysis: {
      identified_item: '1893-S Morgan Silver Dollar',
      confidence: 0.92,
      estimated_value_low: 4200,
      estimated_value_high: 5500,
      estimated_value_avg: 4850,
      market_analysis: 'Key date with consistent collector demand.',
      avg_days_to_sell: 21,
      grading_estimate: 'VG-8 to F-12',
      recent_sales: [],
      recommendations: ['Consider NGC or PCGS certification for maximum value'],
    },
    images: ['https://images.unsplash.com/photo-1621981386829-9b458a2cddde?w=400'],
    created_at: '2024-12-15T11:00:00Z',
    updated_at: '2024-12-17T09:00:00Z',
  },
  {
    id: '4',
    client_id: 'user-1',
    status: 'rejected',
    title: 'Replica Roman Coin',
    description: 'Ancient looking coin found at estate sale.',
    rejection_reason: 'Item appears to be a modern reproduction/replica and is not suitable for our marketplace.',
    images: [],
    created_at: '2024-11-28T14:00:00Z',
    updated_at: '2024-11-30T10:00:00Z',
    reviewed_at: '2024-11-30T10:00:00Z',
  },
];

export default function SubmissionsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            My Submissions
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Track all your submitted items and their status.
          </p>
        </div>
        <Link href="/client-portal/submissions/new">
          <Button variant="gold">
            <Plus className="w-4 h-4 mr-2" />
            Submit Item
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {['All', 'Pending', 'Reviewing', 'Approved', 'Listed', 'Rejected'].map((filter) => (
          <button
            key={filter}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              filter === 'All'
                ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Submissions List */}
      <SubmissionsList submissions={mockSubmissions} />
    </div>
  );
}
