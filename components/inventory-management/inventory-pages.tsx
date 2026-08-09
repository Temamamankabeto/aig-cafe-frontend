"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  ClipboardList,
  CookingPot,
  Edit,
  MoreHorizontal,
  Package,
  PackageCheck,
  Plus,
  Printer,
  RefreshCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  Warehouse,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  formatBaseQuantity,
  formatMoney,
  formatNumber,
} from "@/lib/inventory-management";
import { RecipesTabPage } from "@/components/inventory-management/recipes-tab-page";
import { can, getStoredRoles, inventoryPermissions } from "@/lib/auth/permissions";
import {
  useAdjustStockMutation,
  useCreateInventoryItemMutation,
  useCreateRecipeMutation,
  useDeleteInventoryItemMutation,
  useInventoryBatchesQuery,
  useInventoryItemsQuery,
  useInventoryTransactionsQuery,
  useLowStockQuery,
  useMenuItemsQuery,
  useRecipeIntegrityQuery,
  useRecipesQuery,
  useRecordWasteMutation,
  useStockStatusSummaryQuery,
  useStockValuationQuery,
  useUpdateInventoryItemMutation,
} from "@/hooks/inventory-management";
import type {
  BaseUnit,
  InventoryItem,
  RecipeIngredient,
} from "@/types/inventory-management";
import { printBusinessDocument } from "@/lib/print-documents";

type Scope = "admin" | "food-controller" | "stock-keeper";
const unitOptions: Array<{ value: BaseUnit; label: string; help: string }> = [
  {
    value: "kg",
    label: "kg - kilograms",
    help: "Use for flour, meat, sugar, coffee",
  },
  { value: "L", label: "L - liters", help: "Use for oil, milk, water, sauces" },
  {
    value: "pcs",
    label: "pcs - pieces",
    help: "Use for egg, bottle, pack, counted items",
  },
];

function itemUnit(
  item?: Pick<InventoryItem, "base_unit" | "unit"> | null,
): BaseUnit {
  const unit = item?.base_unit ?? item?.unit;
  return unit === "kg" || unit === "L" || unit === "pcs" ? unit : "pcs";
}

function itemName(item?: Pick<InventoryItem, "name" | "sku"> | null) {
  if (!item) return "—";
  return item.sku ? `${item.name} (${item.sku})` : item.name;
}

function canCreateInventoryItem() {
  return can(inventoryPermissions.create) || can("inventory.create");
}

function canEditInventoryItem() {
  return can(inventoryPermissions.update) || can("inventory.update");
}

function canAdjustInventoryItem() {
  return can(inventoryPermissions.adjust) || can("inventory.adjust");
}

function canDeleteInventoryItem() {
  return can(inventoryPermissions.delete) || can("inventory.destroy");
}

function canViewLowStock() {
  return can(inventoryPermissions.lowStock) || can("inventory.alerts.read");
}

function canViewValuation() {
  return can(inventoryPermissions.valuation) || can("reports.inventory.read");
}

function canViewRecipeIntegrity() {
  return (
    can(inventoryPermissions.recipeIntegrity) || can("reports.inventory.read")
  );
}

function ErrorNote({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {message}
    </p>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-dashed p-8 text-center">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function PageHeader({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: typeof Package;
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
        SI units: g / ml / pc
      </Badge>
    </div>
  );
}

export function InventoryOverviewPage() {
  const items = useInventoryItemsQuery({ per_page: 5 });
  const movements = useInventoryTransactionsQuery({ per_page: 5 });
  const lowStock = useLowStockQuery();
  const valuation = useStockValuationQuery();
  const summary = useStockStatusSummaryQuery();
  const rows = items.data?.data ?? [];
  const valuationRows = valuation.data?.rows ?? [];
  const totalValue =
    valuation.data?.total_value ??
    valuationRows.reduce(
      (sum, row) => sum + Number(row.stock_value ?? row.value ?? 0),
      0,
    );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Overview"
        description="Manager view for stock status, low-stock risk, latest movements and valuation."
        icon={Warehouse}
      />
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard
          title="Items"
          value={items.data?.meta.total ?? rows.length}
          icon={Package}
        />
        <MetricCard
          title="Low stock"
          value={lowStock.data?.length ?? 0}
          icon={AlertTriangle}
        />
        <MetricCard
          title="Stock value"
          value={`${formatMoney(totalValue)} ETB`}
          icon={BarChart3}
        />
        <MetricCard
          title="Summary"
          value={Object.keys(summary.data ?? {}).length || "Ready"}
          icon={Boxes}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Current stock</CardTitle>
            <CardDescription>
              Latest inventory items using base units.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InventoryItemsTable rows={rows} loading={items.isLoading} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent movements</CardTitle>
            <CardDescription>
              Every stock change is recorded as an inventory transaction.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TransactionsTable
              rows={movements.data?.data ?? []}
              loading={movements.isLoading}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  icon: typeof Package;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
        </div>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </CardContent>
    </Card>
  );
}

export function InventoryItemsPage({ scope = "admin" }: { scope?: Scope }) {
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const query = useInventoryItemsQuery({ search, per_page: 20 }, scope);
  const rows = query.data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Items"
        description="Create and maintain stock items. Quantities are saved in base SI units only."
        icon={Package}
      />
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Items</CardTitle>
              <CardDescription>
                Search stock items and monitor current quantity. Row actions are
                role-based.
              </CardDescription>
            </div>
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <div className="relative md:w-72">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="pl-9"
                  placeholder="Search item..."
                />
              </div>
              <Dialog open={showCreate} onOpenChange={setShowCreate}>
                {canCreateInventoryItem() && (
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      New item
                    </Button>
                  </DialogTrigger>
                )}
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Create inventory item</DialogTitle>
                    <DialogDescription>
                      Only F&B Controller/Admin should create master inventory
                      items.
                    </DialogDescription>
                  </DialogHeader>
                  <InventoryItemForm
                    item={null}
                    scope={scope}
                    onCancel={() => setShowCreate(false)}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <InventoryItemsTable
            rows={rows}
            loading={query.isLoading}
            scope={scope}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function InventoryItemsTable({
  rows,
  loading,
  scope = "admin",
}: {
  rows: InventoryItem[];
  loading?: boolean;
  scope?: Scope;
}) {
  if (loading)
    return (
      <p className="text-sm text-muted-foreground">Loading inventory...</p>
    );
  if (!rows.length)
    return (
      <EmptyState
        title="No inventory items"
        description="Create the first stock item from the New item button."
      />
    );

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead>Base unit</TableHead>
            <TableHead>Current stock</TableHead>
            <TableHead>Minimum</TableHead>
            <TableHead>Avg price</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <p className="font-medium">{row.name}</p>
                <p className="text-xs text-muted-foreground">
                  {row.sku ?? "No SKU"}
                </p>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{itemUnit(row)}</Badge>
              </TableCell>
              <TableCell>
                {formatBaseQuantity(row.current_stock, itemUnit(row))}
              </TableCell>
              <TableCell>
                {formatBaseQuantity(row.minimum_quantity, itemUnit(row))}
              </TableCell>
              <TableCell>
                {formatMoney(row.average_purchase_price)} ETB
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    row.is_active === false ? "destructive" : "secondary"
                  }
                >
                  {row.is_active === false ? "Inactive" : "Active"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <InventoryRowActions item={row} scope={scope} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function InventoryRowActions({
  item,
  scope,
}: {
  item: InventoryItem;
  scope: Scope;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const remove = useDeleteInventoryItemMutation();
  const hasAnyAction =
    canEditInventoryItem() ||
    canAdjustInventoryItem() ||
    canDeleteInventoryItem();

  if (!hasAnyAction)
    return <span className="text-xs text-muted-foreground">View only</span>;

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Actions for ${item.name}`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {canEditInventoryItem() && (
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                setEditOpen(true);
              }}
            >
              <Edit className="mr-2 h-4 w-4" /> Edit
            </DropdownMenuItem>
          )}
          {canAdjustInventoryItem() && (
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                setAdjustOpen(true);
              }}
            >
              <SlidersHorizontal className="mr-2 h-4 w-4" /> Adjust
            </DropdownMenuItem>
          )}
          {canDeleteInventoryItem() && (
            <DropdownMenuItem
              className="text-destructive"
              onSelect={(event) => {
                event.preventDefault();
                setDeleteOpen(true);
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit inventory item</DialogTitle>
            <DialogDescription>
              Update item master data. Quantities remain in SI base units.
            </DialogDescription>
          </DialogHeader>
          <InventoryItemForm
            item={item}
            scope={scope}
            onCancel={() => setEditOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <AdjustInventoryDialogContent
          item={item}
          scope={scope}
          onClose={() => setAdjustOpen(false)}
        />
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {item.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the inventory item from active use. Use this only
              when the F&B Controller/Admin confirms the item is no longer
              needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => remove.mutate(item.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function AdjustInventoryDialogContent({
  item,
  scope,
  onClose,
}: {
  item: InventoryItem;
  scope: Scope;
  onClose: () => void;
}) {
  const adjust = useAdjustStockMutation();
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    adjust.mutate({
      id: item.id,
      payload: {
        quantity: Number(quantity),
        reason: note.trim() || "Manual stock adjustment",
      },
    });

    setQuantity("");
    setNote("");
    onClose();
  }

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Adjust stock</DialogTitle>
        <DialogDescription>
          Stock Keeper adjusts {item.name} directly in base unit:{" "}
          {itemUnit(item)}.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-lg bg-muted p-3 text-sm">
          <p>
            Current stock:{" "}
            <strong>
              {formatBaseQuantity(item.current_stock, itemUnit(item))}
            </strong>
          </p>
          <p>
            Minimum:{" "}
            <strong>
              {formatBaseQuantity(item.minimum_quantity, itemUnit(item))}
            </strong>
          </p>
        </div>
        <div className="space-y-2">
          <Label>Quantity ({itemUnit(item)})</Label>
          <Input
            required
            type="number"
            step="0.001"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Reason / note</Label>
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Physical count correction, stock recount, etc."
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={adjust.isPending}>
            Save adjustment
          </Button>
        </div>
      </form>
    </DialogContent>
  );
}

function InventoryItemForm({
  item,
  scope,
  onCancel,
}: {
  item: InventoryItem | null;
  scope: Scope;
  onCancel: () => void;
}) {
  const create = useCreateInventoryItemMutation(onCancel);
  const update = useUpdateInventoryItemMutation(onCancel);
  const [form, setForm] = useState({
    name: item?.name ?? "",
    sku: item?.sku ?? "",
    description: item?.description ?? "",
    base_unit: itemUnit(item),
    current_stock: String(item?.current_stock ?? 0),
    minimum_quantity: String(item?.minimum_quantity ?? 0),
    average_purchase_price: String(item?.average_purchase_price ?? 0),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = {
      name: form.name,
      sku: form.sku,
      description: form.description,
      base_unit: form.base_unit,
      current_stock: Number(form.current_stock),
      minimum_quantity: Number(form.minimum_quantity),
      average_purchase_price: Number(form.average_purchase_price),
    };

    if (item) {
      update.mutate({ id: item.id, payload });
    } else {
      create.mutate(payload);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{item ? "Edit item" : "New item"}</CardTitle>
        <CardDescription>
          Enter quantities in the selected base unit. No conversion table is
          used.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>SKU</Label>
            <Input
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Base unit</Label>
            <Select
              value={form.base_unit}
              onValueChange={(value) =>
                setForm({ ...form, base_unit: value as BaseUnit })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {unitOptions.map((unit) => (
                  <SelectItem key={unit.value} value={unit.value}>
                    {unit.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {unitOptions.find((unit) => unit.value === form.base_unit)?.help}
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Current stock</Label>
              <Input
                type="number"
                min="0"
                step="0.001"
                value={form.current_stock}
                onChange={(e) =>
                  setForm({ ...form, current_stock: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Minimum quantity</Label>
              <Input
                type="number"
                min="0"
                step="0.001"
                value={form.minimum_quantity}
                onChange={(e) =>
                  setForm({ ...form, minimum_quantity: e.target.value })
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Average purchase price</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.average_purchase_price}
              onChange={(e) =>
                setForm({ ...form, average_purchase_price: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={create.isPending || update.isPending}
            >
              {item ? "Update" : "Create"}
            </Button>
            {item && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function StockActionPage({
  mode,
  scope = "admin",
}: {
  mode: "adjust" | "waste" | "receiving";
  scope?: Scope;
}) {
  const items = useInventoryItemsQuery({ per_page: 100 }, scope);
  const adjust = useAdjustStockMutation();
  const waste = useRecordWasteMutation();
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const selectedItem = (items.data?.data ?? []).find(
    (item) => String(item.id) === itemId,
  );
  const title =
    mode === "receiving"
      ? "Stock Receiving"
      : mode === "waste"
        ? "Record Waste / Damage"
        : "Stock Adjustment";
  const description =
    mode === "receiving"
      ? "Receive stock in base units. For purchase order receiving, use the purchase order receive endpoint from procurement."
      : mode === "waste"
        ? "Record damaged, expired or wasted stock directly in base units."
        : "Increase or decrease stock directly in base units.";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!itemId) return;

    // Backend validation requires `reason`, not `note`, for both adjustment and waste.
    // Adjustment accepts positive or negative quantity; waste must be positive.
    const payload = {
      quantity: Number(quantity),
      reason: note.trim() || "Manual stock adjustment",
    };

    if (mode === "waste") {
      waste.mutate({ id: itemId, payload });
    } else {
      adjust.mutate({ id: itemId, payload });
    }

    setQuantity("");
    setNote("");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={description}
        icon={mode === "waste" ? Trash2 : PackageCheck}
      />
      <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription>
              {mode === "adjust"
                ? "Use positive quantity to increase stock or negative quantity to decrease stock."
                : "Quantity must already be in the item base unit."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label>Inventory item</Label>
                <Select value={itemId} onValueChange={setItemId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select item" />
                  </SelectTrigger>
                  <SelectContent>
                    {(items.data?.data ?? []).map((item) => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        {itemName(item)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedItem && (
                <div className="rounded-lg bg-muted p-3 text-sm">
                  <p>
                    Current:{" "}
                    <strong>
                      {formatBaseQuantity(
                        selectedItem.current_stock,
                        itemUnit(selectedItem),
                      )}
                    </strong>
                  </p>
                  <p>
                    Base unit: <strong>{itemUnit(selectedItem)}</strong>
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Label>
                  Quantity (
                  {selectedItem ? itemUnit(selectedItem) : "base unit"})
                </Label>
                <Input
                  required
                  type="number"
                  min={mode === "adjust" ? undefined : "0.001"}
                  step="0.001"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{mode === "waste" ? "Reason" : "Note"}</Label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
              <Button
                disabled={adjust.isPending || waste.isPending || !itemId}
                type="submit"
              >
                Save
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Latest movements</CardTitle>
            <CardDescription>
              Use this to confirm the action was recorded.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TransactionsPreview scope={scope} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TransactionsPreview({ scope = "admin" }: { scope?: Scope }) {
  const query = useInventoryTransactionsQuery({ per_page: 8 }, scope);
  return (
    <TransactionsTable
      rows={query.data?.data ?? []}
      loading={query.isLoading}
    />
  );
}

export function InventoryMovementsPage({
  scope = "stock-keeper",
}: {
  scope?: Scope;
}) {
  const [type, setType] = useState("all");
  const query = useInventoryTransactionsQuery({ per_page: 30, type }, scope);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Movements"
        description="Audit trail of all stock changes. Quantities are recorded in base units."
        icon={ClipboardList}
      />
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Transactions</CardTitle>
              <CardDescription>Filter by movement type.</CardDescription>
            </div>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="md:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[
                  "all",
                  "in",
                  "out",
                  "adjust",
                  "transfer_in",
                  "transfer_out",
                  "waste",
                ].map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <TransactionsTable
            rows={query.data?.data ?? []}
            loading={query.isLoading}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function TransactionsTable({
  rows,
  loading,
}: {
  rows: import("@/types/inventory-management").InventoryTransaction[];
  loading?: boolean;
}) {
  if (loading)
    return (
      <p className="text-sm text-muted-foreground">Loading movements...</p>
    );
  if (!rows.length)
    return (
      <EmptyState
        title="No movements"
        description="Stock changes will appear here."
      />
    );
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>Cost</TableHead>
            <TableHead>Note</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const item = row.inventory_item ?? row.inventoryItem;
            return (
              <TableRow key={row.id}>
                <TableCell>{itemName(item)}</TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {row.transaction_type ?? row.type ?? "movement"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {formatBaseQuantity(row.quantity, itemUnit(item))}
                </TableCell>
                <TableCell>{formatMoney(row.unit_cost)} ETB</TableCell>
                <TableCell className="max-w-[220px] truncate">
                  {row.note ?? "—"}
                </TableCell>
                <TableCell>
                  {row.created_at
                    ? new Date(row.created_at).toLocaleString()
                    : "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function InventoryBatchesPage({
  scope = "stock-keeper",
}: {
  scope?: Scope;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<
  "all" | "active" | "inactive"
>("all");
  const query = useInventoryBatchesQuery(
    { search, status, per_page: 30 },
    scope,
  );
  const rows = query.data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Batches"
        description="Batch remaining quantities and expiry tracking from the backend batch endpoint."
        icon={Boxes}
      />
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Batches</CardTitle>
              <CardDescription>
                Track received batches, remaining stock, expiry and availability
                status.
              </CardDescription>
            </div>
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <div className="relative md:w-72">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="pl-9"
                  placeholder="Search item or SKU..."
                />
              </div>
              <select
  value={status}
  onChange={(e) =>
    setStatus(
      e.target.value as "all" | "active" | "inactive"
    )
  }
>
  <option value="all">
    All
  </option>

  <option value="active">
    Active
  </option>

  <option value="inactive">
    Inactive
  </option>

</select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {query.error ? (
            <ErrorNote message="Could not load batch list. Confirm the backend route /stock-keeper/inventory/batches exists and your role has inventory.items.read permission." />
          ) : (
            <BatchesTable rows={rows} loading={query.isLoading} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BatchStatusBadge({ status }: { status?: string | null }) {
  if (status === "expired") return <Badge variant="destructive">Expired</Badge>;
  if (status === "depleted") return <Badge variant="outline">Depleted</Badge>;
  return <Badge variant="secondary">Available</Badge>;
}

function BatchesTable({
  rows,
  loading,
}: {
  rows: import("@/types/inventory-management").InventoryBatch[];
  loading?: boolean;
}) {
  if (loading)
    return <p className="text-sm text-muted-foreground">Loading batches...</p>;
  if (!rows.length)
    return (
      <EmptyState
        title="No batches"
        description="Received stock batches will appear here after stock receiving."
      />
    );

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead>Batch</TableHead>
            <TableHead>Initial</TableHead>
            <TableHead>Remaining</TableHead>
            <TableHead>Expiry</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Cost</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const item = row.inventory_item ?? row.inventoryItem;
            return (
              <TableRow key={row.id}>
                <TableCell>
                  <p className="font-medium">{itemName(item)}</p>
                  <p className="text-xs text-muted-foreground">
                    Base unit: {itemUnit(item)}
                  </p>
                </TableCell>
                <TableCell>{row.batch_no ?? `#${row.id}`}</TableCell>
                <TableCell>
                  {formatBaseQuantity(row.initial_qty, itemUnit(item))}
                </TableCell>
                <TableCell>
                  {formatBaseQuantity(row.remaining_qty, itemUnit(item))}
                </TableCell>
                <TableCell>{row.expiry_date ?? "—"}</TableCell>
                <TableCell>
                  <BatchStatusBadge status={row.status} />
                </TableCell>
                <TableCell>{formatMoney(row.purchase_price)} ETB</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function RecipesPage({ scope = "food-controller" }: { scope?: Scope }) {
  return <RecipesTabPage scope={scope} />;
}

export function InventoryReportPage({
  type,
}: {
  type: "low-stock" | "valuation" | "recipe-integrity" | "reports";
}) {
  const roleNames = getStoredRoles().map((role) => role.toLowerCase());
  const reportScope = roleNames.includes("general admin")
    ? "admin"
    : roleNames.includes("manager")
      ? "manager"
      : roleNames.includes("finance")
        ? "finance"
        : "food-controller";
  const lowStock = useLowStockQuery(reportScope);
  const valuation = useStockValuationQuery(reportScope);
  const integrity = useRecipeIntegrityQuery(reportScope);
  const valuationRows = valuation.data?.rows ?? [];
  const totalValue =
    valuation.data?.total_value ??
    valuationRows.reduce(
      (sum, row) => sum + Number(row.stock_value ?? row.value ?? 0),
      0,
    );

  function printCurrentReport() {
    if (type === "low-stock") {
      const rows = lowStock.data ?? [];
      printBusinessDocument({
        title: "Low Stock Report",
        columns: [
          { key: "item", label: "Inventory item" },
          { key: "current", label: "Current stock", align: "right" },
          { key: "minimum", label: "Minimum stock", align: "right" },
          { key: "shortage", label: "Shortage", align: "right" },
        ],
        rows: rows.map((row) => ({
          item: itemName(row),
          current: formatBaseQuantity(row.current_stock, itemUnit(row)),
          minimum: formatBaseQuantity(row.minimum_quantity, itemUnit(row)),
          shortage: formatBaseQuantity(Math.max(Number(row.minimum_quantity ?? 0) - Number(row.current_stock ?? 0), 0), itemUnit(row)),
        })),
        summary: [["Low-stock items", rows.length]],
      });
      return;
    }

    if (type === "valuation") {
      printBusinessDocument({
        title: "Stock Valuation Report",
        columns: [
          { key: "item", label: "Inventory item" },
          { key: "stock", label: "Current stock", align: "right" },
          { key: "price", label: "Average price (ETB)", align: "right" },
          { key: "value", label: "Stock value (ETB)", align: "right" },
        ],
        rows: valuationRows.map((row) => ({
          item: itemName(row),
          stock: formatBaseQuantity(row.current_stock, itemUnit(row)),
          price: formatMoney(row.average_purchase_price),
          value: formatMoney(row.stock_value ?? row.value ?? 0),
        })),
        summary: [["Total stock value", `${formatMoney(totalValue)} ETB`]],
      });
      return;
    }

    const rows = integrity.data?.rows ?? [];
    printBusinessDocument({
      title: "Recipe Integrity Report",
      columns: [
        { key: "item", label: "Menu item" },
        { key: "mode", label: "Tracking mode" },
        { key: "recipe", label: "Recipe" },
        { key: "ingredients", label: "Ingredients", align: "right" },
        { key: "issue", label: "Control issue" },
      ],
      rows: rows.map((row) => ({
        item: row.menu_item_name ?? row.name ?? "—",
        mode: row.inventory_tracking_mode ?? row.menu_item_type ?? "—",
        recipe: row.recipe_id ? `#${row.recipe_id}` : "Missing",
        ingredients: row.ingredient_count ?? 0,
        issue: row.issue ?? (Number(row.missing_inventory_links ?? 0) > 0 ? "Missing inventory link" : "Review required"),
      })),
      summary: [["Rows reviewed", rows.length]],
    });
  }

  if (type === "low-stock" && !canViewLowStock())
    return (
      <EmptyState
        title="No permission"
        description="You do not have permission to view low-stock alerts."
      />
    );
  if (type === "valuation" && !canViewValuation())
    return (
      <EmptyState
        title="No permission"
        description="You do not have permission to view stock valuation."
      />
    );
  if (type === "recipe-integrity" && !canViewRecipeIntegrity())
    return (
      <EmptyState
        title="No permission"
        description="You do not have permission to view recipe integrity."
      />
    );

  if (type === "reports") {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Inventory Reports"
          description="Manager and F&B Controller reports for SI-unit stock control."
          icon={BarChart3}
        />
        <div className="grid gap-4 md:grid-cols-3">
          <ReportLink
            href="/dashboard/inventory/low-stock"
            title="Low stock"
            icon={AlertTriangle}
          />
          <ReportLink
            href="/dashboard/inventory/valuation"
            title="Stock valuation"
            icon={BarChart3}
          />
          <ReportLink
            href="/dashboard/inventory/recipe-integrity"
            title="Recipe integrity"
            icon={CookingPot}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          type === "low-stock"
            ? "Low Stock"
            : type === "valuation"
              ? "Stock Valuation"
              : "Recipe Integrity"
        }
        description="Inventory reports generated from backend inventory report endpoints."
        icon={
          type === "low-stock"
            ? AlertTriangle
            : type === "valuation"
              ? BarChart3
              : CookingPot
        }
      />
      <div className="flex justify-end print:hidden">
        <Button type="button" variant="outline" onClick={printCurrentReport}>
          <Printer className="mr-2 h-4 w-4" />Print report
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>
            {type === "valuation"
              ? `Total value: ${formatMoney(totalValue)} ETB`
              : "Report rows"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {type === "low-stock" ? (
            <InventoryItemsTable
              rows={lowStock.data ?? []}
              loading={lowStock.isLoading}
            />
          ) : type === "valuation" ? (
            <ValuationTable
              rows={valuationRows}
              loading={valuation.isLoading}
            />
          ) : (
            <IntegrityTable
              rows={integrity.data?.rows ?? []}
              loading={integrity.isLoading}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ReportLink({
  href,
  title,
  icon: Icon,
}: {
  href: string;
  title: string;
  icon: typeof Package;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border p-5 transition hover:bg-muted"
    >
      <Icon className="mb-3 h-5 w-5 text-primary" />
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">Open report</p>
    </Link>
  );
}

function ValuationTable({
  rows,
  loading,
}: {
  rows: import("@/types/inventory-management").StockValuationRow[];
  loading?: boolean;
}) {
  if (loading)
    return (
      <p className="text-sm text-muted-foreground">Loading valuation...</p>
    );
  if (!rows.length)
    return (
      <EmptyState
        title="No valuation rows"
        description="Stock valuation data will appear here."
      />
    );
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Item</TableHead>
          <TableHead>Stock</TableHead>
          <TableHead>Avg price</TableHead>
          <TableHead>Value</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>{itemName(row)}</TableCell>
            <TableCell>
              {formatBaseQuantity(row.current_stock, itemUnit(row))}
            </TableCell>
            <TableCell>{formatMoney(row.average_purchase_price)} ETB</TableCell>
            <TableCell>
              {formatMoney(row.stock_value ?? row.value)} ETB
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function IntegrityTable({
  rows,
  loading,
}: {
  rows: import("@/types/inventory-management").RecipeIntegrityRow[];
  loading?: boolean;
}) {
  if (loading)
    return (
      <p className="text-sm text-muted-foreground">
        Loading recipe integrity...
      </p>
    );
  if (!rows.length)
    return (
      <EmptyState
        title="No recipe rows"
        description="Recipe integrity data was not returned."
      />
    );
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Menu item</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Tracking</TableHead>
          <TableHead>Recipe</TableHead>
          <TableHead>Ingredients</TableHead>
          <TableHead>Missing links</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => {
          const missing = Number(row.missing_inventory_links ?? 0);
          return (
            <TableRow key={row.recipe_id ?? row.menu_item_id ?? index}>
              <TableCell>
                {row.menu_item_name ??
                  row.name ??
                  "Menu item #" + (row.menu_item_id ?? index + 1)}
              </TableCell>
              <TableCell>{row.menu_item_type ?? "—"}</TableCell>
              <TableCell>
                <Badge variant="outline">
                  {row.inventory_tracking_mode ?? "—"}
                </Badge>
              </TableCell>
              <TableCell>
                {row.recipe_id ? "#" + row.recipe_id : "No recipe"}
              </TableCell>
              <TableCell>{row.ingredient_count ?? 0}</TableCell>
              <TableCell>
                <Badge variant={missing > 0 ? "destructive" : "secondary"}>
                  {missing}
                </Badge>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export function InventoryHomePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Management"
        description="Role-based inventory center using SI base units only."
        icon={Warehouse}
      />
      <Tabs defaultValue="stock-keeper">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
          <TabsTrigger value="manager">Manager</TabsTrigger>
          <TabsTrigger value="fnb">F&B</TabsTrigger>
          <TabsTrigger value="stock-keeper">Stock Keeper</TabsTrigger>
          <TabsTrigger value="purchaser">Purchaser</TabsTrigger>
        </TabsList>
        <TabsContent value="manager">
          <RoleLinks
            links={[
              ["Overview", "/dashboard/inventory/overview"],
              ["Reports", "/dashboard/inventory/reports"],
              ["Valuation", "/dashboard/inventory/valuation"],
            ]}
          />
        </TabsContent>
        <TabsContent value="fnb">
          <RoleLinks
            links={[
              ["Items", "/dashboard/inventory/items"],
              ["Recipes", "/dashboard/inventory/recipes"],
              ["Low Stock", "/dashboard/inventory/low-stock"],
              ["Recipe Integrity", "/dashboard/inventory/recipe-integrity"],
            ]}
          />
        </TabsContent>
        <TabsContent value="stock-keeper">
          <RoleLinks
            links={[
              ["Receiving", "/dashboard/inventory/receiving"],
              ["Adjustments", "/dashboard/inventory/adjustments"],
              ["Waste", "/dashboard/inventory/waste"],
              ["Movements", "/dashboard/inventory/movements"],
              ["Batches", "/dashboard/inventory/batches"],
            ]}
          />
        </TabsContent>
        <TabsContent value="purchaser">
          <RoleLinks
            links={[
              ["Suppliers", "/dashboard/modules/suppliers"],
              ["Purchase Orders", "/dashboard/modules/purchase-orders"],
              ["Receiving History", "/dashboard/modules/purchase-receivings"],
            ]}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RoleLinks({ links }: { links: Array<[string, string]> }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {links.map(([label, href]) => (
        <Button
          key={href}
          asChild
          variant="outline"
          className="h-20 justify-start"
        >
          <Link href={href}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            {label}
          </Link>
        </Button>
      ))}
    </div>
  );
}
