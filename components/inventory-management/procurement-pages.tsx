"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { PurchaseOrderStatus } from "@/services/inventory-management/procurement.service";

import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  PackageCheck,
  Plus,
  RefreshCcw,
  Printer,
  Search,
  Send,
  Truck,
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
    can(purchasePermissions.ordersCreate) ||
    can(purchasePermissions.requestsCreate) ||
    isStoreKeeperRole()
  );
}
function canSubmitPurchaseOrder() {
  return can(purchasePermissions.ordersSubmit);
}
function canApprovePurchaseOrder() {
  return (
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
  if (["validation_rejected", "cancelled"].includes(normalized))
    return (
      <Badge variant="destructive">{normalized.replaceAll("_", " ")}</Badge>
    );
  if (["food_validated", "approved", "completed"].includes(normalized))
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
  const query = useQuery({
    queryKey: ["procurement", "suppliers", search],
    queryFn: () => procurementService.suppliers({ search, per_page: 20 }),
  });
  const rows = query.data?.data ?? [];
  return (
    <div className="space-y-6">
      <PageHeader
        title="Suppliers"
        description="Purchaser manages suppliers before creating purchase requests."
        icon={Users}
      />
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Supplier list</CardTitle>
              <CardDescription>
                Search suppliers and create new suppliers for procurement.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="pl-9"
                  placeholder="Search supplier..."
                />
              </div>
              <Dialog open={open} onOpenChange={setOpen}>
                {canCreateSupplier() && (
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      New supplier
                    </Button>
                  </DialogTrigger>
                )}
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create supplier</DialogTitle>
                    <DialogDescription>
                      Used by Purchaser for purchase requests.
                    </DialogDescription>
                  </DialogHeader>
                  <SupplierForm onDone={() => setOpen(false)} />
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <SuppliersTable rows={rows} loading={query.isLoading} />
        </CardContent>
      </Card>
    </div>
  );
}
function SupplierForm({ onDone }: { onDone?: () => void }) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (payload: SupplierPayload) =>
      procurementService.createSupplier(payload),
    onSuccess: () => {
      toast.success("Supplier created");
      qc.invalidateQueries({ queryKey: ["procurement", "suppliers"] });
      onDone?.();
    },
    onError: (error) =>
      toast.error(extractError(error, "Failed to create supplier")),
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    mutation.mutate({
      name: String(form.get("name") ?? ""),
      phone: String(form.get("phone") ?? ""),
      email: String(form.get("email") ?? ""),
      address: String(form.get("address") ?? ""),
      tax_id: String(form.get("tax_id") ?? ""),
      is_active: true,
    });
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <Label>Name</Label>
        <Input name="name" required />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label>Phone</Label>
          <Input name="phone" />
        </div>
        <div>
          <Label>Email</Label>
          <Input name="email" type="email" />
        </div>
      </div>
      <div>
        <Label>Tax ID</Label>
        <Input name="tax_id" />
      </div>
      <div>
        <Label>Address</Label>
        <Textarea name="address" />
      </div>
      <Button disabled={mutation.isPending} type="submit">
        Save supplier
      </Button>
    </form>
  );
}
function SuppliersTable({
  rows,
  loading,
}: {
  rows: SupplierRow[];
  loading?: boolean;
}) {
  if (loading)
    return (
      <p className="text-sm text-muted-foreground">Loading suppliers...</p>
    );
  if (!rows.length)
    return (
      <div className="rounded-xl border border-dashed p-8 text-center">
        <p className="font-medium">No suppliers</p>
        <p className="text-sm text-muted-foreground">
          Create suppliers before purchase requests.
        </p>
      </div>
    );
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Phone</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Orders</TableHead>
          <TableHead>Total</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="font-medium">{row.name}</TableCell>
            <TableCell>{row.phone ?? "—"}</TableCell>
            <TableCell>{row.email ?? "—"}</TableCell>
            <TableCell>{row.purchase_orders_count ?? 0}</TableCell>
            <TableCell>
              {formatMoney(row.purchase_orders_total ?? 0)} ETB
            </TableCell>
            <TableCell>
              {row.is_active === false ? (
                <Badge variant="secondary">Inactive</Badge>
              ) : (
                <Badge>Active</Badge>
              )}
            </TableCell>
          </TableRow>
        ))}
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
        description="Store Keeper/Purchaser creates requests, Food Controller validates, Manager approves, and Store Keeper receives."
        icon={ClipboardList}
      />
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Purchase orders</CardTitle>
              <CardDescription>
                Flow: Draft → Submitted → Food Controller Validated → Approved →
                Received.
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
                    Food Controller validated
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
                  <DialogContent className="max-w-4xl">
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
  const suppliers = useQuery({
    queryKey: ["procurement", "suppliers", "for-po"],
    queryFn: () => procurementService.suppliers({ per_page: 100 }),
  });
  const inventory = useInventoryItemsQuery(
    { per_page: 100, status: "active" },
    purchaseRequestScope(),
  );
  const items = inventory.data?.data ?? [];
  const [supplierId, setSupplierId] = useState("");
  const [status, setStatus] = useState<"draft" | "submitted">("submitted");
  const [lines, setLines] = useState<
    Array<{ inventory_item_id: string; quantity: string; unit_cost: string }>
  >([{ inventory_item_id: "", quantity: "", unit_cost: "" }]);
  const mutation = useMutation({
    mutationFn: (payload: PurchaseOrderPayload) =>
      procurementService.createPurchaseOrder(payload, purchaseRequestScope()),
    onSuccess: () => {
      toast.success("Purchase request created");
      qc.invalidateQueries({ queryKey: ["procurement", "purchase-orders"] });
      onDone?.();
    },
    onError: (error) =>
      toast.error(extractError(error, "Failed to create purchase request")),
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanLines = lines
      .filter((line) => line.inventory_item_id && Number(line.quantity) > 0)
      .map((line) => {
        const inv = items.find(
          (item) => String(item.id) === line.inventory_item_id,
        );
        return {
          inventory_item_id: Number(line.inventory_item_id),
          quantity: Number(line.quantity),
          base_unit: inv?.base_unit ?? inv?.unit ?? "pc",
          unit_cost: Number(line.unit_cost || inv?.average_purchase_price || 0),
        };
      });
    if (!supplierId || !cleanLines.length) {
      toast.error("Select supplier and at least one item");
      return;
    }
    mutation.mutate({
      supplier_id: Number(supplierId),
      status,
      items: cleanLines,
    });
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label>Supplier</Label>
          <Select value={supplierId} onValueChange={setSupplierId}>
            <SelectTrigger>
              <SelectValue placeholder="Select supplier" />
            </SelectTrigger>
            <SelectContent>
              {(suppliers.data?.data ?? []).map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select
            value={status}
            onValueChange={(value) => setStatus(value as "draft" | "submitted")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="submitted">Submit now</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Items</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setLines([
                ...lines,
                { inventory_item_id: "", quantity: "", unit_cost: "" },
              ])
            }
          >
            Add line
          </Button>
        </div>
        {lines.map((line, index) => (
          <div
            key={index}
            className="grid gap-2 rounded-xl border p-3 md:grid-cols-[1fr_140px_140px_80px]"
          >
            <Select
              value={line.inventory_item_id}
              onValueChange={(value) =>
                setLines((old) =>
                  old.map((row, i) =>
                    i === index
                      ? {
                          ...row,
                          inventory_item_id: value,
                          unit_cost:
                            row.unit_cost ||
                            String(
                              items.find((item) => String(item.id) === value)
                                ?.average_purchase_price ?? "",
                            ),
                        }
                      : row,
                  ),
                )
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Inventory item" />
              </SelectTrigger>
              <SelectContent>
                {items.map((item) => (
                  <SelectItem key={item.id} value={String(item.id)}>
                    {item.name} ({item.base_unit})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
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
              placeholder="Qty"
              type="number"
              step="0.001"
            />
            <Input
              value={line.unit_cost}
              onChange={(event) =>
                setLines((old) =>
                  old.map((row, i) =>
                    i === index
                      ? { ...row, unit_cost: event.target.value }
                      : row,
                  ),
                )
              }
              placeholder="Cost"
              type="number"
              step="0.01"
            />
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                setLines((old) => old.filter((_, i) => i !== index))
              }
            >
              Remove
            </Button>
          </div>
        ))}
      </div>
      <Button
        disabled={mutation.isPending || inventory.isLoading || !items.length}
        type="submit"
      >
        <Send className="mr-2 h-4 w-4" />
        Save request
      </Button>
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
              {po.supplier?.name ?? `Supplier #${po.supplier_id}`}
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
                {canApprovePurchaseOrder() &&
                  po.status === "food_validated" && (
                    <Button size="sm" onClick={() => approve.mutate(po.id)}>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Approve
                    </Button>
                  )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
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
                <Button type="button" size="sm" variant="outline" onClick={() => printPurchaseOrder(po)}>
                  <Printer className="mr-2 h-4 w-4" />Print PO
                </Button>
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
      batch_note: "",
    }));
  const [lines, setLines] = useState(initialLines);
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
          batch_note: line.batch_note || undefined,
        };
      });
    if (!items.length) {
      toast.error("Enter at least one received quantity");
      return;
    }
    mutation.mutate({ note: String(form.get("note") ?? ""), items });
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
              className="grid gap-2 rounded-xl border p-3 md:grid-cols-[1fr_140px_160px_1fr]"
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
              <Input
                placeholder="Batch note"
                value={line.batch_note}
                onChange={(event) =>
                  setLines((old) =>
                    old.map((row, i) =>
                      i === index
                        ? { ...row, batch_note: event.target.value }
                        : row,
                    ),
                  )
                }
              />
            </div>
          );
        })}
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
