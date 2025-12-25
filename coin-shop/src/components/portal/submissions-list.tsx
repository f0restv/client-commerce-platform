'use client';

import Image from 'next/image';
import Link from 'next/link';
import { format } from 'date-fns';
import { Eye, ExternalLink, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils/format';
import type { ClientSubmission } from '@/types';

interface SubmissionsListProps {
  submissions: ClientSubmission[];
}

const statusConfig = {
  pending: { label: 'Pending Review', variant: 'warning' as const },
  reviewing: { label: 'Under Review', variant: 'default' as const },
  approved: { label: 'Approved', variant: 'success' as const },
  rejected: { label: 'Rejected', variant: 'danger' as const },
  listed: { label: 'Listed', variant: 'success' as const },
};

export function SubmissionsList({ submissions }: SubmissionsListProps) {
  if (submissions.length === 0) {
    return (
      <Card className="text-center py-12">
        <div className="max-w-sm mx-auto">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Eye className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
            No submissions yet
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Submit your coins and collectibles to get started.
          </p>
          <Link href="/client-portal/submissions/new">
            <Button variant="gold">Submit Your First Item</Button>
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {submissions.map((submission) => {
        const status = statusConfig[submission.status];
        const primaryImage = submission.images?.[0];

        return (
          <Card
            key={submission.id}
            className="flex gap-4 p-4 hover:shadow-md transition-shadow"
            hover
          >
            {/* Image */}
            <div className="relative w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
              {primaryImage ? (
                <Image
                  src={primaryImage}
                  alt={submission.title}
                  fill
                  className="object-cover"
                  sizes="96px"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  No image
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-1">
                    {submission.title}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
                    {submission.description}
                  </p>
                </div>
                <Badge variant={status.variant}>{status.label}</Badge>
              </div>

              <div className="flex items-center gap-4 mt-3 text-sm">
                <span className="text-gray-500">
                  Submitted {format(new Date(submission.created_at), 'MMM d, yyyy')}
                </span>

                {submission.ai_analysis && (
                  <span className="text-green-600 font-medium">
                    Est. {formatCurrency(submission.ai_analysis.estimated_value_avg)}
                  </span>
                )}

                {submission.product_id && (
                  <Link
                    href={`/shop/product/${submission.product_id}`}
                    className="text-gold-600 hover:text-gold-700 flex items-center gap-1"
                  >
                    View Listing
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                )}
              </div>

              {submission.status === 'rejected' && submission.rejection_reason && (
                <p className="mt-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg p-2">
                  Reason: {submission.rejection_reason}
                </p>
              )}
            </div>

            {/* Action */}
            <div className="flex items-center">
              <Link href={`/client-portal/submissions/${submission.id}`}>
                <Button variant="ghost" size="icon">
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </Link>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
