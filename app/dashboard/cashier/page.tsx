"use client";

import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  BarChart3,
  Clock3,
  CreditCard,
  FileText,
  Loader2,
  Plus,
  ReceiptText,
  RefreshCw,
  ShoppingCart,
  WalletCards,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCashierDashboardQuery } from "@/hooks/dashboard/use-cashier-dashboard";
import type {
  CashierDashboardSummary,
  CashierRecentOrder,
} from "@/types/dashboard/cashier-dashboard";

function money(value: unknown) {
  return Number(value ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function label(value?: string | null) {
  return String(value ?? "unknown")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function time(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function statusVariant(status?: string | null) {
  const normalized = String(status ?? "").toLowerCase();
  if (["paid", "completed", "served", "ready"].includes(normalized)) {
    return "default" as const;
  }
  if (["cancelled", "void", "failed"].includes(normalized)) {
    return "destructive" as const;
  }
  return "secondary" as const;
}

const summaryCards: Array<{
  key: keyof CashierDashboardSummary;
  title: string;
  description: string;
  money?: boolean;
  icon: typeof ShoppingCart;
}> = [
  {
    key: "orders",
    title: "Today’s orders",
    description: "Valid orders created",
    icon: ShoppingCart,
  },
  {
    key: "gross_order_value",
    title: "Gross order value",
    description: "Cash and credit orders",
    money: true,
    icon: ReceiptText,
  },
  {
    key: "payments_collected",
    title: "Payments collected",
    description: "Paid transactions received",
    money: true,
    icon: Banknote,
  },
  {
    key: "pending_amount",
    title: "Pending collection",
    description: "Issued and partial bills",
    money: true,
    icon: Clock3,
  },
];

function DashboardLoading() {
  return (
    <div className="flex min-h-80 items-center justify-center rounded-2xl border bg-card">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      Loading cashier dashboard...
    </div>
  );
}

function RecentOrderRow({ order }: { order: CashierRecentOrder }) {
  return (
    <TableRow>
      <TableCell>
        <p className="font-semibold">{order.order_number}</p>
        <p className="text-xs text-muted-foreground">{time(order.ordered_at)}</p>
      </TableCell>
      <TableCell>
        <p>{label(order.order_type)}</p>
        <p className="text-xs text-muted-foreground">
          {order.table ? `Table ${order.table}` : "No table"}
        </p>
      </TableCell>
      <TableCell>{order.waiter || "—"}</TableCell>
      <TableCell>
        <Badge variant={statusVariant(order.status)}>
          {label(order.status)}
        </Badge>
      </TableCell>
      <TableCell>
        <p>{label(order.payment_type)}</p>
        <p className="text-xs text-muted-foreground">
          {label(order.payment_status)}
        </p>
      </TableCell>
      <TableCell className="text-right font-semibold">
        {money(order.total)}
      </TableCell>
      <TableCell className="text-right">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/dashboard/order-management/pos/orders/${order.id}`}>
            View
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </TableCell>
    </TableRow>
  );
}

export default function CashierDashboardPage() {
  const dashboard = useCashierDashboardQuery();

  if (dashboard.isLoading) return <DashboardLoading />;

  if (dashboard.isError || !dashboard.data) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Cashier dashboard unavailable</AlertTitle>
        <AlertDescription className="mt-2">
          <p>
            {dashboard.error instanceof Error
              ? dashboard.error.message
              : "The dashboard data could not be loaded."}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => dashboard.refetch()}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const data = dashboard.data;
  const shift = data.current_shift;
  const shiftSummary = shift?.summary;
  const paymentTotal = Math.max(
    ...data.payment_methods.map((method) => Number(method.amount ?? 0)),
    1,
  );
  const statuses = Object.entries(data.order_statuses);

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-5 rounded-2xl border bg-card p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline">Cashier workspace</Badge>
            <Badge variant={shift ? "default" : "destructive"}>
              {shift ? `Shift #${shift.id} open` : "No open shift"}
            </Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Cashier Dashboard
          </h1>
          <p className="mt-1 text-muted-foreground">
            {data.business_date} · Welcome, {data.user.name}. Monitor orders,
            collections and your active cash shift.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" asChild>
            <Link href="/dashboard/modules/cashier/payments">
              <WalletCards className="mr-2 h-4 w-4" />
              Receive payment
            </Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/order-management/pos/orders/create">
              <Plus className="mr-2 h-4 w-4" />
              New POS order
            </Link>
          </Button>
        </div>
      </section>

      {!shift && (
        <Alert>
          <Clock3 className="h-4 w-4" />
          <AlertTitle>Open your cash shift before collecting cash</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Opening a shift establishes the opening balance and ensures
              payments are included in X and Z reports.
            </span>
            <Button size="sm" asChild>
              <Link href="/dashboard/modules/cashier/shift">Open shift</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          const value = data.summary[card.key];

          return (
            <Card key={card.key} className="rounded-2xl">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground">{card.title}</p>
                    <p className="mt-2 text-2xl font-bold">
                      {card.money ? `${money(value)} ETB` : Number(value)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {card.description}
                    </p>
                  </div>
                  <span className="rounded-xl bg-primary/10 p-2.5 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="rounded-2xl">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Current cash shift</CardTitle>
              <CardDescription>
                Live cash accountability for the signed-in cashier.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/modules/cashier/shift">
                Manage shift
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {shift ? (
              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border bg-muted/20 p-4">
                    <p className="text-xs text-muted-foreground">Opened</p>
                    <p className="mt-1 font-semibold">{time(shift.opened_at)}</p>
                  </div>
                  <div className="rounded-xl border bg-muted/20 p-4">
                    <p className="text-xs text-muted-foreground">
                      Opening cash
                    </p>
                    <p className="mt-1 font-semibold">
                      {money(shift.opening_cash)} ETB
                    </p>
                  </div>
                  <div className="rounded-xl border bg-muted/20 p-4">
                    <p className="text-xs text-muted-foreground">
                      Cash payments
                    </p>
                    <p className="mt-1 font-semibold">
                      {money(shiftSummary?.cash_payments)} ETB
                    </p>
                  </div>
                  <div className="rounded-xl border bg-primary/5 p-4">
                    <p className="text-xs text-muted-foreground">
                      Expected cash
                    </p>
                    <p className="mt-1 font-semibold text-primary">
                      {money(
                        shiftSummary?.expected_cash ?? shift.expected_cash,
                      )}{" "}
                      ETB
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button variant="outline" asChild>
                    <Link href="/dashboard/modules/cashier/reports/x-report">
                      <FileText className="mr-2 h-4 w-4" />
                      View X report
                    </Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/dashboard/modules/cashier/shift">
                      Close or reconcile shift
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed p-8 text-center">
                <Clock3 className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-3 font-semibold">No active cash shift</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Open a shift to begin recording cashier collections.
                </p>
                <Button className="mt-4" asChild>
                  <Link href="/dashboard/modules/cashier/shift">
                    Open cash shift
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Payment methods</CardTitle>
            <CardDescription>
              Today’s paid transactions received by you.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.payment_methods.length ? (
              data.payment_methods.map((method) => {
                const width = Math.max(
                  6,
                  (Number(method.amount) / paymentTotal) * 100,
                );

                return (
                  <div key={method.method} className="space-y-2">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex items-center gap-2 font-medium">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        {label(method.method)}
                      </span>
                      <span className="text-right">
                        <strong>{money(method.amount)} ETB</strong>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {method.transactions} txns
                        </span>
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                No paid transactions recorded today.
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Order status</CardTitle>
            <CardDescription>Today’s active order pipeline.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {statuses.length ? (
              statuses.map(([status, total]) => (
                <div
                  key={status}
                  className="flex items-center justify-between rounded-xl border px-4 py-3"
                >
                  <Badge variant={statusVariant(status)}>{label(status)}</Badge>
                  <span className="text-lg font-bold">{total}</span>
                </div>
              ))
            ) : (
              <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                No orders created today.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Collection queue</CardTitle>
              <CardDescription>
                Bills waiting for full payment across the cashier workspace.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/modules/cashier/payments">
                Open payments
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border p-4">
                <p className="text-xs text-muted-foreground">Pending bills</p>
                <p className="mt-1 text-2xl font-bold">
                  {data.summary.pending_bills}
                </p>
              </div>
              <div className="rounded-xl border p-4 sm:col-span-2">
                <p className="text-xs text-muted-foreground">
                  Outstanding amount
                </p>
                <p className="mt-1 text-2xl font-bold">
                  {money(data.summary.pending_amount)} ETB
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-2xl">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Recent POS orders</CardTitle>
            <CardDescription>
              Latest orders created by the signed-in cashier.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/order-management/pos/orders">
              View all orders
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Waiter</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="text-right">Total (ETB)</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recent_orders.length ? (
                  data.recent_orders.map((order) => (
                    <RecentOrderRow key={order.id} order={order} />
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="h-28 text-center text-muted-foreground"
                    >
                      No recent POS orders.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            title: "POS orders",
            text: "Create and manage cashier orders.",
            href: "/dashboard/order-management/pos/orders",
            icon: ShoppingCart,
          },
          {
            title: "Payments",
            text: "Receive and review payments.",
            href: "/dashboard/modules/cashier/payments",
            icon: WalletCards,
          },
          {
            title: "Cash sales",
            text: "Review filtered sales totals.",
            href: "/dashboard/modules/reports/cash-sales",
            icon: BarChart3,
          },
          {
            title: "Shift reports",
            text: "Open X and completed Z reports.",
            href: "/dashboard/modules/cashier/reports/x-report",
            icon: FileText,
          },
        ].map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.title}
              href={action.href}
              className="group rounded-2xl border bg-card p-5 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm"
            >
              <Icon className="h-5 w-5 text-primary" />
              <p className="mt-4 font-semibold">{action.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {action.text}
              </p>
              <span className="mt-4 inline-flex items-center text-sm font-medium text-primary">
                Open
                <ArrowRight className="ml-1 h-4 w-4 transition group-hover:translate-x-1" />
              </span>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
