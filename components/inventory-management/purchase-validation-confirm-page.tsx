"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, RefreshCcw, Search, ShieldCheck, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatBaseQuantity, formatMoney } from "@/lib/inventory-management";
import { procurementService, type PurchaseOrderItemRow, type PurchaseOrderRow } from "@/services/inventory-management/procurement.service";
import inventoryService from "@/services/inventory-management/inventory.service";

function extractError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function statusBadge(status?: string | null) {
  const normalized = status ?? "submitted";
  return <Badge variant={normalized === "food_validated" ? "default" : normalized.includes("reject") ? "destructive" : "secondary"}>{normalized.replaceAll("_", " ")}</Badge>;
}

function poItemName(item: PurchaseOrderItemRow) {
  const inv = item.inventory_item ?? item.inventoryItem;
  return inv?.sku ? `${inv.name} (${inv.sku})` : inv?.name ?? `Item #${item.inventory_item_id}`;
}

function PoLinesTable({ lines }: { lines: PurchaseOrderItemRow[] }) {
  return (
    <Table>
      <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Quantity</TableHead><TableHead>Received</TableHead><TableHead>Unit cost</TableHead></TableRow></TableHeader>
      <TableBody>
        {lines.map((line) => {
          const inv = line.inventory_item ?? line.inventoryItem;
          const unit = inv?.base_unit ?? line.unit ?? "pcs";
          return <TableRow key={line.id}><TableCell className="font-medium">{poItemName(line)}</TableCell><TableCell>{formatBaseQuantity(line.quantity, unit)}</TableCell><TableCell>{formatBaseQuantity(line.received_quantity ?? 0, unit)}</TableCell><TableCell>{formatMoney(line.unit_cost)} ETB</TableCell></TableRow>;
        })}
      </TableBody>
    </Table>
  );
}

function ConfirmValidationDialog({ po }: { po: PurchaseOrderRow }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("Food Controller confirmed purchase request validation");
  const qc = useQueryClient();

  const integrity = useQuery({
    queryKey: ["purchase-validation", "recipe-integrity", po.id],
    queryFn: () => inventoryService.recipeIntegrity("food-controller"),
    enabled: open,
    retry: false,
  });

  const confirm = useMutation({
    mutationFn: () => procurementService.validatePurchaseOrder(po.id, note, "food-controller"),
    onSuccess: () => {
      toast.success("Purchase request validated and sent for manager approval");
      qc.invalidateQueries({ queryKey: ["procurement", "purchase-validation"] });
      qc.invalidateQueries({ queryKey: ["procurement", "purchase-orders"] });
      setOpen(false);
    },
    onError: (error) => toast.error(extractError(error, "Failed to validate purchase request")),
  });

  const reject = useMutation({
    mutationFn: () => procurementService.rejectPurchaseValidation(po.id, note || "Rejected by Food Controller", "food-controller"),
    onSuccess: () => {
      toast.success("Purchase request returned to purchaser");
      qc.invalidateQueries({ queryKey: ["procurement", "purchase-validation"] });
      qc.invalidateQueries({ queryKey: ["procurement", "purchase-orders"] });
      setOpen(false);
    },
    onError: (error) => toast.error(extractError(error, "Failed to reject purchase request")),
  });

const summary = (integrity.data?.summary ?? {}) as Record<string, unknown>;

const issueCount = Object.values(summary).reduce<number>((sum, value) => {
  const num =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : 0;

  return sum + (Number.isFinite(num) ? num : 0);
}, 0);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}><ShieldCheck className="mr-2 h-4 w-4" />Validate</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>Confirm purchase validation</DialogTitle><DialogDescription>This confirms the purchase request as Food Controller validated and moves it to manager approval workflow.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border p-4"><p className="font-medium">{po.po_number ?? `PO-${po.id}`} · {po.supplier?.name ?? `Supplier #${po.supplier_id}`}</p><p className="text-sm text-muted-foreground">Status: {po.status?.replaceAll("_", " ")} · Total {formatMoney(po.total ?? 0)} ETB</p></div>
            {integrity.isLoading ? <p className="text-sm text-muted-foreground">Checking recipe integrity...</p> : <div className="grid gap-3 md:grid-cols-4"><div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Items without recipe</p><p className="text-lg font-semibold">{Number(summary.menu_items_without_recipe ?? 0)}</p></div><div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Recipes without ingredients</p><p className="text-lg font-semibold">{Number(summary.recipes_without_ingredients ?? 0)}</p></div><div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Missing inventory links</p><p className="text-lg font-semibold">{Number(summary.recipes_with_missing_inventory_links ?? 0)}</p></div><div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Direct items without link</p><p className="text-lg font-semibold">{Number(summary.direct_items_without_link ?? 0)}</p></div></div>}
            <div className={issueCount > 0 ? "rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" : "rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800"}>{issueCount > 0 ? "Recipe integrity issues were found. Reject and return this request to purchaser, or confirm only if reviewed and accepted." : "No recipe integrity issue was detected. You can confirm validation."}</div>
            <div className="space-y-2"><Label>Validation note / rejection reason</Label><Textarea value={note} onChange={(event) => setNote(event.target.value)} /></div>
            <PoLinesTable lines={po.items ?? []} />
          </div>
          <DialogFooter className="gap-2 sm:gap-0"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="button" variant="destructive" onClick={() => reject.mutate()} disabled={reject.isPending || confirm.isPending}><XCircle className="mr-2 h-4 w-4" />Reject</Button><Button type="button" onClick={() => confirm.mutate()} disabled={reject.isPending || confirm.isPending}><CheckCircle2 className="mr-2 h-4 w-4" />Confirm validation</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function PurchaseValidationConfirmPage() {
  const [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: ["procurement", "purchase-validation", search],
    queryFn: () => procurementService.pendingPurchaseValidation({ search, per_page: 20 }),
    staleTime: 30000,
    retry: false,
  });
  const rows = query.data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><div className="flex items-center gap-2"><div className="rounded-xl bg-primary/10 p-2 text-primary"><ShieldCheck className="h-5 w-5" /></div><h1 className="text-2xl font-bold tracking-tight">Purchase Validation</h1></div><p className="mt-2 text-sm text-muted-foreground">Food Controller validates submitted purchase requests before manager approval.</p></div><Button variant="outline" onClick={() => query.refetch()}><RefreshCcw className="mr-2 h-4 w-4" />Refresh</Button></div>
      <Card>
        <CardHeader><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><CardTitle>Submitted requests</CardTitle><CardDescription>Click Validate, review the request, then Confirm validation.</CardDescription></div><div className="relative md:w-72"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Search PO or supplier..." /></div></div></CardHeader>
        <CardContent>
          {query.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading purchase requests...</p>
          ) : query.isError ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center">
              <p className="font-medium text-destructive">Could not load submitted purchase requests</p>
              <p className="mt-1 text-sm text-muted-foreground">Check the F&amp;B Controller purchase-order read authorization, then try again.</p>
              <Button className="mt-4" variant="outline" onClick={() => query.refetch()}>Try again</Button>
            </div>
          ) : rows.length ? (
            <Table>
              <TableHeader><TableRow><TableHead>PO</TableHead><TableHead>Supplier</TableHead><TableHead>Status</TableHead><TableHead>Items</TableHead><TableHead>Total</TableHead><TableHead>Expected</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
              <TableBody>{rows.map((po) => <TableRow key={po.id}><TableCell className="font-medium">{po.po_number ?? `PO-${po.id}`}</TableCell><TableCell>{po.supplier?.name ?? `Supplier #${po.supplier_id}`}</TableCell><TableCell>{statusBadge(po.status)}</TableCell><TableCell>{po.items?.length ?? 0}</TableCell><TableCell>{formatMoney(po.total ?? 0)} ETB</TableCell><TableCell>{po.expected_date ?? "—"}</TableCell><TableCell className="text-right"><ConfirmValidationDialog po={po} /></TableCell></TableRow>)}</TableBody>
            </Table>
          ) : (
            <div className="rounded-xl border border-dashed p-8 text-center"><p className="font-medium">No submitted purchase requests</p><p className="mt-1 text-sm text-muted-foreground">Submitted purchase requests waiting for Food Controller validation will appear here.</p></div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
