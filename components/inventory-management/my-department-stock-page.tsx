"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2, ChevronDown, ClipboardList, Filter, Layers3, PackageCheck, Plus, RotateCcw, Search, Utensils } from "lucide-react";
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


function formatDate(value: unknown) {
  if (!value) return "—";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function includesText(values: unknown[], term: string) {
  if (!term) return true;
  return values.some((value) => String(value ?? "").toLowerCase().includes(term));
}

export function MyDepartmentStockPage() {
  const client = useQueryClient();
  const [requestSearch, setRequestSearch] = useState("");
  const [issueSearch, setIssueSearch] = useState("");
  const [requestStatus, setRequestStatus] = useState("all");
  const [issueStatus, setIssueStatus] = useState("all");
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
  const requestRows: any[] = requests.data?.data ?? [];
  const createRequest=useMutation({mutationFn:()=>inventoryService.createStockoutRequest({inventory_item_id:requestItem,quantity:Number(requestQuantity),reason:requestReason.trim()}),onSuccess:()=>{toast.success("Stock-out request submitted for validation.");setRequestOpen(false);setRequestItem("");setRequestQuantity("");setRequestReason("");client.invalidateQueries({queryKey:["inventory-custody","stockout-requests"]});},onError:(error)=>toast.error(message(error))});

  const filteredRequests = useMemo(() => {
    const term = requestSearch.trim().toLowerCase();
    return requestRows.filter((row:any) =>
      (requestStatus === "all" || String(row.status ?? "").toLowerCase() === requestStatus) &&
      includesText([row.request_number, row.inventory_item?.name, row.inventoryItem?.name, row.reason, row.validation_note], term)
    );
  }, [requestRows, requestSearch, requestStatus]);

  const filteredIssues = useMemo(() => {
    const term = issueSearch.trim().toLowerCase();
    return rows.filter((issue:any) =>
      (issueStatus === "all" || String(issue.custody_status ?? "issued").toLowerCase() === issueStatus) &&
      includesText([issue.id, issue.inventory_item?.name, issue.inventoryItem?.name, issue.department?.name, issue.creator?.name], term)
    );
  }, [rows, issueSearch, issueStatus]);

  return <div className="space-y-5 pb-8">
    <header className="relative overflow-hidden rounded-2xl border bg-card px-5 py-5 shadow-sm sm:px-6">
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/3 bg-gradient-to-br from-orange-50/20 to-orange-100/60 lg:block" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-700">
            <PackageCheck className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Stock &amp; Consumption</h1>
            <p className="mt-1 text-sm text-muted-foreground">Request stock, receive issued items, record consumption, and return unused quantities.</p>
          </div>
        </div>
        <Button className="h-11 rounded-xl px-5 shadow-sm" onClick={()=>setRequestOpen(true)}><Plus className="mr-2 h-4 w-4"/>Request stock</Button>
      </div>
    </header>

    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="flex flex-col gap-4 border-b px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-orange-50 text-orange-700"><ClipboardList className="h-5 w-5"/></div>
          <div><h2 className="text-lg font-bold">Stock Requests</h2><p className="text-sm text-muted-foreground">View and track your stock requests</p></div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><Input value={requestSearch} onChange={e=>setRequestSearch(e.target.value)} placeholder="Search items, request no..." className="h-10 w-full rounded-xl pl-9 sm:w-[265px]"/></div>
          <div className="flex h-10 items-center gap-2 rounded-xl border px-3 text-sm text-muted-foreground"><CalendarDays className="h-4 w-4"/><span>All request dates</span><ChevronDown className="ml-2 h-4 w-4"/></div>
          <Select value={requestStatus} onValueChange={setRequestStatus}><SelectTrigger className="h-10 w-[145px] rounded-xl"><Filter className="mr-2 h-4 w-4"/><SelectValue placeholder="Filter"/></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="approved">Approved</SelectItem><SelectItem value="rejected">Rejected</SelectItem><SelectItem value="issued">Issued</SelectItem></SelectContent></Select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/35"><TableRow><TableHead className="w-14">#</TableHead><TableHead>Request No</TableHead><TableHead>Item</TableHead><TableHead>Quantity</TableHead><TableHead>Reason</TableHead><TableHead>Status</TableHead><TableHead>Validation Note</TableHead><TableHead>Request Date</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {requests.isLoading?<TableRow><TableCell colSpan={9} className="h-48 text-center text-muted-foreground">Loading requests...</TableCell></TableRow>:filteredRequests.length?filteredRequests.map((row:any,index:number)=><TableRow key={row.id} className="h-14"><TableCell>{index+1}</TableCell><TableCell className="font-semibold">{row.request_number??`#${row.id}`}</TableCell><TableCell>{row.inventory_item?.name??row.inventoryItem?.name??"—"}</TableCell><TableCell>{formatBaseQuantity(row.quantity,row.inventory_item?.base_unit??row.inventoryItem?.base_unit??"pcs")}</TableCell><TableCell className="max-w-[220px] truncate">{row.reason??"—"}</TableCell><TableCell><Badge variant="secondary" className="capitalize">{String(row.status??"pending").replaceAll("_"," ")}</Badge></TableCell><TableCell>{row.validation_note??"—"}</TableCell><TableCell>{formatDate(row.request_date??row.created_at)}</TableCell><TableCell className="text-right text-muted-foreground">—</TableCell></TableRow>):<TableRow><TableCell colSpan={9} className="h-56 text-center"><div className="mx-auto flex max-w-sm flex-col items-center"><div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-50 text-slate-400"><PackageCheck className="h-7 w-7"/></div><p className="mt-3 font-semibold">{requestSearch||requestStatus!=="all"?"No matching stock requests.":"No stock requests submitted yet."}</p><p className="mt-1 text-sm text-muted-foreground">Create a request to get the items you need.</p><Button className="mt-4 rounded-xl" onClick={()=>setRequestOpen(true)}><Plus className="mr-2 h-4 w-4"/>Request Stock</Button></div></TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </section>

    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="flex flex-col gap-4 border-b px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"><Layers3 className="h-5 w-5"/></div>
          <div><h2 className="text-lg font-bold">Issued Stock &amp; Consumption</h2><p className="text-sm text-muted-foreground">Track issued items, record consumption, and request returns.</p></div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><Input value={issueSearch} onChange={e=>setIssueSearch(e.target.value)} placeholder="Search items, department..." className="h-10 w-full rounded-xl pl-9 sm:w-[265px]"/></div>
          <div className="flex h-10 items-center gap-2 rounded-xl border px-3 text-sm text-muted-foreground"><CalendarDays className="h-4 w-4"/><span>All issue dates</span><ChevronDown className="ml-2 h-4 w-4"/></div>
          <Select value={issueStatus} onValueChange={setIssueStatus}><SelectTrigger className="h-10 w-[155px] rounded-xl"><Filter className="mr-2 h-4 w-4"/><SelectValue placeholder="Filter"/></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="issued">Issued</SelectItem><SelectItem value="received">Received</SelectItem><SelectItem value="in_use">In use</SelectItem><SelectItem value="return_requested">Return requested</SelectItem><SelectItem value="returned">Returned</SelectItem></SelectContent></Select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/35"><TableRow><TableHead className="w-14">#</TableHead><TableHead>Issue No</TableHead><TableHead>Item</TableHead><TableHead>Department</TableHead><TableHead>Issued</TableHead><TableHead>Consumed</TableHead><TableHead>Available</TableHead><TableHead>Return Requested</TableHead><TableHead>Status</TableHead><TableHead>Issue Date</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
          {query.isLoading ? <TableRow><TableCell colSpan={11} className="h-56 text-center text-muted-foreground">Loading assigned stock...</TableCell></TableRow> : filteredIssues.length ? filteredIssues.map((issue:any,index:number) => {
            const item = issue.inventory_item ?? issue.inventoryItem;
            const unit = item?.base_unit ?? item?.unit ?? "pcs";
            const available = Number(issue.available_quantity ?? 0);
            return <TableRow key={issue.id} className="h-14"><TableCell>{index+1}</TableCell><TableCell className="font-semibold">{issue.issue_number??`#${issue.id}`}</TableCell><TableCell>{item?.name ?? "Item"}<span className="block text-xs text-muted-foreground">Issued by {issue.creator?.name ?? "Store Keeper"}</span></TableCell><TableCell>{issue.department?.name ?? "—"}</TableCell><TableCell>{formatBaseQuantity(issue.quantity, unit)}</TableCell><TableCell>{formatBaseQuantity(issue.used_quantity ?? 0, unit)}</TableCell><TableCell className="font-semibold">{formatBaseQuantity(available, unit)}</TableCell><TableCell>{formatBaseQuantity(issue.return_requested_quantity ?? 0, unit)}</TableCell><TableCell><Badge variant="secondary" className="capitalize">{(issue.custody_status ?? "issued").replaceAll("_", " ")}</Badge></TableCell><TableCell>{formatDate(issue.issue_date??issue.created_at)}</TableCell><TableCell className="text-right">{issue.custody_status === "issued" ? <Button size="sm" className="rounded-lg" onClick={() => acknowledge.mutate(issue.id)} disabled={acknowledge.isPending}><CheckCircle2 className="mr-2 h-4 w-4" />Receive</Button> : available > 0 && issue.custody_status !== "return_requested" ? <div className="flex justify-end gap-2"><Button size="sm" variant="outline" className="rounded-lg" onClick={() => { setAction({ type: "use", issue }); setQuantity(""); setNote(""); }}><Utensils className="mr-2 h-4 w-4" />Consume</Button><Button size="sm" className="rounded-lg" onClick={() => { setAction({ type: "return", issue }); setQuantity(""); setNote(""); }}><RotateCcw className="mr-2 h-4 w-4" />Return</Button></div> : <span className="text-sm text-muted-foreground">No action</span>}</TableCell></TableRow>;
          }) : <TableRow><TableCell colSpan={11} className="h-56 text-center"><div className="mx-auto flex max-w-sm flex-col items-center"><div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-50 text-slate-400"><Layers3 className="h-7 w-7"/></div><p className="mt-3 font-semibold">{issueSearch||issueStatus!=="all"?"No matching issued stock.":"No department stock is assigned to you."}</p><p className="mt-1 text-sm text-muted-foreground">Once stock is issued to your department, it will appear here.</p></div></TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </section>
    <Dialog open={requestOpen} onOpenChange={setRequestOpen}><DialogContent><DialogHeader><DialogTitle>Request stock from Main Store</DialogTitle><DialogDescription>The F&amp;B Controller validates this request before the Store Keeper can issue it.</DialogDescription></DialogHeader><div className="space-y-4"><div className="space-y-2"><Label>Inventory item</Label><Select value={requestItem} onValueChange={setRequestItem}><SelectTrigger><SelectValue placeholder="Select item"/></SelectTrigger><SelectContent className="max-h-72">{requestItems.isLoading ? <div className="px-3 py-3 text-sm text-muted-foreground">Loading inventory items...</div> : requestItems.isError ? <div className="px-3 py-3 text-sm text-destructive">Could not load inventory items.</div> : (requestItems.data ?? []).length ? (requestItems.data ?? []).map((item:any)=><SelectItem key={item.id} value={String(item.id)}>{item.name} — Available: {formatBaseQuantity(item.current_stock ?? 0,item.base_unit ?? "pcs")}</SelectItem>) : <div className="px-3 py-3 text-sm text-muted-foreground">No active inventory items available.</div>}</SelectContent></Select></div><div className="space-y-2"><Label>Requested quantity</Label><Input type="number" min="0.001" step="0.001" value={requestQuantity} onChange={event=>setRequestQuantity(event.target.value)}/></div><div className="space-y-2"><Label>Purpose / reason</Label><Textarea value={requestReason} onChange={event=>setRequestReason(event.target.value)} required/></div><div className="flex justify-end gap-2"><Button variant="outline" onClick={()=>setRequestOpen(false)}>Cancel</Button><Button disabled={!requestItem||Number(requestQuantity)<=0||!requestReason.trim()||createRequest.isPending} onClick={()=>createRequest.mutate()}>Submit request</Button></div></div></DialogContent></Dialog>
    <Dialog open={Boolean(action)} onOpenChange={(open) => !open && setAction(null)}><DialogContent><DialogHeader><DialogTitle>{action?.type === "use" ? "Record consumed quantity" : "Request return to store"}</DialogTitle><DialogDescription>{action?.issue.inventory_item?.name ?? action?.issue.inventoryItem?.name}</DialogDescription></DialogHeader>{action && <div className="space-y-4"><div className="space-y-2"><Label>Quantity</Label><Input type="number" min="0.001" max={Number(action.issue.available_quantity ?? 0)} step="0.001" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></div><div className="space-y-2"><Label>{action.type === "return" ? "Return reason" : "Consumption note"}</Label><Textarea value={note} onChange={(event) => setNote(event.target.value)} required={action.type === "return"} /></div><div className="flex gap-2"><Button onClick={() => submit.mutate()} disabled={submit.isPending || Number(quantity) <= 0 || Number(quantity) > Number(action.issue.available_quantity ?? 0) || (action.type === "return" && !note.trim())}>Submit</Button><Button variant="outline" onClick={() => setAction(null)}>Cancel</Button></div></div>}</DialogContent></Dialog>
  </div>;
}
