import Link from "next/link";
import { Plus, Search, Building2, Globe, Mail, Phone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { db } from "@/lib/db";

async function getClients(search?: string, status?: string) {
  return db.client.findMany({
    where: {
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      }),
      ...(status && status !== "all" && { status: status as any }),
    },
    include: {
      _count: { select: { products: true, sources: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

const statusColors: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  PENDING: "bg-yellow-100 text-yellow-800",
  PAUSED: "bg-gray-100 text-gray-800",
  TERMINATED: "bg-red-100 text-red-800",
};

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string }>;
}) {
  const params = await searchParams;
  const clients = await getClients(params.search, params.status);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-sm text-gray-500">{clients.length} total clients</p>
        </div>
        <Button variant="gold" asChild>
          <Link href="/admin/clients/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Client
          </Link>
        </Button>
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
              placeholder="Search clients..."
              className="w-full rounded-md border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
          <select
            name="status"
            defaultValue={params.status || "all"}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            <option value="all">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="PENDING">Pending</option>
            <option value="PAUSED">Paused</option>
            <option value="TERMINATED">Terminated</option>
          </select>
          <Button type="submit" variant="outline">
            Filter
          </Button>
        </form>
      </div>

      {/* Client List */}
      <div className="mt-6 grid gap-4">
        {clients.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Building2 className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-4 text-gray-500">No clients found</p>
              <Button variant="outline" className="mt-4" asChild>
                <Link href="/admin/clients/new">Add your first client</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          clients.map((client) => (
            <Link key={client.id} href={`/admin/clients/${client.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold">{client.name}</h3>
                        <Badge className={statusColors[client.status]}>
                          {client.status}
                        </Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Mail className="h-4 w-4" />
                          {client.email}
                        </span>
                        {client.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-4 w-4" />
                            {client.phone}
                          </span>
                        )}
                        {client.website && (
                          <span className="flex items-center gap-1">
                            <Globe className="h-4 w-4" />
                            {client.website}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-6 text-center">
                      <div>
                        <p className="text-2xl font-bold">{client._count.products}</p>
                        <p className="text-xs text-gray-500">Products</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{client._count.sources}</p>
                        <p className="text-xs text-gray-500">Sources</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-green-600">
                          {formatCurrency(client.totalEarnings.toNumber())}
                        </p>
                        <p className="text-xs text-gray-500">Earnings</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t pt-4 text-sm text-gray-500">
                    <span>Commission: {client.commissionRate.toNumber()}%</span>
                    <span>Joined {formatDate(client.createdAt)}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </main>
  );
}
