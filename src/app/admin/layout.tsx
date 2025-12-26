import Link from "next/link";
import { redirect } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Package,
  FileText,
  Gavel,
  Globe,
  Settings,
  LogOut,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/clients", label: "Clients", icon: Users },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/submissions", label: "Submissions", icon: FileText },
  { href: "/admin/auctions", label: "Auctions", icon: Gavel },
  { href: "/admin/integrations", label: "Integrations", icon: Globe },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user || !["ADMIN", "STAFF"].includes(session.user.role || "")) {
    redirect("/auth/login");
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Admin Header */}
      <header className="sticky top-0 z-50 border-b bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xl font-bold">
              Coin<span className="text-amber-600">Vault</span>
            </Link>
            <Badge variant="secondary">Admin</Badge>
          </div>
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-gray-600 md:block">
              {session.user.name || session.user.email}
            </span>
            <Button variant="ghost" size="icon" asChild>
              <Link href="/admin/settings">
                <Settings className="h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation */}
      <nav className="sticky top-16 z-40 overflow-x-auto border-b bg-white px-4 py-2 md:hidden">
        <div className="flex gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </div>
      </nav>

      {children}
    </div>
  );
}
