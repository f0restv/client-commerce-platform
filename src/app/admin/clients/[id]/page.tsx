import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Mail,
  Phone,
  Globe,
  MapPin,
  Package,
  DollarSign,
  Calendar,
  RefreshCw,
  Plus,
  ExternalLink,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, formatRelativeTime } from "@/lib/utils";
import { db } from "@/lib/db";

async function getClient(id: string) {
  return db.client.findUnique({
    where: { id },
    include: {
      sources: {
        orderBy: { createdAt: "desc" },
      },
      products: {
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          images: { take: 1, where: { isPrimary: true } },
        },
      },
      payouts: {
        take: 5,
        orderBy: { createdAt: "desc" },
      },
      _count: {
        select: { products: true, sources: true, payouts: true },
      },
    },
  });
}

const statusColors: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  PENDING: "bg-yellow-100 text-yellow-800",
  PAUSED: "bg-gray-100 text-gray-800",
  TERMINATED: "bg-red-100 text-red-800",
};

const sourceTypeLabels: Record<string, string> = {
  WEBSITE: "Website",
  EBAY_STORE: "eBay Store",
  ETSY_SHOP: "Etsy Shop",
  SHOPIFY: "Shopify",
  SQUARESPACE: "Squarespace",
  WOOCOMMERCE: "WooCommerce",
  AUCTIONZIP: "AuctionZip",
  HIBID: "HiBid",
  PROXIBID: "Proxibid",
  CSV_IMPORT: "CSV Import",
  API: "API",
};

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await getClient(id);

  if (!client) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/admin/clients"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Clients
        </Link>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
            <Badge className={statusColors[client.status]}>{client.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-gray-500">Client since {formatDate(client.createdAt)}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/admin/clients/${client.id}/edit`}>Edit Client</Link>
          </Button>
          <Button variant="gold" asChild>
            <Link href={`/admin/clients/${client.id}/sources/new`}>
              <Plus className="mr-2 h-4 w-4" />
              Add Source
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-blue-100 p-2 text-blue-600">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{client.totalItems}</p>
                <p className="text-sm text-gray-500">Total Items</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-green-100 p-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{client.totalSold}</p>
                <p className="text-sm text-gray-500">Items Sold</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-amber-100 p-2 text-amber-600">
                <DollarSign className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(client.totalEarnings.toNumber())}
                </p>
                <p className="text-sm text-gray-500">Total Earnings</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-purple-100 p-2 text-purple-600">
                <Globe className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{client._count.sources}</p>
                <p className="text-sm text-gray-500">Active Sources</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        {/* Contact Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-gray-400" />
              <a href={`mailto:${client.email}`} className="text-amber-600 hover:underline">
                {client.email}
              </a>
            </div>
            {client.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-gray-400" />
                <a href={`tel:${client.phone}`} className="hover:underline">
                  {client.phone}
                </a>
              </div>
            )}
            {client.website && (
              <div className="flex items-center gap-2 text-sm">
                <Globe className="h-4 w-4 text-gray-400" />
                <a
                  href={client.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-600 hover:underline"
                >
                  {client.website}
                </a>
              </div>
            )}
            {(client.address || client.city) && (
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="mt-0.5 h-4 w-4 text-gray-400" />
                <span>
                  {[client.address, client.city, client.state, client.zip]
                    .filter(Boolean)
                    .join(", ")}
                </span>
              </div>
            )}
            <div className="border-t pt-3">
              <p className="text-sm text-gray-500">
                Commission Rate: <span className="font-medium">{client.commissionRate.toNumber()}%</span>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Inventory Sources */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Inventory Sources</CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/admin/clients/${client.id}/sources/new`}>
                <Plus className="mr-1 h-4 w-4" />
                Add
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {client.sources.length === 0 ? (
              <div className="py-8 text-center">
                <Globe className="mx-auto h-10 w-10 text-gray-300" />
                <p className="mt-2 text-sm text-gray-500">No sources configured</p>
              </div>
            ) : (
              <div className="space-y-4">
                {client.sources.map((source) => (
                  <div
                    key={source.id}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{source.name}</h4>
                        <Badge variant={source.isActive ? "default" : "secondary"}>
                          {source.isActive ? "Active" : "Paused"}
                        </Badge>
                        <Badge variant="outline">{sourceTypeLabels[source.type]}</Badge>
                      </div>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 flex items-center gap-1 text-sm text-gray-500 hover:text-amber-600"
                      >
                        {source.url}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      <div className="mt-2 flex gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <RefreshCw className="h-3 w-3" />
                          Every {source.scrapeFrequency} min
                        </span>
                        <span className="flex items-center gap-1">
                          <Package className="h-3 w-3" />
                          {source.lastItemCount} items
                        </span>
                        {source.lastScrapedAt && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Last sync: {formatRelativeTime(source.lastScrapedAt)}
                          </span>
                        )}
                      </div>
                      {source.lastError && (
                        <p className="mt-2 flex items-center gap-1 text-xs text-red-600">
                          <AlertCircle className="h-3 w-3" />
                          {source.lastError}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        Sync Now
                      </Button>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/admin/clients/${client.id}/sources/${source.id}`}>
                          Edit
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Products */}
      <Card className="mt-8">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Recent Products</CardTitle>
          <Link
            href={`/admin/products?clientId=${client.id}`}
            className="text-sm text-amber-600 hover:underline"
          >
            View all {client._count.products} products
          </Link>
        </CardHeader>
        <CardContent>
          {client.products.length === 0 ? (
            <div className="py-8 text-center">
              <Package className="mx-auto h-10 w-10 text-gray-300" />
              <p className="mt-2 text-sm text-gray-500">No products yet</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {client.products.map((product) => (
                <Link
                  key={product.id}
                  href={`/admin/products/${product.id}`}
                  className="group rounded-lg border p-3 transition-shadow hover:shadow-md"
                >
                  <div className="aspect-square overflow-hidden rounded-md bg-gray-100">
                    {product.images[0] ? (
                      <img
                        src={product.images[0].url}
                        alt={product.title}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Package className="h-8 w-8 text-gray-300" />
                      </div>
                    )}
                  </div>
                  <h4 className="mt-2 line-clamp-2 text-sm font-medium">{product.title}</h4>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-sm font-semibold text-amber-600">
                      {product.price ? formatCurrency(product.price.toNumber()) : "N/A"}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {product.status}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Payouts */}
      {client.payouts.length > 0 && (
        <Card className="mt-8">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent Payouts</CardTitle>
            <Link
              href={`/admin/payouts?clientId=${client.id}`}
              className="text-sm text-amber-600 hover:underline"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium">Amount</th>
                    <th className="pb-2 font-medium">Method</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {client.payouts.map((payout) => (
                    <tr key={payout.id} className="border-b last:border-0">
                      <td className="py-3">{formatDate(payout.createdAt)}</td>
                      <td className="py-3 font-medium text-green-600">
                        {formatCurrency(payout.amount.toNumber())}
                      </td>
                      <td className="py-3 capitalize">{payout.method}</td>
                      <td className="py-3">
                        <Badge
                          variant={payout.status === "COMPLETED" ? "default" : "secondary"}
                        >
                          {payout.status}
                        </Badge>
                      </td>
                      <td className="py-3 text-gray-500">{payout.reference || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {client.notes && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-lg">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-gray-600">{client.notes}</p>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
