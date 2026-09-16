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
type ItemCategory={id:number;name:string;items_count?:number}; type PageData={data?:ItemCategory[]};
const message=(e:any)=>e?.response?.data?.message ?? (e instanceof Error?e.message:"Request failed.");
export function ItemCategoryManagementPage(){
 const qc=useQueryClient(); const [search,setSearch]=useState(""); const [name,setName]=useState(""); const [editing,setEditing]=useState<ItemCategory|null>(null);
 const query=useQuery({queryKey:["admin","item-categories",search],queryFn:async()=>{const r=await api.get("/admin/item-categories",{params:{search,per_page:100}});return r.data.data as PageData;}});
 const refresh=()=>qc.invalidateQueries({queryKey:["admin","item-categories"]}); const clear=()=>{setName("");setEditing(null)};
 const save=useMutation({mutationFn:()=>editing?api.put(`/admin/item-categories/${editing.id}`,{name:name.trim()}):api.post("/admin/item-categories",{name:name.trim()}),onSuccess:r=>{toast.success(r.data.message||"Category saved");clear();refresh();},onError:e=>toast.error(message(e))});
 const remove=useMutation({mutationFn:(id:number)=>api.delete(`/admin/item-categories/${id}`),onSuccess:r=>{toast.success(r.data.message||"Category deleted");refresh();},onError:e=>toast.error(message(e))});
 function submit(e:FormEvent){e.preventDefault();if(name.trim())save.mutate();}
 const rows=query.data?.data??[];
 return <div className="space-y-6"><header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-bold">Item Categories</h1><p className="mt-1 text-sm text-muted-foreground">Manage categories used by inventory items.</p></div><Button variant="outline" onClick={()=>query.refetch()}><RefreshCcw className={`mr-2 h-4 w-4 ${query.isFetching?"animate-spin":""}`}/>Refresh</Button></header><div className="grid gap-5 xl:grid-cols-[360px_1fr]"><Card><CardHeader><CardTitle>{editing?"Edit category":"Create category"}</CardTitle><CardDescription>Category ID is generated automatically.</CardDescription></CardHeader><CardContent><form onSubmit={submit} className="space-y-4"><div className="space-y-2"><Label>Name</Label><Input required maxLength={120} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Meat & Poultry"/></div><div className="flex gap-2"><Button disabled={save.isPending||!name.trim()}><Plus className="mr-2 h-4 w-4"/>{editing?"Update":"Create"}</Button>{editing&&<Button type="button" variant="outline" onClick={clear}>Cancel</Button>}</div></form></CardContent></Card><Card><CardHeader><CardTitle>Category list</CardTitle><CardDescription>Categories assigned to items cannot be deleted.</CardDescription></CardHeader><CardContent className="space-y-4"><Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search category name"/><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Name</TableHead><TableHead>Items</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{rows.map(row=><TableRow key={row.id}><TableCell>{row.id}</TableCell><TableCell className="font-medium">{row.name}</TableCell><TableCell>{row.items_count??0}</TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" onClick={()=>{setEditing(row);setName(row.name)}}><Edit className="h-4 w-4"/></Button><Button variant="ghost" size="icon" className="text-destructive" disabled={(row.items_count??0)>0||remove.isPending} onClick={()=>window.confirm(`Delete ${row.name}?`)&&remove.mutate(row.id)}><Trash2 className="h-4 w-4"/></Button></TableCell></TableRow>)}{!query.isLoading&&!rows.length&&<TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">No categories found.</TableCell></TableRow>}</TableBody></Table></div></CardContent></Card></div></div>;
}
