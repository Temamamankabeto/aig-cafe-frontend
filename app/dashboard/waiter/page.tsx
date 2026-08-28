"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, PlusCircle, RefreshCcw, Search, Users } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

type Data={
 user:{id:number|string;name:string};
 summary:{my_tables:number;occupied_tables:number;active_orders:number;ready_orders:number;today_orders:number};
 tables:Array<{id:number;table_number:string;status:string;capacity:number;guests:number;order_id?:number|null;order_number?:string|null;total:number;order_status?:string|null}>;
 ready_to_serve:Array<{id:number;order_number:string;table?:string|null;source:string;status:string}>;
 requires_attention:string[];
 active_orders:Array<{id:number;order_number:string;table?:string|null;total:number;kitchen_status?:string|null;bar_status?:string|null;status:string;ordered_at?:string|null}>;
};
type Resp={success:boolean;data?:Data};
const mf=new Intl.NumberFormat("en-US",{style:"currency",currency:"ETB",maximumFractionDigits:0});const money=(v:unknown)=>mf.format(Number(v||0));
const titleize=(v:string|null|undefined)=>v? v.replace(/_/g," ").replace(/\b\w/g,m=>m.toUpperCase()):"—";

export default function WaiterDashboardPage(){
 const qc=useQueryClient();const [search,setSearch]=useState("");
 const q=useQuery({queryKey:["waiter-dashboard-v2"],queryFn:async()=>unwrap<Resp>(await api.get("/waiter/dashboard")),refetchInterval:15000,staleTime:5000});
 const serve=useMutation({mutationFn:async(id:number)=>api.post(`/waiter/orders/${id}/serve`),onSuccess:async()=>qc.invalidateQueries({queryKey:["waiter-dashboard-v2"]})});
 const d=q.data?.data;
 const active=useMemo(()=>{if(!d)return[];const t=search.trim().toLowerCase();return d.active_orders.filter(o=>!t||`${o.order_number} ${o.table??""}`.toLowerCase().includes(t))},[d,search]);
 if(q.isLoading&&!d)return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({length:8}).map((_,i)=><Skeleton key={i} className="h-32 rounded-2xl"/>)}</div>;
 if(q.isError||!d)return <Alert variant="destructive"><AlertTriangle className="h-4 w-4"/><AlertTitle>Waiter dashboard could not be loaded</AlertTitle><AlertDescription><Button size="sm" variant="outline" onClick={()=>q.refetch()}>Retry</Button></AlertDescription></Alert>;

 return <div className="space-y-6 pb-8">
  <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><div><div className="flex items-center gap-2"><Users className="h-5 w-5 text-primary"/><p className="text-sm font-medium text-primary">Waiter Operations</p></div><h1 className="mt-1 text-2xl font-bold">Waiter Dashboard</h1><p className="text-sm text-muted-foreground">{d.user.name} · Live table and order service</p></div><div className="flex flex-wrap gap-2"><Button asChild><Link href="/dashboard/order-management/orders/create"><PlusCircle className="mr-2 h-4 w-4"/>New Order</Link></Button><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"/><Input className="w-[220px] pl-9" placeholder="Order / Table" value={search} onChange={e=>setSearch(e.target.value)}/></div><Button variant="outline" onClick={()=>q.refetch()}><RefreshCcw className={`mr-2 h-4 w-4 ${q.isFetching?"animate-spin":""}`}/>Refresh</Button></div></section>
  <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
   ["My Tables",d.summary.my_tables,`${d.summary.occupied_tables} occupied`],
   ["Active Orders",d.summary.active_orders,"In progress"],
   ["Ready",d.summary.ready_orders,"Serve now"],
   ["Today Orders",d.summary.today_orders,"My orders"],
  ].map(([l,v,n])=><Card key={String(l)} className="rounded-2xl"><CardContent className="p-5"><p className="text-sm text-muted-foreground">{l}</p><p className="mt-2 text-3xl font-bold">{v}</p><p className="text-xs text-muted-foreground">{n}</p></CardContent></Card>)}</section>

  <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">My Tables</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{d.tables.map(t=><Card key={t.id} className="rounded-xl"><CardContent className="p-4"><div className="flex justify-between"><strong>Table {t.table_number}</strong><Badge variant="outline">{titleize(t.status)}</Badge></div>{t.order_id?<><p className="mt-3 text-sm">{t.guests||"—"} Guests</p><p className="text-sm font-medium">{t.order_number}</p><p className="text-lg font-bold">{money(t.total)}</p><Button className="mt-3 w-full" size="sm" variant={t.status==="ready"?"default":"outline"} onClick={()=>t.status==="ready"&&t.order_id&&serve.mutate(t.order_id)}>{t.status==="ready"?"Serve":"View"}</Button></>:<><p className="mt-8 text-sm text-muted-foreground">Available for a new order.</p><Button className="mt-3 w-full" size="sm" asChild><Link href="/dashboard/order-management/orders/create">+ Order</Link></Button></>}</CardContent></Card>)}</CardContent></Card>

  <section className="grid gap-4 xl:grid-cols-2"><Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Ready to Serve</CardTitle></CardHeader><CardContent className="space-y-2">{d.ready_to_serve.map(r=><div key={r.id} className="flex items-center justify-between rounded-xl border px-3 py-2.5"><div><p className="text-sm font-medium">{r.order_number} · T-{r.table??"—"}</p><p className="text-xs text-muted-foreground">{r.source}</p></div><Button size="sm" onClick={()=>serve.mutate(r.id)} disabled={serve.isPending}>Mark Served</Button></div>)}{!d.ready_to_serve.length&&<p className="text-sm text-muted-foreground">Nothing is ready to serve.</p>}</CardContent></Card><Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Requires Attention</CardTitle></CardHeader><CardContent className="space-y-2">{d.requires_attention.map((r,i)=><div key={i} className="flex gap-2 rounded-xl border px-3 py-2.5 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 text-muted-foreground"/><span>{r}</span></div>)}{!d.requires_attention.length&&<p className="text-sm text-muted-foreground">No urgent waiter actions.</p>}</CardContent></Card></section>

  <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">My Active Orders</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[780px] text-sm"><thead><tr className="border-b"><th className="px-3 py-3 text-left">Order</th><th className="px-3 py-3 text-left">Table</th><th className="px-3 py-3 text-right">Total</th><th className="px-3 py-3 text-left">Kitchen</th><th className="px-3 py-3 text-left">Bar</th><th className="px-3 py-3 text-right">Status</th></tr></thead><tbody>{active.map(o=><tr key={o.id} className="border-b last:border-0"><td className="px-3 py-3 font-medium">{o.order_number}</td><td className="px-3 py-3">{o.table??"—"}</td><td className="px-3 py-3 text-right">{money(o.total)}</td><td className="px-3 py-3">{titleize(o.kitchen_status)}</td><td className="px-3 py-3">{titleize(o.bar_status)}</td><td className="px-3 py-3 text-right"><Badge variant="outline">{titleize(o.status)}</Badge></td></tr>)}</tbody></table></CardContent></Card>
 </div>
}
