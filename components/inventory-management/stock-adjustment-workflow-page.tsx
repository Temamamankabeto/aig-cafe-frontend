"use client";

import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Eye, PackageCheck, ShieldCheck, XCircle } from "lucide-react";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Item { id:number; name:string; sku?:string; base_unit:string; current_stock:number|string; average_purchase_price?:number|string }
interface Person { id:number; name:string }
interface InventoryTransaction { id:number; before_quantity?:number|string; after_quantity?:number|string; quantity?:number|string; created_at?:string }
interface Adjustment {
  id:number; quantity:number|string; reason:string; expiry_date?:string|null; status:string;
  requested_at?:string; validated_at?:string; approved_at?:string; rejected_at?:string;
  validation_note?:string|null; approval_note?:string|null; rejection_reason?:string|null;
  inventory_item?:Item; requester?:Person; validator?:Person; approver?:Person; rejector?:Person;
  transaction?:InventoryTransaction|null;
}

type ActionKind = "validate" | "approve" | "reject";
const rowsFrom = <T,>(body:any): T[] => Array.isArray(body?.data?.data) ? body.data.data : Array.isArray(body?.data) ? body.data : [];
const fmtDate = (value?:string|null) => value ? new Date(value).toLocaleString() : "-";
const statusLabel = (s:string) => s.replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase());

export function StockAdjustmentWorkflowPage() {
  const qc = useQueryClient();
  const role = normalizeRole(authService.getStoredRoles()[0] ?? authService.getStoredUser()?.role);
  const isStore = role === "stock-keeper";
  const isFb = role === "fb-controller";
  const isManager = role === "cafeteria-manager" || role === "general-admin";
  const prefix = isStore ? "/stock-keeper" : isFb ? "/food-controller" : "/manager";

  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [expiry, setExpiry] = useState("");
  const [detail, setDetail] = useState<Adjustment|null>(null);
  const [actionTarget, setActionTarget] = useState<Adjustment|null>(null);
  const [actionKind, setActionKind] = useState<ActionKind|null>(null);
  const [actionNote, setActionNote] = useState("");

  const items = useQuery({
    queryKey:["adjustment-items"], enabled:isStore,
    queryFn:async()=>rowsFrom<Item>((await api.get("/stock-keeper/inventory/items", {params:{per_page:100}})).data),
  });
  const requests = useQuery({
    queryKey:["stock-adjustment-requests", prefix],
    queryFn:async()=>rowsFrom<Adjustment>((await api.get(`${prefix}/stock-adjustment-requests`, {params:{per_page:100}})).data),
  });

  const selected = useMemo(()=>items.data?.find(x=>String(x.id)===itemId), [items.data,itemId]);
  const stats = useMemo(() => {
    const rows=requests.data??[];
    return {
      validation: rows.filter(r=>r.status==="pending_validation").length,
      approval: rows.filter(r=>r.status==="pending_approval").length,
      approved: rows.filter(r=>r.status==="approved").length,
      rejected: rows.filter(r=>r.status==="rejected").length,
    };
  }, [requests.data]);

  const refresh=()=>{
    qc.invalidateQueries({queryKey:["stock-adjustment-requests"]});
    qc.invalidateQueries({queryKey:["adjustment-items"]});
    qc.invalidateQueries({queryKey:["inventory"]});
  };

  const create=useMutation({
    mutationFn:async()=>api.post(`/stock-keeper/inventory/items/${itemId}/adjust`, {
      quantity:Number(quantity), reason:reason.trim(), expiry_date:Number(quantity)>0 && expiry ? expiry : null,
    }),
    onSuccess:(r)=>{ toast.success(r.data?.message||"Adjustment requested"); setQuantity(""); setReason(""); setExpiry(""); refresh(); },
    onError:(e:any)=>toast.error(e?.response?.data?.message||"Failed to request adjustment"),
  });

  const action=useMutation({
    mutationFn:async()=>{
      if(!actionTarget || !actionKind) throw new Error("No action selected");
      if(actionKind==="reject" && !actionNote.trim()) throw new Error("Rejection reason is required");
      return api.post(`${prefix}/stock-adjustment-requests/${actionTarget.id}/${actionKind}`,
        actionKind==="reject" ? {reason:actionNote.trim()} : {note:actionNote.trim() || null});
    },
    onSuccess:(r)=>{ toast.success(r.data?.message||"Adjustment updated"); closeAction(); setDetail(null); refresh(); },
    onError:(e:any)=>toast.error(e?.response?.data?.message||e?.message||"Action failed"),
  });

  function submit(e:FormEvent){
    e.preventDefault();
    if(!itemId || !quantity || Number(quantity)===0 || !reason.trim()) return;
    create.mutate();
  }
  function openAction(row:Adjustment, kind:ActionKind){ setActionTarget(row); setActionKind(kind); setActionNote(""); }
  function closeAction(){ setActionTarget(null); setActionKind(null); setActionNote(""); }
  const projected = selected && quantity ? Number(selected.current_stock)+Number(quantity) : null;

  return <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-semibold">Stock Adjustment Workflow</h1>
      <p className="text-sm text-muted-foreground">Store Keeper Request → F&amp;B Controller Validate → Manager Approve → Stock Updated.</p>
    </div>

    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Card><CardContent className="flex items-center gap-3 p-4"><ShieldCheck className="h-5 w-5"/><div><p className="text-xs text-muted-foreground">Pending Validation</p><p className="text-xl font-semibold">{stats.validation}</p></div></CardContent></Card>
      <Card><CardContent className="flex items-center gap-3 p-4"><PackageCheck className="h-5 w-5"/><div><p className="text-xs text-muted-foreground">Pending Approval</p><p className="text-xl font-semibold">{stats.approval}</p></div></CardContent></Card>
      <Card><CardContent className="flex items-center gap-3 p-4"><CheckCircle2 className="h-5 w-5"/><div><p className="text-xs text-muted-foreground">Approved</p><p className="text-xl font-semibold">{stats.approved}</p></div></CardContent></Card>
      <Card><CardContent className="flex items-center gap-3 p-4"><XCircle className="h-5 w-5"/><div><p className="text-xs text-muted-foreground">Rejected</p><p className="text-xl font-semibold">{stats.rejected}</p></div></CardContent></Card>
    </div>

    {isStore && <Card>
      <CardHeader><CardTitle>Request Stock Adjustment</CardTitle><CardDescription>Use positive quantity to increase stock and negative quantity to decrease it. Submission does not change stock.</CardDescription></CardHeader>
      <CardContent><form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2"><Label>Inventory item</Label><Select value={itemId} onValueChange={setItemId}><SelectTrigger><SelectValue placeholder="Select item"/></SelectTrigger><SelectContent>{items.data?.map(i=><SelectItem key={i.id} value={String(i.id)}>{i.name} ({i.current_stock} {i.base_unit})</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label>Adjustment quantity (+ / -)</Label><Input required type="number" step="0.001" value={quantity} onChange={e=>setQuantity(e.target.value)}/>{selected&&<p className="text-xs text-muted-foreground">Current: {selected.current_stock} {selected.base_unit}{projected!==null?` • After approval: ${projected} ${selected.base_unit}`:""}</p>}</div>
        <div className="space-y-2"><Label>Expiry date (positive adjustment only)</Label><Input type="date" disabled={Number(quantity)<0} value={Number(quantity)<0?"":expiry} onChange={e=>setExpiry(e.target.value)}/></div>
        <div className="space-y-2"><Label>Reason</Label><Textarea required value={reason} onChange={e=>setReason(e.target.value)} placeholder="Physical count variance, correction, damaged/expired correction, etc."/></div>
        <div className="md:col-span-2"><Button disabled={create.isPending||!itemId||Number(quantity)===0}>{create.isPending?"Submitting...":"Submit for F&B Validation"}</Button></div>
      </form></CardContent>
    </Card>}

    <Card>
      <CardHeader><CardTitle>{isStore?"My Adjustment Requests":isFb?"Stock Adjustment Validation":"Stock Adjustment Approvals"}</CardTitle><CardDescription>Stock changes only when Manager approves an F&amp;B-validated request. Rejection never changes stock.</CardDescription></CardHeader>
      <CardContent className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Request</th><th className="p-2">Item</th><th className="p-2">Requested By</th><th className="p-2">Quantity</th><th className="p-2">Reason</th><th className="p-2">Status</th><th className="p-2">Action</th></tr></thead><tbody>
        {(requests.data??[]).map(r=><tr key={r.id} className="border-b align-top"><td className="p-2 font-medium">ADJ-{r.id}</td><td className="p-2">{r.inventory_item?.name??"-"}</td><td className="p-2">{r.requester?.name??"-"}</td><td className="p-2 font-medium">{Number(r.quantity)>0?"+":""}{r.quantity} {r.inventory_item?.base_unit}</td><td className="p-2 max-w-[260px]">{r.reason}</td><td className="p-2"><Badge variant={r.status==="approved"?"default":r.status==="rejected"?"destructive":"secondary"}>{statusLabel(r.status)}</Badge></td><td className="p-2"><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={()=>setDetail(r)}><Eye className="mr-1 h-4 w-4"/>Details</Button>{isFb&&r.status==="pending_validation"&&<><Button size="sm" onClick={()=>openAction(r,"validate")}>Validate</Button><Button size="sm" variant="destructive" onClick={()=>openAction(r,"reject")}>Reject</Button></>}{isManager&&r.status==="pending_approval"&&<><Button size="sm" onClick={()=>openAction(r,"approve")}>Review &amp; Approve</Button><Button size="sm" variant="destructive" onClick={()=>openAction(r,"reject")}>Reject</Button></>}</div></td></tr>)}
        {!requests.isLoading && !(requests.data??[]).length && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No stock adjustment requests found.</td></tr>}
      </tbody></table></CardContent>
    </Card>

    <Dialog open={!!detail} onOpenChange={open=>!open&&setDetail(null)}>
      <DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Stock Adjustment Details {detail?`• ADJ-${detail.id}`:""}</DialogTitle><DialogDescription>Complete request, validation, approval and stock-posting information.</DialogDescription></DialogHeader>
        {detail&&<div className="space-y-5 text-sm">
          <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2"><Info label="Item" value={`${detail.inventory_item?.name??"-"}${detail.inventory_item?.sku?` (${detail.inventory_item.sku})`:""}`}/><Info label="Current Stock" value={`${detail.inventory_item?.current_stock??"-"} ${detail.inventory_item?.base_unit??""}`}/><Info label="Adjustment" value={`${Number(detail.quantity)>0?"+":""}${detail.quantity} ${detail.inventory_item?.base_unit??""}`}/><Info label="Status" value={statusLabel(detail.status)}/><Info label="Reason" value={detail.reason}/><Info label="Expiry Date" value={detail.expiry_date?new Date(detail.expiry_date).toLocaleDateString():"-"}/></div>
          <div className="grid gap-3 sm:grid-cols-3"><Stage title="Requested" person={detail.requester?.name} date={detail.requested_at}/><Stage title="F&B Validation" person={detail.validator?.name} date={detail.validated_at} note={detail.validation_note}/><Stage title="Manager Approval" person={detail.approver?.name} date={detail.approved_at} note={detail.approval_note}/></div>
          {detail.status==="rejected"&&<div className="rounded-lg border p-4"><p className="font-medium">Rejected by {detail.rejector?.name??"-"}</p><p className="mt-1 text-muted-foreground">{detail.rejection_reason??"-"}</p><p className="mt-1 text-xs text-muted-foreground">{fmtDate(detail.rejected_at)}</p></div>}
          {detail.transaction&&<div className="rounded-lg border p-4"><p className="font-medium">Posted Inventory Transaction</p><p className="mt-1 text-muted-foreground">Transaction #{detail.transaction.id}: {detail.transaction.before_quantity??"-"} → {detail.transaction.after_quantity??"-"} {detail.inventory_item?.base_unit??""}</p></div>}
        </div>}
      </DialogContent>
    </Dialog>

    <Dialog open={!!actionTarget&&!!actionKind} onOpenChange={open=>!open&&closeAction()}>
      <DialogContent className="max-w-xl"><DialogHeader><DialogTitle>{actionKind==="validate"?"Validate Stock Adjustment":actionKind==="approve"?"Manager Approval":"Reject Stock Adjustment"}</DialogTitle><DialogDescription>{actionKind==="approve"?"Review the request before approval. Stock will be updated immediately after this approval.":actionKind==="validate"?"F&B validation sends the request to Manager. Stock remains unchanged.":"Rejecting the request leaves stock unchanged."}</DialogDescription></DialogHeader>
        {actionTarget&&<div className="space-y-4"><div className="grid gap-2 rounded-lg border p-4 text-sm sm:grid-cols-2"><Info label="Request" value={`ADJ-${actionTarget.id}`}/><Info label="Item" value={actionTarget.inventory_item?.name??"-"}/><Info label="Requested By" value={actionTarget.requester?.name??"-"}/><Info label="Quantity" value={`${Number(actionTarget.quantity)>0?"+":""}${actionTarget.quantity} ${actionTarget.inventory_item?.base_unit??""}`}/><div className="sm:col-span-2"><Info label="Reason" value={actionTarget.reason}/></div>{actionKind==="approve"&&<><Info label="F&B Validated By" value={actionTarget.validator?.name??"-"}/><Info label="Validation Note" value={actionTarget.validation_note??"-"}/></>}</div>
          <div className="space-y-2"><Label>{actionKind==="reject"?"Rejection reason *":actionKind==="validate"?"Validation note (optional)":"Approval note (optional)"}</Label><Textarea value={actionNote} onChange={e=>setActionNote(e.target.value)} placeholder={actionKind==="reject"?"Enter the reason for rejection...":"Add a note..."}/></div>
        </div>}
        <DialogFooter><Button variant="outline" onClick={closeAction}>Cancel</Button><Button variant={actionKind==="reject"?"destructive":"default"} disabled={action.isPending||(actionKind==="reject"&&!actionNote.trim())} onClick={()=>action.mutate()}>{action.isPending?"Processing...":actionKind==="validate"?"Validate & Send to Manager":actionKind==="approve"?"Approve & Update Stock":"Reject Request"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}

function Info({label,value}:{label:string;value:string}){ return <div><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium">{value}</p></div>; }
function Stage({title,person,date,note}:{title:string;person?:string;date?:string;note?:string|null}){ return <div className="rounded-lg border p-3"><p className="font-medium">{title}</p><p className="mt-1 text-sm">{person??"Pending"}</p><p className="text-xs text-muted-foreground">{fmtDate(date)}</p>{note&&<p className="mt-2 text-xs text-muted-foreground">{note}</p>}</div>; }
