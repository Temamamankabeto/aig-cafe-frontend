"use client";

import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/api";
import { authService } from "@/services/auth/auth.service";
import { normalizeRole } from "@/config/dashboard.config";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface Item { id:number; name:string; sku?:string; base_unit:string; current_stock:number|string }
interface Person { id:number; name:string }
interface Adjustment { id:number; quantity:number|string; reason:string; expiry_date?:string|null; status:string; requested_at?:string; validated_at?:string; approved_at?:string; rejection_reason?:string|null; inventory_item?:Item; requester?:Person; validator?:Person; approver?:Person }

const rowsFrom = <T,>(body:any): T[] => Array.isArray(body?.data?.data) ? body.data.data : Array.isArray(body?.data) ? body.data : [];

export function StockAdjustmentWorkflowPage() {
  const qc=useQueryClient();
  const role=normalizeRole(authService.getStoredRoles()[0] ?? authService.getStoredUser()?.role);
  const isStore=role === "stock-keeper";
  const isFb=role === "fb-controller";
  const isManager=role === "cafeteria-manager" || role === "general-admin";
  const prefix=isStore?"/stock-keeper":isFb?"/food-controller":"/manager";
  const [itemId,setItemId]=useState(""); const [quantity,setQuantity]=useState(""); const [reason,setReason]=useState(""); const [expiry,setExpiry]=useState("");

  const items=useQuery({queryKey:["adjustment-items"],enabled:isStore,queryFn:async()=>rowsFrom<Item>((await api.get("/stock-keeper/inventory/items",{params:{per_page:100}})).data)});
  const requests=useQuery({queryKey:["stock-adjustment-requests",prefix],queryFn:async()=>rowsFrom<Adjustment>((await api.get(`${prefix}/stock-adjustment-requests`,{params:{per_page:100}})).data)});
  const selected=useMemo(()=>items.data?.find(x=>String(x.id)===itemId),[items.data,itemId]);
  const refresh=()=>{ qc.invalidateQueries({queryKey:["stock-adjustment-requests"]}); qc.invalidateQueries({queryKey:["adjustment-items"]}); qc.invalidateQueries({queryKey:["inventory"]}); };
  const create=useMutation({mutationFn:async()=>api.post(`/stock-keeper/inventory/items/${itemId}/adjust`,{quantity:Number(quantity),reason:reason.trim(),expiry_date:expiry||null}),onSuccess:(r)=>{toast.success(r.data?.message||"Adjustment requested");setQuantity("");setReason("");setExpiry("");refresh()},onError:(e:any)=>toast.error(e?.response?.data?.message||"Failed to request adjustment")});
  const action=useMutation({mutationFn:async({id,kind}:{id:number;kind:"validate"|"approve"|"reject"})=>{const note=kind==="reject"?(window.prompt("Rejection reason")||""): (window.prompt(kind==="validate"?"Validation note (optional)":"Approval note (optional)")||""); if(kind==="reject"&&!note) throw new Error("Rejection reason is required"); return api.post(`${prefix}/stock-adjustment-requests/${id}/${kind}`,kind==="reject"?{reason:note}:{note});},onSuccess:(r)=>{toast.success(r.data?.message||"Adjustment updated");refresh()},onError:(e:any)=>toast.error(e?.response?.data?.message||e?.message||"Action failed")});

  function submit(e:FormEvent){e.preventDefault(); if(!itemId||!quantity||!reason.trim()) return; create.mutate();}
  const statusLabel=(s:string)=>s.replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase());

  return <div className="space-y-6">
    <div><h1 className="text-2xl font-semibold">Stock Adjustment Workflow</h1><p className="text-sm text-muted-foreground">Store Keeper request → F&B Controller validation → Manager approval → stock update.</p></div>
    {isStore && <Card><CardHeader><CardTitle>Request Stock Adjustment</CardTitle><CardDescription>Submitting a request does not change stock. Stock changes only after Manager approval.</CardDescription></CardHeader><CardContent><form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2"><Label>Inventory item</Label><Select value={itemId} onValueChange={setItemId}><SelectTrigger><SelectValue placeholder="Select item"/></SelectTrigger><SelectContent>{items.data?.map(i=><SelectItem key={i.id} value={String(i.id)}>{i.name} ({i.current_stock} {i.base_unit})</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label>Adjustment quantity (+ / -)</Label><Input required type="number" step="0.001" value={quantity} onChange={e=>setQuantity(e.target.value)}/>{selected&&<p className="text-xs text-muted-foreground">Current stock: {selected.current_stock} {selected.base_unit}</p>}</div>
      <div className="space-y-2"><Label>Expiry date (positive adjustment only)</Label><Input type="date" value={expiry} onChange={e=>setExpiry(e.target.value)}/></div>
      <div className="space-y-2"><Label>Reason</Label><Textarea required value={reason} onChange={e=>setReason(e.target.value)} placeholder="Physical count variance, correction, etc."/></div>
      <div className="md:col-span-2"><Button disabled={create.isPending||!itemId}>Submit for F&B Validation</Button></div>
    </form></CardContent></Card>}
    <Card><CardHeader><CardTitle>{isStore?"My Adjustment Requests":isFb?"Adjustments Awaiting Validation":"Stock Adjustment Approvals"}</CardTitle><CardDescription>Stock remains unchanged for Pending Validation, Pending Approval and Rejected requests.</CardDescription></CardHeader><CardContent className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">#</th><th className="p-2">Item</th><th className="p-2">Requested By</th><th className="p-2">Quantity</th><th className="p-2">Reason</th><th className="p-2">Status</th><th className="p-2">Validated By</th><th className="p-2">Approved By</th><th className="p-2">Action</th></tr></thead><tbody>
      {(requests.data??[]).map(r=><tr key={r.id} className="border-b align-top"><td className="p-2">ADJ-{r.id}</td><td className="p-2 font-medium">{r.inventory_item?.name??"-"}</td><td className="p-2">{r.requester?.name??"-"}</td><td className="p-2">{Number(r.quantity)>0?"+":""}{r.quantity} {r.inventory_item?.base_unit}</td><td className="p-2 max-w-[260px]">{r.reason}</td><td className="p-2"><Badge variant={r.status==="approved"?"default":r.status==="rejected"?"destructive":"secondary"}>{statusLabel(r.status)}</Badge></td><td className="p-2">{r.validator?.name??"-"}</td><td className="p-2">{r.approver?.name??"-"}</td><td className="p-2"><div className="flex gap-2">{isFb&&r.status==="pending_validation"&&<><Button size="sm" onClick={()=>action.mutate({id:r.id,kind:"validate"})}>Validate</Button><Button size="sm" variant="destructive" onClick={()=>action.mutate({id:r.id,kind:"reject"})}>Reject</Button></>}{isManager&&r.status==="pending_approval"&&<><Button size="sm" onClick={()=>action.mutate({id:r.id,kind:"approve"})}>Approve & Update Stock</Button><Button size="sm" variant="destructive" onClick={()=>action.mutate({id:r.id,kind:"reject"})}>Reject</Button></>}</div></td></tr>)}
      {!requests.isLoading && !(requests.data??[]).length && <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">No stock adjustment requests found.</td></tr>}
    </tbody></table></CardContent></Card>
  </div>;
}
