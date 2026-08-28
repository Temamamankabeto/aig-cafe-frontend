"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  CircleDollarSign,
  CreditCard,
  RefreshCcw,
  RotateCcw,
  TrendingUp,
  WalletCards,
  XCircle,
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

type FinanceData = {
  filters: {
    period: string;
    cashier_id?: number | null;
    payment_method?: string | null;
    outlet: string;
    cashiers: Array<{ id: number; name: string }>;
    payment_methods: string[];
  };
  kpis: {
    gross_sales: number;
    net_sales: number;
    expenses: number;
    net_profit: number;
    net_margin: number;
    cash_sales: number;
    cash_share: number;
    non_cash_sales: number;
    non_cash_share: number;
    refunds: number;
    refund_transactions: number;
    open_cashier_count: number;
    open_cash_expected: number;
  };
  revenue_profit_trend: Array<{ day: string; gross_sales: number; net_sales: number; profit: number }>;
  payment_methods: Array<{ method: string; amount: number; share: number }>;
  cashier_reconciliation: Array<{
    id: number;
    cashier: string;
    session: string;
    opening: number;
    cash_sales: number;
    expected: number;
    counted: number | null;
    variance: number | null;
    status: string;
  }>;
  sales_summary: {
    food_sales: number;
    beverage_sales: number;
    other_revenue: number;
    total_gross_sales: number;
  };
  requires_attention: Array<{ label: string; count: number; is_money?: boolean }>;
  recent_payments: Array<{
    id: number;
    payment_number: string;
    order: string;
    method: string;
    amount: number;
    cashier: string;
    status: string;
  }>;
  expenses: Array<{
    id: number;
    reference: string;
    category: string;
    description: string;
    amount: number;
    requested_by: string;
    status: string;
  }>;
  refunds_credit: {
    refunds_amount: number;
    refund_transactions: number;
    voided_orders: number;
    pending_approval: number;
    outstanding_credit: number;
    credit_orders: number;
    overdue_amount: number;
  };
  profitability: {
    net_sales: number;
    consumption_cost: number;
    gross_profit: number;
    operating_expenses: number;
    net_profit: number;
    gross_margin: number;
    net_margin: number;
    consumption_percent: number;
  };
  daily_closing: {
    sales_posted: boolean;
    closed_sessions: number;
    total_sessions: number;
    payment_reconciliation: boolean;
    refund_reviewed: number;
    refund_total: number;
    expense_posting: boolean;
    cash_variance_review: boolean;
    status: string;
  };
};

type ApiResponse = { success: boolean; data?: FinanceData; message?: string };

const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "ETB",
  maximumFractionDigits: 0,
});
const numberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

function money(value: unknown) {
  return moneyFormatter.format(Number(value || 0));
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
        <div className="mb-4 rounded-xl bg-primary/10 p-2.5 text-primary w-fit">
          <Icon className="h-5 w-5" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{note}</p>
      </CardContent>
    </Card>
  );
}

function statusText(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function FinanceDashboardPage() {
  const [period, setPeriod] = useState("today");
  const [cashierId, setCashierId] = useState("all");
  const [paymentMethod, setPaymentMethod] = useState("all");
  const [outlet, setOutlet] = useState("all");

  const query = useQuery({
    queryKey: ["finance-dashboard", period, cashierId, paymentMethod, outlet],
    queryFn: async () =>
      unwrap<ApiResponse>(
        await api.get("/finance/dashboard", {
          params: {
            period,
            cashier_id: cashierId === "all" ? undefined : cashierId,
            payment_method: paymentMethod === "all" ? undefined : paymentMethod,
            outlet,
          },
        }),
      ),
    staleTime: 30_000,
    retry: 1,
  });

  const data = query.data?.data;

  const maxPayment = useMemo(
    () => Math.max(1, ...(data?.payment_methods ?? []).map((row) => row.amount)),
    [data?.payment_methods],
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
        <AlertTitle>Finance dashboard could not be loaded</AlertTitle>
        <AlertDescription className="mt-2 flex items-center justify-between gap-3">
          <span>{query.error instanceof Error ? query.error.message : "Please try again."}</span>
          <Button variant="outline" size="sm" onClick={() => query.refetch()}>Retry</Button>
        </AlertDescription>
      </Alert>
    );
  }

  const cards = [
    { title: "Gross Sales", value: money(data.kpis.gross_sales), note: "Paid collections in selected period", icon: Banknote },
    { title: "Net Sales", value: money(data.kpis.net_sales), note: "Gross sales less processed refunds", icon: CircleDollarSign },
    { title: "Expenses", value: money(data.kpis.expenses), note: "Posted operating expenses", icon: WalletCards },
    { title: "Net Profit", value: money(data.kpis.net_profit), note: `${data.kpis.net_margin}% net margin`, icon: TrendingUp },
    { title: "Cash Sales", value: money(data.kpis.cash_sales), note: `${data.kpis.cash_share}% of collections`, icon: Banknote },
    { title: "Non-Cash", value: money(data.kpis.non_cash_sales), note: `${data.kpis.non_cash_share}% of collections`, icon: CreditCard },
    { title: "Refunds", value: money(data.kpis.refunds), note: `${data.kpis.refund_transactions} processed transactions`, icon: RotateCcw },
    { title: "Open Cashier", value: String(data.kpis.open_cashier_count), note: `${money(data.kpis.open_cash_expected)} opening cash`, icon: WalletCards },
  ];

  return (
    <div className="space-y-6 pb-8">
      <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Finance & reconciliation</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">Finance Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Revenue, payments, cashier reconciliation, expenses, refunds, receivables and profitability.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[145px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="this_week">This Week</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="this_year">This Year</SelectItem>
            </SelectContent>
          </Select>

          <Select value={cashierId} onValueChange={setCashierId}>
            <SelectTrigger className="w-[175px]"><SelectValue placeholder="All Cashiers" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cashiers</SelectItem>
              {data.filters.cashiers.map((cashier) => (
                <SelectItem key={cashier.id} value={String(cashier.id)}>{cashier.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={paymentMethod} onValueChange={setPaymentMethod}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Payment Method" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Payment Methods</SelectItem>
              {data.filters.payment_methods.map((method) => (
                <SelectItem key={method} value={method}>{statusText(method)}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={outlet} onValueChange={setOutlet}>
            <SelectTrigger className="w-[145px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Outlets</SelectItem>
              <SelectItem value="restaurant">Restaurant</SelectItem>
              <SelectItem value="bar">Bar</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}>
            <RefreshCcw className={`mr-2 h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => <KpiCard key={card.title} {...card} />)}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-base">Revenue & Profit Trend</CardTitle><CardDescription>Seven-day gross sales, net sales and profit trend.</CardDescription></CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.revenue_profit_trend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} />
                  <Tooltip formatter={(value) => money(value)} />
                  <Legend />
                  <Line type="monotone" dataKey="gross_sales" name="Gross Sales" stroke="currentColor" strokeWidth={2.2} dot={false} />
                  <Line type="monotone" dataKey="net_sales" name="Net Sales" stroke="currentColor" strokeOpacity={0.65} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="profit" name="Profit" stroke="currentColor" strokeOpacity={0.35} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-base">Payment Methods</CardTitle><CardDescription>Collection mix for the selected period.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            {data.payment_methods.map((row) => (
              <div key={row.method}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium">{statusText(row.method)}</span>
                  <span>{money(row.amount)} · {row.share}%</span>
                </div>
                <Progress value={(row.amount / maxPayment) * 100} />
              </div>
            ))}
            {!data.payment_methods.length && <p className="text-sm text-muted-foreground">No payment collections found.</p>}
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-base">Cashier Reconciliation</CardTitle><CardDescription>Cash-shift expected vs counted balances.</CardDescription></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead><tr className="border-b">
              <th className="px-3 py-3 text-left">Cashier</th><th className="px-3 py-3 text-left">Session</th>
              <th className="px-3 py-3 text-right">Opening</th><th className="px-3 py-3 text-right">Cash Sales</th>
              <th className="px-3 py-3 text-right">Expected</th><th className="px-3 py-3 text-right">Counted</th>
              <th className="px-3 py-3 text-right">Variance</th>
            </tr></thead>
            <tbody>{data.cashier_reconciliation.map((row) => (
              <tr key={row.id} className="border-b last:border-0">
                <td className="px-3 py-3 font-medium">{row.cashier}</td><td className="px-3 py-3">{row.session}</td>
                <td className="px-3 py-3 text-right">{money(row.opening)}</td><td className="px-3 py-3 text-right">{money(row.cash_sales)}</td>
                <td className="px-3 py-3 text-right">{money(row.expected)}</td><td className="px-3 py-3 text-right">{row.counted === null ? "—" : money(row.counted)}</td>
                <td className="px-3 py-3 text-right font-semibold">{row.variance === null ? "—" : money(row.variance)}</td>
              </tr>
            ))}</tbody>
          </table>
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-base">Sales Summary</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Food Sales</span><strong>{money(data.sales_summary.food_sales)}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Beverage / Bar Sales</span><strong>{money(data.sales_summary.beverage_sales)}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Other Revenue</span><strong>{money(data.sales_summary.other_revenue)}</strong></div>
            <div className="flex justify-between border-t pt-3"><span className="font-semibold">Total Gross Sales</span><strong>{money(data.sales_summary.total_gross_sales)}</strong></div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-base">Requires Attention</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.requires_attention.map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-xl border px-3 py-2.5">
                <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-muted-foreground" /><span className="text-sm">{item.label}</span></div>
                <strong className="text-sm">{item.is_money ? money(item.count) : item.count}</strong>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-base">Recent Payments</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead><tr className="border-b"><th className="px-3 py-3 text-left">Payment No.</th><th className="px-3 py-3 text-left">Order</th><th className="px-3 py-3 text-left">Method</th><th className="px-3 py-3 text-right">Amount</th><th className="px-3 py-3 text-left">Cashier</th><th className="px-3 py-3 text-right">Status</th></tr></thead>
            <tbody>{data.recent_payments.map((row) => (
              <tr key={row.id} className="border-b last:border-0"><td className="px-3 py-3 font-medium">{row.payment_number}</td><td className="px-3 py-3">{row.order}</td><td className="px-3 py-3">{statusText(row.method)}</td><td className="px-3 py-3 text-right">{money(row.amount)}</td><td className="px-3 py-3">{row.cashier}</td><td className="px-3 py-3 text-right"><Badge variant="outline">{statusText(row.status)}</Badge></td></tr>
            ))}</tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-base">Expenses</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-sm">
            <thead><tr className="border-b"><th className="px-3 py-3 text-left">Ref</th><th className="px-3 py-3 text-left">Category</th><th className="px-3 py-3 text-left">Description</th><th className="px-3 py-3 text-right">Amount</th><th className="px-3 py-3 text-left">Recorded By</th><th className="px-3 py-3 text-right">Status</th></tr></thead>
            <tbody>{data.expenses.map((row) => (
              <tr key={row.id} className="border-b last:border-0"><td className="px-3 py-3 font-medium">{row.reference}</td><td className="px-3 py-3">{row.category}</td><td className="px-3 py-3">{row.description}</td><td className="px-3 py-3 text-right">{money(row.amount)}</td><td className="px-3 py-3">{row.requested_by}</td><td className="px-3 py-3 text-right"><Badge variant="outline">{row.status}</Badge></td></tr>
            ))}</tbody>
          </table>
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-base">Refunds & Voids</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Refunds</span><strong>{money(data.refunds_credit.refunds_amount)}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Refund Transactions</span><strong>{data.refunds_credit.refund_transactions}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Voided / Cancelled Orders</span><strong>{data.refunds_credit.voided_orders}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Pending Approval</span><strong>{data.refunds_credit.pending_approval}</strong></div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-base">Credit / Receivables</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Outstanding Credit</span><strong>{money(data.refunds_credit.outstanding_credit)}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Credit Orders</span><strong>{data.refunds_credit.credit_orders}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Overdue Amount</span><strong>{money(data.refunds_credit.overdue_amount)}</strong></div>
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-base">Consumption & Profitability</CardTitle></CardHeader>
        <CardContent className="mx-auto w-full max-w-2xl space-y-3">
          <div className="flex justify-between"><span>Net Sales</span><strong>{money(data.profitability.net_sales)}</strong></div>
          <div className="flex justify-between text-muted-foreground"><span>Consumption Cost</span><span>- {money(data.profitability.consumption_cost)}</span></div>
          <div className="flex justify-between border-t pt-3"><span className="font-semibold">Gross Profit</span><strong>{money(data.profitability.gross_profit)}</strong></div>
          <div className="flex justify-between text-muted-foreground"><span>Operating Expenses</span><span>- {money(data.profitability.operating_expenses)}</span></div>
          <div className="flex justify-between border-t pt-3 text-lg"><span className="font-bold">NET PROFIT</span><strong>{money(data.profitability.net_profit)}</strong></div>
          <div className="grid gap-3 border-t pt-3 sm:grid-cols-3">
            <div><p className="text-xs text-muted-foreground">Gross Margin</p><strong>{data.profitability.gross_margin}%</strong></div>
            <div><p className="text-xs text-muted-foreground">Net Margin</p><strong>{data.profitability.net_margin}%</strong></div>
            <div><p className="text-xs text-muted-foreground">Consumption Cost %</p><strong>{data.profitability.consumption_percent}%</strong></div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-base">Daily Finance Closing</CardTitle><CardDescription>Finance-control checklist for the selected period.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          {[
            ["Sales Posted", data.daily_closing.sales_posted, "Posted"],
            ["Cashier Sessions Closed", data.daily_closing.closed_sessions === data.daily_closing.total_sessions, `${data.daily_closing.closed_sessions} / ${data.daily_closing.total_sessions}`],
            ["Payment Reconciliation", data.daily_closing.payment_reconciliation, data.daily_closing.payment_reconciliation ? "Reconciled" : "Review"],
            ["Refund Review", data.daily_closing.refund_reviewed === data.daily_closing.refund_total, `${data.daily_closing.refund_reviewed} / ${data.daily_closing.refund_total}`],
            ["Expense Posting", data.daily_closing.expense_posting, "Posted"],
            ["Cash Variance Review", data.daily_closing.cash_variance_review, data.daily_closing.cash_variance_review ? "Reviewed" : "Pending"],
          ].map(([label, ok, detail]) => (
            <div key={String(label)} className="flex items-center justify-between rounded-xl border px-3 py-2.5">
              <div className="flex items-center gap-2">
                {ok ? <CheckCircle2 className="h-4 w-4 text-muted-foreground" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}
                <span className="text-sm font-medium">{label}</span>
              </div>
              <span className="text-sm font-semibold">{detail}</span>
            </div>
          ))}
          <div className="mt-4 flex items-center justify-between border-t pt-4">
            <span className="font-bold">Daily Close Status</span>
            <Badge variant={data.daily_closing.status === "complete" ? "outline" : "destructive"} className="uppercase">
              {data.daily_closing.status}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
