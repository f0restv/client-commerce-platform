import Link from "next/link";
import {
  Search,
  Plus,
  Package,
  Filter,
  Grid,
  List,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Globe,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { db } from "@/lib/db";

async function getProducts(params: {
  search?: string;
  status?: string;
  clientId?: string;
  category?: string;
}) {
  return db.product.findMany({
    where: {
      ...(params.search && {
        OR: [
          { title: { contains: params.search, mode: "insensitive" } },
          { sku: { contains: params.search, mode: "insensitive" } },
          { description: { contains: params.search, mode: "insensitive" } },
        ],
      }),
      ...(params.status && params.status !== "all" && { status: params.status as any }),
      ...(params.clientId && { clientId: params.clientId }),
      ...(params.category && { categoryId: params.category }),
    },
    include: {
      images: { take: 1, where: { isPrimary: true } },
      client: { select: { name: true } },
      category: { select: { name: true } },
      _count: { select: { platformListings: true, watchlistItems: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

async function getStats() {
  const [total, active, draft, sold] = await Promise.all([
    db.product.count(),
    db.product.count({ where: { status: "ACTIVE" } }),
    db.product.count({ where: { status: "DRAFT" } }),
    db.product.count({ where: { status: "SOLD" } }),
  ]);
  return { total, active, draft, sold };
}

async function getCategories() {
  return db.category.findMany({
    where: { parentId: null },
    orderBy: { name: "asc" },
  });
}

async function getClients() {
  return db.client.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-800",
  PENDING_REVIEW: "bg-yellow-100 text-yellow-800",
  ACTIVE: "bg-green-100 text-green-800",
  SOLD: "bg-blue-100 text-blue-800",
  RESERVED: "bg-purple-100 text-purple-800",
  ARCHIVED: "bg-gray-100 text-gray-600",
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    status?: string;
    clientId?: string;
    category?: string;
    view?: string;
  }>;
}) {
  const params = await searchParams;
  const [products, stats, categories, clients] = await Promise.all([
    getProducts(params),
    getStats(),
    getCategories(),
    getClients(),
  ]);

  const viewMode = params.view || "grid";

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-sm text-gray-500">Manage your inventory</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/admin/products/import">
              <Globe className="mr-2 h-4 w-4" />
              Import
            </Link>
          </Button>
          <Button variant="gold" asChild>
            <Link href="/admin/products/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Product
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-sm text-gray-500">Total Products</p>
          </CardContent>
        </Card>
        <Card className={params.status === "ACTIVE" ? "ring-2 ring-amber-500" : ""}>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-green-600">{stats.active}</p>
            <p className="text-sm text-gray-500">Active Listings</p>
          </CardContent>
        </Card>
        <Card className={params.status === "DRAFT" ? "ring-2 ring-amber-500" : ""}>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-gray-600">{stats.draft}</p>
            <p className="text-sm text-gray-500">Drafts</p>
          </CardContent>
        </Card>
        <Card className={params.status === "SOLD" ? "ring-2 ring-amber-500" : ""}>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-blue-600">{stats.sold}</p>
            <p className="text-sm text-gray-500">Sold</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="mt-6">
        <form className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              name="search"
              defaultValue={params.search}
              placeholder="Search by title, SKU..."
              className="w-full rounded-md border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
          <select
            name="status"
            defaultValue={params.status || "all"}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            <option value="all">All Status</option>
            <option value="DRAFT">Draft</option>
            <option value="PENDING_REVIEW">Pending Review</option>
            <option value="ACTIVE">Active</option>
            <option value="SOLD">Sold</option>
            <option value="RESERVED">Reserved</option>
            <option value="ARCHIVED">Archived</option>
          </select>
          <select
            name="clientId"
            defaultValue={params.clientId || ""}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            <option value="">All Clients</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
          <select
            name="category"
            defaultValue={params.category || ""}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          <Button type="submit" variant="outline">
            <Filter className="mr-2 h-4 w-4" />
            Filter
          </Button>
          <div className="flex rounded-md border border-gray-300">
            <Link
              href={`?${new URLSearchParams({ ...params, view: "grid" }).toString()}`}
              className={`p-2 ${viewMode === "grid" ? "bg-gray-100" : ""}`}
            >
              <Grid className="h-4 w-4" />
            </Link>
            <Link
              href={`?${new URLSearchParams({ ...params, view: "list" }).toString()}`}
              className={`p-2 ${viewMode === "list" ? "bg-gray-100" : ""}`}
            >
              <List className="h-4 w-4" />
            </Link>
          </div>
        </form>
      </div>

      {/* Products */}
      <div className="mt-6">
        {products.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-4 text-gray-500">No products found</p>
              <Button variant="outline" className="mt-4" asChild>
                <Link href="/admin/products/new">Add your first product</Link>
              </Button>
            </CardContent>
          </Card>
        ) : viewMode === "grid" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            {products.map((product) => (
              <Link
                key={product.id}
                href={`/admin/products/${product.id}`}
                className="group"
              >
                <Card className="overflow-hidden transition-shadow hover:shadow-md">
                  <div className="aspect-square overflow-hidden bg-gray-100">
                    {product.images[0] ? (
                      <img
                        src={product.images[0].url}
                        alt={product.title}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Package className="h-12 w-12 text-gray-300" />
                      </div>
                    )}
                  </div>
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs text-gray-500">{product.sku}</p>
                        <h3 className="line-clamp-2 text-sm font-medium">{product.title}</h3>
                      </div>
                      <Badge className={`${statusColors[product.status]} shrink-0 text-xs`}>
                        {product.status}
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-lg font-bold text-amber-600">
                        {product.price ? formatCurrency(product.price.toNumber()) : "—"}
                      </span>
                      <span className="text-xs text-gray-500">Qty: {product.quantity}</span>
                    </div>
                    {product.client && (
                      <p className="mt-1 truncate text-xs text-gray-500">
                        {product.client.name}
                      </p>
                    )}
                    <div className="mt-2 flex gap-2 text-xs text-gray-400">
                      {product._count.platformListings > 0 && (
                        <span className="flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          {product._count.platformListings}
                        </span>
                      )}
                      {product._count.watchlistItems > 0 && (
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {product._count.watchlistItems}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left">
                    <th className="p-3 font-medium">Product</th>
                    <th className="p-3 font-medium">SKU</th>
                    <th className="p-3 font-medium">Category</th>
                    <th className="p-3 font-medium">Client</th>
                    <th className="p-3 font-medium">Price</th>
                    <th className="p-3 font-medium">Qty</th>
                    <th className="p-3 font-medium">Status</th>
                    <th className="p-3 font-medium">Listed</th>
                    <th className="p-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded bg-gray-100">
                            {product.images[0] ? (
                              <img
                                src={product.images[0].url}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center">
                                <Package className="h-5 w-5 text-gray-300" />
                              </div>
                            )}
                          </div>
                          <Link
                            href={`/admin/products/${product.id}`}
                            className="font-medium hover:text-amber-600"
                          >
                            {product.title}
                          </Link>
                        </div>
                      </td>
                      <td className="p-3 text-gray-500">{product.sku}</td>
                      <td className="p-3 text-gray-500">{product.category?.name || "—"}</td>
                      <td className="p-3 text-gray-500">{product.client?.name || "—"}</td>
                      <td className="p-3 font-medium">
                        {product.price ? formatCurrency(product.price.toNumber()) : "—"}
                      </td>
                      <td className="p-3">{product.quantity}</td>
                      <td className="p-3">
                        <Badge className={statusColors[product.status]}>{product.status}</Badge>
                      </td>
                      <td className="p-3 text-gray-500">
                        {product._count.platformListings > 0 ? (
                          <span className="flex items-center gap-1">
                            <Globe className="h-4 w-4" />
                            {product._count.platformListings}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" asChild>
                            <Link href={`/admin/products/${product.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button variant="ghost" size="icon" asChild>
                            <Link href={`/admin/products/${product.id}/edit`}>
                              <Edit className="h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </main>
  );
}
