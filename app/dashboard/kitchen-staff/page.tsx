"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ChefHat, RefreshCcw, Search } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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


export default function KitchenStaffDashboardPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");

  const query = useQuery({
    queryKey: ["kitchen-live-dashboard"],
    queryFn: async () => unwrap<ApiResponse>(await api.get("/kitchen/dashboard")),
    refetchInterval: 15_000,
    staleTime: 5_000,
  });

  const action = useMutation({
    mutationFn: async ({ id, action }: { id: number; action: "accept" | "ready" }) =>
      api.post(`/kitchen/tickets/${id}/${action}`),
    onSuccess: async () => qc.invalidateQueries({ queryKey: ["kitchen-live-dashboard"] }),
  });

  const data = query.data?.data;
  const orders = useMemo(() => {
    if (!data) return [];
    const term = search.trim().toLowerCase();
    return data.orders.filter((order) => {
      const matchesStatus = status === "all" || order.status === status;
      const matchesSearch = !term || `${order.order_number} ${order.table ?? ""} ${order.waiter ?? ""}`.toLowerCase().includes(term);
      return matchesStatus && matchesSearch;
    });
  }, [data, status, search]);

  if (query.isLoading && !data) return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{Array.from({length:8}).map((_,i)=><Skeleton key={i} className="h-64 rounded-2xl"/>)}</div>;
  if (query.isError || !data) return <Alert variant="destructive"><AlertTriangle className="h-4 w-4"/><AlertTitle>Kitchen display could not be loaded</AlertTitle><AlertDescription><Button variant="outline" size="sm" onClick={()=>query.refetch()}>Retry</Button></AlertDescription></Alert>;

  return <div className="space-y-5 pb-8">
    <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div><div className="flex items-center gap-2"><ChefHat className="h-5 w-5 text-primary"/><p className="text-sm font-medium text-primary">Kitchen Display</p><Badge variant="outline">● LIVE</Badge></div><h1 className="mt-1 text-2xl font-bold">Kitchen Display</h1><p className="text-sm text-muted-foreground">Average preparation: {data.summary.avg_prep_minutes} min</p></div>
      <div className="flex flex-wrap gap-2"><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"/><Input className="w-[220px] pl-9" placeholder="Order / Table..." value={search} onChange={e=>setSearch(e.target.value)}/></div><Button variant="outline" onClick={()=>query.refetch()} disabled={query.isFetching}><RefreshCcw className={`mr-2 h-4 w-4 ${query.isFetching?"animate-spin":""}`}/>Refresh</Button></div>
    </section>

    <section className="flex flex-wrap gap-2">{[
      ["all",`All Orders ${data.summary.active}`],["new",`New ${data.summary.new}`],["preparing",`Preparing ${data.summary.preparing}`],["ready",`Ready ${data.summary.ready}`],["delayed",`Delayed ${data.summary.delayed}`]
    ].map(([v,l])=><Button key={v} variant={status===v?"default":"outline"} size="sm" onClick={()=>setStatus(v)}>{l}</Button>)}</section>

    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {orders.map(order=><Card key={order.order_id} className={`rounded-2xl ${order.age_minutes>20?"border-destructive/50":""}`}><CardContent className="p-5">
        <div className="flex items-center justify-between"><Badge variant={order.status==="delayed"?"destructive":"outline"} className="uppercase">{order.status}</Badge><span className="text-sm font-semibold">{order.age_minutes}m</span></div>
        <h2 className="mt-3 text-lg font-bold">{order.order_number}</h2><p className="text-sm text-muted-foreground">Table {order.table??"—"} · Waiter: {order.waiter??"—"}</p>
        <div className="mt-4 space-y-2">{order.tickets.map(t=><div key={t.id} className="rounded-xl border p-2.5"><div className="flex justify-between text-sm"><span className="font-medium">{t.quantity} {t.item}</span><Badge variant="outline">{t.status}</Badge></div>{t.note&&<p className="mt-1 text-xs text-muted-foreground">NOTE: {t.note}</p>}</div>)}</div>
        {order.age_minutes>20&&<p className="mt-3 text-sm font-semibold text-destructive">⚠ Over 20 minutes</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          {order.tickets.filter(t=>["pending","confirmed"].includes(t.status)).map(t=><Button key={`a-${t.id}`} size="sm" disabled={action.isPending} onClick={()=>action.mutate({id:t.id,action:"accept"})}>Start {t.item}</Button>)}
          {order.tickets.filter(t=>t.status==="preparing").map(t=><Button key={`r-${t.id}`} size="sm" variant="outline" disabled={action.isPending} onClick={()=>action.mutate({id:t.id,action:"ready"})}>Mark {t.item} Ready</Button>)}
        </div>
      </CardContent></Card>)}
      {!orders.length&&<p className="col-span-full py-12 text-center text-sm text-muted-foreground">No kitchen orders match the selected filter.</p>}
    </section>

    <Card className="rounded-2xl"><CardContent className="grid gap-4 p-5 sm:grid-cols-3 lg:grid-cols-6">{[
      ["Active Orders",data.summary.active],["New",data.summary.new],["Preparing",data.summary.preparing],["Ready",data.summary.ready],["Delayed",data.summary.delayed],["Avg Prep",`${data.summary.avg_prep_minutes} min`]
    ].map(([l,v])=><div key={String(l)}><p className="text-xs text-muted-foreground">{l}</p><p className="mt-1 text-xl font-bold">{v}</p></div>)}</CardContent></Card>
  </div>;
}
