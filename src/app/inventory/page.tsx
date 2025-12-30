import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Package,
  Camera,
  Search,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  ACTIVE: "bg-green-100 text-green-700",
  SOLD: "bg-blue-100 text-blue-700",
  ARCHIVED: "bg-gray-100 text-gray-500",
};

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;

  if (!session?.user) {
    redirect("/auth/login?callbackUrl=/inventory");
  }

  // Get user with client relation
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: { client: true },
  });

  const clientId = user?.client?.id;

  // Build query - show products for user's client, or all if no client
  const baseWhere = clientId ? { clientId } : { clientId: null };

  const where = {
    ...baseWhere,
    ...(params.status && params.status !== "all"
      ? { status: params.status as any }
      : {}),
    ...(params.q
      ? {
          OR: [
            { title: { contains: params.q, mode: "insensitive" as const } },
            { sku: { contains: params.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  // Fetch products
  const [products, counts] = await Promise.all([
    db.product.findMany({
      where,
      include: {
        images: { take: 1, orderBy: { order: "asc" } },
        marketAnalysis: { take: 1, orderBy: { createdAt: "desc" } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.product.groupBy({
      by: ["status"],
      where: baseWhere,
      _count: true,
    }),
  ]);

  const totalCount = counts.reduce((sum, c) => sum + c._count, 0);


  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-white">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-900">
              <span className="text-sm font-bold text-white">IQ</span>
            </div>
            <span className="font-semibold">My Collection</span>
          </Link>
          <Button size="sm" className="bg-gray-900 hover:bg-gray-800" asChild>
            <Link href="/scan">
              <Camera className="mr-2 h-4 w-4" />
              Scan
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        {/* Stats */}
        <div className="mb-6 grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{totalCount}</p>
              <p className="text-sm text-gray-500">Items</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">
                {counts.find((c) => c.status === "ACTIVE")?._count || 0}
              </p>
              <p className="text-sm text-gray-500">Listed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">
                {counts.find((c) => c.status === "SOLD")?._count || 0}
              </p>
              <p className="text-sm text-gray-500">Sold</p>
            </CardContent>
          </Card>
        </div>

        {/* Search & Filters */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row">
          <form className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              name="q"
              placeholder="Search your collection..."
              defaultValue={params.q}
              className="pl-10"
            />
          </form>
          <div className="flex gap-2 overflow-x-auto">
            <Link
              href="/inventory"
              className={cn(
                "whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors",
                !params.status || params.status === "all"
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              All
            </Link>
            <Link
              href="/inventory?status=DRAFT"
              className={cn(
                "whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors",
                params.status === "DRAFT"
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              Drafts
            </Link>
            <Link
              href="/inventory?status=ACTIVE"
              className={cn(
                "whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors",
                params.status === "ACTIVE"
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              Listed
            </Link>
            <Link
              href="/inventory?status=SOLD"
              className={cn(
                "whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors",
                params.status === "SOLD"
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              Sold
            </Link>
          </div>
        </div>

        {/* Products */}
        {products.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => {
              const image = product.images[0];
              const analysis = product.marketAnalysis[0];

              return (
                <Link key={product.id} href={`/inventory/${product.id}`}>
                  <Card className="overflow-hidden transition-shadow hover:shadow-md">
                    {/* Image */}
                    <div className="relative aspect-square bg-gray-100">
                      {image ? (
                        <Image
                          src={image.url}
                          alt={product.title}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Package className="h-12 w-12 text-gray-300" />
                        </div>
                      )}
                      <Badge
                        className={cn(
                          "absolute right-2 top-2",
                          statusStyles[product.status] || statusStyles.DRAFT
                        )}
                      >
                        {product.status.toLowerCase()}
                      </Badge>
                    </div>

                    {/* Details */}
                    <CardContent className="p-3">
                      <h3 className="font-medium text-gray-900 line-clamp-1">
                        {product.title}
                      </h3>

                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-lg font-bold text-gray-900">
                          {product.price
                            ? formatCurrency(product.price.toNumber())
                            : "No price"}
                        </span>
                        {analysis && (
                          <span className="text-xs text-gray-500">
                            Est: {formatCurrency(Number(analysis.avgPrice || 0))}
                          </span>
                        )}
                      </div>

                      {product.grade && (
                        <p className="mt-1 text-xs text-gray-500">
                          Grade: {product.grade}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center py-16">
              <Package className="h-16 w-16 text-gray-200" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">
                {params.q ? "No items found" : "Your collection is empty"}
              </h3>
              <p className="mt-1 text-center text-sm text-gray-500">
                {params.q
                  ? "Try a different search term"
                  : "Scan your first item to get started"}
              </p>
              {!params.q && (
                <Button
                  className="mt-6 bg-gray-900 hover:bg-gray-800"
                  asChild
                >
                  <Link href="/scan">
                    <Camera className="mr-2 h-4 w-4" />
                    Scan Your First Item
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
