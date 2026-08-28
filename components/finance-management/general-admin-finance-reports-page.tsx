"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Banknote, Download, RefreshCcw, TrendingUp, WalletCards } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import api, { unwrap } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Range = "today" | "7" | "30";

type FinanceData = {
  summary: {
    gross_sales: number; discounts: number; refunds: number; net_sales: number; expenses: number;
    consumption_cost: number; gross_profit: number; net_profit: number; profit_margin: number; payments: number;
    payment_transactions: number; cash_sales: number; cash_sales_percent: number; open_sessions: number; open_session_cash: number;
  };
  trend: Array<{ date: string; label: string; sales: number; profit: number }>;
  category_sales: Array<{ category: string; amount: number }>;
  payment_methods: Array<{ method: string; transactions: number; amount: number }>;
  cashier_sessions: Array<Record<string, any>>;
  recent_sales: Array<Record<string, any>>;
  expenses: Array<Record<string, any>>;
  consumption_by_category: Array<{ category: string; cost: number }>;
  top_consumption: Array<{ name: string; quantity: number; cost: number }>;
  alerts: Array<{ type: string; count: number; message: string }>;
};

type Envelope = { success: boolean; data: FinanceData; meta?: Record<string, unknown> };

const money = (v: unknown) => `ETB ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(Number(v ?? 0))}`;
const num = (v: unknown) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(Number(v ?? 0));

function Metric({ title, value, note }: { title: string; value: string; note?: string }) {
  return <Card className="rounded-2xl"><CardContent className="p-5"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p><p className="mt-2 text-2xl font-bold">{value}</p>{note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}</CardContent></Card>;
}

function Empty({ text = "No data for the selected period." }: { text?: string }) {
  return <div className="py-10 text-center text-sm text-muted-foreground">{text}</div>;
}

export function GeneralAdminFinanceReportsPage() {
  const [range, setRange] = useState<Range>("today");
  const [report, setReport] = useState("sales");
  const query = useQuery({
    queryKey: ["general-admin-finance-reports", range],
    queryFn: async () => unwrap<Envelope>(await api.get("/admin/general/finance-reports", { params: { range } })),
    staleTime: 30_000,
  });
  const data = query.data?.data;
  const s = data?.summary;

  const paymentRows = useMemo(() => {
    const total = data?.payment_methods.reduce((a, b) => a + Number(b.amount || 0), 0) ?? 0;
    return (data?.payment_methods ?? []).map((x) => ({ ...x, percent: total > 0 ? (Number(x.amount) / total) * 100 : 0 }));
  }, [data]);

  if (query.isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading Finance & Reports...</div>;
  if (query.isError || !data || !s) return <div className="p-6"><Card className="border-destructive/40"><CardContent className="flex items-center justify-between gap-4 p-6"><div><p className="font-semibold text-destructive">Finance & Reports could not be loaded</p><p className="mt-1 text-sm text-muted-foreground">{(query.error as any)?.response?.data?.message ?? "Please retry."}</p></div><Button variant="outline" onClick={() => query.refetch()}>Retry</Button></CardContent></Card></div>;

  return <div className="space-y-6 p-1 md:p-2">
    <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div><h1 className="text-2xl font-bold tracking-tight">Finance & Reports</h1><p className="text-sm text-muted-foreground">Monitor sales, expenses, payments, cashier sessions and profitability. This General Admin page is read-only for sensitive finance actions.</p></div>
      <div className="flex gap-2"><Select value={range} onValueChange={(v) => setRange(v as Range)}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="today">Today</SelectItem><SelectItem value="7">Last 7 days</SelectItem><SelectItem value="30">Last 30 days</SelectItem></SelectContent></Select><Button variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}><RefreshCcw className={`mr-2 h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} />Refresh</Button></div>
    </header>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Metric title="Gross Sales" value={money(s.gross_sales)} note={`Discounts ${money(s.discounts)} · Refunds ${money(s.refunds)}`} />
      <Metric title="Net Sales" value={money(s.net_sales)} note="Gross sales − discounts − refunds" />
      <Metric title="Expenses" value={money(s.expenses)} note="Operating expenses only" />
      <Metric title="Net Profit" value={money(s.net_profit)} note={`${num(s.profit_margin)}% margin`} />
      <Metric title="Payments" value={money(s.payments)} note={`${s.payment_transactions} transactions`} />
      <Metric title="Cash Sales" value={money(s.cash_sales)} note={`${num(s.cash_sales_percent)}% of paid sales`} />
      <Metric title="Consumption" value={money(s.consumption_cost)} note={s.net_sales > 0 ? `${num((s.consumption_cost / s.net_sales) * 100)}% of net sales` : "0% of net sales"} />
      <Metric title="Open Sessions" value={String(s.open_sessions)} note={`${money(s.open_session_cash)} opening cash`} />
    </section>

    <section className="grid gap-4 xl:grid-cols-3">
      <Card className="xl:col-span-2"><CardHeader><CardTitle>Sales / Profit Trend</CardTitle><CardDescription>Sales and net operating profit over the selected period.</CardDescription></CardHeader><CardContent className="h-80">{data.trend.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={data.trend}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="label"/><YAxis/><Tooltip formatter={(v) => money(v)}/><Line dataKey="sales" stroke="currentColor" strokeWidth={2} dot={false}/><Line dataKey="profit" stroke="currentColor" strokeWidth={2} strokeDasharray="5 5" dot={false}/></LineChart></ResponsiveContainer> : <Empty/>}</CardContent></Card>
      <Card><CardHeader><CardTitle>Revenue Breakdown</CardTitle><CardDescription>Sales by menu category.</CardDescription></CardHeader><CardContent className="h-80">{data.category_sales.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={data.category_sales} layout="vertical"><CartesianGrid strokeDasharray="3 3" horizontal={false}/><XAxis type="number" hide/><YAxis dataKey="category" type="category" width={90}/><Tooltip formatter={(v) => money(v)}/><Bar dataKey="amount" fill="currentColor" radius={[0,4,4,0]}/></BarChart></ResponsiveContainer> : <Empty/>}</CardContent></Card>
    </section>

    <Card><CardHeader><CardTitle>Payment Methods</CardTitle></CardHeader><CardContent><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{paymentRows.length ? paymentRows.map((x) => <div key={x.method} className="rounded-xl border p-4"><div className="flex items-center justify-between"><span className="font-medium capitalize">{x.method}</span><WalletCards className="h-4 w-4 text-muted-foreground"/></div><p className="mt-2 text-xl font-bold">{money(x.amount)}</p><p className="text-xs text-muted-foreground">{num(x.percent)}% · {x.transactions} txns</p></div>) : <Empty/>}</div></CardContent></Card>

    <Card><CardHeader><CardTitle>Cashier Sessions</CardTitle><CardDescription>Visibility into session control and discrepancies. No General Admin close-session privilege is added.</CardDescription></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Cashier</TableHead><TableHead>Session No</TableHead><TableHead>Opened</TableHead><TableHead>Closed</TableHead><TableHead>Opening Cash</TableHead><TableHead>Cash Sales</TableHead><TableHead>Non-Cash</TableHead><TableHead>Expected</TableHead><TableHead>Counted</TableHead><TableHead>Variance</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{data.cashier_sessions.map((x) => <TableRow key={x.id}><TableCell>{x.cashier}</TableCell><TableCell>{x.session_no}</TableCell><TableCell>{x.opened_at ? new Date(x.opened_at).toLocaleString() : "-"}</TableCell><TableCell>{x.closed_at ? new Date(x.closed_at).toLocaleString() : "-"}</TableCell><TableCell>{money(x.opening_cash)}</TableCell><TableCell>{money(x.cash_sales)}</TableCell><TableCell>{money(x.non_cash_sales)}</TableCell><TableCell>{money(x.expected_cash)}</TableCell><TableCell>{x.closing_cash == null ? "-" : money(x.closing_cash)}</TableCell><TableCell className={Number(x.variance || 0) < 0 ? "font-semibold text-destructive" : ""}>{x.variance == null ? "-" : money(x.variance)}</TableCell><TableCell><Badge variant={x.status === "open" ? "secondary" : "outline"}>{x.status}</Badge></TableCell></TableRow>)}</TableBody></Table></CardContent></Card>

    <section className="grid gap-4 xl:grid-cols-2">
      <Card><CardHeader><CardTitle>Recent Sales</CardTitle></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Order</TableHead><TableHead>Table</TableHead><TableHead>Cashier</TableHead><TableHead>Gross</TableHead><TableHead>Discount</TableHead><TableHead>Net</TableHead></TableRow></TableHeader><TableBody>{data.recent_sales.map((x) => <TableRow key={x.id}><TableCell>{x.order_number}</TableCell><TableCell>{x.table ?? "-"}</TableCell><TableCell>{x.cashier ?? "-"}</TableCell><TableCell>{money(x.subtotal)}</TableCell><TableCell>{money(x.discount)}</TableCell><TableCell>{money(x.total)}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
      <Card><CardHeader><CardTitle>Expenses</CardTitle><CardDescription>Read-only General Admin visibility.</CardDescription></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Reference</TableHead><TableHead>Category</TableHead><TableHead>Description</TableHead><TableHead>Amount</TableHead><TableHead>Recorded By</TableHead></TableRow></TableHeader><TableBody>{data.expenses.map((x, i) => <TableRow key={`${x.reference}-${i}`}><TableCell>{x.reference}</TableCell><TableCell>{x.category}</TableCell><TableCell>{x.description}</TableCell><TableCell>{money(x.amount)}</TableCell><TableCell>{x.recorded_by ?? "-"}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
    </section>

    <section className="grid gap-4 xl:grid-cols-2">
      <Card><CardHeader><CardTitle>Consumption Cost</CardTitle><CardDescription>Actual approved inventory consumption, not purchase estimates.</CardDescription></CardHeader><CardContent className="space-y-3"><div className="grid grid-cols-2 gap-3"><div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Total Consumption</p><p className="text-xl font-bold">{money(s.consumption_cost)}</p></div><div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Consumption / Net Sales</p><p className="text-xl font-bold">{s.net_sales > 0 ? `${num((s.consumption_cost/s.net_sales)*100)}%` : "0%"}</p></div></div>{data.consumption_by_category.map((x) => <div key={x.category} className="flex items-center justify-between border-b py-2 text-sm"><span>{x.category}</span><strong>{money(x.cost)}</strong></div>)}</CardContent></Card>
      <Card><CardHeader><CardTitle>Profitability</CardTitle><CardDescription>Restaurant-level profit bridge.</CardDescription></CardHeader><CardContent className="space-y-2 text-sm"><div className="flex justify-between"><span>Gross Sales</span><strong>{money(s.gross_sales)}</strong></div><div className="flex justify-between text-muted-foreground"><span>− Discounts</span><span>{money(s.discounts)}</span></div><div className="flex justify-between text-muted-foreground"><span>− Refunds</span><span>{money(s.refunds)}</span></div><div className="flex justify-between border-t pt-2"><span>Net Sales</span><strong>{money(s.net_sales)}</strong></div><div className="flex justify-between text-muted-foreground"><span>− Consumption Cost</span><span>{money(s.consumption_cost)}</span></div><div className="flex justify-between border-t pt-2"><span>Gross Profit</span><strong>{money(s.gross_profit)}</strong></div><div className="flex justify-between text-muted-foreground"><span>− Operating Expenses</span><span>{money(s.expenses)}</span></div><div className="flex justify-between border-t pt-3 text-base"><span className="font-semibold">Net Profit</span><strong>{money(s.net_profit)}</strong></div></CardContent></Card>
    </section>

    <Card className={data.alerts.length ? "border-amber-500/40" : ""}><CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5"/>Requires Attention</CardTitle><CardDescription>Financial and cashier exceptions requiring management review.</CardDescription></CardHeader><CardContent>{data.alerts.length ? <div className="grid gap-2 md:grid-cols-2">{data.alerts.map((a, i) => <div key={`${a.type}-${i}`} className="flex items-start gap-3 rounded-xl border p-3"><AlertTriangle className="mt-0.5 h-4 w-4"/><span className="text-sm">{a.message}</span></div>)}</div> : <p className="text-sm text-muted-foreground">No current finance exceptions.</p>}</CardContent></Card>

    <Card><CardHeader className="flex flex-row items-start justify-between gap-3"><div><CardTitle>Report Center</CardTitle><CardDescription>Drill-down reporting without navigating to unrelated screens.</CardDescription></div><div className="flex gap-2"><Button variant="outline" onClick={() => window.print()}><Download className="mr-2 h-4 w-4"/>PDF / Print</Button></div></CardHeader><CardContent><Tabs value={report} onValueChange={setReport}><TabsList className="mb-4 grid h-auto grid-cols-3 lg:grid-cols-6"><TabsTrigger value="sales">Sales</TabsTrigger><TabsTrigger value="orders">Orders</TabsTrigger><TabsTrigger value="inventory">Inventory</TabsTrigger><TabsTrigger value="consumption">Consumption</TabsTrigger><TabsTrigger value="procurement">Procurement</TabsTrigger><TabsTrigger value="finance">Finance</TabsTrigger></TabsList>
      <TabsContent value="sales"><div className="grid gap-3 md:grid-cols-3"><Metric title="Gross Sales" value={money(s.gross_sales)}/><Metric title="Net Sales" value={money(s.net_sales)}/><Metric title="Transactions" value={String(s.payment_transactions)}/></div></TabsContent>
      <TabsContent value="orders"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Order</TableHead><TableHead>Type/Status</TableHead><TableHead>Subtotal</TableHead><TableHead>Discount</TableHead><TableHead>Total</TableHead><TableHead>Payment</TableHead></TableRow></TableHeader><TableBody>{data.recent_sales.map((x) => <TableRow key={x.id}><TableCell>{x.order_number}</TableCell><TableCell>{x.status}</TableCell><TableCell>{money(x.subtotal)}</TableCell><TableCell>{money(x.discount)}</TableCell><TableCell>{money(x.total)}</TableCell><TableCell>{x.payment_status}</TableCell></TableRow>)}</TableBody></Table></div></TabsContent>
      <TabsContent value="inventory"><p className="text-sm text-muted-foreground">Inventory financial visibility is represented by approved consumption cost on this consolidated page. Detailed stock balance and valuation remain in Inventory to preserve existing workflows.</p></TabsContent>
      <TabsContent value="consumption"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Qty Used</TableHead><TableHead>Cost</TableHead></TableRow></TableHeader><TableBody>{data.top_consumption.map((x) => <TableRow key={x.name}><TableCell>{x.name}</TableCell><TableCell>{num(x.quantity)}</TableCell><TableCell>{money(x.cost)}</TableCell></TableRow>)}</TableBody></Table></div></TabsContent>
      <TabsContent value="procurement"><p className="text-sm text-muted-foreground">Procurement remains linked to the existing Purchase Approval and Inventory & Procurement workflows so this page does not duplicate or bypass approval logic.</p></TabsContent>
      <TabsContent value="finance"><div className="max-w-2xl space-y-2 text-sm"><div className="flex justify-between"><span>Revenue / Net Sales</span><strong>{money(s.net_sales)}</strong></div><div className="flex justify-between"><span>Consumption Cost</span><strong>{money(s.consumption_cost)}</strong></div><div className="flex justify-between"><span>Gross Profit</span><strong>{money(s.gross_profit)}</strong></div><div className="flex justify-between"><span>Operating Expenses</span><strong>{money(s.expenses)}</strong></div><div className="flex justify-between border-t pt-3 text-base"><span>NET PROFIT</span><strong>{money(s.net_profit)}</strong></div><div className="flex justify-between"><span>NET PROFIT MARGIN</span><strong>{num(s.profit_margin)}%</strong></div></div></TabsContent>
    </Tabs></CardContent></Card>
  </div>;
}
