"use client";

import { Fragment, FormEvent, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  Clock3,
  ChevronDown,
  ChevronRight,
  PackageX,
  Truck,
  ClipboardCheck,
  Boxes,
  ClipboardList,
  CookingPot,
  Edit,
  MoreHorizontal,
  Package,
  PackageCheck,
  Plus,
  Printer,
  Download,
  Layers3,
  Box,
  Tag,
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
import { normalizeRole } from "@/config/dashboard.config";
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
  useUpdateRecipeMutation,
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
import api, { unwrap } from "@/lib/api";
import { inventoryService } from "@/services/inventory-management/inventory.service";
import { procurementService } from "@/services/inventory-management/procurement.service";

type Scope = "admin" | "food-controller" | "stock-keeper";

function resolveInventoryActionScope(scope: Scope): Scope {
  const activeRole = normalizeRole(getStoredRoles()[0]);
  return activeRole === "stock-keeper" ? "stock-keeper" : scope;
}
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
  return (
    normalizeRole(getStoredRoles()[0]) === "stock-keeper" ||
    can(inventoryPermissions.lowStock) ||
    can("inventory.alerts.read")
  );
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
  const isGeneralAdmin = normalizeRole(getStoredRoles()[0]) === "general-admin";
  const items = useInventoryItemsQuery({ per_page: isGeneralAdmin ? 100 : 5 });
  const movements = useInventoryTransactionsQuery({ per_page: 5 });
  const lowStock = useLowStockQuery();
  const valuation = useStockValuationQuery();
  const summary = useStockStatusSummaryQuery();

  const purchaseOrders = useQuery({
    queryKey: ["general-admin", "inventory-overview", "purchase-orders"],
    queryFn: () => procurementService.purchaseOrders({ per_page: 100 }, "admin"),
    enabled: isGeneralAdmin,
    staleTime: 30_000,
  });

  const receivings = useQuery({
    queryKey: ["general-admin", "inventory-overview", "stock-receivings"],
    queryFn: () => procurementService.stockReceivings({ per_page: 100 }, "admin"),
    enabled: isGeneralAdmin,
    staleTime: 30_000,
  });

  const consumptionTransactions = useQuery({
    queryKey: ["general-admin", "inventory-overview", "consumption-transactions"],
    queryFn: () => inventoryService.transactions({ per_page: 100, reference_type: "department_stockout" }, "admin"),
    enabled: isGeneralAdmin,
    staleTime: 30_000,
  });

  const adjustmentTransactions = useQuery({
    queryKey: ["general-admin", "inventory-overview", "adjustments"],
    queryFn: () => inventoryService.transactions({ per_page: 100, type: "adjust" }, "admin"),
    enabled: isGeneralAdmin,
    staleTime: 30_000,
  });

  const managementDashboard = useQuery({
    queryKey: ["general-admin", "inventory-overview", "sales-today"],
    queryFn: async () => unwrap<any>(await api.get("/admin/general/dashboard", { params: { days: 7 } })),
    enabled: isGeneralAdmin,
    staleTime: 30_000,
  });

  const rows = items.data?.data ?? [];
  const valuationRows = valuation.data?.rows ?? [];
  const totalValue =
    valuation.data?.total_value ??
    valuationRows.reduce(
      (sum, row) => sum + Number(row.stock_value ?? row.value ?? 0),
      0,
    );

  if (!isGeneralAdmin) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Inventory Overview"
          description="Manager view for stock status, low-stock risk, latest movements and valuation."
          icon={Warehouse}
        />
        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard title="Items" value={items.data?.meta.total ?? rows.length} icon={Package} />
          <MetricCard title="Low stock" value={lowStock.data?.length ?? 0} icon={AlertTriangle} />
          <MetricCard title="Stock value" value={`${formatMoney(totalValue)} ETB`} icon={BarChart3} />
          <MetricCard title="Summary" value={Object.keys(summary.data ?? {}).length || "Ready"} icon={Boxes} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Current stock</CardTitle>
              <CardDescription>Latest inventory items using base units.</CardDescription>
            </CardHeader>
            <CardContent><InventoryItemsTable rows={rows.slice(0, 5)} loading={items.isLoading} /></CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Recent movements</CardTitle>
              <CardDescription>Every stock change is recorded as an inventory transaction.</CardDescription>
            </CardHeader>
            <CardContent><TransactionsTable rows={movements.data?.data ?? []} loading={movements.isLoading} /></CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const purchaseRows = purchaseOrders.data?.data ?? [];
  const receivingRows = receivings.data?.data ?? [];
  const consumptionRows = consumptionTransactions.data?.data ?? [];
  const adjustmentRows = adjustmentTransactions.data?.data ?? [];
  const outOfStockCount = rows.filter((item) => Number(item.current_stock ?? 0) <= 0).length;
  const lowStockCount = lowStock.data?.length ?? rows.filter((item) => Number(item.current_stock ?? 0) > 0 && Number(item.current_stock ?? 0) <= Number(item.minimum_quantity ?? 0)).length;

  const overdueOrders = purchaseRows.filter((po) => {
    if (!po.expected_date || ["completed", "cancelled"].includes(po.status)) return false;
    return new Date(`${po.expected_date}T23:59:59`).getTime() < now.getTime();
  });
  const pendingGrn = receivingRows.filter((receiving: any) => !["approved", "posted", "completed"].includes(String(receiving.status ?? "").toLowerCase()));
  const staleApprovals = purchaseRows.filter((po) => {
    if (!["submitted", "food_validated"].includes(po.status) || !po.created_at) return false;
    return now.getTime() - new Date(po.created_at).getTime() > 48 * 60 * 60 * 1000;
  });
  const delayedSuppliers = new Set(overdueOrders.map((po) => po.supplier?.id ?? po.supplier_id)).size;
  const unusualAdjustments = adjustmentRows.filter((tx) => {
    const minimum = Number(tx.inventory_item?.minimum_quantity ?? tx.inventoryItem?.minimum_quantity ?? 0);
    return Number(tx.quantity ?? 0) >= Math.max(1, minimum * 0.5);
  });

  const todayConsumption = consumptionRows.filter((tx) => String(tx.created_at ?? "").slice(0, 10) === todayKey);
  const consumptionByItem = new Map<number | string, { name: string; unit: BaseUnit; quantity: number; cost: number; beverage: boolean }>();
  let beverageCost = 0;
  let totalConsumption = 0;

  todayConsumption.forEach((tx) => {
    const item = tx.inventory_item ?? tx.inventoryItem;
    const quantity = Math.abs(Number(tx.quantity ?? 0));
    const unitCost = Number(tx.unit_cost ?? item?.average_purchase_price ?? 0);
    const cost = quantity * unitCost;
    const departmentName = String(tx.department?.name ?? "").toLowerCase();
    const itemText = String(item?.name ?? "").toLowerCase();
    const beverage = departmentName.includes("bar") || departmentName.includes("beverage") || /(beer|wine|whisky|whiskey|vodka|gin|soft drink|juice|water|coca|pepsi|sprite|fanta|coffee|tea)/.test(itemText);
    totalConsumption += cost;
    if (beverage) beverageCost += cost;
    const key = item?.id ?? tx.inventory_item_id;
    const current = consumptionByItem.get(key) ?? { name: item?.name ?? `Item #${key}`, unit: itemUnit(item), quantity: 0, cost: 0, beverage };
    current.quantity += quantity;
    current.cost += cost;
    current.beverage = current.beverage || beverage;
    consumptionByItem.set(key, current);
  });

  const foodCost = Math.max(0, totalConsumption - beverageCost);
  const salesToday = Number(managementDashboard.data?.data?.kpis?.today_sales ?? 0);
  const foodCostPercent = salesToday > 0 ? (totalConsumption / salesToday) * 100 : 0;
  const highestConsumption = Array.from(consumptionByItem.values()).sort((a, b) => b.cost - a.cost).slice(0, 5);

  const attentionItems = [
    { label: "items out of stock", value: outOfStockCount, icon: PackageX, href: "/dashboard/inventory/low-stock" },
    { label: "items below minimum stock", value: lowStockCount, icon: AlertTriangle, href: "/dashboard/inventory/low-stock" },
    { label: "PO deliveries overdue", value: overdueOrders.length, icon: Clock3, href: "/dashboard/purchases/requests" },
    { label: "GRNs awaiting inspection", value: pendingGrn.length, icon: ClipboardCheck, href: "/dashboard/purchases/receiving" },
    { label: "unusual stock adjustments", value: unusualAdjustments.length, icon: SlidersHorizontal, href: "/dashboard/inventory/adjustments" },
    { label: "suppliers with delayed deliveries", value: delayedSuppliers, icon: Truck, href: "/dashboard/purchases/suppliers" },
    { label: "PRs waiting over 48 hours for approval", value: staleApprovals.length, icon: ClipboardList, href: "/dashboard/purchases/requests" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Overview"
        description="General Admin view of inventory value, stock risk, procurement exceptions and restaurant consumption."
        icon={Warehouse}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Stock value" value={`${formatMoney(totalValue)} ETB`} icon={BarChart3} />
        <MetricCard title="Stock items" value={items.data?.meta.total ?? rows.length} icon={Package} />
        <MetricCard title="Low stock" value={lowStockCount} icon={AlertTriangle} />
        <MetricCard title="Out of stock" value={outOfStockCount} icon={PackageX} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Current stock</CardTitle>
                <CardDescription>Latest inventory balances and stock status.</CardDescription>
              </div>
              <Button asChild variant="outline" size="sm"><Link href="/dashboard/inventory/stock-balance">View all</Link></Button>
            </div>
          </CardHeader>
          <CardContent><InventoryItemsTable rows={rows.slice(0, 5)} loading={items.isLoading} /></CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Recent stock movements</CardTitle>
                <CardDescription>Latest receipts, issues, returns and adjustments.</CardDescription>
              </div>
              <Button asChild variant="outline" size="sm"><Link href="/dashboard/inventory/movements">View movements</Link></Button>
            </div>
          </CardHeader>
          <CardContent><TransactionsTable rows={movements.data?.data ?? []} loading={movements.isLoading} /></CardContent>
        </Card>
      </div>

      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" /> Requires Attention</CardTitle>
          <CardDescription>Operational exceptions that need General Admin review rather than another passive chart.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {attentionItems.map(({ label, value, icon: Icon, href }) => (
              <Link key={label} href={href} className="group flex items-center justify-between rounded-xl border p-4 transition-colors hover:bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-2 ${value > 0 ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}><Icon className="h-4 w-4" /></div>
                  <div><p className="font-semibold">{value}</p><p className="text-sm text-muted-foreground">{label}</p></div>
                </div>
                <span className="text-xs text-muted-foreground transition-transform group-hover:translate-x-0.5">View →</span>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Inventory Consumption Intelligence</CardTitle>
          <CardDescription>Today&apos;s restaurant consumption cost compared with sales, plus the highest-cost consumed items.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard title="Food Cost Today" value={`${formatMoney(foodCost)} ETB`} icon={CookingPot} />
            <MetricCard title="Beverage Cost" value={`${formatMoney(beverageCost)} ETB`} icon={BarChart3} />
            <MetricCard title="Total Consumption" value={`${formatMoney(totalConsumption)} ETB`} icon={Boxes} />
            <MetricCard title="Sales" value={`${formatMoney(salesToday)} ETB`} icon={BarChart3} />
            <MetricCard title="Consumption Cost" value={`${formatMoney(totalConsumption)} ETB`} icon={Package} />
            <MetricCard title="Food Cost %" value={`${foodCostPercent.toFixed(1)}%`} icon={AlertTriangle} />
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <div><h3 className="font-semibold">Highest Consumption</h3><p className="text-sm text-muted-foreground">Ranked by consumption cost today.</p></div>
            </div>
            {highestConsumption.length ? (
              <div className="overflow-x-auto rounded-xl border">
                <Table>
                  <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Quantity</TableHead><TableHead className="text-right">Cost</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {highestConsumption.map((item) => (
                      <TableRow key={item.name}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>{formatBaseQuantity(item.quantity, item.unit)}</TableCell>
                        <TableCell className="text-right font-medium">{formatMoney(item.cost)} ETB</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <EmptyState title="No consumption recorded today" description="Consumption intelligence will populate automatically from department stock-out transactions." />
            )}
          </div>
        </CardContent>
      </Card>
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
  const actionScope = resolveInventoryActionScope(scope);
  const adjust = useAdjustStockMutation(undefined, actionScope);
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
  const categoriesQuery = useQuery({ queryKey: ["item-categories", "options"], queryFn: async () => { const response = await api.get("/item-categories/options"); return (response.data?.data ?? []) as Array<{ id: number; name: string }>; } });
  const [form, setForm] = useState({
    name: item?.name ?? "",
    sku: item?.sku ?? "",
    description: item?.description ?? "",
    item_category_id: item?.item_category_id ? String(item.item_category_id) : "",
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
      item_category_id: Number(form.item_category_id),
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
            <Label>Category</Label>
            <Select value={form.item_category_id} onValueChange={(value) => setForm({ ...form, item_category_id: value })} disabled={categoriesQuery.isLoading}>
              <SelectTrigger><SelectValue placeholder={categoriesQuery.isLoading ? "Loading categories..." : "Select category"} /></SelectTrigger>
              <SelectContent>{(categoriesQuery.data ?? []).map((category) => <SelectItem key={category.id} value={String(category.id)}>{category.name}</SelectItem>)}</SelectContent>
            </Select>
            {!categoriesQuery.isLoading && !(categoriesQuery.data ?? []).length && <p className="text-xs text-destructive">Create an item category before saving inventory items.</p>}
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
              disabled={create.isPending || update.isPending || !form.item_category_id}
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
  const actionScope = resolveInventoryActionScope(scope);
  const items = useInventoryItemsQuery({ per_page: 100 }, actionScope);
  // Keep mutations on the same role-scoped API used to load the workspace.
  // Store Keepers must call /stock-keeper/*, never the /admin/* endpoints.
  const adjust = useAdjustStockMutation(undefined, actionScope);
  const waste = useRecordWasteMutation(undefined, actionScope);
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
            <TransactionsPreview scope={actionScope} />
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
    : roleNames.some((role) => role.includes("store keeper") || role.includes("stock keeper"))
      ? "stock-keeper"
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

  if (type === "valuation") {
    return (
      <ModernStockValuation
        rows={valuationRows}
        loading={valuation.isLoading}
        totalValue={Number(totalValue)}
        onPrint={printCurrentReport}
      />
    );
  }

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
        title={type === "low-stock" ? "Low Stock" : "Recipe Integrity"}
        description="Inventory reports generated from backend inventory report endpoints."
        icon={type === "low-stock" ? AlertTriangle : CookingPot}
      />
      <div className="flex justify-end print:hidden">
        <Button type="button" variant="outline" onClick={printCurrentReport}>
          <Printer className="mr-2 h-4 w-4" />Print report
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Report rows</CardTitle>
        </CardHeader>
        <CardContent>
          {type === "low-stock" ? (
            <InventoryItemsTable
              rows={lowStock.data ?? []}
              loading={lowStock.isLoading}
            />
          ) : (
            <IntegrityTable
              rows={integrity.data?.rows ?? []}
              loading={integrity.isLoading}
              scope={reportScope}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ModernStockValuation({
  rows,
  loading,
  totalValue,
  onPrint,
}: {
  rows: import("@/types/inventory-management").StockValuationRow[];
  loading?: boolean;
  totalValue: number;
  onPrint: () => void;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [unit, setUnit] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const categories = useMemo(
    () => Array.from(new Set(rows.map((row) => row.category?.name).filter(Boolean) as string[])).sort(),
    [rows],
  );
  const units = useMemo(
    () => Array.from(new Set(rows.map((row) => String(row.base_unit ?? row.unit ?? "pcs")))).sort(),
    [rows],
  );
  const stockStatus = (row: import("@/types/inventory-management").StockValuationRow) => {
    const current = Number(row.current_stock ?? 0);
    const minimum = Number(row.minimum_quantity ?? 0);
    if (current <= 0) return "out";
    if (minimum > 0 && current <= minimum) return "low";
    return "in";
  };
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesSearch = !q || row.name.toLowerCase().includes(q) || String(row.sku ?? "").toLowerCase().includes(q);
      const matchesCategory = category === "all" || row.category?.name === category;
      const matchesUnit = unit === "all" || String(row.base_unit ?? row.unit ?? "pcs") === unit;
      const matchesStatus = status === "all" || stockStatus(row) === status;
      return matchesSearch && matchesCategory && matchesUnit && matchesStatus;
    });
  }, [rows, search, category, unit, status]);

  const totalItems = rows.length;
  const totalStock = rows.reduce((sum, row) => sum + Number(row.current_stock ?? 0), 0);
  const averageValue = totalItems ? totalValue / totalItems : 0;
  const filteredValue = filtered.reduce((sum, row) => sum + Number(row.stock_value ?? row.value ?? 0), 0);
  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, pages);
  const visibleRows = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  const reset = () => {
    setSearch(""); setCategory("all"); setUnit("all"); setStatus("all"); setPage(1);
  };
  const exportCsv = () => {
    const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = [
      ["Item", "SKU", "Category", "Unit", "Stock Quantity", "Average Price (ETB)", "Total Value (ETB)", "Status"],
      ...filtered.map((row) => [row.name, row.sku ?? "", row.category?.name ?? "Uncategorized", row.base_unit ?? row.unit ?? "pcs", row.current_stock, row.average_purchase_price ?? 0, row.stock_value ?? row.value ?? 0, stockStatus(row)]),
    ].map((line) => line.map(escape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "stock-valuation.csv"; anchor.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading valuation...</p>;

  const cardData = [
    { label: "Total Items", value: formatNumber(totalItems), note: "Active inventory items", icon: Layers3, className: "border-blue-200 bg-blue-50/60" },
    { label: "Total Stock Quantity", value: formatNumber(totalStock), note: "Across all units", icon: Box, className: "border-green-200 bg-green-50/60" },
    { label: "Total Stock Value", value: `${formatMoney(totalValue)} ETB`, note: "Based on average cost", icon: BarChart3, className: "border-amber-200 bg-amber-50/60" },
    { label: "Average Item Value", value: `${formatMoney(averageValue)} ETB`, note: "Per item", icon: Tag, className: "border-violet-200 bg-violet-50/60" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-3"><BarChart3 className="h-6 w-6 text-primary" /><h1 className="text-3xl font-bold tracking-tight">Stock Valuation</h1></div>
          <p className="mt-1 text-sm text-muted-foreground">View current stock valuation based on average cost from inventory transactions.</p>
        </div>
        <div className="flex flex-col items-end gap-2 print:hidden">
          <Badge variant="secondary">SI units: g / ml / pc</Badge>
          <Button type="button" variant="outline" onClick={onPrint}><Printer className="mr-2 h-4 w-4" />Print report</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cardData.map(({ label, value, note, icon: Icon, className }) => (
          <Card key={label} className={`shadow-sm ${className}`}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-full bg-background/80 p-3 shadow-sm"><Icon className="h-6 w-6" /></div>
              <div className="min-w-0"><p className="text-sm font-medium text-muted-foreground">{label}</p><p className="mt-1 truncate text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{note}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-sm print:hidden">
        <CardContent className="grid gap-3 p-4 lg:grid-cols-[2fr_1fr_1fr_1fr_auto] lg:items-end">
          <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search item name or code..." className="pl-9" /></div>
          <div><Label className="mb-1 block text-xs">Category</Label><Select value={category} onValueChange={(v) => { setCategory(v); setPage(1); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All categories</SelectItem>{categories.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent></Select></div>
          <div><Label className="mb-1 block text-xs">Unit</Label><Select value={unit} onValueChange={(v) => { setUnit(v); setPage(1); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All units</SelectItem>{units.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent></Select></div>
          <div><Label className="mb-1 block text-xs">Stock Status</Label><Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All items</SelectItem><SelectItem value="in">In Stock</SelectItem><SelectItem value="low">Low Stock</SelectItem><SelectItem value="out">Out of Stock</SelectItem></SelectContent></Select></div>
          <Button type="button" onClick={reset}><RefreshCcw className="mr-2 h-4 w-4" />Reset</Button>
        </CardContent>
      </Card>

      <Card className="overflow-hidden shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-4 border-b pb-4">
          <div><CardTitle className="text-lg">Stock Valuation List</CardTitle><CardDescription>Showing {filtered.length ? (safePage - 1) * perPage + 1 : 0} to {Math.min(safePage * perPage, filtered.length)} of {filtered.length} items · Filtered value {formatMoney(filteredValue)} ETB</CardDescription></div>
          <Button type="button" variant="outline" onClick={exportCsv} className="print:hidden"><Download className="mr-2 h-4 w-4" />Export</Button>
        </CardHeader>
        <CardContent className="p-0">
          {!visibleRows.length ? <div className="p-6"><EmptyState title="No valuation rows" description="No stock valuation records match the selected filters." /></div> : (
            <div className="overflow-x-auto"><Table><TableHeader><TableRow className="bg-muted/40"><TableHead className="w-12">#</TableHead><TableHead>Item</TableHead><TableHead>Category</TableHead><TableHead>Unit</TableHead><TableHead>Stock Quantity</TableHead><TableHead>Average Price (ETB)</TableHead><TableHead>Total Value (ETB)</TableHead><TableHead>Status</TableHead><TableHead className="w-16 text-center print:hidden">Actions</TableHead></TableRow></TableHeader><TableBody>
              {visibleRows.map((row, index) => { const rowStatus = stockStatus(row); const unitName = String(row.base_unit ?? row.unit ?? "pcs"); return <TableRow key={row.id}><TableCell>{(safePage - 1) * perPage + index + 1}</TableCell><TableCell><p className="font-medium">{row.name}</p>{row.sku ? <p className="text-xs text-muted-foreground">{row.sku}</p> : null}</TableCell><TableCell>{row.category?.name ?? "Uncategorized"}</TableCell><TableCell>{unitName}</TableCell><TableCell>{formatBaseQuantity(row.current_stock, itemUnit(row))}</TableCell><TableCell>{formatMoney(row.average_purchase_price)}</TableCell><TableCell className="font-medium">{formatMoney(row.stock_value ?? row.value ?? 0)}</TableCell><TableCell><Badge variant={rowStatus === "out" ? "destructive" : "secondary"} className={rowStatus === "in" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : rowStatus === "low" ? "bg-amber-100 text-amber-700 hover:bg-amber-100" : ""}>{rowStatus === "in" ? "● In Stock" : rowStatus === "low" ? "● Low Stock" : "Out of Stock"}</Badge></TableCell><TableCell className="text-center print:hidden"><Button type="button" variant="ghost" size="icon" onClick={onPrint} aria-label={`Print ${row.name}`}><MoreHorizontal className="h-4 w-4" /></Button></TableCell></TableRow>; })}
            </TableBody></Table></div>
          )}
          <div className="flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
            <div className="flex items-center gap-2 text-sm"><span>Show</span><Select value={String(perPage)} onValueChange={(v) => { setPerPage(Number(v)); setPage(1); }}><SelectTrigger className="w-20"><SelectValue /></SelectTrigger><SelectContent>{[5,10,20,50].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent></Select><span>items per page</span></div>
            <div className="flex items-center gap-1"><Button type="button" size="sm" variant="outline" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>‹</Button>{Array.from({ length: Math.min(pages, 5) }, (_, i) => { const p = pages <= 5 ? i + 1 : Math.min(Math.max(safePage - 2, 1) + i, pages); return <Button key={p} type="button" size="sm" variant={p === safePage ? "default" : "outline"} onClick={() => setPage(p)}>{p}</Button>; })}<Button type="button" size="sm" variant="outline" disabled={safePage >= pages} onClick={() => setPage(safePage + 1)}>›</Button></div>
          </div>
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

function InlineRecipeEditor({
  menuItemId,
  recipe,
  scope,
  onClose,
}: {
  menuItemId: number;
  recipe?: any;
  scope: "admin" | "manager" | "finance" | "food-controller" | "stock-keeper" | "purchaser";
  onClose: () => void;
}) {
  const itemsQuery = useInventoryItemsQuery({ per_page: 100 }, scope);
  const createRecipe = useCreateRecipeMutation(undefined, scope);
  const updateRecipe = useUpdateRecipeMutation(undefined, scope);
  const stockItems = itemsQuery.data?.data ?? [];
  const sourceItems = recipe?.items ?? recipe?.recipe_items ?? [];
  const [inventoryItemId, setInventoryItemId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [draft, setDraft] = useState<Array<{ inventory_item_id: number; quantity: number }>>(() =>
    sourceItems.map((item: any) => ({ inventory_item_id: Number(item.inventory_item_id), quantity: Number(item.quantity) })),
  );

  const selected = stockItems.find((item) => String(item.id) === inventoryItemId);
  const used = new Set(draft.map((item) => item.inventory_item_id));
  const busy = createRecipe.isPending || updateRecipe.isPending;

  function addIngredient() {
    const qty = Number(quantity);
    if (!selected || !Number.isFinite(qty) || qty <= 0 || used.has(Number(selected.id))) return;
    setDraft((current) => [...current, { inventory_item_id: Number(selected.id), quantity: qty }]);
    setInventoryItemId("");
    setQuantity("");
  }

  function save() {
    const items = draft.filter((item) => item.quantity > 0);
    if (!items.length) return;
    const payload = { menu_item_id: menuItemId, items };
    if (recipe?.id) updateRecipe.mutate({ id: recipe.id, payload }, { onSuccess: onClose });
    else createRecipe.mutate(payload, { onSuccess: onClose });
  }

  return (
    <div className="space-y-4 rounded-xl border bg-background p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold">{recipe?.id ? "Edit recipe" : "Add recipe"}</p>
          <p className="text-sm text-muted-foreground">Add ingredients and quantities here without leaving Recipe Integrity.</p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>Close</Button>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_180px_auto] md:items-end">
        <div className="space-y-2">
          <Label>Ingredient</Label>
          <Select value={inventoryItemId} onValueChange={setInventoryItemId}>
            <SelectTrigger><SelectValue placeholder="Select stock item" /></SelectTrigger>
            <SelectContent>
              {stockItems.map((item) => (
                <SelectItem key={item.id} value={String(item.id)} disabled={used.has(Number(item.id))}>
                  {itemName(item)} — {itemUnit(item)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Quantity {selected ? `(${itemUnit(selected)})` : ""}</Label>
          <Input type="number" min="0.001" step="0.001" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </div>
        <Button type="button" variant="outline" onClick={addIngredient} disabled={!selected || Number(quantity) <= 0}>
          <Plus className="mr-2 h-4 w-4" /> Add ingredient
        </Button>
      </div>

      {draft.length > 0 && (
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {draft.map((ingredient) => {
            const item = stockItems.find((stock) => Number(stock.id) === ingredient.inventory_item_id);
            return (
              <div key={ingredient.inventory_item_id} className="grid grid-cols-[1fr_130px_36px] items-center gap-2 rounded-lg border p-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{itemName(item)}</p>
                  <p className="text-xs text-muted-foreground">{itemUnit(item)}</p>
                </div>
                <Input
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={String(ingredient.quantity)}
                  onChange={(e) => {
                    const qty = Number(e.target.value);
                    setDraft((current) => current.map((row) => row.inventory_item_id === ingredient.inventory_item_id ? { ...row, quantity: qty } : row));
                  }}
                />
                <Button type="button" variant="ghost" size="icon" onClick={() => setDraft((current) => current.filter((row) => row.inventory_item_id !== ingredient.inventory_item_id))}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="button" onClick={save} disabled={busy || !draft.some((item) => item.quantity > 0)}>
          {busy ? "Saving..." : recipe?.id ? "Update recipe" : "Save recipe"}
        </Button>
      </div>
    </div>
  );
}

function IntegrityTable({
  rows,
  loading,
  scope = "food-controller",
}: {
  rows: import("@/types/inventory-management").RecipeIntegrityRow[];
  loading?: boolean;
  scope?: "admin" | "manager" | "finance" | "food-controller" | "stock-keeper" | "purchaser";
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<Set<number>>(new Set());
  const recipesQuery = useRecipesQuery({ per_page: 100 }, scope);
  const recipes = recipesQuery.data?.data ?? [];
  const pageSize = 10;

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return rows;
    return rows.filter((row) =>
      [row.menu_item_name, row.name, row.menu_item_type, row.inventory_tracking_mode]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function toggleRow(menuItemId?: number) {
    if (!menuItemId) return;
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(menuItemId)) next.delete(menuItemId);
      else next.add(menuItemId);
      return next;
    });
  }

  function openRecipeEditor(menuItemId?: number) {
    if (!menuItemId) return;
    setExpanded((current) => new Set(current).add(menuItemId));
    setEditing((current) => {
      const next = new Set(current);
      next.add(menuItemId);
      return next;
    });
  }

  function closeRecipeEditor(menuItemId: number) {
    setEditing((current) => {
      const next = new Set(current);
      next.delete(menuItemId);
      return next;
    });
  }

  if (loading)
    return <p className="text-sm text-muted-foreground">Loading recipe integrity...</p>;
  if (!rows.length)
    return <EmptyState title="No recipe rows" description="Recipe integrity data was not returned." />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            placeholder="Search menu item, type or tracking..."
            className="pl-9"
          />
        </div>
        <Badge variant="outline">{filteredRows.length} menu items</Badge>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12" />
              <TableHead>Menu item</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Tracking</TableHead>
              <TableHead>Recipe</TableHead>
              <TableHead>Ingredients</TableHead>
              <TableHead>Missing links</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedRows.map((row, index) => {
              const missing = Number(row.missing_inventory_links ?? 0);
              const menuId = Number(row.menu_item_id ?? 0);
              const recipe = recipes.find((item) => Number(item.menu_item_id) === menuId);
              const ingredients = recipe?.items ?? recipe?.recipe_items ?? [];
              const isExpanded = expanded.has(menuId);
              return (
                <Fragment key={row.recipe_id ?? row.menu_item_id ?? index}>
                  <TableRow>
                    <TableCell>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleRow(menuId)} disabled={!row.recipe_id} aria-label={isExpanded ? "Hide recipe" : "Show recipe"}>
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </Button>
                    </TableCell>
                    <TableCell className="font-medium">{row.menu_item_name ?? row.name ?? "Menu item #" + (row.menu_item_id ?? index + 1)}</TableCell>
                    <TableCell>{row.menu_item_type ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline">{row.inventory_tracking_mode ?? "—"}</Badge></TableCell>
                    <TableCell>{row.recipe_id ? "#" + row.recipe_id : "No recipe"}</TableCell>
                    <TableCell>{row.ingredient_count ?? ingredients.length}</TableCell>
                    <TableCell><Badge variant={missing > 0 ? "destructive" : "secondary"}>{missing}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button type="button" size="sm" variant={row.recipe_id ? "outline" : "default"} onClick={() => openRecipeEditor(menuId)}>
                        <Plus className="mr-2 h-4 w-4" />{row.recipe_id ? "Edit recipe" : "Add recipe"}
                      </Button>
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow>
                      <TableCell colSpan={8} className="bg-muted/20 px-6 py-4">
                        {editing.has(menuId) ? (
                          <InlineRecipeEditor
                            menuItemId={menuId}
                            recipe={recipe}
                            scope={scope}
                            onClose={() => closeRecipeEditor(menuId)}
                          />
                        ) : (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-medium">Recipe ingredients</p>
                              <Badge variant="secondary">{ingredients.length}</Badge>
                            </div>
                            {recipesQuery.isLoading ? (
                              <p className="text-sm text-muted-foreground">Loading ingredients...</p>
                            ) : ingredients.length ? (
                              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                                {ingredients.map((ingredient, ingredientIndex) => {
                                  const item = ingredient.inventory_item ?? ingredient.inventoryItem;
                                  const unit = ingredient.base_unit ?? ingredient.unit ?? item?.base_unit ?? item?.unit ?? "";
                                  return (
                                    <div key={`${menuId}-${ingredient.inventory_item_id}-${ingredientIndex}`} className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2 text-sm">
                                      <span className="font-medium">{itemName(item)}</span>
                                      <span className="shrink-0 text-muted-foreground">{formatNumber(ingredient.quantity)} {unit}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">No recipe ingredients were returned.</p>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {!paginatedRows.length && <EmptyState title="No matching menu items" description="Try another search term." />}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">Page {currentPage} of {totalPages} · {filteredRows.length} item{filteredRows.length === 1 ? "" : "s"}</p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</Button>
          <Button type="button" variant="outline" disabled={currentPage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next</Button>
        </div>
      </div>
    </div>
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
