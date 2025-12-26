import { redirect } from "next/navigation";
import Link from "next/link";
import {
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  ArrowDownToLine,
  TrendingUp,
  Calendar,
  FileText,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, cn } from "@/lib/utils";

const payoutStatusConfig: Record<
  string,
  { label: string; color: string; icon: React.ReactNode }
> = {
  PENDING: {
    label: "Pending",
    color: "bg-yellow-100 text-yellow-800",
    icon: <Clock className="h-4 w-4" />,
  },
  PROCESSING: {
    label: "Processing",
    color: "bg-blue-100 text-blue-800",
    icon: <ArrowDownToLine className="h-4 w-4" />,
  },
  COMPLETED: {
    label: "Completed",
    color: "bg-green-100 text-green-800",
    icon: <CheckCircle className="h-4 w-4" />,
  },
  FAILED: {
    label: "Failed",
    color: "bg-red-100 text-red-800",
    icon: <XCircle className="h-4 w-4" />,
  },
};

export default async function PayoutsPage() {
  const session = await auth();

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
            <DollarSign className="h-12 w-12 text-gray-300" />
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

  // Fetch payouts
  const payouts = await db.clientPayout.findMany({
    where: { clientId: client.id },
    orderBy: { createdAt: "desc" },
  });

  // Calculate stats
  const pendingPayouts = payouts.filter((p) => p.status === "PENDING");
  const processingPayouts = payouts.filter((p) => p.status === "PROCESSING");
  const completedPayouts = payouts.filter((p) => p.status === "COMPLETED");

  const pendingTotal = pendingPayouts.reduce(
    (sum, p) => sum + p.amount.toNumber(),
    0
  );
  const processingTotal = processingPayouts.reduce(
    (sum, p) => sum + p.amount.toNumber(),
    0
  );
  const completedTotal = completedPayouts.reduce(
    (sum, p) => sum + p.amount.toNumber(),
    0
  );
  const totalItemsSold = completedPayouts.reduce(
    (sum, p) => sum + p.itemsSold,
    0
  );

  // Calculate this month's earnings
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const thisMonthPayouts = completedPayouts.filter(
    (p) => p.processedAt && p.processedAt >= startOfMonth
  );
  const thisMonthTotal = thisMonthPayouts.reduce(
    (sum, p) => sum + p.amount.toNumber(),
    0
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payouts & Earnings</h1>
          <p className="text-gray-500">
            Track your earnings and payment history
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Commission Rate</p>
          <p className="text-lg font-semibold text-amber-600">
            {100 - client.commissionRate.toNumber()}% to you
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Pending Payout"
          value={formatCurrency(pendingTotal)}
          icon={<Clock className="h-5 w-5" />}
          description={`${pendingPayouts.length} pending`}
          highlight
        />
        <StatCard
          title="Processing"
          value={formatCurrency(processingTotal)}
          icon={<ArrowDownToLine className="h-5 w-5" />}
          description={`${processingPayouts.length} in progress`}
        />
        <StatCard
          title="Total Earnings"
          value={formatCurrency(completedTotal)}
          icon={<DollarSign className="h-5 w-5" />}
          description={`${totalItemsSold} items sold`}
        />
        <StatCard
          title="This Month"
          value={formatCurrency(thisMonthTotal)}
          icon={<TrendingUp className="h-5 w-5" />}
          description={`${thisMonthPayouts.length} payouts`}
        />
      </div>

      {/* Payout History */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">Payment History</h2>

        {payouts.length > 0 ? (
          <div className="mt-4 space-y-4">
            {payouts.map((payout) => {
              const status =
                payoutStatusConfig[payout.status] || payoutStatusConfig.PENDING;

              return (
                <Card key={payout.id}>
                  <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                      <div className="rounded-full bg-amber-100 p-3 text-amber-600">
                        <DollarSign className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">
                          {formatCurrency(payout.amount.toNumber())}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {payout.createdAt.toLocaleDateString()}
                          </span>
                          {payout.periodStart && payout.periodEnd && (
                            <span>
                              Period: {payout.periodStart.toLocaleDateString()} -{" "}
                              {payout.periodEnd.toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-4">
                      <div className="text-right">
                        <p className="text-sm text-gray-500">
                          {payout.itemsSold} items sold
                        </p>
                        {payout.method && (
                          <p className="text-xs text-gray-400 capitalize">
                            via {payout.method}
                          </p>
                        )}
                      </div>
                      <Badge className={cn("gap-1", status.color)}>
                        {status.icon}
                        {status.label}
                      </Badge>
                    </div>
                  </CardContent>

                  {payout.notes && (
                    <div className="border-t px-4 py-3 text-sm text-gray-600">
                      {payout.notes}
                    </div>
                  )}

                  {payout.reference && payout.status === "COMPLETED" && (
                    <div className="border-t px-4 py-3 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        Reference: {payout.reference}
                      </span>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="mt-4">
            <CardContent className="flex flex-col items-center py-12">
              <DollarSign className="h-12 w-12 text-gray-300" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">
                No payouts yet
              </h3>
              <p className="mt-1 text-center text-sm text-gray-500">
                When your items sell, your earnings will appear here.
              </p>
              <Button variant="gold" size="sm" asChild className="mt-4">
                <Link href="/client-portal/inventory">View Your Inventory</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Payment Info */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-base">Payment Information</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-600">
          <p>
            Payouts are processed on a bi-weekly basis for all completed sales.
            Your commission rate of {100 - client.commissionRate.toNumber()}% is
            applied to each sale after fees.
          </p>
          <p className="mt-2">
            Payment methods available: Check, ACH Bank Transfer, PayPal.
          </p>
          <p className="mt-2 text-gray-500">
            Questions about payouts? Contact us at{" "}
            <a href="mailto:support@coinvault.com" className="text-amber-600">
              support@coinvault.com
            </a>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

function StatCard({
  title,
  value,
  icon,
  description,
  highlight,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  description?: string;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-amber-200 bg-amber-50" : ""}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">{title}</span>
          <div
            className={cn(
              "rounded-full p-2",
              highlight
                ? "bg-amber-200 text-amber-700"
                : "bg-amber-100 text-amber-600"
            )}
          >
            {icon}
          </div>
        </div>
        <p
          className={cn(
            "mt-2 text-2xl font-bold",
            highlight ? "text-amber-700" : ""
          )}
        >
          {value}
        </p>
        {description && (
          <p className="mt-1 text-xs text-gray-500">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}
