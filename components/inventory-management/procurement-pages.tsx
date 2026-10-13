"use client";

import { FormEvent, useState } from "react";
import { authService } from "@/services/auth/auth.service";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { PurchaseOrderStatus } from "@/services/inventory-management/procurement.service";

import {
  AlertTriangle,
  Check,
  ChevronsUpDown,
  CheckCircle2,
  ClipboardList,
  PackageCheck,
  Plus,
  RefreshCcw,
  Printer,
  Search,
  Send,
  Truck,
  Pencil,
  Trash2,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatBaseQuantity, formatMoney } from "@/lib/inventory-management";
import {
  can,
  getStoredRoles,
  inventoryPermissions,
  purchasePermissions,
} from "@/lib/auth/permissions";
import { useInventoryItemsQuery } from "@/hooks/inventory-management";
import {
  procurementService,
  type PurchaseOrderItemRow,
  type PurchaseOrderPayload,
  type PurchaseOrderRow,
  type SupplierPayload,
  type SupplierRow,
} from "@/services/inventory-management/procurement.service";
import { PurchaseValidationConfirmPage } from "@/components/inventory-management/purchase-validation-confirm-page";
import { printBusinessDocument } from "@/lib/print-documents";

type StatusFilter =
  | "all"
  | "draft"
  | "submitted"
  | "food_validated"
  | "finance_verified"
  | "finance_rejected"
  | "validation_rejected"
  | "approved"
  | "partially_received"
  | "completed"
  | "cancelled";
function extractError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
function canCreateSupplier() {
  return can(purchasePermissions.suppliersCreate);
}
function normalizedStoredRoles() {
  return getStoredRoles().map((role) =>
    String(role ?? "")
      .trim()
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[\s-]+/g, "_"),
  );
}
function isStoreKeeperRole() {
  return normalizedStoredRoles().some((role) =>
    ["store_keeper", "stock_keeper", "warehouse", "warehouse_keeper"].includes(
      role,
    ),
  );
}
function purchaseRequestScope(): "purchaser" | "stock-keeper" {
  return isStoreKeeperRole() ? "stock-keeper" : "purchaser";
}
function canCreatePurchaseOrder() {
  return (
    !normalizedStoredRoles().includes("purchaser") && (can(purchasePermissions.ordersCreate) ||
    can(purchasePermissions.requestsCreate) ||
    isStoreKeeperRole())
  );
}
function canSubmitPurchaseOrder() {
  return can(purchasePermissions.ordersSubmit);
}
function canApprovePurchaseOrder() {
  return (
    normalizedStoredRoles().some((role) => ["manager", "general_admin", "cafeteria_manager"].includes(role)) ||
    can(purchasePermissions.ordersApprove) ||
    can(purchasePermissions.requestsApprove)
  );
}
function canReceivePurchaseOrder() {
  return (
    can(purchasePermissions.ordersReceive) || can(inventoryPermissions.receive)
  );
}

export function statusBadge(status?: string | null) {
  const normalized = status ?? "draft";
  if (["validation_rejected", "finance_rejected", "cancelled"].includes(normalized))
    return (
      <Badge variant="destructive">{normalized.replaceAll("_", " ")}</Badge>
    );
  if (["food_validated", "finance_verified", "approved", "completed"].includes(normalized))
    return <Badge variant="default">{normalized.replaceAll("_", " ")}</Badge>;
  return <Badge variant="secondary">{normalized.replaceAll("_", " ")}</Badge>;
}

function PageHeader({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: typeof Truck;
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-primary/10 p-2 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      </div>
      <Badge variant="secondary" className="w-fit">
        Purchaser → Food Controller validates → Manager approves → Stock Keeper
        receives
      </Badge>
    </div>
  );
}
function poItemName(item: PurchaseOrderItemRow) {
  const inv = item.inventory_item ?? item.inventoryItem;
  return inv?.sku
    ? `${inv.name} (${inv.sku})`
    : (inv?.name ?? `Item #${item.inventory_item_id}`);
}
function poRemaining(item: PurchaseOrderItemRow) {

  return Math.max(
    Number(item.quantity ?? 0) - Number(item.received_quantity ?? 0),
    0,
  );
}
function lineUnit(line?: PurchaseOrderItemRow) {
  const inv = line?.inventory_item ?? line?.inventoryItem;
  return inv?.base_unit ?? line?.unit ?? "pc";
}

function PoLinesTable({ lines }: { lines: PurchaseOrderItemRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Item</TableHead>
          <TableHead>Ordered</TableHead>
          <TableHead>Received</TableHead>
          <TableHead>Remaining</TableHead>
          <TableHead>Cost</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lines.map((line) => (
          <TableRow key={line.id}>
            <TableCell>{poItemName(line)}</TableCell>
            <TableCell>
              {formatBaseQuantity(line.quantity, lineUnit(line))}
            </TableCell>
            <TableCell>
              {formatBaseQuantity(line.received_quantity ?? 0, lineUnit(line))}
            </TableCell>
            <TableCell>
              {formatBaseQuantity(poRemaining(line), lineUnit(line))}
            </TableCell>
            <TableCell>{formatMoney(line.unit_cost)} ETB</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function printPurchaseOrder(po: PurchaseOrderRow) {
  printBusinessDocument({
    title: "Purchase Order",
    reference: po.po_number ?? `PO-${po.id}`,
    details: [
      ["Supplier", po.supplier?.name ?? "—"],
      ["Status", po.status.replaceAll("_", " ")],
      ["Expected date", po.expected_date ?? "—"],
      ["Created", po.created_at ? new Date(po.created_at).toLocaleString() : "—"],
    ],
    columns: [
      { key: "item", label: "Inventory item" },
      { key: "quantity", label: "Ordered quantity", align: "right" },
      { key: "received", label: "Received", align: "right" },
      { key: "unitCost", label: "Unit cost (ETB)", align: "right" },
      { key: "lineTotal", label: "Line total (ETB)", align: "right" },
    ],
    rows: (po.items ?? []).map((line) => ({
      item: poItemName(line),
      quantity: `${line.quantity} ${lineUnit(line)}`,
      received: `${line.received_quantity ?? 0} ${lineUnit(line)}`,
      unitCost: formatMoney(line.unit_cost),
      lineTotal: formatMoney(line.line_total ?? Number(line.quantity) * Number(line.unit_cost)),
    })),
    summary: [["Grand total", `${formatMoney(po.total ?? 0)} ETB`]],
  });
}

export function SuppliersPage() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SupplierRow | null>(null);
  const [deleting, setDeleting] = useState<SupplierRow | null>(null);
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["procurement", "suppliers", search],
    queryFn: () => procurementService.suppliers({ search, per_page: 20 }),
  });
  const remove = useMutation({
    mutationFn: (id: number) => procurementService.deleteSupplier(id),
    onSuccess: () => {
      toast.success("Supplier deleted");
      qc.invalidateQueries({ queryKey: ["procurement", "suppliers"] });
      setDeleting(null);
    },
    onError: (error) => toast.error(extractError(error, "Failed to delete supplier. If purchase orders exist, deactivate the supplier instead.")),
  });
  return (
    <div className="space-y-6">
      <PageHeader title="Suppliers" description="Manage suppliers for purchase requests." icon={Users} />
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Supplier list</CardTitle>
              <CardDescription>Search, create, edit and manage suppliers.</CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Search supplier..." />
              </div>
              {canCreateSupplier() && <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="mr-2 h-4 w-4" />New supplier</Button>}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <SuppliersTable rows={query.data?.data ?? []} loading={query.isLoading} onEdit={(row) => { setEditing(row); setOpen(true); }} onDelete={setDeleting} />
        </CardContent>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit supplier" : "Create supplier"}</DialogTitle>
            <DialogDescription>{editing ? "Update supplier details and active status." : "Register a supplier for procurement."}</DialogDescription>
          </DialogHeader>
          <SupplierForm key={editing?.id ?? "new"} supplier={editing} onDone={() => { setOpen(false); setEditing(null); }} />
        </DialogContent>
      </Dialog>
      <Dialog open={!!deleting} onOpenChange={(next) => { if (!next && !remove.isPending) setDeleting(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete supplier?</DialogTitle>
            <DialogDescription>Delete {deleting?.name}? This cannot be undone. Suppliers with purchase orders cannot be deleted; deactivate them instead.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={remove.isPending} onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="destructive" disabled={remove.isPending || !deleting} onClick={() => deleting && remove.mutate(deleting.id)}>Delete supplier</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
function SupplierForm({ supplier, onDone }: { supplier?: SupplierRow | null; onDone?: () => void }) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (payload: SupplierPayload) => supplier ? procurementService.updateSupplier(supplier.id, payload) : procurementService.createSupplier(payload),
    onSuccess: () => {
      toast.success(supplier ? "Supplier updated" : "Supplier created");
      qc.invalidateQueries({ queryKey: ["procurement", "suppliers"] });
      onDone?.();
    },
    onError: (error) => toast.error(extractError(error, "Failed to save supplier")),
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    mutation.mutate({
      name: String(form.get("name") ?? "").trim(),
      phone: String(form.get("phone") ?? ""),
      email: String(form.get("email") ?? ""),
      address: String(form.get("address") ?? ""),
      tax_id: String(form.get("tax_id") ?? ""),
      is_active: form.get("is_active") === "true",
    });
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <div><Label>Name</Label><Input name="name" defaultValue={supplier?.name ?? ""} required /></div>
      <div className="grid gap-3 md:grid-cols-2">
        <div><Label>Phone</Label><Input name="phone" defaultValue={supplier?.phone ?? ""} /></div>
        <div><Label>Email</Label><Input name="email" type="email" defaultValue={supplier?.email ?? ""} /></div>
      </div>
      <div><Label>Tax ID</Label><Input name="tax_id" defaultValue={supplier?.tax_id ?? ""} /></div>
      <div><Label>Address</Label><Textarea name="address" defaultValue={supplier?.address ?? ""} /></div>
      <div>
        <Label>Status</Label>
        <Select name="is_active" defaultValue={supplier?.is_active === false ? "false" : "true"}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="true">Active</SelectItem><SelectItem value="false">Inactive</SelectItem></SelectContent>
        </Select>
      </div>
      <DialogFooter><Button disabled={mutation.isPending} type="submit">{supplier ? "Save changes" : "Save supplier"}</Button></DialogFooter>
    </form>
  );
}
function SuppliersTable({ rows, loading, onEdit, onDelete }: {
  rows: SupplierRow[];
  loading?: boolean;
  onEdit: (row: SupplierRow) => void;
  onDelete: (row: SupplierRow) => void;
}) {
  if (loading) return <p className="text-sm text-muted-foreground">Loading suppliers...</p>;
  if (!rows.length) return <div className="rounded-xl border border-dashed p-8 text-center"><p className="font-medium">No suppliers</p><p className="text-sm text-muted-foreground">Create suppliers before purchase requests.</p></div>;
  return (
    <Table>
      <TableHeader><TableRow>
        <TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Email</TableHead><TableHead>Orders</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead>
      </TableRow></TableHeader>
      <TableBody>
        {rows.map((row) => <TableRow key={row.id}>
          <TableCell className="font-medium">{row.name}</TableCell>
          <TableCell>{row.phone ?? "—"}</TableCell>
          <TableCell>{row.email ?? "—"}</TableCell>
          <TableCell>{row.purchase_orders_count ?? 0}</TableCell>
          <TableCell>{formatMoney(row.purchase_orders_total ?? 0)} ETB</TableCell>
          <TableCell>{row.is_active === false ? <Badge variant="secondary">Inactive</Badge> : <Badge>Active</Badge>}</TableCell>
          <TableCell><div className="flex gap-2">
            {can(purchasePermissions.suppliersUpdate) && <Button variant="outline" size="sm" onClick={() => onEdit(row)}><Pencil className="mr-1 h-4 w-4" />Edit</Button>}
            {can(purchasePermissions.suppliersDelete) && <Button variant="outline" size="sm" onClick={() => onDelete(row)}><Trash2 className="mr-1 h-4 w-4" />Delete</Button>}
          </div></TableCell>
        </TableRow>)}
      </TableBody>
    </Table>
  );
}

export function PurchaseRequestsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [open, setOpen] = useState(false);
  const query = useQuery({
    queryKey: ["procurement", "purchase-orders", search, status],
    queryFn: () =>
      procurementService.purchaseOrders({
        search,
        status: status === "all" ? undefined : (status as PurchaseOrderStatus),
        per_page: 20,
      }),
  });
  const rows = query.data?.data ?? [];
  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Requests"
        description="Purchase requisitions: requester → Finance budget verification → Manager approval → Store Keeper receiving."
        icon={ClipboardList}
      />
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Purchase requisitions</CardTitle>
              <CardDescription>
                Requested → Finance verifies budget → Manager approves → Finance prints / Purchaser views → Store Keeper receives.
              </CardDescription>
            </div>
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="pl-9"
                  placeholder="Search PO or supplier..."
                />
              </div>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as StatusFilter)}
              >
                <SelectTrigger className="w-[190px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="food_validated">
                    Legacy F&B validated
                  </SelectItem>
                  <SelectItem value="validation_rejected">
                    Validation rejected
                  </SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="partially_received">
                    Partially received
                  </SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              {canCreatePurchaseOrder() && (
                <Dialog open={open} onOpenChange={setOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      New request
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-[96vw] sm:max-w-6xl">
                    <DialogHeader>
                      <DialogTitle>Create purchase request</DialogTitle>
                      <DialogDescription>
                        Quantities are entered in item base unit.
                      </DialogDescription>
                    </DialogHeader>
                    <PurchaseOrderForm onDone={() => setOpen(false)} />
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <PurchaseOrdersTable rows={rows} loading={query.isLoading} />
        </CardContent>
      </Card>
    </div>
  );
}
export function PurchaseValidationPage() {
  return <PurchaseValidationConfirmPage />;
}

function PurchaseOrderForm({ onDone }: { onDone?: () => void }) {
  const qc = useQueryClient();
  const inventory = useInventoryItemsQuery({ per_page: 100, status: "active" }, purchaseRequestScope());
  const items = inventory.data?.data ?? [];
  const [status, setStatus] = useState<"draft" | "submitted">("submitted");
  const [department, setDepartment] = useState("AIG Cafe and Restaurant");
  const authenticatedRequester = authService.getStoredUser();
  const requesterName = String(authenticatedRequester?.name ?? "").trim();
  const [purpose, setPurpose] = useState("");
  const [lines, setLines] = useState<Array<{
    inventory_item_id: string; specification: string; quantity: string; unit_cost: string; remarks: string;
  }>>([{ inventory_item_id: "", specification: "", quantity: "", unit_cost: "", remarks: "" }]);
  const mutation = useMutation({
    mutationFn: (payload: PurchaseOrderPayload) => procurementService.createPurchaseOrder(payload, purchaseRequestScope()),
    onSuccess: () => {
      toast.success("Purchase request created");
      qc.invalidateQueries({ queryKey: ["procurement", "purchase-orders"] });
      onDone?.();
    },
    onError: (error) => toast.error(extractError(error, "Failed to create purchase request")),
  });
  const updateLine = (index: number, patch: Partial<(typeof lines)[number]>) =>
    setLines((current) => current.map((line, i) => i === index ? { ...line, ...patch } : line));
  const grandTotal = lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unit_cost || 0), 0);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selected = lines.filter((line) => line.inventory_item_id && Number(line.quantity) > 0);
    if (!selected.length || !purpose.trim()) {
      toast.error("Complete the purpose and at least one item");
      return;
    }
    // The existing API has no separate specification/remarks/requester columns yet.
    // Preserve these fields in the supported notes property until the workflow migration.
    const notes = [
      `Requesting Department: ${department}`,
      `Purpose / Reason for Purchase: ${purpose}`,
      ...selected.map((line, i) => {
        const inv = items.find((item) => String(item.id) === line.inventory_item_id);
        return `Item ${i + 1} (${inv?.name ?? line.inventory_item_id}): Specification / Model: ${line.specification || "—"}; Remarks: ${line.remarks || "—"}`;
      }),
    ].join("\n");
    mutation.mutate({
      status, notes,
      items: selected.map((line) => {
        const inv = items.find((item) => String(item.id) === line.inventory_item_id);
        return {
          inventory_item_id: Number(line.inventory_item_id),
          quantity: Number(line.quantity),
          base_unit: inv?.base_unit ?? inv?.unit ?? "pc",
          unit_cost: Number(line.unit_cost || 0),
        };
      }),
    });
  }
  return (
    <form onSubmit={submit} className="max-h-[75vh] space-y-5 overflow-y-auto pr-2">
      <div className="rounded-lg border bg-muted/30 p-4 text-center">
        <p className="text-lg font-bold tracking-wide md:text-xl">ADAMA INVESTMENT GROUP (AIG)</p>
        <h2 className="mt-3 text-xl font-extrabold md:text-2xl">PURCHASE REQUISITION FORM</h2>
        <p className="font-semibold">(Purchase Request / Material Requisition)</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1"><Label>Requesting Department</Label><Input required value={department} onChange={(e) => setDepartment(e.target.value)} /></div>
        <div className="space-y-1 md:col-span-2"><Label>Purpose / Reason for Purchase</Label><Textarea required value={purpose} onChange={(e) => setPurpose(e.target.value)} rows={2} /></div>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[970px] border-collapse text-sm">
          <thead className="bg-muted/50"><tr className="[&_th]:border [&_th]:p-2">
            <th>No.</th><th className="min-w-52">Item Description</th><th>Specification / Model</th><th>Unit of Measure</th><th>Quantity</th><th>Estimated Unit Price (ETB)</th><th>Total Price (ETB)</th><th>Remarks</th><th></th>
          </tr></thead>
          <tbody>{lines.map((line, index) => {
            const inv = items.find((item) => String(item.id) === line.inventory_item_id);
            return <tr key={index} className="[&_td]:border [&_td]:p-1.5">
              <td className="text-center">{index + 1}</td>
              <td><Popover><PopoverTrigger asChild><Button type="button" variant="outline" className="w-full justify-between font-normal"><span className="max-w-40 truncate">{inv?.name ?? "Select item"}</span><ChevronsUpDown className="h-4 w-4" /></Button></PopoverTrigger><PopoverContent className="w-72 p-0" align="start"><Command><CommandInput placeholder="Search inventory item..." /><CommandList><CommandEmpty>No item found</CommandEmpty><CommandGroup>{items.map((item) => <CommandItem key={item.id} value={`${item.name} ${item.sku ?? ""}`} onSelect={() => updateLine(index, { inventory_item_id: String(item.id), unit_cost: line.unit_cost || String(item.average_purchase_price ?? "") })}><Check className={cn("mr-2 h-4 w-4", line.inventory_item_id === String(item.id) ? "opacity-100" : "opacity-0")} />{item.name}</CommandItem>)}</CommandGroup></CommandList></Command></PopoverContent></Popover></td>
              <td><Input aria-label="Specification or model" value={line.specification} onChange={(e) => updateLine(index, { specification: e.target.value })} /></td>
              <td className="text-center">{inv?.base_unit ?? inv?.unit ?? "—"}</td>
              <td><Input aria-label="Quantity" type="number" min="0.001" step="0.001" value={line.quantity} onChange={(e) => updateLine(index, { quantity: e.target.value })} /></td>
              <td><Input aria-label="Estimated unit price" type="number" min="0" step="0.01" value={line.unit_cost} onChange={(e) => updateLine(index, { unit_cost: e.target.value })} /></td>
              <td className="whitespace-nowrap text-right">{formatMoney(Number(line.quantity || 0) * Number(line.unit_cost || 0))}</td>
              <td><Input aria-label="Remarks" value={line.remarks} onChange={(e) => updateLine(index, { remarks: e.target.value })} /></td>
              <td><Button type="button" variant="ghost" size="sm" disabled={lines.length === 1} onClick={() => setLines((old) => old.filter((_, i) => i !== index))}>Remove</Button></td>
            </tr>;
          })}</tbody>
          <tfoot><tr className="bg-muted/50 font-bold"><td colSpan={6} className="border p-2 text-right">Grand Total</td><td className="border p-2 text-right">{formatMoney(grandTotal)}</td><td colSpan={2} className="border" /></tr></tfoot>
        </table>
      </div>
      <Button type="button" variant="outline" onClick={() => setLines((old) => [...old, { inventory_item_id: "", specification: "", quantity: "", unit_cost: "", remarks: "" }])}><Plus className="mr-2 h-4 w-4" />Add line</Button>
      <div className="grid gap-3 md:grid-cols-3">{[
        ["A. Requested By", requesterName || "Authenticated user", getStoredRoles().join(", ") || "Requester"],
        ["B. Reviewed / Verified By", "Finance", "Budget verification"],
        ["C. Approved By", "Manager", "Final approval"],
      ].map(([heading, name, detail]) => <div key={heading} className="rounded-md border"><div className="bg-muted/50 p-2 text-center font-bold">{heading}</div><div className="space-y-2 p-3 text-sm"><p>Name: {name}</p><p className="text-xs text-muted-foreground">{detail}</p><p>Signature: __________________</p><p>Date: _____________________</p></div></div>)}</div>
      <div className="grid gap-3 md:grid-cols-2"><div className="space-y-1"><Label>Save as</Label><Select value={status} onValueChange={(value) => setStatus(value as "draft" | "submitted")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="submitted">Submit now</SelectItem></SelectContent></Select></div></div>
      <p className="text-xs text-muted-foreground">Supplier selection belongs to purchasing after approval. Finance verification, Manager approval and role-specific print permissions require the separate backend workflow update.</p>
      <Button type="submit" disabled={mutation.isPending || inventory.isLoading || !items.length}><Send className="mr-2 h-4 w-4" />Save request</Button>
    </form>
  );
}

function PurchaseOrdersTable({
  rows,
  loading,
}: {
  rows: PurchaseOrderRow[];
  loading?: boolean;
}) {
  const qc = useQueryClient();
  const [detailPo, setDetailPo] = useState<PurchaseOrderRow | null>(null);
  const openPurchaseDetails = async (po: PurchaseOrderRow) => {
    setDetailPo(po);
    try {
      const full = await procurementService.purchaseOrder(po.id);
      setDetailPo((current) => current?.id === po.id ? full : current);
    } catch {
      // Keep the list record visible if the detail endpoint is unavailable.
    }
  };
  const submit = useMutation({
    mutationFn: (id: number) => procurementService.submitPurchaseOrder(id),
    onSuccess: () => {
      toast.success("Purchase order submitted");
      qc.invalidateQueries({ queryKey: ["procurement", "purchase-orders"] });
    },
    onError: (error) => toast.error(extractError(error, "Failed to submit")),
  });
  const approve = useMutation({
    mutationFn: (id: number) =>
      procurementService.approvePurchaseOrder(id, "manager"),
    onSuccess: () => {
      toast.success("Purchase order approved and ready for receiving");
      setDetailPo(null);
      qc.invalidateQueries({ queryKey: ["procurement", "purchase-orders"] });
    },
    onError: (error) => toast.error(extractError(error, "Failed to approve")),
  });
  if (loading)
    return (
      <p className="text-sm text-muted-foreground">
        Loading purchase orders...
      </p>
    );
  if (!rows.length)
    return (
      <div className="rounded-xl border border-dashed p-8 text-center">
        <p className="font-medium">No purchase requests</p>
        <p className="text-sm text-muted-foreground">
          Requests will appear here.
        </p>
      </div>
    );
  return (
    <>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>PO</TableHead>
          <TableHead>Supplier</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Items</TableHead>
          <TableHead>Total</TableHead>
          <TableHead className="text-right">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((po) => (
          <TableRow key={po.id}>
            <TableCell className="font-medium">
              {po.po_number ?? `PO-${po.id}`}
            </TableCell>
            <TableCell>
              {po.supplier?.name ?? "Not selected (requisition)"}
            </TableCell>
            <TableCell>{statusBadge(po.status)}</TableCell>
            <TableCell>{po.items?.length ?? 0}</TableCell>
            <TableCell>{formatMoney(po.total ?? 0)} ETB</TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                {canSubmitPurchaseOrder() && po.status === "draft" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => submit.mutate(po.id)}
                  >
                    Submit
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => void openPurchaseDetails(po)}>Details</Button>
                {canApprovePurchaseOrder() && po.status === "finance_verified" && (
                  <Button size="sm" onClick={() => void openPurchaseDetails(po)}>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Review & Approve
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    <Dialog open={!!detailPo} onOpenChange={(open) => !open && setDetailPo(null)}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Purchase requisition details</DialogTitle>
          <DialogDescription>Purchase Request / Material Requisition — Finance budget verification and Manager approval.</DialogDescription>
        </DialogHeader>
        {detailPo && (() => {
          const notes = detailPo.notes ?? "";
          const noteValue = (label: string) => notes.split("\n").find((part) => part.startsWith(`${label}: `))?.slice(label.length + 2).trim() ?? "";
          const department = noteValue("Requesting Department") || "AIG Cafe and Restaurant";
          const purpose = noteValue("Purpose / Reason for Purchase") || "—";
          const itemNote = (index: number) => notes.split("\n").find((part) => part.startsWith(`Item ${index + 1} (`)) ?? "";
          const itemDetail = (index: number, field: string) => {
            const match = itemNote(index).match(new RegExp(`${field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}: (.*?)(?:; Remarks:|$)`));
            return match?.[1]?.trim() || "—";
          };
          const creator = detailPo.creator?.name ?? detailPo.requester?.name ?? "—";
          return <div className="max-h-[68vh] space-y-4 overflow-y-auto pr-1">
            <div className="rounded-lg border bg-muted/30 p-4 text-center">
              <p className="text-lg font-bold tracking-wide">ADAMA INVESTMENT GROUP (AIG)</p>
              <h2 className="mt-2 text-xl font-bold">PURCHASE REQUISITION FORM</h2>
              <p className="text-sm font-medium">(Purchase Request / Material Requisition)</p>
            </div>
            <div className="flex flex-wrap items-start justify-between gap-3 text-sm">
              <div className="space-y-2"><p><span className="font-semibold">Requesting Department:</span> {department}</p><p><span className="font-semibold">Purpose / Reason for Purchase:</span> {purpose}</p></div>
              <div className="space-y-2"><p><span className="font-semibold">Ref. No.:</span> __________________</p><p><span className="font-semibold">Date:</span> __________________</p><div className="flex items-center gap-2"><span className="font-semibold">Status:</span>{statusBadge(detailPo.status)}</div></div>
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader><TableRow className="bg-muted/50"><TableHead>No.</TableHead><TableHead>Item Description</TableHead><TableHead>Specification / Model</TableHead><TableHead>Unit of Measure</TableHead><TableHead className="text-right">Quantity</TableHead><TableHead className="text-right">Estimated Unit Price (ETB)</TableHead><TableHead className="text-right">Total Price (ETB)</TableHead><TableHead>Remarks</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(detailPo.items ?? []).map((line, index) => <TableRow key={line.id}><TableCell>{index + 1}</TableCell><TableCell>{poItemName(line)}</TableCell><TableCell>{itemDetail(index, "Specification / Model")}</TableCell><TableCell>{lineUnit(line)}</TableCell><TableCell className="text-right">{Number(line.quantity)}</TableCell><TableCell className="text-right">{formatMoney(line.unit_cost)}</TableCell><TableCell className="text-right">{formatMoney(line.line_total ?? Number(line.quantity) * Number(line.unit_cost))}</TableCell><TableCell>{itemNote(index).split("; Remarks: ")[1] || "—"}</TableCell></TableRow>)}
                  <TableRow className="bg-muted/50 font-semibold"><TableCell colSpan={6} className="text-right">Grand Total</TableCell><TableCell className="text-right">{formatMoney(detailPo.total ?? 0)} ETB</TableCell><TableCell /></TableRow>
                </TableBody>
              </Table>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="overflow-hidden rounded-md border"><div className="border-b bg-muted/50 p-2 text-center font-semibold">A. Requested By</div><div className="space-y-3 p-3 text-sm"><p>Name: {creator}</p><p>Signature: __________________</p><p>Date: {detailPo.submitted_at ? new Date(detailPo.submitted_at).toLocaleDateString() : "—"}</p></div></div>
              <div className="overflow-hidden rounded-md border"><div className="border-b bg-muted/50 p-2 text-center font-semibold">B. Reviewed / Verified By</div><div className="space-y-3 p-3 text-sm"><p>Name: {detailPo.finance_verifier?.name || "—"}</p><p>Signature: __________________</p><p>Date: {detailPo.finance_verified_at ? new Date(detailPo.finance_verified_at).toLocaleDateString() : "—"}</p></div></div>
              <div className="overflow-hidden rounded-md border"><div className="border-b bg-muted/50 p-2 text-center font-semibold">C. Approved By</div><div className="space-y-3 p-3 text-sm"><p>Name: {detailPo.approver?.name || "—"}</p><p>Signature: __________________</p><p>Date: {detailPo.approved_at ? new Date(detailPo.approved_at).toLocaleDateString() : "—"}</p></div></div>
            </div>
            {detailPo.finance_verification_note && <p className="text-sm text-muted-foreground">Finance note: {detailPo.finance_verification_note}</p>}
          </div>;
        })()}
        <DialogFooter><Button variant="outline" onClick={() => setDetailPo(null)}>Close</Button>{detailPo && canApprovePurchaseOrder() && detailPo.status === "finance_verified" && <Button disabled={approve.isPending} onClick={() => approve.mutate(detailPo.id)}><CheckCircle2 className="mr-2 h-4 w-4"/>Approve Purchase</Button>}</DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

export function OrderedItemsReceivingPage() {
 const [status, setStatus] = useState<StatusFilter>("approved");
  const query = useQuery({
    queryKey: ["procurement", "purchase-orders", "receiving", status],
    queryFn: () =>
  procurementService.purchaseOrders(
    {
      per_page: 20,
      status: status === "all" ? undefined : (status as PurchaseOrderStatus),
    },
    "stock-keeper",
  ),
  });
  const rows = query.data?.data ?? [];
  return (
    <div className="space-y-6">
      <PageHeader
        title="Receive Ordered Items"
        description="Stock Keeper receives approved purchase orders."
        icon={PackageCheck}
      />
      {!canReceivePurchaseOrder() && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
          <AlertTriangle className="mr-2 inline h-4 w-4" />
          Only Stock Keeper/Admin should receive stock.
        </div>
      )}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Orders ready for receiving</CardTitle>
              <CardDescription>
                Choose approved or partially received orders.
              </CardDescription>
            </div>
            <Select
              value={status}
              onValueChange={(value) => setStatus(value as StatusFilter)}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="partially_received">
                  Partially received
                </SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <ReceivingOrdersTable
            rows={rows}
            loading={query.isLoading}
            canReceive={canReceivePurchaseOrder()}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function ReceivingOrdersTable({
  rows,
  loading,
  canReceive,
}: {
  rows: PurchaseOrderRow[];
  loading?: boolean;
  canReceive: boolean;
}) {
  if (loading)
    return (
      <p className="text-sm text-muted-foreground">Loading ordered items...</p>
    );
  if (!rows.length)
    return (
      <div className="rounded-xl border border-dashed p-8 text-center">
        <p className="font-medium">No approved orders</p>
        <p className="text-sm text-muted-foreground">
          Approved orders will appear here.
        </p>
      </div>
    );
  return (
    <div className="space-y-3">
      {rows.map((po) => (
        <Card key={po.id}>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-base">
                  {po.po_number ?? `PO-${po.id}`} ·{" "}
                  {po.supplier?.name ?? "Supplier"}
                </CardTitle>
                <CardDescription>
                  {statusBadge(po.status)} · {po.items?.length ?? 0} items ·
                  Total {formatMoney(po.total ?? 0)} ETB
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                {canReceive && ["approved", "partially_received"].includes(po.status) && <ReceiveOrderDialog po={po} />}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <PoLinesTable lines={po.items ?? []} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ReceiveOrderDialog({ po }: { po: PurchaseOrderRow }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PackageCheck className="mr-2 h-4 w-4" />
          Receive order
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Receive {po.po_number ?? `PO-${po.id}`}</DialogTitle>
          <DialogDescription>
            Enter received quantity in each item base unit. Partial receiving is
            allowed.
          </DialogDescription>
        </DialogHeader>
        <ReceiveOrderForm po={po} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ReceiveOrderForm({
  po,
  onDone,
}: {
  po: PurchaseOrderRow;
  onDone?: () => void;
}) {
  const qc = useQueryClient();
  const initialLines = (po.items ?? [])
    .filter((line) => poRemaining(line) > 0)
    .map((line) => ({
      purchase_order_item_id: line.id,
      quantity: String(poRemaining(line)),
      expiry_date: "",
    }));
  const [lines, setLines] = useState(initialLines);
  const [receiptNumber, setReceiptNumber] = useState("");
  const mutation = useMutation({
    mutationFn: (payload: any) =>
      procurementService.receivePurchaseOrder(po.id, payload, "stock-keeper"),
    onSuccess: (result: any) => {
      toast.success("Ordered items received into inventory");
      const receiving = result?.receiving;
      printBusinessDocument({
        title: "Goods Receiving Note",
        reference: `GRN-${String(receiving?.id ?? "").padStart(6, "0")}`,
        details: [
          ["Purchase order", po.po_number ?? `PO-${po.id}`],
          ["Supplier", po.supplier?.name ?? "—"],
          ["Received at", receiving?.received_at ? new Date(receiving.received_at).toLocaleString() : new Date().toLocaleString()],
          ["Status", receiving?.status ?? "approved"],
          ["Receipt Number", receiving?.receipt_number ?? receiptNumber],
        ],
        columns: [
          { key: "item", label: "Inventory item" },
          { key: "quantity", label: "Quantity received", align: "right" },
          { key: "unitCost", label: "Unit cost (ETB)", align: "right" },
          { key: "total", label: "Total (ETB)", align: "right" },
          { key: "expiry", label: "Expiry date" },
        ],
        rows: (receiving?.items ?? []).map((item: any) => ({
          item: item.inventory_item?.name ?? `Item #${item.inventory_item_id}`,
          quantity: `${item.quantity_received} ${item.base_unit ?? ""}`,
          unitCost: formatMoney(item.unit_cost),
          total: formatMoney(Number(item.quantity_received) * Number(item.unit_cost)),
          expiry: item.expiry_date ?? "—",
        })),
        footer: "Goods received against an approved purchase order. Retain with delivery documentation.",
      });
      qc.invalidateQueries({ queryKey: ["procurement"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      onDone?.();
    },
    onError: (error) =>
      toast.error(extractError(error, "Failed to receive ordered items")),
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const items = lines
      .filter((line) => Number(line.quantity) > 0)
      .map((line) => {
        const poLine = (po.items ?? []).find(
          (item) => item.id === line.purchase_order_item_id,
        );
        return {
          purchase_order_item_id: line.purchase_order_item_id,
          quantity: Number(line.quantity),
          unit: lineUnit(poLine),
          expiry_date: line.expiry_date || undefined,
        };
      });
    if (!items.length) {
      toast.error("Enter at least one received quantity");
      return;
    }
    if (!receiptNumber.trim()) { toast.error("Enter the delivery receipt number"); return; }
    mutation.mutate({ receipt_number: receiptNumber.trim(), note: String(form.get("note") ?? ""), items });
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <PoLinesTable lines={po.items ?? []} />
      <div className="space-y-2">
        <Label>Receive quantities</Label>
        {lines.map((line, index) => {
          const poLine = (po.items ?? []).find(
            (item) => item.id === line.purchase_order_item_id,
          );
          return (
            <div
              key={line.purchase_order_item_id}
              className="grid gap-2 rounded-xl border p-3 md:grid-cols-[1fr_140px_160px]"
            >
              <div>
                <p className="font-medium">
                  {poLine
                    ? poItemName(poLine)
                    : `Line #${line.purchase_order_item_id}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  Remaining{" "}
                  {poLine
                    ? formatBaseQuantity(poRemaining(poLine), lineUnit(poLine))
                    : "—"}
                </p>
              </div>
              <Input
                type="number"
                step="0.001"
                max={poLine ? poRemaining(poLine) : undefined}
                value={line.quantity}
                onChange={(event) =>
                  setLines((old) =>
                    old.map((row, i) =>
                      i === index
                        ? { ...row, quantity: event.target.value }
                        : row,
                    ),
                  )
                }
              />
              <Input
                type="date"
                value={line.expiry_date}
                onChange={(event) =>
                  setLines((old) =>
                    old.map((row, i) =>
                      i === index
                        ? { ...row, expiry_date: event.target.value }
                        : row,
                    ),
                  )
                }
              />

            </div>
          );
        })}
      </div>
      <div className="space-y-2">
        <Label htmlFor="receipt-number">Receipt Number *</Label>
        <Input id="receipt-number" required maxLength={100} placeholder="Supplier delivery receipt number" value={receiptNumber} onChange={(event) => setReceiptNumber(event.target.value)} />
      </div>
      <div>
        <Label>Receiving note</Label>
        <Textarea name="note" />
      </div>
      <Button disabled={mutation.isPending} type="submit">
        <RefreshCcw className="mr-2 h-4 w-4" />
        Receive into stock
      </Button>
    </form>
  );
}
