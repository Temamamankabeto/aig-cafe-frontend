"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  Clock3,
  CreditCard,
  FileText,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  WalletCards,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useCashierDashboardQuery } from "@/hooks/dashboard/use-cashier-dashboard";

const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "ETB",
  maximumFractionDigits: 0,
});
const money = (value: unknown) => moneyFormatter.format(Number(value || 0));
const label = (value: string) =>
  value.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

function time(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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
        <div className="mb-4 w-fit rounded-xl bg-primary/10 p-2.5 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{note}</p>
      </CardContent>
    </Card>
  );
}

export default function CashierDashboardPage() {
  const dashboard = useCashierDashboardQuery();
  const [search, setSearch] = useState("");
  const [billStatus, setBillStatus] = useState("all");
  const [orderType, setOrderType] = useState("all");

  const data = dashboard.data;

  const openBills = useMemo(() => {
    if (!data) return [];
    const term = search.trim().toLowerCase();

    return data.open_bills.filter((bill) => {
      const matchesSearch =
        !term ||
        bill.order_number.toLowerCase().includes(term) ||
        String(bill.table ?? "").toLowerCase().includes(term) ||
        String(bill.waiter ?? "").toLowerCase().includes(term);
      const matchesStatus = billStatus === "all" || bill.bill_status === billStatus;
      const matchesType = orderType === "all" || bill.order_type === orderType;
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [data, search, billStatus, orderType]);

  if (dashboard.isLoading && !data) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-24 rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    );
  }

  if (dashboard.isError || !data) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Cashier dashboard could not be loaded</AlertTitle>
        <AlertDescription className="mt-2">
          <Button size="sm" variant="outline" onClick={() => dashboard.refetch()}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const shift = data.current_shift;
  const cards = [
    { title: "Today Sales", value: money(data.summary.today_sales), note: shift ? "My Session" : "Today", icon: Banknote },
    { title: "Paid Orders", value: String(data.summary.paid_orders), note: shift ? "My Session" : "Today", icon: ReceiptText },
    { title: "Open Bills", value: String(data.summary.open_bills), note: money(data.summary.open_bills_amount), icon: Clock3 },
    { title: "Cash Sales", value: money(data.summary.cash_sales), note: `${data.summary.cash_share}%`, icon: Banknote },
    { title: "Non-Cash", value: money(data.summary.non_cash_sales), note: `${data.summary.non_cash_share}%`, icon: CreditCard },
    { title: "Discounts", value: money(data.summary.discounts), note: `${data.summary.discount_orders} orders`, icon: WalletCards },
    { title: "Refunds", value: money(data.summary.refunds), note: `${data.summary.refund_count} refunds`, icon: RotateCcw },
    { title: "Expected Cash", value: money(data.summary.expected_cash), note: "Current", icon: WalletCards },
  ];

  return (
    <div className="space-y-6 pb-8">
      <section className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Cashier operations</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">Cashier Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Payments, open bills, refunds and current cash-session control.
          </p>
        </div>
        <Button variant="outline" onClick={() => dashboard.refetch()} disabled={dashboard.isFetching}>
          <RefreshCw className={`mr-2 h-4 w-4 ${dashboard.isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </section>

      {shift ? (
        <Card className="rounded-2xl border-border/70">
          <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <span className="font-semibold">Session: {shift.session_number}</span>
              <Badge variant="outline" className="uppercase">{shift.status}</Badge>
              <span className="text-muted-foreground">Opened {time(shift.opened_at)}</span>
              <span>Opening Cash: <strong>{money(shift.opening_cash)}</strong></span>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/modules/cashier/shift">Manage Session</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Alert>
          <Clock3 className="h-4 w-4" />
          <AlertTitle>No open cashier session</AlertTitle>
          <AlertDescription className="mt-2 flex items-center justify-between gap-3">
            <span>Open a cash shift before collecting cash payments.</span>
            <Button size="sm" asChild><Link href="/dashboard/modules/cashier/shift">Open Session</Link></Button>
          </AlertDescription>
        </Alert>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => <KpiCard key={card.title} {...card} />)}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-base">Quick Actions</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Button className="h-14 justify-start" asChild><Link href="/dashboard/modules/cashier/payments"><CreditCard className="mr-2 h-5 w-5" />Pay Bill</Link></Button>
            <Button variant="outline" className="h-14 justify-start" asChild><Link href="/dashboard/modules/cashier/payments"><ReceiptText className="mr-2 h-5 w-5" />Open Bills</Link></Button>
            <Button variant="outline" className="h-14 justify-start" asChild><Link href="/dashboard/modules/cashier/payments"><FileText className="mr-2 h-5 w-5" />Reprint Receipt</Link></Button>
            <Button variant="outline" className="h-14 justify-start" asChild><Link href="/dashboard/modules/cashier/payments"><RotateCcw className="mr-2 h-5 w-5" />Refund Request</Link></Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-base">Session Status</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Session</span><strong>{shift?.session_number ?? "No active session"}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Opened</span><strong>{time(shift?.opened_at)}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Opening Cash</span><strong>{money(shift?.opening_cash)}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Cash Sales</span><strong>{money(shift?.cash_sales)}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Cash Refunds</span><strong>{money(shift?.cash_refunds)}</strong></div>
            <div className="flex justify-between border-t pt-3"><span className="font-semibold">Expected Cash</span><strong>{money(shift?.expected_cash)}</strong></div>
            <Button variant="outline" className="mt-2 w-full" asChild>
              <Link href="/dashboard/modules/cashier/shift">{shift ? "Close / Reconcile Session" : "Open Session"}</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Open / Unpaid Bills</CardTitle>
          <CardDescription>Orders ready for cashier collection.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap gap-2">
            <Input className="w-full sm:w-[260px]" placeholder="Search Order / Table..." value={search} onChange={(event) => setSearch(event.target.value)} />
            <Select value={billStatus} onValueChange={setBillStatus}><SelectTrigger className="w-[145px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="issued">Issued</SelectItem><SelectItem value="partial">Partial</SelectItem></SelectContent></Select>
            <Select value={orderType} onValueChange={setOrderType}><SelectTrigger className="w-[155px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Types</SelectItem><SelectItem value="dine_in">Dine-in</SelectItem><SelectItem value="takeaway">Takeaway</SelectItem><SelectItem value="delivery">Delivery</SelectItem></SelectContent></Select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead><tr className="border-b"><th className="px-3 py-3 text-left">Order</th><th className="px-3 py-3 text-left">Table</th><th className="px-3 py-3 text-left">Waiter</th><th className="px-3 py-3 text-right">Items</th><th className="px-3 py-3 text-right">Amount</th><th className="px-3 py-3 text-right">Age</th><th className="px-3 py-3 text-right">Action</th></tr></thead>
              <tbody>
                {openBills.length ? openBills.map((bill) => (
                  <tr key={bill.id} className="border-b last:border-0">
                    <td className="px-3 py-3 font-medium">{bill.order_number}</td>
                    <td className="px-3 py-3">{bill.table ?? "—"}</td>
                    <td className="px-3 py-3">{bill.waiter ?? "—"}</td>
                    <td className="px-3 py-3 text-right">{bill.items}</td>
                    <td className="px-3 py-3 text-right font-semibold">{money(bill.amount)}</td>
                    <td className="px-3 py-3 text-right">{bill.age_minutes} min</td>
                    <td className="px-3 py-3 text-right"><Button size="sm" asChild><Link href="/dashboard/modules/cashier/payments">Take Payment</Link></Button></td>
                  </tr>
                )) : <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">No unpaid bills match the selected filters.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-base">Recent Payments</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead><tr className="border-b"><th className="px-3 py-3 text-left">Receipt</th><th className="px-3 py-3 text-left">Order</th><th className="px-3 py-3 text-left">Method</th><th className="px-3 py-3 text-right">Amount</th><th className="px-3 py-3 text-right">Time</th><th className="px-3 py-3 text-right">Status</th></tr></thead>
            <tbody>{data.recent_payments.map((payment) => (
              <tr key={payment.id} className="border-b last:border-0">
                <td className="px-3 py-3 font-medium">{payment.receipt}</td><td className="px-3 py-3">{payment.order}</td><td className="px-3 py-3">{label(payment.method)}</td><td className="px-3 py-3 text-right">{money(payment.amount)}</td><td className="px-3 py-3 text-right">{time(payment.time)}</td><td className="px-3 py-3 text-right"><Badge variant="outline">{label(payment.status)}</Badge></td>
              </tr>
            ))}</tbody>
          </table>
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-base">Payment Methods</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {data.payment_methods.map((method) => (
              <div key={method.method}>
                <div className="mb-1.5 flex justify-between gap-3 text-sm"><span className="font-medium">{label(method.method)}</span><span>{money(method.amount)} · {method.share}%</span></div>
                <Progress value={method.share} />
              </div>
            ))}
            {!data.payment_methods.length && <p className="text-sm text-muted-foreground">No payments in the current session.</p>}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-base">Requires Attention</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.requires_attention.map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-xl border px-3 py-2.5">
                <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-muted-foreground" /><span className="text-sm">{item.label}</span></div>
                <strong>{item.count}</strong>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-base">My Shift Summary</CardTitle></CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span>Orders Paid</span><strong>{data.shift_summary.orders_paid}</strong></div>
            <div className="flex justify-between"><span>Discounted Orders</span><strong>{data.shift_summary.discount_orders}</strong></div>
            <div className="flex justify-between"><span>Refunds</span><strong>{data.shift_summary.refund_count}</strong></div>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span>Gross Sales</span><strong>{money(data.shift_summary.gross_sales)}</strong></div>
            <div className="flex justify-between text-muted-foreground"><span>- Discounts</span><span>{money(data.shift_summary.discounts)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>- Refunds</span><span>{money(data.shift_summary.refunds)}</span></div>
            <div className="flex justify-between border-t pt-3 text-base"><span className="font-bold">Net Collected</span><strong>{money(data.shift_summary.net_collected)}</strong></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
