"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Boxes,
  CircleDollarSign,
  PackageSearch,
  RefreshCcw,
  Scale,
  TrendingDown,
  TrendingUp,
  Utensils,
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
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

type DashboardData = {
  filters: {
    period: string;
    department: string;
    category_id?: number | null;
    categories: Array<{ id: number; name: string }>;
  };
  kpis: {
    net_sales: number;
    actual_cost: number;
    food_cost_percent: number;
    beverage_cost_percent: number;
    theoretical_cost: number;
    cost_variance: number;
    cost_variance_percent: number;
    wastage: number;
    wastage_percent: number;
    stock_value: number;
    food_target: number;
    beverage_target: number;
  };
  actual_vs_theoretical: Array<{ day: string; actual: number; theoretical: number }>;
  cost_by_department: Array<{ department: string; cost: number; share: number }>;
  exceptions: Array<{ level: string; message: string }>;
  item_cost_analysis: Array<{
    id: number;
    item: string;
    unit: string;
    theoretical_qty: number;
    actual_qty: number;
    variance_qty: number;
    cost: number;
    cost_percent: number;
  }>;
  consumption_by_category: Array<{ category: string; cost: number; share: number }>;
  wastage: {
    total: number;
    spoilage: number;
    preparation_waste: number;
    breakage: number;
    other: number;
  };
  stock_health: {
    healthy: number;
    low_stock: number;
    critical: number;
    out_of_stock: number;
    current_value: number;
  };
  stock_movements: Array<{
    id: number;
    reference: string;
    item: string;
    type: string;
    quantity: number;
    unit: string;
    location: string;
    status: string;
  }>;
  receiving_costs: Array<{
    grn: string;
    supplier: string;
    item: string;
    quantity: number;
    unit: string;
    unit_cost: number;
    last_cost: number;
    change_percent: number;
  }>;
  menu_profitability: {
    top_margin: Array<{ id: number; name: string; margin: number; revenue: number; cost: number }>;
    low_margin: Array<{ id: number; name: string; margin: number; revenue: number; cost: number }>;
  };
  month_to_date: {
    net_sales: number;
    theoretical_consumption: number;
    actual_consumption: number;
    cost_variance: number;
    actual_cost_percent: number;
    target_cost_percent: number;
    variance_pp: number;
  };
};

type ApiResponse = { success: boolean; data?: DashboardData; message?: string };

const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "ETB",
  maximumFractionDigits: 0,
});
const numberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

function money(value: unknown) {
  return moneyFormatter.format(Number(value || 0));
}

function quantity(value: unknown, unit = "") {
  return `${numberFormatter.format(Number(value || 0))}${unit ? ` ${unit}` : ""}`;
}

function KpiCard({
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

export default function FBControllerDashboardPage() {
  const [period, setPeriod] = useState("today");
  const [department, setDepartment] = useState("all");
  const [categoryId, setCategoryId] = useState("all");

  const query = useQuery({
    queryKey: ["fb-controller-cost-dashboard", period, department, categoryId],
    queryFn: async () =>
      unwrap<ApiResponse>(
        await api.get("/food-controller/dashboard", {
          params: {
            period,
            department,
            category_id: categoryId === "all" ? undefined : categoryId,
          },
        }),
      ),
    staleTime: 30_000,
    retry: 1,
  });

  const data = query.data?.data;

  const maxCategoryCost = useMemo(
    () => Math.max(1, ...(data?.consumption_by_category ?? []).map((item) => item.cost)),
    [data?.consumption_by_category],
  );

  if (query.isLoading && !data) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-20 rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    );
  }

  if (query.isError || !data) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>F&B Controller dashboard could not be loaded</AlertTitle>
        <AlertDescription className="mt-2 flex items-center justify-between gap-3">
          <span>{query.error instanceof Error ? query.error.message : "Please try again."}</span>
          <Button variant="outline" size="sm" onClick={() => query.refetch()}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const kpis = [
    { title: "Net Sales", value: money(data.kpis.net_sales), note: "Paid sales after processed refunds", icon: CircleDollarSign },
    { title: "Actual Cost", value: money(data.kpis.actual_cost), note: "Approved stock consumption", icon: Scale },
    { title: "Food Cost %", value: `${data.kpis.food_cost_percent}%`, note: `Target ${data.kpis.food_target}%`, icon: Utensils },
    { title: "Bev. Cost %", value: `${data.kpis.beverage_cost_percent}%`, note: `Target ${data.kpis.beverage_target}%`, icon: Wine },
    { title: "Theoretical Cost", value: money(data.kpis.theoretical_cost), note: "Recipe-based expected consumption", icon: TrendingUp },
    { title: "Cost Variance", value: money(data.kpis.cost_variance), note: `${data.kpis.cost_variance_percent >= 0 ? "+" : ""}${data.kpis.cost_variance_percent}% vs theoretical`, icon: TrendingDown },
    { title: "Wastage", value: money(data.kpis.wastage), note: `${data.kpis.wastage_percent}% of net sales`, icon: AlertTriangle },
    { title: "Stock Value", value: money(data.kpis.stock_value), note: "Current inventory valuation", icon: Boxes },
  ];

  return (
    <div className="space-y-6 pb-8">
      <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Food & Beverage cost control</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">F&B Controller Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Actual vs theoretical consumption, wastage, stock health, receiving cost and menu profitability.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="this_week">This Week</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="this_year">This Year</SelectItem>
            </SelectContent>
          </Select>

          <Select value={department} onValueChange={setDepartment}>
            <SelectTrigger className="w-[165px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Kitchen & Bar</SelectItem>
              <SelectItem value="kitchen">Kitchen</SelectItem>
              <SelectItem value="bar">Bar</SelectItem>
            </SelectContent>
          </Select>

          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {data.filters.categories.map((category) => (
                <SelectItem key={category.id} value={String(category.id)}>{category.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}>
            <RefreshCcw className={`mr-2 h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((card) => <KpiCard key={card.title} {...card} />)}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Actual vs Theoretical Cost</CardTitle>
            <CardDescription>Seven-day cost-control trend.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.actual_vs_theoretical}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} />
                  <Tooltip formatter={(value) => money(value)} />
                  <Legend />
                  <Line type="monotone" dataKey="actual" name="Actual" stroke="currentColor" strokeWidth={2.25} dot={false} />
                  <Line type="monotone" dataKey="theoretical" name="Theoretical" stroke="currentColor" strokeOpacity={0.45} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Cost by Department</CardTitle>
            <CardDescription>Approved consumption share.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.cost_by_department.map((row) => (
              <div key={row.department}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium">{row.department}</span>
                  <span>{money(row.cost)} · {row.share}%</span>
                </div>
                <Progress value={Math.min(100, row.share)} />
              </div>
            ))}
            {!data.cost_by_department.length && <p className="text-sm text-muted-foreground">No approved consumption in this period.</p>}
            <div className="grid grid-cols-2 gap-3 border-t pt-4 text-sm">
              <div><p className="text-muted-foreground">Food Cost</p><p className="font-bold">{data.kpis.food_cost_percent}%</p></div>
              <div><p className="text-muted-foreground">Beverage Cost</p><p className="font-bold">{data.kpis.beverage_cost_percent}%</p></div>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Cost Control Exceptions</CardTitle>
          <CardDescription>Items requiring F&B Controller review.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.exceptions.length ? data.exceptions.map((item, index) => (
            <div key={`${item.message}-${index}`} className="flex items-start gap-3 rounded-xl border p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="text-sm">{item.message}</p>
              <Badge variant={item.level === "high" ? "destructive" : "outline"} className="ml-auto capitalize">{item.level}</Badge>
            </div>
          )) : (
            <p className="text-sm text-muted-foreground">No cost-control exceptions detected for the selected period.</p>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Item Cost Analysis</CardTitle>
          <CardDescription>Actual ingredient usage compared with recipe-based theoretical usage.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead><tr className="border-b">
              <th className="px-3 py-3 text-left">Item</th>
              <th className="px-3 py-3 text-right">Theo. Qty</th>
              <th className="px-3 py-3 text-right">Actual Qty</th>
              <th className="px-3 py-3 text-right">Variance</th>
              <th className="px-3 py-3 text-right">Cost</th>
              <th className="px-3 py-3 text-right">Cost %</th>
            </tr></thead>
            <tbody>
              {data.item_cost_analysis.map((row) => (
                <tr key={row.id} className="border-b last:border-0">
                  <td className="px-3 py-3 font-medium">{row.item}</td>
                  <td className="px-3 py-3 text-right">{quantity(row.theoretical_qty, row.unit)}</td>
                  <td className="px-3 py-3 text-right">{quantity(row.actual_qty, row.unit)}</td>
                  <td className="px-3 py-3 text-right font-semibold">{row.variance_qty >= 0 ? "+" : ""}{quantity(row.variance_qty, row.unit)}</td>
                  <td className="px-3 py-3 text-right">{money(row.cost)}</td>
                  <td className="px-3 py-3 text-right">{row.cost_percent}%</td>
                </tr>
              ))}
              {!data.item_cost_analysis.length && <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">No item-cost data available.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Consumption by Category</CardTitle>
          <CardDescription>Approved consumption grouped by linked menu category.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.consumption_by_category.map((row) => (
            <div key={row.category} className="grid gap-2 md:grid-cols-[180px_150px_1fr_65px] md:items-center">
              <span className="text-sm font-medium">{row.category}</span>
              <span className="text-sm">{money(row.cost)}</span>
              <Progress value={(row.cost / maxCategoryCost) * 100} />
              <span className="text-right text-sm font-semibold">{row.share}%</span>
            </div>
          ))}
          {!data.consumption_by_category.length && <p className="text-sm text-muted-foreground">No category consumption data.</p>}
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-base">Wastage & Loss</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Wastage</span><strong>{money(data.wastage.total)}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Spoilage</span><strong>{money(data.wastage.spoilage)}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Preparation Waste</span><strong>{money(data.wastage.preparation_waste)}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Breakage</span><strong>{money(data.wastage.breakage)}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Other</span><strong>{money(data.wastage.other)}</strong></div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-base">Stock Health</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Healthy Items</span><strong>{data.stock_health.healthy}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Low Stock</span><strong>{data.stock_health.low_stock}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Critical</span><strong>{data.stock_health.critical}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Out of Stock</span><strong>{data.stock_health.out_of_stock}</strong></div>
            <div className="flex justify-between border-t pt-3"><span className="font-semibold">Current Value</span><strong>{money(data.stock_health.current_value)}</strong></div>
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-base">Stock Movement Review</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-sm">
            <thead><tr className="border-b"><th className="px-3 py-3 text-left">Ref</th><th className="px-3 py-3 text-left">Item</th><th className="px-3 py-3 text-left">Type</th><th className="px-3 py-3 text-right">Qty</th><th className="px-3 py-3 text-left">Location</th><th className="px-3 py-3 text-right">Status</th></tr></thead>
            <tbody>{data.stock_movements.map((row) => (
              <tr key={row.id} className="border-b last:border-0"><td className="px-3 py-3 font-medium">{row.reference}</td><td className="px-3 py-3">{row.item}</td><td className="px-3 py-3">{row.type}</td><td className="px-3 py-3 text-right">{quantity(row.quantity, row.unit)}</td><td className="px-3 py-3">{row.location}</td><td className="px-3 py-3 text-right"><Badge variant="outline">{row.status}</Badge></td></tr>
            ))}</tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-base">Receiving & Purchase Cost</CardTitle><CardDescription>Latest receipts and current average-cost comparison.</CardDescription></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-sm">
            <thead><tr className="border-b"><th className="px-3 py-3 text-left">GRN</th><th className="px-3 py-3 text-left">Supplier</th><th className="px-3 py-3 text-left">Item</th><th className="px-3 py-3 text-right">Qty</th><th className="px-3 py-3 text-right">Unit Cost</th><th className="px-3 py-3 text-right">Avg Cost</th><th className="px-3 py-3 text-right">Change</th></tr></thead>
            <tbody>{data.receiving_costs.map((row) => (
              <tr key={`${row.grn}-${row.item}`} className="border-b last:border-0"><td className="px-3 py-3 font-medium">{row.grn}</td><td className="px-3 py-3">{row.supplier}</td><td className="px-3 py-3">{row.item}</td><td className="px-3 py-3 text-right">{quantity(row.quantity, row.unit)}</td><td className="px-3 py-3 text-right">{money(row.unit_cost)}</td><td className="px-3 py-3 text-right">{money(row.last_cost)}</td><td className="px-3 py-3 text-right font-semibold">{row.change_percent >= 0 ? "+" : ""}{row.change_percent}%</td></tr>
            ))}</tbody>
          </table>
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-base">Menu Profitability</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.menu_profitability.top_margin.map((row) => (
              <div key={row.id} className="flex justify-between rounded-xl border px-3 py-2.5 text-sm"><span className="font-medium">{row.name}</span><strong>Margin {row.margin}%</strong></div>
            ))}
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-base">Low Margin Items</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.menu_profitability.low_margin.length ? data.menu_profitability.low_margin.map((row) => (
              <div key={row.id} className="flex justify-between rounded-xl border px-3 py-2.5 text-sm"><span className="font-medium">{row.name}</span><strong>{row.margin}%</strong></div>
            )) : <p className="text-sm text-muted-foreground">No menu items below the 30% margin threshold.</p>}
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-base">Month-to-Date Cost Performance</CardTitle><CardDescription>F&B cost position for the current month.</CardDescription></CardHeader>
        <CardContent className="mx-auto w-full max-w-2xl space-y-3">
          <div className="flex justify-between"><span>Net Sales</span><strong>{money(data.month_to_date.net_sales)}</strong></div>
          <div className="flex justify-between"><span>Theoretical Consumption</span><strong>{money(data.month_to_date.theoretical_consumption)}</strong></div>
          <div className="flex justify-between"><span>Actual Consumption</span><strong>{money(data.month_to_date.actual_consumption)}</strong></div>
          <div className="flex justify-between border-t pt-3"><span className="font-semibold">Cost Variance</span><strong>{money(data.month_to_date.cost_variance)}</strong></div>
          <div className="flex justify-between"><span>Actual F&B Cost %</span><strong>{data.month_to_date.actual_cost_percent}%</strong></div>
          <div className="flex justify-between"><span>Target F&B Cost %</span><strong>{data.month_to_date.target_cost_percent}%</strong></div>
          <div className="flex justify-between border-t pt-3 text-lg"><span className="font-bold">Variance</span><strong>{data.month_to_date.variance_pp >= 0 ? "+" : ""}{data.month_to_date.variance_pp} pp</strong></div>
        </CardContent>
      </Card>
    </div>
  );
}
