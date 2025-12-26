import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  Package,
  Search,
  Filter,
  ExternalLink,
  Eye,
  DollarSign,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, cn } from "@/lib/utils";

const statusConfig: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Draft", color: "bg-gray-100 text-gray-800" },
  PENDING_REVIEW: { label: "Pending Review", color: "bg-yellow-100 text-yellow-800" },
  ACTIVE: { label: "Active", color: "bg-green-100 text-green-800" },
  SOLD: { label: "Sold", color: "bg-blue-100 text-blue-800" },
  RESERVED: { label: "Reserved", color: "bg-purple-100 text-purple-800" },
  ARCHIVED: { label: "Archived", color: "bg-gray-100 text-gray-800" },
};

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string; page?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;

  if (!session?.user) {
    redirect("/auth/login");
  }

  // Fetch user with client relation
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: { client: true },
  });

  const client = user?.client;

  if (!client) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8">
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <Package className="h-12 w-12 text-gray-300" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              No Client Account
            </h3>
            <p className="mt-1 text-center text-sm text-gray-500">
              Your account is not linked to a client business.
              <br />
              Contact support to set up your client account.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  // Build query filters
  const statusFilter = params.status;
  const searchFilter = params.search;
  const page = parseInt(params.page || "1", 10);
  const pageSize = 20;

  const where = {
    clientId: client.id,
    ...(statusFilter && statusFilter !== "all" ? { status: statusFilter as any } : {}),
    ...(searchFilter
      ? {
          OR: [
            { title: { contains: searchFilter, mode: "insensitive" as const } },
            { sku: { contains: searchFilter, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  // Fetch products
  const [products, totalCount] = await Promise.all([
    db.product.findMany({
      where,
      include: {
        images: { orderBy: { order: "asc" }, take: 1 },
        platformListings: {
          include: { connection: true },
          where: { status: "ACTIVE" },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.product.count({ where }),
  ]);

  // Get status counts for filters
  const statusCounts = await db.product.groupBy({
    by: ["status"],
    where: { clientId: client.id },
    _count: true,
  });

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Inventory</h1>
          <p className="text-gray-500">
            {totalCount} product{totalCount !== 1 ? "s" : ""} in your inventory
          </p>
        </div>
        <Button variant="gold" asChild>
          <Link href="/client-portal/submit">
            <Package className="mr-2 h-4 w-4" />
            Submit New Items
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <form>
            <Input
              name="search"
              placeholder="Search by title or SKU..."
              defaultValue={searchFilter}
              className="pl-10"
            />
          </form>
        </div>

        {/* Status Filter */}
        <div className="flex flex-wrap gap-2">
          <Link
            href="/client-portal/inventory"
            className={cn(
              "rounded-full px-3 py-1 text-sm font-medium transition-colors",
              !statusFilter || statusFilter === "all"
                ? "bg-amber-100 text-amber-800"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            All ({client.totalItems})
          </Link>
          {statusCounts.map((sc) => {
            const config = statusConfig[sc.status] || statusConfig.DRAFT;
            return (
              <Link
                key={sc.status}
                href={`/client-portal/inventory?status=${sc.status}`}
                className={cn(
                  "rounded-full px-3 py-1 text-sm font-medium transition-colors",
                  statusFilter === sc.status
                    ? config.color
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                {config.label} ({sc._count})
              </Link>
            );
          })}
        </div>
      </div>

      {/* Products Grid */}
      {products.length > 0 ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => {
            const status = statusConfig[product.status] || statusConfig.DRAFT;
            const primaryImage = product.images[0];

            return (
              <Card key={product.id} className="overflow-hidden">
                {/* Image */}
                <div className="relative aspect-square bg-gray-100">
                  {primaryImage ? (
                    <Image
                      src={primaryImage.url}
                      alt={product.title}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Package className="h-12 w-12 text-gray-300" />
                    </div>
                  )}
                  <Badge className={cn("absolute right-2 top-2", status.color)}>
                    {status.label}
                  </Badge>
                </div>

                <CardContent className="p-4">
                  {/* Title */}
                  <h3 className="font-medium text-gray-900 line-clamp-2">
                    {product.title}
                  </h3>

                  {/* SKU */}
                  <p className="mt-1 text-xs text-gray-500">SKU: {product.sku}</p>

                  {/* Price */}
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-lg font-bold text-amber-600">
                      {formatCurrency(product.price?.toNumber() ?? 0)}
                    </span>
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      <Eye className="h-4 w-4" />
                      {product.views}
                    </div>
                  </div>

                  {/* Platform Listings */}
                  {product.platformListings.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {product.platformListings.map((listing) => (
                        <a
                          key={listing.id}
                          href={listing.externalUrl || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-200"
                        >
                          {listing.connection.platform}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Consignment Info */}
                  {product.isConsignment && product.consignmentRate && (
                    <div className="mt-3 flex items-center gap-1 text-xs text-gray-500">
                      <DollarSign className="h-3 w-3" />
                      {100 - product.consignmentRate.toNumber()}% commission to you
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="mt-6">
          <CardContent className="flex flex-col items-center py-12">
            <Package className="h-12 w-12 text-gray-300" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              No products found
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchFilter
                ? "Try adjusting your search or filters"
                : "Submit your first items to get started"}
            </p>
            {!searchFilter && (
              <Button variant="gold" size="sm" asChild className="mt-4">
                <Link href="/client-portal/submit">Submit Items</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex justify-center gap-2">
          {page > 1 && (
            <Link
              href={`/client-portal/inventory?page=${page - 1}${
                statusFilter ? `&status=${statusFilter}` : ""
              }${searchFilter ? `&search=${searchFilter}` : ""}`}
              className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Previous
            </Link>
          )}
          <span className="flex items-center px-4 text-sm text-gray-500">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`/client-portal/inventory?page=${page + 1}${
                statusFilter ? `&status=${statusFilter}` : ""
              }${searchFilter ? `&search=${searchFilter}` : ""}`}
              className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </main>
  );
}
