import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Package,
  Edit,
  Trash2,
  ExternalLink,
  Calendar,
  Tag,
  Award,
  TrendingUp,
  DollarSign,
  BarChart3,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, cn } from "@/lib/utils";

const statusStyles: Record<string, { bg: string; text: string }> = {
  DRAFT: { bg: "bg-gray-100", text: "text-gray-700" },
  ACTIVE: { bg: "bg-green-100", text: "text-green-700" },
  SOLD: { bg: "bg-blue-100", text: "text-blue-700" },
  ARCHIVED: { bg: "bg-gray-100", text: "text-gray-500" },
};

export default async function InventoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user) {
    redirect(`/auth/login?callbackUrl=/inventory/${id}`);
  }

  // Get user with client relation
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: { client: true },
  });

  const clientId = user?.client?.id;

  // Fetch product with all related data
  const product = await db.product.findUnique({
    where: { id },
    include: {
      images: { orderBy: { order: "asc" } },
      marketAnalysis: { orderBy: { createdAt: "desc" }, take: 1 },
      category: true,
    },
  });

  if (!product) {
    notFound();
  }

  // Verify ownership
  if (clientId && product.clientId !== clientId) {
    notFound();
  }

  const analysis = product.marketAnalysis[0];
  const statusStyle = statusStyles[product.status] || statusStyles.DRAFT;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-white">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <Link
            href="/inventory"
            className="flex items-center gap-2 text-gray-600"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm">Back</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/inventory/${id}/edit`}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        {/* Image Gallery */}
        <div className="mb-6">
          {product.images.length > 0 ? (
            <div className="grid gap-2">
              {/* Main Image */}
              <div className="relative aspect-square overflow-hidden rounded-lg bg-gray-100">
                <Image
                  src={product.images[0].url}
                  alt={product.title}
                  fill
                  className="object-contain"
                  priority
                />
              </div>
              {/* Thumbnails */}
              {product.images.length > 1 && (
                <div className="grid grid-cols-4 gap-2">
                  {product.images.slice(1, 5).map((img) => (
                    <div
                      key={img.id}
                      className="relative aspect-square overflow-hidden rounded-lg bg-gray-100"
                    >
                      <Image
                        src={img.url}
                        alt={product.title}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex aspect-square items-center justify-center rounded-lg bg-gray-100">
              <Package className="h-24 w-24 text-gray-300" />
            </div>
          )}
        </div>

        {/* Title and Status */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-2xl font-bold text-gray-900">{product.title}</h1>
            <Badge className={cn(statusStyle.bg, statusStyle.text)}>
              {product.status.toLowerCase()}
            </Badge>
          </div>
          {product.sku && (
            <p className="mt-1 text-sm text-gray-500">SKU: {product.sku}</p>
          )}
        </div>

        {/* Price Card */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Your Price</p>
                <p className="text-3xl font-bold text-gray-900">
                  {product.price
                    ? formatCurrency(product.price.toNumber())
                    : "Not set"}
                </p>
              </div>
              {product.costBasis && (
                <div className="text-right">
                  <p className="text-sm text-gray-500">Cost Basis</p>
                  <p className="text-lg font-medium text-gray-700">
                    {formatCurrency(product.costBasis.toNumber())}
                  </p>
                  {product.price && (
                    <p
                      className={cn(
                        "text-sm font-medium",
                        product.price.toNumber() > product.costBasis.toNumber()
                          ? "text-green-600"
                          : "text-red-600"
                      )}
                    >
                      {product.price.toNumber() > product.costBasis.toNumber()
                        ? "+"
                        : ""}
                      {formatCurrency(
                        product.price.toNumber() - product.costBasis.toNumber()
                      )}{" "}
                      profit
                    </p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Market Analysis */}
        {analysis && (
          <Card className="mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4" />
                Market Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-sm text-gray-500">Low</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {analysis.lowPrice
                      ? formatCurrency(Number(analysis.lowPrice))
                      : "-"}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-500">Average</p>
                  <p className="text-lg font-semibold text-green-600">
                    {analysis.avgPrice
                      ? formatCurrency(Number(analysis.avgPrice))
                      : "-"}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-500">High</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {analysis.highPrice
                      ? formatCurrency(Number(analysis.highPrice))
                      : "-"}
                  </p>
                </div>
              </div>
              {analysis.salesCount && (
                <p className="mt-3 text-center text-sm text-gray-500">
                  Based on {analysis.salesCount} recent sales
                  {analysis.avgDaysToSell &&
                    ` (avg ${analysis.avgDaysToSell} days to sell)`}
                </p>
              )}
              {analysis.aiSummary && (
                <p className="mt-3 text-sm text-gray-600 border-t pt-3">
                  {analysis.aiSummary}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Details */}
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              {product.category && (
                <>
                  <dt className="text-sm text-gray-500">Category</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {product.category.name}
                  </dd>
                </>
              )}
              {product.year && (
                <>
                  <dt className="text-sm text-gray-500">Year</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {product.year}
                  </dd>
                </>
              )}
              {product.mint && (
                <>
                  <dt className="text-sm text-gray-500">Mint</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {product.mint}
                  </dd>
                </>
              )}
              {product.grade && (
                <>
                  <dt className="text-sm text-gray-500">Grade</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {product.grade}
                  </dd>
                </>
              )}
              {product.certification && (
                <>
                  <dt className="text-sm text-gray-500">Certification</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {product.certification}
                    {product.certNumber && ` #${product.certNumber}`}
                  </dd>
                </>
              )}
              {product.population && (
                <>
                  <dt className="text-sm text-gray-500">Population</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {product.population.toLocaleString()}
                  </dd>
                </>
              )}
              {product.condition && (
                <>
                  <dt className="text-sm text-gray-500">Condition</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {product.condition}
                  </dd>
                </>
              )}
              {product.quantity > 1 && (
                <>
                  <dt className="text-sm text-gray-500">Quantity</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {product.quantity}
                  </dd>
                </>
              )}
            </dl>
          </CardContent>
        </Card>

        {/* Description */}
        {product.description && (
          <Card className="mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Description</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {product.description}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="space-y-3">
          {product.status === "DRAFT" && (
            <Button className="w-full bg-green-600 hover:bg-green-700">
              <ExternalLink className="mr-2 h-4 w-4" />
              List for Sale
            </Button>
          )}
          {product.status === "ACTIVE" && (
            <Button variant="outline" className="w-full">
              <TrendingUp className="mr-2 h-4 w-4" />
              View Listing
            </Button>
          )}
          <Button variant="outline" className="w-full" asChild>
            <Link href={`/inventory/${id}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Item
            </Link>
          </Button>
          <Button
            variant="outline"
            className="w-full text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>

        {/* Metadata */}
        <div className="mt-8 border-t pt-4">
          <dl className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-gray-400">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <dt>Added:</dt>
              <dd>{product.createdAt.toLocaleDateString()}</dd>
            </div>
            <div className="flex items-center gap-1">
              <Tag className="h-3 w-3" />
              <dt>ID:</dt>
              <dd className="font-mono">{product.id}</dd>
            </div>
            {product.views > 0 && (
              <div>
                <dt className="sr-only">Views</dt>
                <dd>{product.views} views</dd>
              </div>
            )}
          </dl>
        </div>
      </main>
    </div>
  );
}
