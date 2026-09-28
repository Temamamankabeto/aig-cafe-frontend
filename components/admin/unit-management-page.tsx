"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Plus, RefreshCcw, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import api from "@/lib/api";

type Unit = { id:number; name:string; symbol:string; is_active?:boolean };
type PageData = { data?:Unit[] };
const errorMessage=(e:unknown)=>e instanceof Error?e.message:"Request failed.";

export function UnitManagementPage(){
 const qc=useQueryClient();
 const [search,setSearch]=useState(""); const [name,setName]=useState(""); const [symbol,setSymbol]=useState("");
 const [editing,setEditing]=useState<Unit|null>(null); const [modalOpen,setModalOpen]=useState(false); const [menuId,setMenuId]=useState<number|null>(null);
 const menuRef=useRef<HTMLDivElement|null>(null);
 const query=useQuery({queryKey:["admin","units",search],queryFn:async()=>{const r=await api.get("/admin/units",{params:{search,per_page:100}});return r.data.data as PageData;}});
 const refresh=()=>qc.invalidateQueries({queryKey:["admin","units"]});
 const closeModal=()=>{setModalOpen(false);setEditing(null);setName("");setSymbol("");};
 const openCreate=()=>{setMenuId(null);setEditing(null);setName("");setSymbol("");setModalOpen(true);};
 const openEdit=(row:Unit)=>{setMenuId(null);setEditing(row);setName(row.name);setSymbol(row.symbol);setModalOpen(true);};
 const save=useMutation({mutationFn:async()=>editing?api.put(`/admin/units/${editing.id}`,{name:name.trim(),symbol:symbol.trim()}):api.post("/admin/units",{name:name.trim(),symbol:symbol.trim()}),onSuccess:r=>{toast.success(r.data.message||"Unit saved");closeModal();refresh();},onError:e=>toast.error(errorMessage(e))});
 const toggle=useMutation({mutationFn:async(row:Unit)=>api.put(`/admin/units/${row.id}`,{name:row.name,symbol:row.symbol,is_active:!(row.is_active??true)}),onSuccess:r=>{toast.success(r.data.message||"Unit updated");setMenuId(null);refresh();},onError:e=>toast.error(errorMessage(e))});
 function submit(e:FormEvent){e.preventDefault();if(name.trim()&&symbol.trim())save.mutate();}
 useEffect(()=>{const onDown=(e:MouseEvent)=>{if(menuRef.current&&!menuRef.current.contains(e.target as Node))setMenuId(null)};document.addEventListener("mousedown",onDown);return()=>document.removeEventListener("mousedown",onDown)},[]);
 useEffect(()=>{if(!modalOpen)return;const old=document.body.style.overflow;document.body.style.overflow="hidden";return()=>{document.body.style.overflow=old}},[modalOpen]);
 const rows=query.data?.data??[];
 return <div className="space-y-4">
  <header className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-bold">Units</h1><div className="flex gap-2"><Button variant="outline" onClick={()=>query.refetch()}><RefreshCcw className={`mr-2 h-4 w-4 ${query.isFetching?"animate-spin":""}`}/>Refresh</Button><Button onClick={openCreate}><Plus className="mr-2 h-4 w-4"/>Add Unit</Button></div></header>
  <div className="overflow-visible rounded-xl border bg-card">
   <div className="border-b p-4"><Input className="max-w-md" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search unit name or symbol"/></div>
   <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead className="w-16">#</TableHead><TableHead>Name</TableHead><TableHead>Symbol</TableHead><TableHead>Status</TableHead><TableHead className="w-20 text-right">Action</TableHead></TableRow></TableHeader><TableBody>{rows.map((row,i)=><TableRow key={row.id}><TableCell>{i+1}</TableCell><TableCell className="font-medium">{row.name}</TableCell><TableCell>{row.symbol}</TableCell><TableCell><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${(row.is_active??true)?"bg-muted text-foreground":"bg-destructive/10 text-destructive"}`}>{(row.is_active??true)?"Active":"Disabled"}</span></TableCell><TableCell className="relative text-right"><div className="relative inline-block" ref={menuId===row.id?menuRef:undefined}><Button variant="ghost" size="icon" aria-label={`Actions for ${row.name}`} onClick={()=>setMenuId(v=>v===row.id?null:row.id)}><MoreHorizontal className="h-4 w-4"/></Button>{menuId===row.id&&<div className="absolute right-0 z-50 mt-1 w-36 rounded-md border bg-popover p-1 text-left shadow-md"><button className="w-full rounded px-3 py-2 text-sm hover:bg-accent" onClick={()=>openEdit(row)}>Edit</button><button className="w-full rounded px-3 py-2 text-sm hover:bg-accent" onClick={()=>toggle.mutate(row)} disabled={toggle.isPending}>{(row.is_active??true)?"Disable":"Enable"}</button></div>}</div></TableCell></TableRow>)}</TableBody></Table></div>
  </div>
  {modalOpen&&<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4" onMouseDown={e=>{if(e.target===e.currentTarget)closeModal()}}><div className="w-full max-w-lg rounded-xl border bg-background shadow-2xl"><div className="flex items-center justify-between border-b px-6 py-4"><h2 className="text-lg font-semibold">{editing?"Edit Unit":"Add Unit"}</h2><Button type="button" variant="ghost" size="icon" onClick={closeModal}><X className="h-4 w-4"/></Button></div><form onSubmit={submit}><div className="space-y-4 p-6"><div className="space-y-2"><Label>Name</Label><Input autoFocus required maxLength={120} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Kilogram"/></div><div className="space-y-2"><Label>Symbol</Label><Input required maxLength={30} value={symbol} onChange={e=>setSymbol(e.target.value)} placeholder="e.g. kg"/></div></div><div className="flex justify-end gap-2 border-t px-6 py-4"><Button type="button" variant="outline" onClick={closeModal}>Cancel</Button><Button disabled={save.isPending||!name.trim()||!symbol.trim()}>{save.isPending?"Saving...":editing?"Update Unit":"Add Unit"}</Button></div></form></div></div>}
 </div>;
}
