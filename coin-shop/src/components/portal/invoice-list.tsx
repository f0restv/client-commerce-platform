'use client';

import { format } from 'date-fns';
import { FileText, CreditCard, Download, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils/format';
import type { Invoice } from '@/types';

interface InvoiceListProps {
  invoices: Invoice[];
}

const statusConfig = {
  draft: { label: 'Draft', variant: 'default' as const },
  sent: { label: 'Awaiting Payment', variant: 'warning' as const },
  paid: { label: 'Paid', variant: 'success' as const },
  overdue: { label: 'Overdue', variant: 'danger' as const },
  cancelled: { label: 'Cancelled', variant: 'default' as const },
};

export function InvoiceList({ invoices }: InvoiceListProps) {
  if (invoices.length === 0) {
    return (
      <Card className="text-center py-12">
        <div className="max-w-sm mx-auto">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
            No invoices yet
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            Invoices will appear here once your items sell.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {invoices.map((invoice) => {
        const status = statusConfig[invoice.status];

        return (
          <Card key={invoice.id} className="p-4 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Invoice Info */}
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText className="w-6 h-6 text-gray-500" />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {invoice.invoice_number}
                    </h3>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                    <span>Issued {format(new Date(invoice.created_at), 'MMM d, yyyy')}</span>
                    <span>Due {format(new Date(invoice.due_date), 'MMM d, yyyy')}</span>
                  </div>
                </div>
              </div>

              {/* Amount & Actions */}
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm text-gray-500">
                    {invoice.status === 'paid' ? 'Amount Received' : 'Amount Due'}
                  </p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {formatCurrency(invoice.status === 'paid' ? invoice.amount_paid : invoice.total_due)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {(invoice.status === 'sent' || invoice.status === 'overdue') && invoice.payment_link && (
                    <a href={invoice.payment_link} target="_blank" rel="noopener noreferrer">
                      <Button variant="gold" size="sm">
                        <CreditCard className="w-4 h-4 mr-2" />
                        Pay Now
                      </Button>
                    </a>
                  )}
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    PDF
                  </Button>
                </div>
              </div>
            </div>

            {/* Line Items Summary */}
            {invoice.items && invoice.items.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div className="col-span-2 text-gray-500">Item</div>
                  <div className="text-right text-gray-500">Sale Price</div>
                  <div className="text-right text-gray-500">Your Share</div>
                </div>
                {invoice.items.slice(0, 3).map((item) => (
                  <div key={item.id} className="grid grid-cols-4 gap-4 text-sm py-2">
                    <div className="col-span-2 truncate">{item.description}</div>
                    <div className="text-right">{item.sale_price ? formatCurrency(item.sale_price) : '-'}</div>
                    <div className="text-right font-medium text-green-600">
                      {formatCurrency(item.net_amount)}
                    </div>
                  </div>
                ))}
                {invoice.items.length > 3 && (
                  <p className="text-sm text-gray-500 py-2">
                    +{invoice.items.length - 3} more items
                  </p>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
