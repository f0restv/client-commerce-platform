import Link from "next/link";
import { redirect } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  PlusCircle,
  DollarSign,
  Settings,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/client-portal", label: "Dashboard", icon: LayoutDashboard },
  { href: "/client-portal/inventory", label: "My Inventory", icon: Package },
  { href: "/client-portal/submit", label: "Submit Items", icon: PlusCircle },
  { href: "/client-portal/payouts", label: "Payouts", icon: DollarSign },
];

export default async function ClientPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/login");
  }

  // Ensure user is a CLIENT (or admin/staff who can access)
  if (!["CLIENT", "ADMIN", "STAFF"].includes(session.user.role || "")) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xl font-bold">
              Coin<span className="text-amber-600">Vault</span>
            </Link>
            <Badge variant="secondary">Client Portal</Badge>
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
              <Link href="/client-portal/settings">
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
