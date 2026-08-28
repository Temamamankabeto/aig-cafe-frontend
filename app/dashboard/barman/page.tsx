"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, RefreshCcw, Search, Wine } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

type DisplayOrder = {
  order_id: number;
  order_number: string;
  table?: string | null;
  waiter?: string | null;
  status: string;
  age_minutes: number;
  tickets: Array<{ id: number; status: string; item: string; quantity: number; note?: string | null }>;
};
type DisplayData = {
  summary: { active: number; new: number; preparing: number; ready: number; delayed: number; avg_prep_minutes: number };
  orders: DisplayOrder[];
};
type ApiResponse = { success: boolean; data?: DisplayData; message?: string };

type BarData = DisplayData & { stock_alerts: Array<{id:number;item:string;quantity:number;unit:string}> };
type BarResponse = { success:boolean; data?:BarData };

export default function BarmanDashboardPage(){
  const qc=useQueryClient(); const [status,setStatus]=useState("all"); const [search,setSearch]=useState("");
  const query=useQuery({queryKey:["bar-live-dashboard"],queryFn:async()=>unwrap<BarResponse>(await api.get("/bar/dashboard")),refetchInterval:15000,staleTime:5000});
  const action=useMutation({mutationFn:async({id,action}:{id:number;action:"accept"|"ready"})=>api.post(`/bar/tickets/${id}/${action}`),onSuccess:async()=>qc.invalidateQueries({queryKey:["bar-live-dashboard"]})});
  const data=query.data?.data;
  const orders=useMemo(()=>{if(!data)return[];const term=search.trim().toLowerCase();return data.orders.filter(o=>(status==="all"||o.status===status)&&(!term||`${o.order_number} ${o.table??""}`.toLowerCase().includes(term)))},[data,status,search]);
  if(query.isLoading&&!data)return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{Array.from({length:8}).map((_,i)=><Skeleton key={i} className="h-64 rounded-2xl"/>)}</div>;
  if(query.isError||!data)return <Alert variant="destructive"><AlertTriangle className="h-4 w-4"/><AlertTitle>Bar display could not be loaded</AlertTitle><AlertDescription><Button size="sm" variant="outline" onClick={()=>query.refetch()}>Retry</Button></AlertDescription></Alert>;

  return <div className="space-y-5 pb-8">
    <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><div><div className="flex items-center gap-2"><Wine className="h-5 w-5 text-primary"/><p className="text-sm font-medium text-primary">Bar Display</p><Badge variant="outline">● LIVE</Badge></div><h1 className="mt-1 text-2xl font-bold">Bar Display</h1><p className="text-sm text-muted-foreground">Average preparation: {data.summary.avg_prep_minutes} min</p></div><div className="flex gap-2"><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"/><Input className="w-[220px] pl-9" placeholder="Order / Table..." value={search} onChange={e=>setSearch(e.target.value)}/></div><Button variant="outline" onClick={()=>query.refetch()}><RefreshCcw className={`mr-2 h-4 w-4 ${query.isFetching?"animate-spin":""}`}/>Refresh</Button></div></section>
    <section className="flex flex-wrap gap-2">{[["all",`All ${data.summary.active}`],["new",`New ${data.summary.new}`],["preparing",`Preparing ${data.summary.preparing}`],["ready",`Ready ${data.summary.ready}`],["delayed",`Delayed ${data.summary.delayed}`]].map(([v,l])=><Button key={v} size="sm" variant={status===v?"default":"outline"} onClick={()=>setStatus(v)}>{l}</Button>)}</section>
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{orders.map(o=><Card key={o.order_id} className={`rounded-2xl ${o.age_minutes>10?"border-destructive/50":""}`}><CardContent className="p-5"><div className="flex justify-between"><Badge variant={o.status==="delayed"?"destructive":"outline"} className="uppercase">{o.status}</Badge><span className="font-semibold">{o.age_minutes}m</span></div><h2 className="mt-3 text-lg font-bold">{o.order_number}</h2><p className="text-sm text-muted-foreground">Table {o.table??"—"}</p><div className="mt-4 space-y-2">{o.tickets.map(t=><div key={t.id} className="rounded-xl border p-2.5"><div className="flex justify-between text-sm"><span className="font-medium">{t.quantity} {t.item}</span><Badge variant="outline">{t.status}</Badge></div>{t.note&&<p className="mt-1 text-xs text-muted-foreground">NOTE: {t.note}</p>}</div>)}</div><div className="mt-4 flex flex-wrap gap-2">{o.tickets.filter(t=>["pending","confirmed"].includes(t.status)).map(t=><Button key={`a${t.id}`} size="sm" onClick={()=>action.mutate({id:t.id,action:"accept"})}>Start {t.item}</Button>)}{o.tickets.filter(t=>["preparing","delayed"].includes(t.status)).map(t=><Button key={`r${t.id}`} size="sm" variant="outline" onClick={()=>action.mutate({id:t.id,action:"ready"})}>Mark {t.item} Ready</Button>)}</div></CardContent></Card>)}</section>
    <section className="grid gap-4 xl:grid-cols-2"><Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Bar Queue</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-4 text-sm">{[["Active Tickets",data.summary.active],["New",data.summary.new],["Preparing",data.summary.preparing],["Ready",data.summary.ready],["Delayed",data.summary.delayed],["Average Prep",`${data.summary.avg_prep_minutes} min`]].map(([l,v])=><div key={String(l)} className="flex justify-between"><span className="text-muted-foreground">{l}</span><strong>{v}</strong></div>)}</CardContent></Card><Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Bar Stock Alerts</CardTitle></CardHeader><CardContent className="space-y-2">{data.stock_alerts.map(r=><div key={r.id} className="flex justify-between rounded-xl border px-3 py-2.5 text-sm"><span>⚠ {r.item}</span><strong>{r.quantity} {r.unit}</strong></div>)}{!data.stock_alerts.length&&<p className="text-sm text-muted-foreground">No low-stock beverage items.</p>}</CardContent></Card></section>
  </div>;
}
