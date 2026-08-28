"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle, Boxes, ClipboardList, PackageCheck, RefreshCcw,
  RotateCcw, SlidersHorizontal, TrendingUp, Truck, Warehouse
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
  kpis:{stock_items:number;healthy_items:number;stock_value:number;low_stock:number;out_of_stock:number;receiving:number;issues_today:number;issues_value:number;returns:number;transfers:number};
  stock_health:{healthy:number;low:number;critical:number;out_of_stock:number};
  requires_attention:Array<{label:string;count:number}>;
  stock_balance:Array<{id:number;item:string;category:string;on_hand:number;unit:string;minimum:number;value:number;status:string}>;
  movements:Array<{id:number;reference:string;item:string;movement:string;quantity:number;unit:string;direction:string}>;
  expected_receiving:Array<{id:number;po_number:string;supplier:string;expected_date:string|null;status:string}>;
  issue_requests:Array<{request_number:string;department:string;items:number;requested_by:string;status:string}>;
  receivings:Array<{id:number;grn:string;po:string;supplier:string;ordered:number;received:number;difference:number;status:string}>;
  low_stock_items:Array<{id:number;item:string;current:number;minimum:number;reorder_qty:number;unit:string;status:string}>;
  physical_count:{items_due:number;counted:number;remaining:number;variances:number;configured:boolean};
  summary:{received:number;issued:number;returned:number;adjusted:number;net_movement:number};
};
type Resp={success:boolean;data?:Data;message?:string};
const mf=new Intl.NumberFormat("en-US",{style:"currency",currency:"ETB",maximumFractionDigits:0}); const money=(v:unknown)=>mf.format(Number(v||0));
const titleize=(v:string)=>v.replace(/_/g," ").replace(/\b\w/g,m=>m.toUpperCase());

function Kpi({title,value,note,icon:Icon}:{title:string;value:string;note:string;icon:React.ComponentType<{className?:string}>}){return <Card className="rounded-2xl"><CardContent className="p-5"><div className="mb-4 w-fit rounded-xl bg-primary/10 p-2.5 text-primary"><Icon className="h-5 w-5"/></div><p className="text-sm text-muted-foreground">{title}</p><p className="mt-1 text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{note}</p></CardContent></Card>}

export default function StockKeeperDashboardPage(){
  const [period,setPeriod]=useState("today"); const [search,setSearch]=useState("");
  const q=useQuery({queryKey:["stock-keeper-dashboard-v2",period,search],queryFn:async()=>unwrap<Resp>(await api.get("/stock-keeper/dashboard",{params:{period,search:search||undefined}})),staleTime:30000,retry:1});
  const d=q.data?.data;
  if(q.isLoading&&!d)return <div className="space-y-5"><Skeleton className="h-20 rounded-2xl"/><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({length:8}).map((_,i)=><Skeleton key={i} className="h-32 rounded-2xl"/>)}</div></div>;
  if(q.isError||!d)return <Alert variant="destructive"><AlertTriangle className="h-4 w-4"/><AlertTitle>Store Keeper dashboard could not be loaded</AlertTitle><AlertDescription className="mt-2"><Button size="sm" variant="outline" onClick={()=>q.refetch()}>Retry</Button></AlertDescription></Alert>;

  const cards=[
    {title:"Stock Items",value:String(d.kpis.stock_items),note:`${d.kpis.healthy_items} healthy`,icon:Boxes},
    {title:"Stock Value",value:money(d.kpis.stock_value),note:"Current inventory value",icon:TrendingUp},
    {title:"Low Stock",value:String(d.kpis.low_stock),note:"Reorder required",icon:AlertTriangle},
    {title:"Out of Stock",value:String(d.kpis.out_of_stock),note:"Critical",icon:Warehouse},
    {title:"Receiving",value:String(d.kpis.receiving),note:"Expected deliveries",icon:PackageCheck},
    {title:"Issues",value:String(d.kpis.issues_today),note:money(d.kpis.issues_value),icon:ClipboardList},
    {title:"Returns",value:String(d.kpis.returns),note:"Selected period",icon:RotateCcw},
    {title:"Transfers",value:String(d.kpis.transfers),note:"Selected period",icon:Truck},
  ];

  return <div className="space-y-6 pb-8">
    <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><div><p className="text-sm font-medium text-primary">Store operations</p><h1 className="mt-1 text-2xl font-bold md:text-3xl">Store Keeper Dashboard</h1><p className="mt-1 text-sm text-muted-foreground">Stock health, receiving, issues, returns, movements and reorder control.</p></div><div className="flex flex-wrap gap-2"><Select value={period} onValueChange={setPeriod}><SelectTrigger className="w-[150px]"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="today">Today</SelectItem><SelectItem value="this_week">This Week</SelectItem><SelectItem value="this_month">This Month</SelectItem><SelectItem value="this_year">This Year</SelectItem></SelectContent></Select><Input className="w-[220px]" placeholder="Search Item..." value={search} onChange={e=>setSearch(e.target.value)}/><Button variant="outline" onClick={()=>q.refetch()} disabled={q.isFetching}><RefreshCcw className={`mr-2 h-4 w-4 ${q.isFetching?"animate-spin":""}`}/>Refresh</Button></div></section>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(c=><Kpi key={c.title} {...c}/>)}</section>

    <section className="grid gap-4 xl:grid-cols-2"><Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Stock Health</CardTitle></CardHeader><CardContent className="space-y-4">{[["Healthy",d.stock_health.healthy],["Low",d.stock_health.low],["Critical",d.stock_health.critical],["Out of Stock",d.stock_health.out_of_stock]].map(([l,v])=><div key={String(l)}><div className="mb-1.5 flex justify-between text-sm"><span>{l}</span><strong>{v}</strong></div><Progress value={d.kpis.stock_items?Number(v)/d.kpis.stock_items*100:0}/></div>)}</CardContent></Card><Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Requires Attention</CardTitle></CardHeader><CardContent className="space-y-2">{d.requires_attention.map(r=><div key={r.label} className="flex items-center justify-between rounded-xl border px-3 py-2.5"><div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-muted-foreground"/><span className="text-sm">{r.label}</span></div><strong>{r.count}</strong></div>)}</CardContent></Card></section>

    <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Stock Balance</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[820px] text-sm"><thead><tr className="border-b"><th className="px-3 py-3 text-left">Item</th><th className="px-3 py-3 text-left">Category</th><th className="px-3 py-3 text-right">On Hand</th><th className="px-3 py-3 text-right">Min</th><th className="px-3 py-3 text-right">Value</th><th className="px-3 py-3 text-right">Status</th></tr></thead><tbody>{d.stock_balance.map(r=><tr key={r.id} className="border-b last:border-0"><td className="px-3 py-3 font-medium">{r.item}</td><td className="px-3 py-3">{r.category}</td><td className="px-3 py-3 text-right">{r.on_hand} {r.unit}</td><td className="px-3 py-3 text-right">{r.minimum} {r.unit}</td><td className="px-3 py-3 text-right">{money(r.value)}</td><td className="px-3 py-3 text-right"><Badge variant="outline">{titleize(r.status)}</Badge></td></tr>)}</tbody></table></CardContent></Card>

    <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Stock Movement</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[800px] text-sm"><thead><tr className="border-b"><th className="px-3 py-3 text-left">Reference</th><th className="px-3 py-3 text-left">Item</th><th className="px-3 py-3 text-left">Movement</th><th className="px-3 py-3 text-right">Qty</th><th className="px-3 py-3 text-left">From → To</th></tr></thead><tbody>{d.movements.map(r=><tr key={r.id} className="border-b last:border-0"><td className="px-3 py-3 font-medium">{r.reference}</td><td className="px-3 py-3">{r.item}</td><td className="px-3 py-3">{r.movement}</td><td className="px-3 py-3 text-right">{r.quantity} {r.unit}</td><td className="px-3 py-3">{r.direction}</td></tr>)}</tbody></table></CardContent></Card>

    <section className="grid gap-4 xl:grid-cols-2"><Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Expected Receiving</CardTitle></CardHeader><CardContent className="space-y-2">{d.expected_receiving.map(r=><div key={r.id} className="grid grid-cols-[auto_1fr_auto] gap-3 rounded-xl border px-3 py-2.5 text-sm"><span className="font-medium">{r.po_number}</span><span>{r.supplier}</span><span>{r.expected_date??"—"}</span></div>)}</CardContent></Card><Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Issue Requests</CardTitle></CardHeader><CardContent className="space-y-2">{d.issue_requests.map(r=><div key={r.request_number} className="grid grid-cols-[auto_1fr_auto] gap-3 rounded-xl border px-3 py-2.5 text-sm"><span className="font-medium">{r.request_number}</span><span>{r.department} · {r.items} items</span><Badge variant="outline">{titleize(r.status)}</Badge></div>)}</CardContent></Card></section>

    <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Receiving / GRN</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[800px] text-sm"><thead><tr className="border-b"><th className="px-3 py-3 text-left">GRN</th><th className="px-3 py-3 text-left">PO</th><th className="px-3 py-3 text-left">Supplier</th><th className="px-3 py-3 text-right">Ordered</th><th className="px-3 py-3 text-right">Received</th><th className="px-3 py-3 text-right">Difference</th><th className="px-3 py-3 text-right">Status</th></tr></thead><tbody>{d.receivings.map(r=><tr key={r.id} className="border-b last:border-0"><td className="px-3 py-3 font-medium">{r.grn}</td><td className="px-3 py-3">{r.po}</td><td className="px-3 py-3">{r.supplier}</td><td className="px-3 py-3 text-right">{r.ordered}</td><td className="px-3 py-3 text-right">{r.received}</td><td className="px-3 py-3 text-right">{r.difference}</td><td className="px-3 py-3 text-right"><Badge variant="outline">{titleize(r.status)}</Badge></td></tr>)}</tbody></table></CardContent></Card>

    <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Low Stock / Reorder</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead><tr className="border-b"><th className="px-3 py-3 text-left">Item</th><th className="px-3 py-3 text-right">Current</th><th className="px-3 py-3 text-right">Minimum</th><th className="px-3 py-3 text-right">Reorder Qty</th><th className="px-3 py-3 text-right">Status</th></tr></thead><tbody>{d.low_stock_items.map(r=><tr key={r.id} className="border-b last:border-0"><td className="px-3 py-3 font-medium">{r.item}</td><td className="px-3 py-3 text-right">{r.current} {r.unit}</td><td className="px-3 py-3 text-right">{r.minimum} {r.unit}</td><td className="px-3 py-3 text-right">{r.reorder_qty} {r.unit}</td><td className="px-3 py-3 text-right"><Badge variant="outline">{titleize(r.status)}</Badge></td></tr>)}</tbody></table></CardContent></Card>

    <section className="grid gap-4 xl:grid-cols-2"><Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Physical Count</CardTitle><CardDescription>{d.physical_count.configured?"Current count cycle":"Physical-count scheduling is not configured yet."}</CardDescription></CardHeader><CardContent className="space-y-3 text-sm"><div className="flex justify-between"><span>Items Due</span><strong>{d.physical_count.items_due}</strong></div><div className="flex justify-between"><span>Counted</span><strong>{d.physical_count.counted}</strong></div><div className="flex justify-between"><span>Remaining</span><strong>{d.physical_count.remaining}</strong></div><div className="flex justify-between"><span>Recorded Variances</span><strong>{d.physical_count.variances}</strong></div></CardContent></Card><Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Today's Summary</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><div className="flex justify-between"><span>Received</span><strong>{money(d.summary.received)}</strong></div><div className="flex justify-between"><span>Issued</span><strong>{money(d.summary.issued)}</strong></div><div className="flex justify-between"><span>Returned</span><strong>{money(d.summary.returned)}</strong></div><div className="flex justify-between"><span>Adjusted</span><strong>{money(d.summary.adjusted)}</strong></div><div className="flex justify-between border-t pt-3"><span className="font-semibold">Net Movement</span><strong>{money(d.summary.net_movement)}</strong></div></CardContent></Card></section>
  </div>
}
