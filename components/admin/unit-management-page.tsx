"use client";
import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit, Plus, RefreshCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import api from "@/lib/api";

type Unit = { id: number; name: string; symbol: string };
type PageData = { data?: Unit[] };
const errorMessage = (e: unknown) => e instanceof Error ? e.message : "Request failed.";

export function UnitManagementPage() {
  const qc = useQueryClient(); const [search,setSearch]=useState(""); const [name,setName]=useState(""); const [symbol,setSymbol]=useState(""); const [editing,setEditing]=useState<Unit|null>(null);
  const query=useQuery({queryKey:["admin","units",search],queryFn:async()=>{const r=await api.get("/admin/units",{params:{search,per_page:100}}); return r.data.data as PageData;}});
  const refresh=()=>qc.invalidateQueries({queryKey:["admin","units"]});
  const save=useMutation({mutationFn:async()=> editing ? api.put(`/admin/units/${editing.id}`,{name:name.trim(),symbol:symbol.trim()}) : api.post("/admin/units",{name:name.trim(),symbol:symbol.trim()}),onSuccess:(r)=>{toast.success(r.data.message||"Unit saved");setName("");setSymbol("");setEditing(null);refresh();},onError:(e)=>toast.error(errorMessage(e))});
  const remove=useMutation({mutationFn:(id:number)=>api.delete(`/admin/units/${id}`),onSuccess:()=>{toast.success("Unit deleted");refresh();},onError:(e)=>toast.error(errorMessage(e))});
  function submit(e:FormEvent){e.preventDefault();if(name.trim()&&symbol.trim())save.mutate();}
  return <div className="space-y-6"><header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-bold">Units</h1><p className="mt-1 text-sm text-muted-foreground">Manage unit master data by ID, name, and symbol.</p></div><Button variant="outline" onClick={()=>query.refetch()}><RefreshCcw className={`mr-2 h-4 w-4 ${query.isFetching?"animate-spin":""}`}/>Refresh</Button></header><div className="grid gap-5 xl:grid-cols-[360px_1fr]"><Card><CardHeader><CardTitle>{editing?"Edit unit":"Create unit"}</CardTitle><CardDescription>Unit ID is generated automatically.</CardDescription></CardHeader><CardContent><form onSubmit={submit} className="space-y-4"><div className="space-y-2"><Label>Name</Label><Input required maxLength={120} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Kilogram"/></div><div className="space-y-2"><Label>Symbol</Label><Input required maxLength={30} value={symbol} onChange={e=>setSymbol(e.target.value)} placeholder="e.g. kg"/></div><div className="flex gap-2"><Button disabled={save.isPending||!name.trim()||!symbol.trim()}><Plus className="mr-2 h-4 w-4"/>{editing?"Update":"Create"}</Button>{editing&&<Button type="button" variant="outline" onClick={()=>{setEditing(null);setName("");setSymbol("")}}>Cancel</Button>}</div></form></CardContent></Card><Card><CardHeader><CardTitle>Unit list</CardTitle><CardDescription>Search, edit, and delete units.</CardDescription></CardHeader><CardContent className="space-y-4"><Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search unit name or symbol"/><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Name</TableHead><TableHead>Symbol</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{(query.data?.data??[]).map(row=><TableRow key={row.id}><TableCell>{row.id}</TableCell><TableCell className="font-medium">{row.name}</TableCell><TableCell>{row.symbol}</TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" aria-label={`Edit ${row.name}`} onClick={()=>{setEditing(row);setName(row.name);setSymbol(row.symbol)}}><Edit className="h-4 w-4"/></Button><Button variant="ghost" size="icon" className="text-destructive" aria-label={`Delete ${row.name}`} onClick={()=>window.confirm(`Delete ${row.name}?`)&&remove.mutate(row.id)}><Trash2 className="h-4 w-4"/></Button></TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card></div></div>;
}
