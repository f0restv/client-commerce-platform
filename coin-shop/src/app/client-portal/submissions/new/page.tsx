'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { SubmissionForm } from '@/components/portal';
import type { Category, AIAnalysis } from '@/types';

// Mock categories - in production, fetch from Supabase
const mockCategories: Category[] = [
  { id: '1', name: 'US Coins', slug: 'us-coins', position: 1 },
  { id: '2', name: 'World Coins', slug: 'world-coins', position: 2 },
  { id: '3', name: 'Ancient Coins', slug: 'ancient-coins', position: 3 },
  { id: '4', name: 'Bullion', slug: 'bullion', position: 4 },
  { id: '5', name: 'Paper Money', slug: 'paper-money', position: 5 },
  { id: '6', name: 'Tokens & Medals', slug: 'tokens-medals', position: 6 },
];

export default function NewSubmissionPage() {
  const router = useRouter();

  const handleSubmit = async (
    data: {
      title: string;
      description: string;
      category_id?: string;
      estimated_value?: number;
      desired_price?: number;
    },
    images: File[],
    analysis?: AIAnalysis
  ) => {
    // In production, upload images to Supabase Storage and create submission
    console.log('Submitting:', { data, images, analysis });

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Redirect to submissions list
    router.push('/client-portal/submissions');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/client-portal/submissions"
          className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Submit New Item
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Upload photos and get an instant AI-powered valuation.
          </p>
        </div>
      </div>

      {/* Form */}
      <SubmissionForm categories={mockCategories} onSubmit={handleSubmit} />
    </div>
  );
}
