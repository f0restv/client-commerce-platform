import Link from "next/link";
import {
  Package,
  Users,
  DollarSign,
  TrendingUp,
  Gavel,
  FileText,
  Upload,
  Globe,
  BarChart3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { db } from "@/lib/db";

async function getStats() {
  const [
    totalProducts,
    activeListings,
    pendingSubmissions,
    activeAuctions,
    totalClients,
    totalSalesResult,
  ] = await Promise.all([
    db.product.count(),
    db.product.count({ where: { status: "ACTIVE" } }),
    db.submission.count({ where: { status: { in: ["PENDING", "UNDER_REVIEW"] } } }),
    db.auction.count({ where: { status: "ACTIVE" } }),
    db.client.count({ where: { status: "ACTIVE" } }),
    db.order.aggregate({
      where: { status: { in: ["PAID", "SHIPPED", "DELIVERED"] } },
      _sum: { total: true },
    }),
  ]);

  return {
    totalProducts,
    activeListings,
    pendingSubmissions,
    activeAuctions,
    totalClients,
    totalSales: totalSalesResult._sum.total?.toNumber() || 0,
  };
}

async function getRecentSubmissions() {
  return db.submission.findMany({
    where: { status: { in: ["PENDING", "UNDER_REVIEW"] } },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
}

async function getRecentSales() {
  return db.order.findMany({
    where: { status: { in: ["PAID", "SHIPPED", "DELIVERED"] } },
    include: {
      items: {
        include: { product: { select: { title: true } } },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
}

export default async function AdminDashboard() {
  const [stats, recentSubmissions, recentSales] = await Promise.all([
    getStats(),
    getRecentSubmissions(),
    getRecentSales(),
  ]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/admin/products/new">
              <Upload className="mr-2 h-4 w-4" />
              Add Product
            </Link>
          </Button>
          <Button variant="gold" asChild>
            <Link href="/admin/sync">
              <Globe className="mr-2 h-4 w-4" />
              Sync Platforms
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          title="Total Products"
          value={stats.totalProducts.toLocaleString()}
          icon={<Package className="h-5 w-5" />}
          color="blue"
        />
        <StatCard
          title="Active Listings"
          value={stats.activeListings.toLocaleString()}
          icon={<TrendingUp className="h-5 w-5" />}
          color="green"
        />
        <StatCard
          title="Total Sales"
          value={formatCurrency(stats.totalSales)}
          icon={<DollarSign className="h-5 w-5" />}
          color="amber"
        />
        <StatCard
          title="Pending Reviews"
          value={stats.pendingSubmissions.toString()}
          icon={<FileText className="h-5 w-5" />}
          color="purple"
          alert={stats.pendingSubmissions > 0}
        />
        <StatCard
          title="Active Auctions"
          value={stats.activeAuctions.toString()}
          icon={<Gavel className="h-5 w-5" />}
          color="pink"
        />
        <StatCard
          title="Total Clients"
          value={stats.totalClients.toLocaleString()}
          icon={<Users className="h-5 w-5" />}
          color="cyan"
        />
      </div>

      {/* Main Content Grid */}
      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        {/* Pending Submissions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Pending Submissions</CardTitle>
            <Link href="/admin/submissions" className="text-sm text-amber-600 hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {recentSubmissions.length === 0 ? (
              <p className="text-sm text-gray-500">No pending submissions</p>
            ) : (
              <div className="space-y-4">
                {recentSubmissions.map((sub) => (
                  <div key={sub.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{sub.title}</p>
                      <p className="text-sm text-gray-500">
                        by {sub.user.name || sub.user.email}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={sub.status === "PENDING" ? "secondary" : "default"}>
                        {sub.status.replace("_", " ")}
                      </Badge>
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/admin/submissions/${sub.id}`}>Review</Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Sales */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent Sales</CardTitle>
            <Link href="/admin/sales" className="text-sm text-amber-600 hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {recentSales.length === 0 ? (
              <p className="text-sm text-gray-500">No recent sales</p>
            ) : (
              <div className="space-y-4">
                {recentSales.map((sale) => (
                  <div key={sale.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        {sale.items[0]?.product.title || `Order ${sale.orderNumber}`}
                      </p>
                      <p className="text-sm text-gray-500">{sale.orderNumber}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-green-600">
                        {formatCurrency(sale.total.toNumber())}
                      </p>
                      <p className="text-xs text-gray-500">{formatDate(sale.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold">Quick Actions</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <QuickActionCard
            href="/admin/products"
            icon={<Package className="h-6 w-6" />}
            title="Manage Products"
            description="Edit listings, prices, and inventory"
          />
          <QuickActionCard
            href="/admin/clients"
            icon={<Users className="h-6 w-6" />}
            title="Manage Clients"
            description="View clients and their sources"
          />
          <QuickActionCard
            href="/admin/auctions/new"
            icon={<Gavel className="h-6 w-6" />}
            title="Create Auction"
            description="Set up a new auction event"
          />
          <QuickActionCard
            href="/admin/reports"
            icon={<BarChart3 className="h-6 w-6" />}
            title="View Reports"
            description="Sales analytics and insights"
          />
        </div>
      </div>
    </main>
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
  alert,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  alert?: boolean;
}) {
  const colorClasses: Record<string, string> = {
    blue: "bg-blue-100 text-blue-600",
    green: "bg-green-100 text-green-600",
    amber: "bg-amber-100 text-amber-600",
    purple: "bg-purple-100 text-purple-600",
    pink: "bg-pink-100 text-pink-600",
    cyan: "bg-cyan-100 text-cyan-600",
  };

  return (
    <Card className={alert ? "border-amber-300 bg-amber-50" : ""}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">{title}</span>
          <div className={`rounded-full p-2 ${colorClasses[color]}`}>{icon}</div>
        </div>
        <p className="mt-2 text-xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function QuickActionCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link href={href}>
      <Card className="h-full transition-shadow hover:shadow-md">
        <CardContent className="flex items-start gap-4 p-4">
          <div className="rounded-lg bg-amber-100 p-3 text-amber-600">{icon}</div>
          <div>
            <p className="font-semibold">{title}</p>
            <p className="text-sm text-gray-500">{description}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
