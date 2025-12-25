import Link from 'next/link';
import {
  LayoutDashboard,
  Package,
  Users,
  Gavel,
  FileText,
  Globe,
  Settings,
  ArrowLeft,
  Search,
  BarChart3,
} from 'lucide-react';

const sidebarLinks = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/admin/dashboard' },
  { icon: Package, label: 'Products', href: '/admin/products' },
  { icon: Users, label: 'Clients', href: '/admin/clients' },
  { icon: Gavel, label: 'Auctions', href: '/admin/auctions' },
  { icon: FileText, label: 'Invoices', href: '/admin/invoices' },
  { icon: Globe, label: 'Platforms', href: '/admin/platforms' },
  { icon: Search, label: 'Scraper', href: '/admin/scraper' },
  { icon: BarChart3, label: 'Analytics', href: '/admin/analytics' },
  { icon: Settings, label: 'Settings', href: '/admin/settings' },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden lg:flex w-64 flex-col fixed inset-y-0 bg-gray-900 text-white">
          {/* Logo */}
          <div className="h-16 flex items-center px-6 border-b border-gray-800">
            <Link href="/admin/dashboard" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-gold-400 to-gold-600 rounded-lg flex items-center justify-center">
                <span className="font-bold text-sm">CV</span>
              </div>
              <span className="font-bold">Admin Panel</span>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {sidebarLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
              >
                <link.icon className="w-5 h-5" />
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-gray-800">
            <Link
              href="/"
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Shop
            </Link>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 lg:ml-64">
          {/* Top Bar */}
          <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-6 sticky top-0 z-40">
            <div className="flex items-center gap-4">
              <button className="lg:hidden p-2 text-gray-500 hover:text-gray-700">
                <LayoutDashboard className="w-5 h-5" />
              </button>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                CoinVault Admin
              </h1>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative hidden sm:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="w-64 h-9 pl-10 pr-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                />
              </div>
              <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600" />
            </div>
          </header>

          {/* Page Content */}
          <div className="p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
