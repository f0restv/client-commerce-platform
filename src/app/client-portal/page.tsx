import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Package,
  PlusCircle,
  TrendingUp,
  DollarSign,
  Clock,
  ArrowRight,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SubmissionsList } from "@/components/portal/submissions-list";
import { formatCurrency } from "@/lib/utils";

export default async function ClientPortalDashboard() {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/login");
  }

  // Fetch user with client relation
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: {
      client: true,
    },
  });

  // Fetch client stats if user is linked to a client
  const client = user?.client;

  // Fetch products for this client
  const products = client
    ? await db.product.findMany({
        where: { clientId: client.id },
        include: { images: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      })
    : [];

  // Fetch recent submissions by this user
  const submissions = await db.submission.findMany({
    where: { userId: session.user.id },
    include: { images: true },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  // Fetch pending payouts
  const pendingPayouts = client
    ? await db.clientPayout.aggregate({
        where: { clientId: client.id, status: "PENDING" },
        _sum: { amount: true },
      })
    : { _sum: { amount: null } };

  // Calculate stats
  const stats = {
    totalProducts: client?.totalItems ?? 0,
    itemsSold: client?.totalSold ?? 0,
    totalEarnings: client?.totalEarnings?.toNumber() ?? 0,
    pendingPayout: pendingPayouts._sum.amount?.toNumber() ?? 0,
    activeListings: products.filter((p) => p.status === "ACTIVE").length,
  };

  const firstName = session.user.name?.split(" ")[0] || "there";

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      {/* Welcome Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {firstName}!
          </h1>
          <p className="text-gray-500">
            Manage your inventory and track your earnings
          </p>
        </div>
        <Button variant="gold" asChild>
          <Link href="/client-portal/submit">
            <PlusCircle className="mr-2 h-4 w-4" />
            Submit New Items
          </Link>
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Products"
          value={stats.totalProducts.toString()}
          icon={<Package className="h-5 w-5" />}
          description={`${stats.activeListings} active listings`}
        />
        <StatCard
          title="Items Sold"
          value={stats.itemsSold.toString()}
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <StatCard
          title="Total Earnings"
          value={formatCurrency(stats.totalEarnings)}
          icon={<DollarSign className="h-5 w-5" />}
        />
        <StatCard
          title="Pending Payout"
          value={formatCurrency(stats.pendingPayout)}
          icon={<Clock className="h-5 w-5" />}
          description={stats.pendingPayout > 0 ? "Processing..." : undefined}
        />
      </div>

      {/* Quick Actions */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <QuickAction
          href="/client-portal/submit"
          icon={<PlusCircle className="h-6 w-6" />}
          title="Submit Items"
          description="Upload new products for listing"
        />
        <QuickAction
          href="/client-portal/inventory"
          icon={<Package className="h-6 w-6" />}
          title="My Inventory"
          description="View and manage your products"
        />
        <QuickAction
          href="/client-portal/payouts"
          icon={<DollarSign className="h-6 w-6" />}
          title="Payouts"
          description="View earnings and payment history"
        />
      </div>

      {/* Recent Activity */}
      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        {/* Recent Submissions */}
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Recent Submissions
            </h2>
            <Link
              href="/client-portal/submit"
              className="flex items-center gap-1 text-sm text-amber-600 hover:text-amber-700"
            >
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-4">
            {submissions.length > 0 ? (
              <SubmissionsList
                submissions={submissions.map((s) => ({
                  id: s.id,
                  title: s.title,
                  status: s.status,
                  createdAt: s.createdAt.toISOString(),
                  images: s.images.map((img) => ({ url: img.url })),
                  estimatedValue: s.estimatedValue?.toNumber(),
                  suggestedPrice: s.suggestedPrice?.toNumber(),
                  reviewNotes: s.reviewNotes,
                }))}
              />
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center py-8">
                  <Package className="h-10 w-10 text-gray-300" />
                  <p className="mt-2 text-sm text-gray-500">
                    No submissions yet
                  </p>
                  <Button variant="gold" size="sm" asChild className="mt-4">
                    <Link href="/client-portal/submit">Submit your first item</Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Recent Products */}
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Recent Products
            </h2>
            <Link
              href="/client-portal/inventory"
              className="flex items-center gap-1 text-sm text-amber-600 hover:text-amber-700"
            >
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-4">
            {products.length > 0 ? (
              <div className="space-y-3">
                {products.map((product) => (
                  <Card key={product.id}>
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="h-12 w-12 rounded-md bg-gray-100 flex items-center justify-center">
                        <Package className="h-6 w-6 text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {product.title}
                        </p>
                        <p className="text-sm text-gray-500">
                          {product.status} - {formatCurrency(product.price?.toNumber() ?? 0)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center py-8">
                  <Package className="h-10 w-10 text-gray-300" />
                  <p className="mt-2 text-sm text-gray-500">
                    No products listed yet
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function StatCard({
  title,
  value,
  icon,
  description,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  description?: string;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">{title}</span>
          <div className="rounded-full bg-amber-100 p-2 text-amber-600">
            {icon}
          </div>
        </div>
        <p className="mt-2 text-2xl font-bold">{value}</p>
        {description && (
          <p className="mt-1 text-xs text-gray-500">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

function QuickAction({
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
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="flex items-center gap-4 p-6">
          <div className="rounded-full bg-amber-100 p-3 text-amber-600">
            {icon}
          </div>
          <div>
            <p className="font-semibold text-gray-900">{title}</p>
            <p className="text-sm text-gray-500">{description}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
