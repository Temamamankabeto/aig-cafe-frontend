"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDownToLine, BookOpen, Printer, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatBaseQuantity } from "@/lib/inventory-management";
import inventoryService from "@/services/inventory-management/inventory.service";
import type { InventoryTransaction } from "@/types/inventory-management";

const number = (value: unknown) => Number(value ?? 0);
const issueItem = (issue?: InventoryTransaction) => issue?.inventory_item ?? issue?.inventoryItem;
const issueDepartment = (issue?: InventoryTransaction) => issue?.department?.name ?? "Unknown department";
const errorText = (error: unknown) => error instanceof Error ? error.message : "The request could not be completed.";

export function ReturnToStorePage() {
  const client = useQueryClient();
  const [acceptingId, setAcceptingId] = useState<number | string | null>(null);
  const issues = useQuery({
    queryKey: ["inventory", "returnable-issues"],
    queryFn: () => inventoryService.returnableIssues({ per_page: 200 }, "stock-keeper"),
  });
  const mutation = useMutation({
    mutationFn: (issue: InventoryTransaction) => inventoryService.returnToStore(issue.id, {
      quantity: number(issue.returnable_quantity),
      reason: `Accepted department return request: ${issue.return_request_reason || "Unused stock returned"}`,
    }, "stock-keeper"),
    onSuccess: () => {
      toast.success("Return accepted and stock balance updated.");
      setAcceptingId(null);
      client.invalidateQueries({ queryKey: ["inventory"] });
    },
    onError: (error) => { setAcceptingId(null); toast.error(errorText(error)); },
  });
  const rows = issues.data?.data ?? [];

  return <div className="space-y-6">
    <header><h1 className="flex items-center gap-2 text-2xl font-bold"><RotateCcw className="h-6 w-6" />Department Return Requests</h1><p className="mt-1 text-sm text-muted-foreground">Review return requests from every department. Accepting a request records stock-in and updates the main stock balance.</p></header>
    <div className="overflow-x-auto rounded-xl border bg-card"><Table><TableHeader><TableRow><TableHead>Request</TableHead><TableHead>Department</TableHead><TableHead>Responsible user</TableHead><TableHead>Item</TableHead><TableHead>Quantity</TableHead><TableHead>Reason</TableHead><TableHead>Requested</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader><TableBody>
      {issues.isLoading ? <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">Loading return requests...</TableCell></TableRow> : rows.length ? rows.map((issue) => { const item = issueItem(issue); const busy = mutation.isPending && acceptingId === issue.id; return <TableRow key={issue.id}><TableCell className="font-medium">#{issue.id}</TableCell><TableCell>{issueDepartment(issue)}</TableCell><TableCell>{issue.responsible_user?.name ?? "Legacy issue"}</TableCell><TableCell>{item?.name ?? "Item"}</TableCell><TableCell>{formatBaseQuantity(number(issue.returnable_quantity), item?.base_unit ?? "pcs")}</TableCell><TableCell className="max-w-72 whitespace-normal">{issue.return_request_reason ?? issue.note ?? "—"}</TableCell><TableCell>{issue.return_requested_at ? new Date(issue.return_requested_at).toLocaleString() : "—"}</TableCell><TableCell className="text-right"><Button size="sm" disabled={mutation.isPending || number(issue.returnable_quantity) <= 0} onClick={() => { if (!window.confirm(`Accept ${formatBaseQuantity(number(issue.returnable_quantity), item?.base_unit ?? "pcs")} returned from ${issueDepartment(issue)} and update stock?`)) return; setAcceptingId(issue.id); mutation.mutate(issue); }}><ArrowDownToLine className="mr-2 h-4 w-4" />{busy ? "Accepting..." : "Accept return"}</Button></TableCell></TableRow>; }) : <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">No pending department return requests.</TableCell></TableRow>}
    </TableBody></Table></div>
  </div>;
}

export function StockBalancePage() {
  const [search, setSearch] = useState("");
  const balances = useQuery({ queryKey: ["inventory", "stock-balances", search], queryFn: () => inventoryService.stockBalances({ search, per_page: 200 }, "stock-keeper") });
  return <div className="space-y-6"><header><h1 className="text-2xl font-bold">Stock Balance</h1><p className="mt-1 text-sm text-muted-foreground">Current available stock. Use Stock Card to see how each balance was reached.</p></header><Card><CardHeader><CardTitle>Current quantities</CardTitle><CardDescription>Main Store availability and reorder position.</CardDescription></CardHeader><CardContent className="space-y-4"><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search item or SKU" /><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Store</TableHead><TableHead>Available</TableHead><TableHead>Reserved</TableHead><TableHead>Minimum</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{(balances.data?.data ?? []).map((row) => <TableRow key={row.inventory_item_id}><TableCell className="font-medium">{row.item}<span className="block text-xs text-muted-foreground">{row.sku || "No SKU"}</span></TableCell><TableCell>{row.store}</TableCell><TableCell>{formatBaseQuantity(row.available_quantity, row.unit)}</TableCell><TableCell>{formatBaseQuantity(row.reserved_quantity, row.unit)}</TableCell><TableCell>{formatBaseQuantity(row.minimum_quantity, row.unit)}</TableCell><TableCell className="capitalize">{row.stock_status.replaceAll("_", " ")}</TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card></div>;
}

export function StockCardPage() {
  const [itemId, setItemId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const items = useQuery({ queryKey: ["inventory", "stock-card-items"], queryFn: () => inventoryService.items({ per_page: 200 }, "stock-keeper") });
  const card = useQuery({ queryKey: ["inventory", "stock-card", itemId, from, to], queryFn: () => inventoryService.stockCard(itemId, { from: from || undefined, to: to || undefined }, "stock-keeper"), enabled: Boolean(itemId) });
  const lines = card.data?.lines ?? [];
  const totals = useMemo(() => lines.reduce((sum, line) => ({ received: sum.received + number(line.received), issued: sum.issued + number(line.issued), returned: sum.returned + number(line.returned) }), { received: 0, issued: 0, returned: 0 }), [lines]);
  return <div className="space-y-6 print:space-y-3"><header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="flex items-center gap-2 text-2xl font-bold"><BookOpen className="h-6 w-6" />Stock Card / Bin Card</h1><p className="mt-1 text-sm text-muted-foreground">Detailed movement history with a running balance.</p></div><Button variant="outline" onClick={() => window.print()} disabled={!card.data}><Printer className="mr-2 h-4 w-4" />Print</Button></header><Card><CardHeader><CardTitle>Filters</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-3"><div className="space-y-2"><Label>Inventory item</Label><Select value={itemId} onValueChange={setItemId}><SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger><SelectContent>{(items.data?.data ?? []).map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name}{item.sku ? ` (${item.sku})` : ""}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>From date</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div><div className="space-y-2"><Label>To date</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} min={from || undefined} /></div></CardContent></Card>{card.data && <Card><CardHeader><CardTitle>{card.data.item.name}</CardTitle><CardDescription>{card.data.store} · Unit: {card.data.item.unit} · Opening: {card.data.opening_balance.toFixed(3)} · Closing: {card.data.closing_balance.toFixed(3)}</CardDescription></CardHeader><CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Reference</TableHead><TableHead>Received</TableHead><TableHead>Issued</TableHead><TableHead>Returned</TableHead><TableHead>Transfer</TableHead><TableHead>Adjustment</TableHead><TableHead>Waste</TableHead><TableHead>Balance</TableHead></TableRow></TableHeader><TableBody>{lines.map((line) => <TableRow key={line.id}><TableCell>{new Date(line.date).toLocaleString()}</TableCell><TableCell><span className="font-medium">{line.reference || "—"}</span><span className="block max-w-64 truncate text-xs text-muted-foreground">{line.note || ""}</span></TableCell><TableCell>{line.received || "—"}</TableCell><TableCell>{line.issued || "—"}</TableCell><TableCell>{line.returned || "—"}</TableCell><TableCell>{line.transferred || "—"}</TableCell><TableCell>{line.adjustment || "—"}</TableCell><TableCell>{line.waste || "—"}</TableCell><TableCell className="font-semibold">{number(line.balance).toFixed(3)}</TableCell></TableRow>)}</TableBody></Table></div><p className="mt-4 text-sm text-muted-foreground">Period totals — Received: {totals.received.toFixed(3)}, Issued: {totals.issued.toFixed(3)}, Returned: {totals.returned.toFixed(3)}</p></CardContent></Card>}</div>;
}
