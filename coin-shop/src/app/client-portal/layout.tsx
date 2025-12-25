import Link from 'next/link';
import { LayoutDashboard, Package, FileText, Plus, Settings, ArrowLeft } from 'lucide-react';

const sidebarLinks = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/client-portal' },
  { icon: Package, label: 'My Submissions', href: '/client-portal/submissions' },
  { icon: FileText, label: 'Invoices', href: '/client-portal/invoices' },
  { icon: Settings, label: 'Settings', href: '/client-portal/settings' },
];

export default function ClientPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden md:flex w-64 flex-col fixed inset-y-0 pt-16 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <Link
              href="/"
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Shop
            </Link>
          </div>

          <nav className="flex-1 p-4 space-y-1">
            {sidebarLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <link.icon className="w-5 h-5" />
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <Link
              href="/client-portal/submissions/new"
              className="flex items-center justify-center gap-2 w-full py-2.5 bg-gold-500 hover:bg-gold-600 text-white rounded-lg font-medium transition-colors"
            >
              <Plus className="w-5 h-5" />
              Submit New Item
            </Link>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 md:ml-64 pt-16">
          <div className="p-4 md:p-8">{children}</div>
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-40">
        <div className="grid grid-cols-4 h-16">
          {sidebarLinks.slice(0, 4).map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex flex-col items-center justify-center text-gray-500 dark:text-gray-400"
            >
              <link.icon className="w-5 h-5" />
              <span className="text-xs mt-1">{link.label.split(' ')[0]}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
