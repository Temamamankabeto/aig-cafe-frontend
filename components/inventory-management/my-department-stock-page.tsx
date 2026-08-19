"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, PackageCheck, Plus, RotateCcw, Utensils } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatBaseQuantity } from "@/lib/inventory-management";
import inventoryService from "@/services/inventory-management/inventory.service";
import type { InventoryTransaction } from "@/types/inventory-management";

function message(error: unknown) {
  return error instanceof Error ? error.message : "The action could not be completed.";
}

export function MyDepartmentStockPage() {
  const client = useQueryClient();
  const [action, setAction] = useState<{ type: "use" | "return"; issue: InventoryTransaction } | null>(null);
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [requestOpen,setRequestOpen]=useState(false), [requestItem,setRequestItem]=useState(""), [requestQuantity,setRequestQuantity]=useState(""), [requestReason,setRequestReason]=useState("");
  const requestItems=useQuery({queryKey:["inventory-custody","request-items"],queryFn:()=>inventoryService.requestableStockItems()});
  const requests=useQuery({queryKey:["inventory-custody","stockout-requests"],queryFn:()=>inventoryService.myStockoutRequests()});
  const query = useQuery({ queryKey: ["inventory-custody", "my-issues"], queryFn: () => inventoryService.myDepartmentIssues({ per_page: 100 }) });
  const refresh = () => {
    client.invalidateQueries({ queryKey: ["inventory-custody", "my-issues"] });
    client.invalidateQueries({ queryKey: ["inventory-custody", "stockout-requests"] });
    client.invalidateQueries({ queryKey: ["consumption-report"] });
  };
  const acknowledge = useMutation({
    mutationFn: (id: number | string) => inventoryService.acknowledgeDepartmentIssue(id),
    onSuccess: () => { toast.success("Stock receipt acknowledged."); refresh(); },
    onError: (error) => toast.error(message(error)),
  });
  const submit = useMutation({
    mutationFn: () => {
      if (!action) throw new Error("Select an action.");
      return action.type === "use"
        ? inventoryService.recordDepartmentUse(action.issue.id, { quantity: Number(quantity), note: note.trim() || undefined })
        : inventoryService.requestDepartmentReturn(action.issue.id, { quantity: Number(quantity), reason: note.trim() });
    },
    onSuccess: (_, __, context) => {
      toast.success(action?.type === "use" ? "Consumption recorded." : "Return request sent to the Store Keeper.");
      setAction(null); setQuantity(""); setNote(""); refresh();
    },
    onError: (error) => toast.error(message(error)),
  });
  const rows = query.data?.data ?? [];
  const createRequest=useMutation({mutationFn:()=>inventoryService.createStockoutRequest({inventory_item_id:requestItem,quantity:Number(requestQuantity),reason:requestReason.trim()}),onSuccess:()=>{toast.success("Stock-out request submitted for validation.");setRequestOpen(false);setRequestItem("");setRequestQuantity("");setRequestReason("");client.invalidateQueries({queryKey:["inventory-custody","stockout-requests"]});},onError:(error)=>toast.error(message(error))});

  return <div className="space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="flex items-center gap-2 text-2xl font-bold"><PackageCheck className="h-6 w-6" />Stock & Consumption</h1><p className="mt-1 text-sm text-muted-foreground">Request stock, receive issued items, record consumption, and return unused quantities.</p></div><Button onClick={()=>setRequestOpen(true)}><Plus className="mr-2 h-4 w-4"/>Request stock</Button></header>
    <div className="overflow-x-auto rounded-xl border bg-card"><Table><TableHeader><TableRow><TableHead>Request</TableHead><TableHead>Item</TableHead><TableHead>Quantity</TableHead><TableHead>Reason</TableHead><TableHead>Status</TableHead><TableHead>Validation note</TableHead></TableRow></TableHeader><TableBody>{requests.isLoading?<TableRow><TableCell colSpan={6} className="py-8 text-center">Loading requests...</TableCell></TableRow>:(requests.data?.data??[]).length?(requests.data?.data??[]).map((row:any)=><TableRow key={row.id}><TableCell>{row.request_number}</TableCell><TableCell>{row.inventory_item?.name??row.inventoryItem?.name??"—"}</TableCell><TableCell>{formatBaseQuantity(row.quantity,row.inventory_item?.base_unit??row.inventoryItem?.base_unit??"pcs")}</TableCell><TableCell>{row.reason}</TableCell><TableCell><Badge variant="secondary">{row.status}</Badge></TableCell><TableCell>{row.validation_note??"—"}</TableCell></TableRow>):<TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No stock requests submitted.</TableCell></TableRow>}</TableBody></Table></div>
    <div className="overflow-x-auto rounded-xl border bg-card"><Table><TableHeader><TableRow><TableHead>Issue</TableHead><TableHead>Item</TableHead><TableHead>Department</TableHead><TableHead>Issued</TableHead><TableHead>Consumed</TableHead><TableHead>Available</TableHead><TableHead>Return requested</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>
    {query.isLoading ? <TableRow><TableCell colSpan={9} className="py-10 text-center text-muted-foreground">Loading assigned stock...</TableCell></TableRow> : rows.length ? rows.map((issue) => {
      const item = issue.inventory_item ?? issue.inventoryItem;
      const unit = item?.base_unit ?? item?.unit ?? "pcs";
      const available = Number(issue.available_quantity ?? 0);
      return <TableRow key={issue.id}><TableCell className="font-medium">#{issue.id}</TableCell><TableCell>{item?.name ?? "Item"}<span className="block text-xs text-muted-foreground">Issued by {issue.creator?.name ?? "Store Keeper"}</span></TableCell><TableCell>{issue.department?.name ?? "—"}</TableCell><TableCell>{formatBaseQuantity(issue.quantity, unit)}</TableCell><TableCell>{formatBaseQuantity(issue.used_quantity ?? 0, unit)}</TableCell><TableCell>{formatBaseQuantity(available, unit)}</TableCell><TableCell>{formatBaseQuantity(issue.return_requested_quantity ?? 0, unit)}</TableCell><TableCell><Badge variant="secondary" className="capitalize">{(issue.custody_status ?? "issued").replaceAll("_", " ")}</Badge></TableCell><TableCell className="text-right">{issue.custody_status === "issued" ? <Button size="sm" onClick={() => acknowledge.mutate(issue.id)} disabled={acknowledge.isPending}><CheckCircle2 className="mr-2 h-4 w-4" />Receive</Button> : available > 0 && issue.custody_status !== "return_requested" ? <div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => { setAction({ type: "use", issue }); setQuantity(""); setNote(""); }}><Utensils className="mr-2 h-4 w-4" />Consume</Button><Button size="sm" onClick={() => { setAction({ type: "return", issue }); setQuantity(""); setNote(""); }}><RotateCcw className="mr-2 h-4 w-4" />Return</Button></div> : <span className="text-sm text-muted-foreground">No action</span>}</TableCell></TableRow>;
    }) : <TableRow><TableCell colSpan={9} className="py-10 text-center text-muted-foreground">No department stock is assigned to you.</TableCell></TableRow>}
    </TableBody></Table></div>
    <Dialog open={requestOpen} onOpenChange={setRequestOpen}><DialogContent><DialogHeader><DialogTitle>Request stock from Main Store</DialogTitle><DialogDescription>The F&amp;B Controller validates this request before the Store Keeper can issue it.</DialogDescription></DialogHeader><div className="space-y-4"><div className="space-y-2"><Label>Inventory item</Label><Select value={requestItem} onValueChange={setRequestItem}><SelectTrigger><SelectValue placeholder="Select item"/></SelectTrigger><SelectContent>{(requestItems.data??[]).map((item:any)=><SelectItem key={item.id} value={String(item.id)}>{item.name} — {formatBaseQuantity(item.current_stock,item.base_unit)}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Requested quantity</Label><Input type="number" min="0.001" step="0.001" value={requestQuantity} onChange={event=>setRequestQuantity(event.target.value)}/></div><div className="space-y-2"><Label>Purpose / reason</Label><Textarea value={requestReason} onChange={event=>setRequestReason(event.target.value)} required/></div><div className="flex justify-end gap-2"><Button variant="outline" onClick={()=>setRequestOpen(false)}>Cancel</Button><Button disabled={!requestItem||Number(requestQuantity)<=0||!requestReason.trim()||createRequest.isPending} onClick={()=>createRequest.mutate()}>Submit request</Button></div></div></DialogContent></Dialog>
    <Dialog open={Boolean(action)} onOpenChange={(open) => !open && setAction(null)}><DialogContent><DialogHeader><DialogTitle>{action?.type === "use" ? "Record consumed quantity" : "Request return to store"}</DialogTitle><DialogDescription>{action?.issue.inventory_item?.name ?? action?.issue.inventoryItem?.name}</DialogDescription></DialogHeader>{action && <div className="space-y-4"><div className="space-y-2"><Label>Quantity</Label><Input type="number" min="0.001" max={Number(action.issue.available_quantity ?? 0)} step="0.001" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></div><div className="space-y-2"><Label>{action.type === "return" ? "Return reason" : "Consumption note"}</Label><Textarea value={note} onChange={(event) => setNote(event.target.value)} required={action.type === "return"} /></div><div className="flex gap-2"><Button onClick={() => submit.mutate()} disabled={submit.isPending || Number(quantity) <= 0 || Number(quantity) > Number(action.issue.available_quantity ?? 0) || (action.type === "return" && !note.trim())}>Submit</Button><Button variant="outline" onClick={() => setAction(null)}>Cancel</Button></div></div>}</DialogContent></Dialog>
  </div>;
}
