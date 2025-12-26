import Link from "next/link";
import {
  Search,
  FileText,
  Clock,
  Eye,
  CheckCircle,
  XCircle,
  Package,
  DollarSign,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, formatRelativeTime } from "@/lib/utils";
import { db } from "@/lib/db";

async function getSubmissions(status?: string, search?: string) {
  return db.submission.findMany({
    where: {
      ...(status && status !== "all" && { status: status as any }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      }),
    },
    include: {
      user: { select: { name: true, email: true, client: { select: { name: true } } } },
      images: { take: 1 },
      _count: { select: { products: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

async function getStats() {
  const [pending, underReview, approved, total] = await Promise.all([
    db.submission.count({ where: { status: "PENDING" } }),
    db.submission.count({ where: { status: "UNDER_REVIEW" } }),
    db.submission.count({ where: { status: "APPROVED" } }),
    db.submission.count(),
  ]);
  return { pending, underReview, approved, total };
}

const statusConfig: Record<string, { color: string; icon: React.ReactNode }> = {
  PENDING: { color: "bg-yellow-100 text-yellow-800", icon: <Clock className="h-3 w-3" /> },
  RECEIVED: { color: "bg-blue-100 text-blue-800", icon: <Package className="h-3 w-3" /> },
  UNDER_REVIEW: { color: "bg-purple-100 text-purple-800", icon: <Eye className="h-3 w-3" /> },
  APPROVED: { color: "bg-green-100 text-green-800", icon: <CheckCircle className="h-3 w-3" /> },
  LISTED: { color: "bg-amber-100 text-amber-800", icon: <DollarSign className="h-3 w-3" /> },
  SOLD: { color: "bg-emerald-100 text-emerald-800", icon: <CheckCircle className="h-3 w-3" /> },
  RETURNED: { color: "bg-gray-100 text-gray-800", icon: <Package className="h-3 w-3" /> },
  REJECTED: { color: "bg-red-100 text-red-800", icon: <XCircle className="h-3 w-3" /> },
};

export default async function SubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string }>;
}) {
  const params = await searchParams;
  const [submissions, stats] = await Promise.all([
    getSubmissions(params.status, params.search),
    getStats(),
  ]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Submissions</h1>
          <p className="text-sm text-gray-500">Review and manage client submissions</p>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        <Card className={params.status === "PENDING" ? "ring-2 ring-amber-500" : ""}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
                <p className="text-sm text-gray-500">Pending</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-200" />
            </div>
          </CardContent>
        </Card>
        <Card className={params.status === "UNDER_REVIEW" ? "ring-2 ring-amber-500" : ""}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-purple-600">{stats.underReview}</p>
                <p className="text-sm text-gray-500">Under Review</p>
              </div>
              <Eye className="h-8 w-8 text-purple-200" />
            </div>
          </CardContent>
        </Card>
        <Card className={params.status === "APPROVED" ? "ring-2 ring-amber-500" : ""}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
                <p className="text-sm text-gray-500">Approved</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-200" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-gray-500">Total</p>
              </div>
              <FileText className="h-8 w-8 text-gray-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-wrap gap-4">
        <form className="flex flex-1 gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              name="search"
              defaultValue={params.search}
              placeholder="Search submissions..."
              className="w-full rounded-md border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
          <select
            name="status"
            defaultValue={params.status || "all"}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            <option value="all">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="RECEIVED">Received</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="APPROVED">Approved</option>
            <option value="LISTED">Listed</option>
            <option value="SOLD">Sold</option>
            <option value="RETURNED">Returned</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <Button type="submit" variant="outline">
            Filter
          </Button>
        </form>
      </div>

      {/* Submissions List */}
      <div className="mt-6 space-y-4">
        {submissions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-4 text-gray-500">No submissions found</p>
            </CardContent>
          </Card>
        ) : (
          submissions.map((submission) => (
            <Card key={submission.id} className="transition-shadow hover:shadow-md">
              <CardContent className="p-0">
                <div className="flex">
                  {/* Image */}
                  <div className="w-32 flex-shrink-0 sm:w-40">
                    {submission.images[0] ? (
                      <img
                        src={submission.images[0].url}
                        alt={submission.title}
                        className="h-full w-full rounded-l-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-full min-h-[120px] items-center justify-center rounded-l-lg bg-gray-100">
                        <Package className="h-8 w-8 text-gray-300" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex flex-1 flex-col justify-between p-4">
                    <div>
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold">{submission.title}</h3>
                          <p className="text-sm text-gray-500">
                            by {submission.user.name || submission.user.email}
                            {submission.user.client && (
                              <span className="ml-1">({submission.user.client.name})</span>
                            )}
                          </p>
                        </div>
                        <Badge className={`${statusConfig[submission.status]?.color} flex items-center gap-1`}>
                          {statusConfig[submission.status]?.icon}
                          {submission.status.replace("_", " ")}
                        </Badge>
                      </div>
                      {submission.description && (
                        <p className="mt-2 line-clamp-2 text-sm text-gray-600">
                          {submission.description}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex gap-4 text-sm text-gray-500">
                        {submission.estimatedValue && (
                          <span>
                            Est. Value:{" "}
                            <span className="font-medium text-gray-900">
                              {formatCurrency(submission.estimatedValue.toNumber())}
                            </span>
                          </span>
                        )}
                        {submission.suggestedPrice && (
                          <span>
                            Suggested:{" "}
                            <span className="font-medium text-amber-600">
                              {formatCurrency(submission.suggestedPrice.toNumber())}
                            </span>
                          </span>
                        )}
                        <span>{formatRelativeTime(submission.createdAt)}</span>
                      </div>
                      <div className="flex gap-2">
                        {submission.status === "PENDING" && (
                          <Button size="sm" variant="outline">
                            Start Review
                          </Button>
                        )}
                        <Button size="sm" variant="gold" asChild>
                          <Link href={`/admin/submissions/${submission.id}`}>
                            {submission.status === "PENDING" || submission.status === "UNDER_REVIEW"
                              ? "Review"
                              : "View"}
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </main>
  );
}
