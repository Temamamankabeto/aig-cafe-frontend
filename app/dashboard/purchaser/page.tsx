"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  PackageCheck,
  RefreshCcw,
  ShoppingCart,
  Store,
  TrendingUp,
  Truck,
  Users,
} from "lucide-react";

import api, { unwrap } from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

type Data = {
  filters: { suppliers: Array<{ id: number; name: string }> };
  kpis: {
    approved_pr: number; open_po: number; order_value: number; due_delivery: number;
    received_po: number; partial: number; suppliers: number; active_suppliers: number; price_change: number;
  };
  pipeline: Array<{ label: string; value: number }>;
  requires_attention: Array<{ label: string; count: number }>;
  approved_requests: Array<{ id: number; pr_number: string; department: string; items: number; estimated_amount: number; approved_by: string; age: string }>;
  active_purchase_orders: Array<{ id: number; po_number: string; supplier: string; amount: number; delivery: string; received_percent: number; status: string }>;
  purchase_spend: Array<{ category: string; amount: number }>;
  supplier_performance: Array<{ id: number; supplier: string; on_time_percent: number; orders: number }>;
  price_changes: Array<{ id: number; item: string; unit: string; previous: number; current: number; change: number; supplier: string }>;
};
type ApiResponse = { success: boolean; data?: Data; message?: string };

const moneyFmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "ETB", maximumFractionDigits: 0 });
const money = (v: unknown) => moneyFmt.format(Number(v || 0));
const titleize = (v: string) => v.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());

function Kpi({ title, value, note, icon: Icon }: { title: string; value: string; note: string; icon: React.ComponentType<{className?: string}> }) {
  return <Card className="rounded-2xl"><CardContent className="p-5">
    <div className="mb-4 w-fit rounded-xl bg-primary/10 p-2.5 text-primary"><Icon className="h-5 w-5"/></div>
    <p className="text-sm text-muted-foreground">{title}</p><p className="mt-1 text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{note}</p>
  </CardContent></Card>;
}

export default function PurchaserDashboardPage() {
  const [period, setPeriod] = useState("this_month");
  const [supplier, setSupplier] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");

  const query = useQuery({
    queryKey: ["purchaser-dashboard-v2", period, supplier, status, search],
    queryFn: async () => unwrap<ApiResponse>(await api.get("/purchaser/dashboard", { params: {
      period, supplier_id: supplier === "all" ? undefined : supplier,
      status: status === "all" ? undefined : status,
      search: search || undefined,
    }})),
    staleTime: 30_000, retry: 1,
  });
  const data = query.data?.data;
  const maxSpend = useMemo(() => Math.max(1, ...(data?.purchase_spend ?? []).map((r) => r.amount)), [data?.purchase_spend]);

  if (query.isLoading && !data) return <div className="space-y-5"><Skeleton className="h-20 rounded-2xl"/><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({length:8}).map((_,i)=><Skeleton key={i} className="h-32 rounded-2xl"/>)}</div></div>;
  if (query.isError || !data) return <Alert variant="destructive"><AlertTriangle className="h-4 w-4"/><AlertTitle>Purchaser dashboard could not be loaded</AlertTitle><AlertDescription className="mt-2"><Button size="sm" variant="outline" onClick={()=>query.refetch()}>Retry</Button></AlertDescription></Alert>;

  const cards = [
    {title:"Approved PR",value:String(data.kpis.approved_pr),note:"Ready for purchasing",icon:CheckCircle2},
    {title:"Open PO",value:String(data.kpis.open_po),note:"Active purchase orders",icon:ShoppingCart},
    {title:"Order Value",value:money(data.kpis.order_value),note:"Selected period",icon:TrendingUp},
    {title:"Due Delivery",value:String(data.kpis.due_delivery),note:"Needs action",icon:Clock3},
    {title:"Received PO",value:String(data.kpis.received_po),note:"Selected period",icon:PackageCheck},
    {title:"Partial",value:String(data.kpis.partial),note:"Partial deliveries",icon:Truck},
    {title:"Suppliers",value:String(data.kpis.suppliers),note:`${data.kpis.active_suppliers} active`,icon:Users},
    {title:"Price Change",value:String(data.kpis.price_change),note:"Review purchase costs",icon:AlertTriangle},
  ];

  return <div className="space-y-6 pb-8">
    <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div><p className="text-sm font-medium text-primary">Procurement operations</p><h1 className="mt-1 text-2xl font-bold md:text-3xl">Purchaser Dashboard</h1><p className="mt-1 text-sm text-muted-foreground">Approved requests, purchase orders, deliveries, supplier performance and purchase-cost changes.</p></div>
      <div className="flex flex-wrap gap-2">
        <Select value={period} onValueChange={setPeriod}><SelectTrigger className="w-[150px]"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="today">Today</SelectItem><SelectItem value="this_week">This Week</SelectItem><SelectItem value="this_month">This Month</SelectItem><SelectItem value="this_year">This Year</SelectItem></SelectContent></Select>
        <Select value={supplier} onValueChange={setSupplier}><SelectTrigger className="w-[180px]"><SelectValue placeholder="All Suppliers"/></SelectTrigger><SelectContent><SelectItem value="all">All Suppliers</SelectItem>{data.filters.suppliers.map(s=><SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent></Select>
        <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-[165px]"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All Statuses</SelectItem><SelectItem value="draft">Draft</SelectItem><SelectItem value="submitted">Submitted</SelectItem><SelectItem value="food_validated">Validated</SelectItem><SelectItem value="approved">Approved</SelectItem><SelectItem value="partially_received">Partial</SelectItem><SelectItem value="completed">Completed</SelectItem><SelectItem value="received">Received</SelectItem></SelectContent></Select>
        <Input className="w-[210px]" placeholder="Search..." value={search} onChange={e=>setSearch(e.target.value)}/>
        <Button variant="outline" onClick={()=>query.refetch()} disabled={query.isFetching}><RefreshCcw className={`mr-2 h-4 w-4 ${query.isFetching?"animate-spin":""}`}/>Refresh</Button>
      </div>
    </section>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(c=><Kpi key={c.title} {...c}/>)}</section>

    <section className="grid gap-4 xl:grid-cols-2">
      <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Procurement Pipeline</CardTitle></CardHeader><CardContent className="space-y-3">{data.pipeline.map((r,i)=><div key={r.label} className="flex items-center justify-between rounded-xl border px-3 py-2.5"><span className="text-sm font-medium">{r.label}</span><strong>{r.value}</strong></div>)}</CardContent></Card>
      <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Requires Attention</CardTitle></CardHeader><CardContent className="space-y-2">{data.requires_attention.map(r=><div key={r.label} className="flex items-center justify-between rounded-xl border px-3 py-2.5"><div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-muted-foreground"/><span className="text-sm">{r.label}</span></div><strong>{r.count}</strong></div>)}</CardContent></Card>
    </section>

    <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Approved Purchase Requests</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[780px] text-sm"><thead><tr className="border-b"><th className="px-3 py-3 text-left">PR No.</th><th className="px-3 py-3 text-left">Department</th><th className="px-3 py-3 text-right">Items</th><th className="px-3 py-3 text-right">Est. Amount</th><th className="px-3 py-3 text-left">Approved</th><th className="px-3 py-3 text-right">Age</th></tr></thead><tbody>{data.approved_requests.map(r=><tr key={r.id} className="border-b last:border-0"><td className="px-3 py-3 font-medium">{r.pr_number}</td><td className="px-3 py-3">{r.department}</td><td className="px-3 py-3 text-right">{r.items}</td><td className="px-3 py-3 text-right">{money(r.estimated_amount)}</td><td className="px-3 py-3">{r.approved_by}</td><td className="px-3 py-3 text-right">{r.age}</td></tr>)}</tbody></table></CardContent></Card>

    <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Active Purchase Orders</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead><tr className="border-b"><th className="px-3 py-3 text-left">PO No.</th><th className="px-3 py-3 text-left">Supplier</th><th className="px-3 py-3 text-right">Amount</th><th className="px-3 py-3 text-right">Delivery</th><th className="px-3 py-3 text-right">Received</th><th className="px-3 py-3 text-right">Status</th></tr></thead><tbody>{data.active_purchase_orders.map(r=><tr key={r.id} className="border-b last:border-0"><td className="px-3 py-3 font-medium">{r.po_number}</td><td className="px-3 py-3">{r.supplier}</td><td className="px-3 py-3 text-right">{money(r.amount)}</td><td className="px-3 py-3 text-right">{r.delivery}</td><td className="px-3 py-3 text-right">{r.received_percent}%</td><td className="px-3 py-3 text-right"><Badge variant="outline">{titleize(r.status)}</Badge></td></tr>)}</tbody></table></CardContent></Card>

    <section className="grid gap-4 xl:grid-cols-2">
      <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Purchase Spend</CardTitle></CardHeader><CardContent className="space-y-4">{data.purchase_spend.map(r=><div key={r.category}><div className="mb-1.5 flex justify-between text-sm"><span>{r.category}</span><strong>{money(r.amount)}</strong></div><Progress value={(r.amount/maxSpend)*100}/></div>)}</CardContent></Card>
      <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Supplier Performance</CardTitle></CardHeader><CardContent className="space-y-3">{data.supplier_performance.map(r=><div key={r.id} className="rounded-xl border p-3"><div className="flex justify-between text-sm"><span className="font-medium">{r.supplier}</span><strong>{r.on_time_percent}% On Time</strong></div><Progress className="mt-2" value={r.on_time_percent}/></div>)}</CardContent></Card>
    </section>

    <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Recent Purchase Price Changes</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead><tr className="border-b"><th className="px-3 py-3 text-left">Item</th><th className="px-3 py-3 text-right">Previous</th><th className="px-3 py-3 text-right">Current</th><th className="px-3 py-3 text-right">Change</th><th className="px-3 py-3 text-left">Supplier</th></tr></thead><tbody>{data.price_changes.map(r=><tr key={r.id} className="border-b last:border-0"><td className="px-3 py-3 font-medium">{r.item}</td><td className="px-3 py-3 text-right">{money(r.previous)}/{r.unit}</td><td className="px-3 py-3 text-right">{money(r.current)}/{r.unit}</td><td className="px-3 py-3 text-right font-semibold">{r.change>=0?"+":""}{r.change}%</td><td className="px-3 py-3">{r.supplier}</td></tr>)}</tbody></table></CardContent></Card>
  </div>;
}
