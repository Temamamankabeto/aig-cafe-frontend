"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Banknote,
  Boxes,
  ChefHat,
  ClipboardList,
  CreditCard,
  PackageSearch,
  ReceiptText,
  RefreshCcw,
  ShoppingCart,
  Table2,
  TrendingUp,
  UtensilsCrossed,
  WalletCards,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useState } from "react";
import api, { unwrap } from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface DashboardData {
  kpis: {
    today_sales: number;
    orders_today: number;
    average_order_value: number;
    net_revenue: number;
    food_cost: number;
    gross_profit: number;
  };
  operations: {
    open_orders: number;
    kitchen_queue: number;
    occupied_tables: number;
    low_stock_items: number;
    pending_procurement: number;
    unpaid_orders: number;
  };
  sales_trend: Array<{ date: string; label: string; revenue: number; orders: number }>;
  monthly_performance: Array<{ month: string; revenue: number; expenses: number; profit: number }>;
  category_sales: Array<{ category: string; quantity: number; revenue: number }>;
  payment_methods: Array<{ method: string; transactions: number; amount: number }>;
  top_selling_items: Array<{ id: number; name: string; quantity: number; revenue: number }>;
  consumption_vs_sales: Array<{ date: string; label: string; sales: number; consumption: number }>;
}

type DashboardResponse = {
  success: boolean;
  message?: string;
  data?: DashboardData;
};

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "ETB",
  maximumFractionDigits: 0,
});

const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function currency(value: number | string | undefined) {
  return money.format(Number(value || 0));
}

function KpiCard({ title, value, note, icon: Icon }: { title: string; value: string; note: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Card className="rounded-2xl border-border/70 shadow-sm">
      <CardContent className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><Icon className="h-5 w-5" /></div>
        </div>
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{note}</p>
      </CardContent>
    </Card>
  );
}

function OperationCard({ title, value, icon: Icon, attention = false }: { title: string; value: number; icon: React.ComponentType<{ className?: string }>; attention?: boolean }) {
  return (
    <Card className="rounded-2xl border-border/70 shadow-sm">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`rounded-xl p-2.5 ${attention && value > 0 ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xl font-bold leading-none">{number.format(value)}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{title}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ChartShell({ title, description, children, className = "" }: { title: string; description: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={`rounded-2xl border-border/70 shadow-sm ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default function GeneralAdminDashboardPage() {
  const [days, setDays] = useState<7 | 30>(7);
  const query = useQuery({
    queryKey: ["general-admin-dashboard", days],
    queryFn: async () => unwrap<DashboardResponse>(await api.get("/admin/general/dashboard", { params: { days } })),
    staleTime: 30_000,
    retry: 1,
  });

  const data = query.data?.data;

  if (query.isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-20 rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}</div>
        <div className="grid gap-4 xl:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-80 rounded-2xl" />)}</div>
      </div>
    );
  }

  if (query.isError || !data) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Dashboard could not be loaded</AlertTitle>
        <AlertDescription className="mt-2 flex items-center justify-between gap-3">
          <span>{query.error instanceof Error ? query.error.message : "Please try again."}</span>
          <Button variant="outline" size="sm" onClick={() => query.refetch()}>Retry</Button>
        </AlertDescription>
      </Alert>
    );
  }

  const kpis = [
    { title: "Today's Sales", value: currency(data.kpis.today_sales), note: "Paid sales collected today", icon: Banknote },
    { title: "Orders Today", value: number.format(data.kpis.orders_today), note: "Non-cancelled orders today", icon: ShoppingCart },
    { title: "Average Order Value", value: currency(data.kpis.average_order_value), note: "Sales divided by today's orders", icon: ReceiptText },
    { title: "Net Revenue", value: currency(data.kpis.net_revenue), note: "Today's sales less processed refunds", icon: WalletCards },
    { title: "Food Cost", value: currency(data.kpis.food_cost), note: "Approved consumption cost today", icon: UtensilsCrossed },
    { title: "Gross Profit", value: currency(data.kpis.gross_profit), note: "Net revenue less food cost", icon: TrendingUp },
  ];

  const operations = [
    { title: "Open Orders", value: data.operations.open_orders, icon: ClipboardList },
    { title: "Kitchen Queue", value: data.operations.kitchen_queue, icon: ChefHat },
    { title: "Occupied Tables", value: data.operations.occupied_tables, icon: Table2 },
    { title: "Low Stock Items", value: data.operations.low_stock_items, icon: Boxes, attention: true },
    { title: "Pending Procurement", value: data.operations.pending_procurement, icon: PackageSearch, attention: true },
    { title: "Unpaid Orders", value: data.operations.unpaid_orders, icon: CreditCard, attention: true },
  ];

  return (
    <div className="space-y-6 pb-8">
      <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Management overview</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">General Admin Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sales, profitability, operations, inventory risk and procurement in one view.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl border bg-card p-1">
            {[7, 30].map((value) => (
              <Button key={value} size="sm" variant={days === value ? "default" : "ghost"} className="h-8 rounded-lg px-3" onClick={() => setDays(value as 7 | 30)}>
                {value} days
              </Button>
            ))}
          </div>
          <Button variant="outline" size="icon" className="rounded-xl" onClick={() => query.refetch()} disabled={query.isFetching} aria-label="Refresh dashboard">
            <RefreshCcw className={`h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {kpis.map((item) => <KpiCard key={item.title} {...item} />)}
      </section>

      <section>
        <div className="mb-3">
          <h2 className="text-lg font-semibold">Current operations</h2>
          <p className="text-sm text-muted-foreground">Live indicators that may require operational attention.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          {operations.map((item) => <OperationCard key={item.title} {...item} />)}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <ChartShell title="Sales & Orders Trend" description={`Daily revenue and order count for the last ${days} days.`}>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.sales_trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis yAxisId="left" tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip formatter={(value, name) => name === "Revenue" ? [currency(Number(value)), name] : [number.format(Number(value)), name]} />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="revenue" name="Revenue" stroke="currentColor" strokeWidth={2.25} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="orders" name="Orders" stroke="currentColor" strokeOpacity={0.45} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartShell>

        <ChartShell title="Revenue vs Expenses vs Profit" description="Monthly financial performance for the latest six months.">
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.monthly_performance} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                <Tooltip formatter={(value, name) => [currency(Number(value)), String(name)]} />
                <Legend />
                <Bar dataKey="revenue" name="Revenue" fill="currentColor" radius={[5, 5, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="currentColor" fillOpacity={0.35} radius={[5, 5, 0, 0]} />
                <Line type="monotone" dataKey="profit" name="Profit" stroke="currentColor" strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </ChartShell>

        <ChartShell title="Sales by Category" description={`Highest-revenue menu categories over the last ${days} days.`}>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.category_sales} layout="vertical" margin={{ top: 5, right: 16, left: 16, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                <YAxis type="category" dataKey="category" width={90} tickLine={false} axisLine={false} />
                <Tooltip formatter={(value) => currency(Number(value))} />
                <Bar dataKey="revenue" name="Revenue" fill="currentColor" radius={[0, 5, 5, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartShell>

        <ChartShell title="Payment Methods" description={`Payment mix collected over the last ${days} days.`}>
          <div className="grid gap-4 md:grid-cols-[1fr_180px] md:items-center">
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.payment_methods} dataKey="amount" nameKey="method" innerRadius={62} outerRadius={96} paddingAngle={3}>
                    {data.payment_methods.map((item, index) => <Cell key={`${item.method}-${index}`} fill="currentColor" opacity={Math.max(0.3, 1 - index * 0.14)} />)}
                  </Pie>
                  <Tooltip formatter={(value) => currency(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              {data.payment_methods.map((item) => (
                <div key={item.method} className="flex items-center justify-between gap-3 border-b pb-2 last:border-0">
                  <div><p className="text-sm font-medium capitalize">{item.method.replace(/_/g, " ")}</p><p className="text-xs text-muted-foreground">{number.format(item.transactions)} transactions</p></div>
                  <p className="text-sm font-semibold">{currency(item.amount)}</p>
                </div>
              ))}
              {data.payment_methods.length === 0 && <p className="text-sm text-muted-foreground">No payment data for this period.</p>}
            </div>
          </div>
        </ChartShell>

        <ChartShell title="Top Selling Items" description={`Best-performing menu items over the last ${days} days.`}>
          <div className="space-y-1">
            {data.top_selling_items.map((item, index) => (
              <div key={item.id} className="grid grid-cols-[32px_1fr_auto] items-center gap-3 rounded-xl px-2 py-3 hover:bg-muted/50">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-xs font-bold">{index + 1}</div>
                <div className="min-w-0"><p className="truncate text-sm font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{number.format(item.quantity)} sold</p></div>
                <p className="text-sm font-semibold">{currency(item.revenue)}</p>
              </div>
            ))}
            {data.top_selling_items.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No completed sales in this period.</p>}
          </div>
        </ChartShell>

        <ChartShell title="Consumption vs Sales" description={`Approved food consumption cost compared with sales over the last ${days} days.`}>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.consumption_vs_sales} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                <Tooltip formatter={(value, name) => [currency(Number(value)), String(name)]} />
                <Legend />
                <Area type="monotone" dataKey="sales" name="Sales" stroke="currentColor" fill="currentColor" fillOpacity={0.12} strokeWidth={2} />
                <Area type="monotone" dataKey="consumption" name="Consumption" stroke="currentColor" fill="currentColor" fillOpacity={0.04} strokeOpacity={0.55} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartShell>
      </section>
    </div>
  );
}
