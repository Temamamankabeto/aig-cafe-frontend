"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Package,
  PackageMinus,
  RefreshCcw,
  ShieldCheck,
  ShoppingCart,
  Utensils,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartBarList, ChartContainer } from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  procurementService,
  type FoodControllerDashboardData,
} from "@/services/inventory-management/procurement.service";

const emptyDashboard: FoodControllerDashboardData = {
  kpis: {
    pending_validation: 0,
    validated_requests: 0,
    validation_rejected: 0,
    approved_requests: 0,
    received_requests: 0,
    pending_value: 0,
    monthly_validated_value: 0,
    monthly_approved_value: 0,
    today_validated: 0,
    week_rejected: 0,
    low_stock_items: 0,
    out_of_stock_items: 0,
    recipe_integrity_issues: 0,
    active_menu_items: 0,
    total_suppliers: 0,
    kitchen_pending: 0,
    bar_pending: 0,
  },
  status_distribution: [],
  workflow: [],
  trend: [],
  recent_validation_requests: [],
  low_stock_items: [],
  recent_inventory_transactions: [],
  recipe_integrity: {
    menu_items_without_recipe: 0,
    recipes_without_ingredients: 0,
    recipes_with_missing_inventory_links: 0,
    direct_items_without_link: 0,
  },
  alerts: {
    pending_validation: 0,
    validation_rejected: 0,
    low_stock_items: 0,
    recipe_integrity_issues: 0,
    kitchen_bar_pending: 0,
  },
};

function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: unknown): string {
  return `${numberValue(value).toLocaleString(undefined, { maximumFractionDigits: 2 })} ETB`;
}

function compact(value: unknown): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(numberValue(value));
}

function statusLabel(status: string): string {
  return status.replaceAll("_", " ");
}

function statusBadge(status: string) {
  if (["food_validated", "approved", "completed", "received"].includes(status)) {
    return <Badge>{statusLabel(status)}</Badge>;
  }

  if (status === "validation_rejected") {
    return <Badge variant="destructive">{statusLabel(status)}</Badge>;
  }

  return <Badge variant="outline">{statusLabel(status)}</Badge>;
}

export default function FBControllerDashboardPage() {
  const [dashboard, setDashboard] = useState<FoodControllerDashboardData>(emptyDashboard);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await procurementService.foodControllerDashboard();
      setDashboard(data ?? emptyDashboard);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Unable to load F&B Controller dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  const workflowTotal = useMemo(
    () => dashboard.workflow.reduce((sum, row) => sum + numberValue(row.value), 0),
    [dashboard.workflow],
  );

  const validationCompletion = workflowTotal
    ? Math.round((numberValue(dashboard.kpis.validated_requests) / workflowTotal) * 100)
    : 0;

  const kpis = [
    {
      title: "Pending Validation",
      value: dashboard.kpis.pending_validation,
      caption: `${money(dashboard.kpis.pending_value)} waiting review`,
      icon: ShieldCheck,
    },
    {
      title: "Validated Requests",
      value: dashboard.kpis.validated_requests,
      caption: `${dashboard.kpis.today_validated} validated today`,
      icon: CheckCircle2,
    },
    {
      title: "Recipe Issues",
      value: dashboard.kpis.recipe_integrity_issues,
      caption: "Recipe, ingredient, or direct stock links",
      icon: ClipboardList,
    },
    {
      title: "Low Stock Risk",
      value: dashboard.kpis.low_stock_items,
      caption: `${dashboard.kpis.out_of_stock_items} out of stock`,
      icon: AlertTriangle,
    },
  ];

  const actionCards = [
    {
      title: "Purchase Validation",
      description: "Validate submitted purchase requests before manager approval.",
      href: "/dashboard/purchases/validation",
      icon: ShoppingCart,
    },
    {
      title: "Inventory Forecast",
      description: "Review stock risk, waste trend, recipe integrity, and valuation.",
      href: "/dashboard/fb-controller/inventory-forecast",
      icon: Package,
    },
    {
      title: "Kitchen & Bar Stockout Report",
      description: "Review stockout items issued to kitchen and bar departments.",
      href: "/dashboard/fb-controller/stockout-report",
      icon: PackageMinus,
    },
    {
      title: "Recipe Module",
      description: "Maintain recipe ingredients and menu item stock usage.",
      href: "/dashboard/inventory/recipes",
      icon: Utensils,
    },
  ];

  const statusChart = dashboard.status_distribution.map((row) => ({
    label: row.label,
    value: numberValue(row.value),
  }));

  const trendChart = dashboard.trend.map((row) => ({
    label: row.day,
    value: numberValue(row.submitted) + numberValue(row.validated) + numberValue(row.rejected),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
            <BarChart3 className="h-3.5 w-3.5" />
            F&B controller analytics dashboard
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">F&B Controller Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Live purchase validation workload, recipe integrity, stock risk, and kitchen/bar readiness.
            </p>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/purchases/validation">Open Validation</Link>
          </Button>
          <Button type="button" onClick={loadDashboard} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.title} className="rounded-2xl shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{item.title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loading ? <Skeleton className="h-8 w-20" /> : <div className="text-2xl font-bold">{item.value}</div>}
                <p className="mt-1 text-xs text-muted-foreground">{item.caption}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <ChartContainer title="Purchase validation pipeline" description="Submitted, validated, approved, received, and rejected requests.">
          {loading ? <Skeleton className="h-48 w-full" /> : <ChartBarList data={statusChart} emptyLabel="No validation data available" />}
        </ChartContainer>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-3 text-sm">
              Validation Completion
              <Badge variant="outline">{validationCompletion}%</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? <Skeleton className="h-4 w-full" /> : <Progress value={validationCompletion} />}
            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              <div className="rounded-xl border bg-card p-3">
                <div className="font-bold">{dashboard.kpis.monthly_validated_value ? compact(dashboard.kpis.monthly_validated_value) : 0}</div>
                <div className="text-muted-foreground">Validated ETB</div>
              </div>
              <div className="rounded-xl border bg-card p-3">
                <div className="font-bold">{dashboard.kpis.monthly_approved_value ? compact(dashboard.kpis.monthly_approved_value) : 0}</div>
                <div className="text-muted-foreground">Approved ETB</div>
              </div>
            </div>
            <div className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
              {dashboard.kpis.kitchen_pending + dashboard.kpis.bar_pending} kitchen/bar tickets are currently pending, preparing, or delayed.
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="rounded-2xl shadow-sm xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm">Recent Validation Requests</CardTitle>
              <p className="text-xs text-muted-foreground">Latest submitted, validated, and rejected purchase requests.</p>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/purchases/validation">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">PO Number</th>
                    <th className="px-4 py-3 text-left font-medium">Supplier</th>
                    <th className="px-4 py-3 text-left font-medium">Items</th>
                    <th className="px-4 py-3 text-left font-medium">Amount</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 4 }).map((_, index) => (
                      <tr key={index} className="border-t">
                        <td className="px-4 py-3" colSpan={5}><Skeleton className="h-4 w-full" /></td>
                      </tr>
                    ))
                  ) : dashboard.recent_validation_requests.length ? (
                    dashboard.recent_validation_requests.map((row) => (
                      <tr key={row.id} className="border-t">
                        <td className="px-4 py-3 font-medium">{row.po_number ?? `PO-${row.id}`}</td>
                        <td className="px-4 py-3 text-muted-foreground">{row.supplier}</td>
                        <td className="px-4 py-3">{row.items_count}</td>
                        <td className="px-4 py-3">{money(row.amount)}</td>
                        <td className="px-4 py-3">{statusBadge(row.status)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-4 py-8 text-center text-muted-foreground" colSpan={5}>No validation requests found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm">Controller Alerts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "Pending validation", value: dashboard.alerts.pending_validation, icon: ShieldCheck },
              { label: "Rejected this workflow", value: dashboard.alerts.validation_rejected, icon: XCircle },
              { label: "Low stock items", value: dashboard.alerts.low_stock_items, icon: AlertTriangle },
              { label: "Recipe integrity issues", value: dashboard.alerts.recipe_integrity_issues, icon: ClipboardList },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="flex items-center justify-between rounded-xl border bg-card p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span>{item.label}</span>
                  </div>
                  <Badge variant={item.value > 0 ? "secondary" : "outline"}>{item.value}</Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <ChartContainer title="7-day validation activity" description="Daily submitted, validated, and rejected validation workload.">
          {loading ? <Skeleton className="h-40 w-full" /> : <ChartBarList data={trendChart} emptyLabel="No validation activity this week" />}
        </ChartContainer>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {actionCards.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} className="group rounded-2xl border bg-card p-4 transition hover:border-primary/50 hover:shadow-sm">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-1" />
                  </div>
                  <div className="font-semibold">{item.title}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
