import { InvoiceList } from '@/components/portal';
import type { Invoice } from '@/types';

// Mock data - in production, fetch from Supabase
const mockInvoices: Invoice[] = [
  {
    id: '1',
    invoice_number: 'INV-20241201-0001',
    client_id: 'user-1',
    status: 'paid',
    items: [
      {
        id: '1',
        invoice_id: '1',
        description: '1878-CC Morgan Dollar MS-63',
        product_id: 'prod-1',
        sale_price: 850,
        commission_rate: 15,
        commission_amount: 127.50,
        fees: 22.50,
        net_amount: 700,
      },
      {
        id: '2',
        invoice_id: '1',
        description: '1oz Gold Eagle 2023',
        product_id: 'prod-2',
        sale_price: 2100,
        commission_rate: 10,
        commission_amount: 210,
        fees: 40,
        net_amount: 1850,
      },
    ],
    subtotal: 2950,
    fees: 62.50,
    commission: 337.50,
    total_due: 2550,
    amount_paid: 2550,
    stripe_invoice_id: 'in_xxx',
    paid_at: '2024-12-05T14:30:00Z',
    due_date: '2024-12-15',
    created_at: '2024-12-01T10:00:00Z',
    updated_at: '2024-12-05T14:30:00Z',
  },
  {
    id: '2',
    invoice_number: 'INV-20241215-0002',
    client_id: 'user-1',
    status: 'sent',
    items: [
      {
        id: '3',
        invoice_id: '2',
        description: '10oz Silver Bar - Engelhard',
        product_id: 'prod-3',
        sale_price: 320,
        commission_rate: 15,
        commission_amount: 48,
        fees: 12,
        net_amount: 260,
      },
    ],
    subtotal: 320,
    fees: 12,
    commission: 48,
    total_due: 260,
    amount_paid: 0,
    payment_link: 'https://buy.stripe.com/xxx',
    due_date: '2024-12-30',
    created_at: '2024-12-15T16:00:00Z',
    updated_at: '2024-12-15T16:00:00Z',
  },
];

export default function InvoicesPage() {
  const totalPaid = mockInvoices
    .filter((inv) => inv.status === 'paid')
    .reduce((sum, inv) => sum + inv.amount_paid, 0);

  const totalPending = mockInvoices
    .filter((inv) => inv.status === 'sent' || inv.status === 'overdue')
    .reduce((sum, inv) => sum + inv.total_due, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Invoices
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          View and pay your consignment invoices.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
          <p className="text-sm text-green-600 dark:text-green-400">Total Received</p>
          <p className="text-2xl font-bold text-green-700 dark:text-green-300">
            ${totalPaid.toLocaleString()}
          </p>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
          <p className="text-sm text-yellow-600 dark:text-yellow-400">Pending Payment</p>
          <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">
            ${totalPending.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {['All', 'Awaiting Payment', 'Paid', 'Overdue'].map((filter) => (
          <button
            key={filter}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              filter === 'All'
                ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Invoice List */}
      <InvoiceList invoices={mockInvoices} />
    </div>
  );
}
