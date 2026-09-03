"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Banknote,
  BarChart3,
  Boxes,
  ChefHat,
  CircleDollarSign,
  ClipboardList,
  PackageSearch,
  RefreshCcw,
  ShoppingCart,
  Table2,
  TrendingUp,
  Users,
  Wine,
} from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import api, { unwrap } from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type ManagerData = {
  kpis: {
    today_sales: number;
    orders_today: number;
    occupied_tables: number;
    total_tables: number;
    average_order_value: number;
    net_sales: number;
    consumption_cost: number;
    expenses: number;
    net_profit: number;
    profit_margin: number;
  };
  sales_trend: Array<{ hour: string; sales: number; orders: number }>;
  live_order_status: {
    new: number;
    preparing: number;
    ready: number;
    served: number;
    cancelled: number;
    active: number;
  };
  operations: {
    tables: { occupied: number; available: number; reserved: number };
    kitchen: { queued: number; ready: number; avg_minutes: number };
    bar: { queued: number; ready: number; avg_minutes: number };
    cashiers: { open: number; closed: number; sales: number };
  };
  table_status: Array<{ id: number; table_number: string; status: string }>;
  requires_attention: Array<{ label: string; count: number; is_money?: boolean }>;
  kitchen_bar_performance: Array<{
    area: string;
    active: number;
    avg_prep: number;
    delayed: number;
    completed: number;
    performance: number;
  }>;
  top_selling_items: Array<{
    id: number;
    name: string;
    category: string;
    quantity: number;
    revenue: number;
    consumption: number;
    margin: number;
  }>;
  inventory: {
    low_stock: number;
    out_of_stock: number;
    stock_value: number;
    today_consumption: number;
  };
  procurement: {
    pending_pr: number;
    approved_pr: number;
    open_po: number;
    awaiting_delivery: number;
    pending_grn: number;
  };
  cashier_sessions: Array<{
    id: number;
    cashier: string;
    session: string;
    sales: number;
    expected_cash: number;
    variance: number;
    status: string;
  }>;
  staff_performance: Array<{ id: number; name: string; orders: number; sales: number }>;
  shift_status: Record<string, { active: number; total: number }>;
  financial_summary: {
    gross_sales: number;
    refunds: number;
    net_sales: number;
    consumption_cost: number;
    gross_profit: number;
    expenses: number;
    net_profit: number;
    profit_margin: number;
  };
};

type Response = { success: boolean; data?: ManagerData; message?: string };

function extractNestedData(value: unknown): any {
  let current: any = value;

  for (let depth = 0; depth < 6 && current && typeof current === "object"; depth += 1) {
    if (current.kpis || current.summary) {
      return current;
    }

    current = current.data;
  }

  return undefined;
}

function normalizeManagerData(value: unknown): ManagerData | undefined {
  const payload = extractNestedData(value);

  if (!payload) {
    return undefined;
  }

  const summary = payload.kpis ?? payload.summary ?? {};
  const todaySales = Number(summary.today_sales ?? 0);
  const ordersToday = Number(summary.orders_today ?? summary.today_orders ?? 0);

  return {
    kpis: {
      today_sales: todaySales,
      orders_today: ordersToday,
      occupied_tables: Number(summary.occupied_tables ?? 0),
      total_tables: Number(summary.total_tables ?? 0),
      average_order_value: ordersToday > 0 ? todaySales / ordersToday : 0,
      net_sales: Number(summary.net_sales ?? todaySales),
      consumption_cost: Number(summary.consumption_cost ?? 0),
      expenses: Number(summary.expenses ?? 0),
      net_profit: Number(summary.net_profit ?? 0),
      profit_margin: Number(summary.profit_margin ?? 0),
    },
    sales_trend: Array.isArray(payload.sales_trend) ? payload.sales_trend : [],
    live_order_status: {
      new: Number(payload.live_order_status?.new ?? 0),
      preparing: Number(payload.live_order_status?.preparing ?? 0),
      ready: Number(payload.live_order_status?.ready ?? 0),
      served: Number(payload.live_order_status?.served ?? 0),
      cancelled: Number(payload.live_order_status?.cancelled ?? 0),
      active: Number(payload.live_order_status?.active ?? 0),
    },
    operations: {
      tables: {
        occupied: Number(payload.operations?.tables?.occupied ?? 0),
        available: Number(payload.operations?.tables?.available ?? 0),
        reserved: Number(payload.operations?.tables?.reserved ?? 0),
      },
      kitchen: {
        queued: Number(payload.operations?.kitchen?.queued ?? 0),
        ready: Number(payload.operations?.kitchen?.ready ?? 0),
        avg_minutes: Number(payload.operations?.kitchen?.avg_minutes ?? 0),
      },
      bar: {
        queued: Number(payload.operations?.bar?.queued ?? 0),
        ready: Number(payload.operations?.bar?.ready ?? 0),
        avg_minutes: Number(payload.operations?.bar?.avg_minutes ?? 0),
      },
      cashiers: {
        open: Number(payload.operations?.cashiers?.open ?? 0),
        closed: Number(payload.operations?.cashiers?.closed ?? 0),
        sales: Number(payload.operations?.cashiers?.sales ?? 0),
      },
    },
    table_status: Array.isArray(payload.table_status) ? payload.table_status : [],
    requires_attention: Array.isArray(payload.requires_attention)
      ? payload.requires_attention
      : Number(summary.pending_approvals ?? 0) > 0
        ? [{ label: "Pending Approvals", count: Number(summary.pending_approvals) }]
        : [],
    kitchen_bar_performance: Array.isArray(payload.kitchen_bar_performance)
      ? payload.kitchen_bar_performance
      : [],
    top_selling_items: Array.isArray(payload.top_selling_items) ? payload.top_selling_items : [],
    inventory: {
      low_stock: Number(payload.inventory?.low_stock ?? 0),
      out_of_stock: Number(payload.inventory?.out_of_stock ?? 0),
      stock_value: Number(payload.inventory?.stock_value ?? 0),
      today_consumption: Number(payload.inventory?.today_consumption ?? 0),
    },
    procurement: {
      pending_pr: Number(payload.procurement?.pending_pr ?? summary.pending_approvals ?? 0),
      approved_pr: Number(payload.procurement?.approved_pr ?? 0),
      open_po: Number(payload.procurement?.open_po ?? 0),
      awaiting_delivery: Number(payload.procurement?.awaiting_delivery ?? 0),
      pending_grn: Number(payload.procurement?.pending_grn ?? 0),
    },
    cashier_sessions: Array.isArray(payload.cashier_sessions) ? payload.cashier_sessions : [],
    staff_performance: Array.isArray(payload.staff_performance) ? payload.staff_performance : [],
    shift_status: payload.shift_status && typeof payload.shift_status === "object"
      ? payload.shift_status
      : {},
    financial_summary: {
      gross_sales: Number(payload.financial_summary?.gross_sales ?? todaySales),
      refunds: Number(payload.financial_summary?.refunds ?? 0),
      net_sales: Number(payload.financial_summary?.net_sales ?? todaySales),
      consumption_cost: Number(payload.financial_summary?.consumption_cost ?? 0),
      gross_profit: Number(payload.financial_summary?.gross_profit ?? todaySales),
      expenses: Number(payload.financial_summary?.expenses ?? 0),
      net_profit: Number(payload.financial_summary?.net_profit ?? 0),
      profit_margin: Number(payload.financial_summary?.profit_margin ?? 0),
    },
  };
}

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "ETB",
  maximumFractionDigits: 0,
});
const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function currency(value: number | undefined) {
  return money.format(Number(value || 0));
}

function MetricCard({
  title,
  value,
  note,
  icon: Icon,
}: {
  title: string;
  value: string;
  note: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="rounded-2xl border-border/70 shadow-sm">
      <CardContent className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{note}</p>
      </CardContent>
    </Card>
  );
}

function statusLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function ManagerDashboardPage() {
  const query = useQuery({
    queryKey: ["manager-dashboard"],
    queryFn: async () => unwrap<Response>(await api.get("/manager/dashboard")),
    staleTime: 30_000,
    retry: 1,
  });

  const data = normalizeManagerData(query.data);

  if (query.isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-20 rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-2xl" />
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (query.isError || !data) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Manager dashboard could not be loaded</AlertTitle>
        <AlertDescription className="mt-2 flex items-center justify-between gap-3">
          <span>{query.error instanceof Error ? query.error.message : "Please try again."}</span>
          <Button variant="outline" size="sm" onClick={() => query.refetch()}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const cards = [
    { title: "Today's Sales", value: currency(data.kpis.today_sales), note: "Paid sales collected today", icon: Banknote },
    { title: "Orders", value: number.format(data.kpis.orders_today), note: "Today's non-cancelled orders", icon: ShoppingCart },
    { title: "Occupied Tables", value: `${data.kpis.occupied_tables} / ${data.kpis.total_tables}`, note: `${data.kpis.total_tables ? Math.round((data.kpis.occupied_tables / data.kpis.total_tables) * 100) : 0}% occupied`, icon: Table2 },
    { title: "Avg. Order", value: currency(data.kpis.average_order_value), note: "Average value per order", icon: BarChart3 },
    { title: "Net Sales", value: currency(data.kpis.net_sales), note: "After processed refunds", icon: CircleDollarSign },
    { title: "Consumption", value: currency(data.kpis.consumption_cost), note: "Approved consumption today", icon: Boxes },
    { title: "Expenses", value: currency(data.kpis.expenses), note: "Finance expenses today", icon: ClipboardList },
    { title: "Net Profit", value: currency(data.kpis.net_profit), note: `${data.kpis.profit_margin}% margin`, icon: TrendingUp },
  ];

  return (
    <div className="space-y-6 pb-8">
      <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Restaurant operations</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">Restaurant Manager Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live sales, orders, tables, kitchen, bar, cashiers, inventory and profitability.
          </p>
        </div>
        <Button
          variant="outline"
          className="rounded-xl"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
        >
          <RefreshCcw className={`mr-2 h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <MetricCard key={card.title} {...card} />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.45fr_0.75fr]">
        <Card className="rounded-2xl border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Sales & Orders Trend</CardTitle>
            <CardDescription>Hourly performance for today.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.sales_trend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="hour" tickLine={false} axisLine={false} minTickGap={28} />
                  <YAxis yAxisId="sales" tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                  <YAxis yAxisId="orders" orientation="right" tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip formatter={(value, name) => name === "Sales" ? [currency(Number(value)), name] : [number.format(Number(value)), name]} />
                  <Legend />
                  <Line yAxisId="sales" type="monotone" dataKey="sales" name="Sales" stroke="currentColor" strokeWidth={2.25} dot={false} />
                  <Line yAxisId="orders" type="monotone" dataKey="orders" name="Orders" stroke="currentColor" strokeOpacity={0.45} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Live Order Status</CardTitle>
            <CardDescription>Current order flow for today.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              ["New", data.live_order_status.new],
              ["Preparing", data.live_order_status.preparing],
              ["Ready", data.live_order_status.ready],
              ["Served", data.live_order_status.served],
              ["Cancelled", data.live_order_status.cancelled],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex items-center justify-between rounded-xl border px-3 py-2.5">
                <span className="text-sm font-medium">{label}</span>
                <span className="text-lg font-bold">{number.format(Number(value))}</span>
              </div>
            ))}
            <div className="flex items-center justify-between border-t pt-3">
              <span className="text-sm font-semibold">Total Active</span>
              <span className="text-xl font-bold">{data.live_order_status.active}</span>
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        <div className="mb-3">
          <h2 className="text-lg font-semibold">Live Restaurant Operations</h2>
          <p className="text-sm text-muted-foreground">Current operating state across the restaurant.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="rounded-2xl"><CardContent className="p-5"><Table2 className="mb-3 h-5 w-5 text-primary" /><p className="font-semibold">Tables</p><p className="mt-2 text-sm">{data.operations.tables.occupied} Occupied</p><p className="text-sm text-muted-foreground">{data.operations.tables.available} Available · {data.operations.tables.reserved} Reserved</p></CardContent></Card>
          <Card className="rounded-2xl"><CardContent className="p-5"><ChefHat className="mb-3 h-5 w-5 text-primary" /><p className="font-semibold">Kitchen</p><p className="mt-2 text-sm">{data.operations.kitchen.queued} Queued · {data.operations.kitchen.ready} Ready</p><p className="text-sm text-muted-foreground">Avg {data.operations.kitchen.avg_minutes} min</p></CardContent></Card>
          <Card className="rounded-2xl"><CardContent className="p-5"><Wine className="mb-3 h-5 w-5 text-primary" /><p className="font-semibold">Bar</p><p className="mt-2 text-sm">{data.operations.bar.queued} Queued · {data.operations.bar.ready} Ready</p><p className="text-sm text-muted-foreground">Avg {data.operations.bar.avg_minutes} min</p></CardContent></Card>
          <Card className="rounded-2xl"><CardContent className="p-5"><Users className="mb-3 h-5 w-5 text-primary" /><p className="font-semibold">Cashiers</p><p className="mt-2 text-sm">{data.operations.cashiers.open} Open · {data.operations.cashiers.closed} Closed</p><p className="text-sm text-muted-foreground">{currency(data.operations.cashiers.sales)} sales</p></CardContent></Card>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-base">Table Status</CardTitle><CardDescription>Active restaurant tables.</CardDescription></CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {data.table_status.map((table) => (
              <div key={table.id} className="flex items-center justify-between rounded-xl border px-3 py-2.5">
                <span className="text-sm font-medium">{table.table_number}</span>
                <Badge variant="outline" className="capitalize">{statusLabel(table.status)}</Badge>
              </div>
            ))}
            {data.table_status.length === 0 && <p className="text-sm text-muted-foreground">No active tables.</p>}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-base">Requires Attention</CardTitle><CardDescription>Operational exceptions requiring manager review.</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {data.requires_attention.map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-xl border px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{item.label}</span>
                </div>
                <span className="font-semibold">{item.is_money ? currency(item.count) : number.format(item.count)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-base">Kitchen & Bar Performance</CardTitle><CardDescription>Preparation speed and delayed workload.</CardDescription></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead><tr className="border-b"><th className="px-3 py-3 text-left">Area</th><th className="px-3 py-3 text-right">Active</th><th className="px-3 py-3 text-right">Avg Prep</th><th className="px-3 py-3 text-right">Delayed</th><th className="px-3 py-3 text-right">Completed</th><th className="px-3 py-3 text-right">Performance</th></tr></thead>
            <tbody>{data.kitchen_bar_performance.map((row) => <tr key={row.area} className="border-b last:border-0"><td className="px-3 py-3 font-medium">{row.area}</td><td className="px-3 py-3 text-right">{row.active}</td><td className="px-3 py-3 text-right">{row.avg_prep} min</td><td className="px-3 py-3 text-right">{row.delayed}</td><td className="px-3 py-3 text-right">{row.completed}</td><td className="px-3 py-3 text-right font-semibold">{row.performance}%</td></tr>)}</tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-base">Top Selling Items</CardTitle><CardDescription>Today's best-performing menu items with recipe-based consumption estimate.</CardDescription></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead><tr className="border-b"><th className="px-3 py-3 text-left">Item</th><th className="px-3 py-3 text-left">Category</th><th className="px-3 py-3 text-right">Qty Sold</th><th className="px-3 py-3 text-right">Revenue</th><th className="px-3 py-3 text-right">Consumption</th><th className="px-3 py-3 text-right">Margin</th></tr></thead>
            <tbody>{data.top_selling_items.map((item) => <tr key={item.id} className="border-b last:border-0"><td className="px-3 py-3 font-medium">{item.name}</td><td className="px-3 py-3">{item.category}</td><td className="px-3 py-3 text-right">{number.format(item.quantity)}</td><td className="px-3 py-3 text-right">{currency(item.revenue)}</td><td className="px-3 py-3 text-right">{currency(item.consumption)}</td><td className="px-3 py-3 text-right font-semibold">{item.margin}%</td></tr>)}</tbody>
          </table>
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-base">Inventory Status</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Low Stock</span><strong>{data.inventory.low_stock}</strong></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Out of Stock</span><strong>{data.inventory.out_of_stock}</strong></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Stock Value</span><strong>{currency(data.inventory.stock_value)}</strong></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Today's Consumption</span><strong>{currency(data.inventory.today_consumption)}</strong></div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-base">Procurement</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Pending PR</span><strong>{data.procurement.pending_pr}</strong></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Approved PR</span><strong>{data.procurement.approved_pr}</strong></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Open PO</span><strong>{data.procurement.open_po}</strong></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Awaiting Delivery</span><strong>{data.procurement.awaiting_delivery}</strong></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Pending GRN</span><strong>{data.procurement.pending_grn}</strong></div>
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-base">Cashier Sessions</CardTitle><CardDescription>Today's cash-shift performance.</CardDescription></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead><tr className="border-b"><th className="px-3 py-3 text-left">Cashier</th><th className="px-3 py-3 text-left">Session</th><th className="px-3 py-3 text-right">Sales</th><th className="px-3 py-3 text-right">Expected Cash</th><th className="px-3 py-3 text-right">Variance</th><th className="px-3 py-3 text-right">Status</th></tr></thead>
            <tbody>{data.cashier_sessions.map((row) => <tr key={row.id} className="border-b last:border-0"><td className="px-3 py-3 font-medium">{row.cashier}</td><td className="px-3 py-3">{row.session}</td><td className="px-3 py-3 text-right">{currency(row.sales)}</td><td className="px-3 py-3 text-right">{currency(row.expected_cash)}</td><td className="px-3 py-3 text-right">{currency(row.variance)}</td><td className="px-3 py-3 text-right"><Badge variant="outline" className="capitalize">{row.status}</Badge></td></tr>)}</tbody>
          </table>
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-base">Staff Performance</CardTitle><CardDescription>Waiter order and sales performance today.</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {data.staff_performance.map((row) => (
              <div key={row.id} className="grid grid-cols-[1fr_auto_auto] gap-4 rounded-xl border px-3 py-2.5 text-sm">
                <span className="font-medium">{row.name}</span>
                <span>{row.orders} orders</span>
                <span className="font-semibold">{currency(row.sales)}</span>
              </div>
            ))}
            {data.staff_performance.length === 0 && <p className="text-sm text-muted-foreground">No waiter activity today.</p>}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-base">Shift Status</CardTitle><CardDescription>Active staff by operational role.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(data.shift_status).map(([key, row]) => (
              <div key={key} className="flex items-center justify-between rounded-xl border px-3 py-2.5">
                <span className="text-sm font-medium capitalize">{key}</span>
                <span className="font-semibold">{row.active} / {row.total} Active</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-base">Today's Financial Summary</CardTitle><CardDescription>Manager-level profitability snapshot.</CardDescription></CardHeader>
        <CardContent className="mx-auto w-full max-w-2xl space-y-3">
          <div className="flex justify-between"><span>Gross Sales</span><strong>{currency(data.financial_summary.gross_sales)}</strong></div>
          <div className="flex justify-between text-muted-foreground"><span>Refunds</span><span>- {currency(data.financial_summary.refunds)}</span></div>
          <div className="flex justify-between border-t pt-3"><span className="font-semibold">Net Sales</span><strong>{currency(data.financial_summary.net_sales)}</strong></div>
          <div className="flex justify-between text-muted-foreground"><span>Consumption Cost</span><span>- {currency(data.financial_summary.consumption_cost)}</span></div>
          <div className="flex justify-between border-t pt-3"><span className="font-semibold">Gross Profit</span><strong>{currency(data.financial_summary.gross_profit)}</strong></div>
          <div className="flex justify-between text-muted-foreground"><span>Expenses</span><span>- {currency(data.financial_summary.expenses)}</span></div>
          <div className="flex justify-between border-t pt-3 text-lg"><span className="font-bold">NET PROFIT</span><strong>{currency(data.financial_summary.net_profit)}</strong></div>
          <div className="flex justify-between"><span className="text-sm text-muted-foreground">Profit Margin</span><strong>{data.financial_summary.profit_margin}%</strong></div>
        </CardContent>
      </Card>
    </div>
  );
}
