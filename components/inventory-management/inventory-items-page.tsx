"use client";

import { FormEvent, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Edit, MoreHorizontal, Package, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { can, inventoryPermissions } from "@/lib/auth/permissions";
import { formatBaseQuantity, formatMoney } from "@/lib/inventory-management";
import { useCreateInventoryItemMutation, useInventoryItemsQuery, useUpdateInventoryItemMutation } from "@/hooks/inventory-management";
import type { BaseUnit, InventoryItem } from "@/types/inventory-management";
import api from "@/lib/api";

type Scope = "admin" | "food-controller" | "stock-keeper";
type ItemCategoryOption = { id: number; name: string };

function useItemCategoryOptions() {
  return useQuery({
    queryKey: ["item-category-options"],
    queryFn: async () => {
      const response = await api.get("/item-categories/options");
      return (response.data?.data ?? []) as ItemCategoryOption[];
    },
    staleTime: 60_000,
  });
}

const unitOptions: Array<{ value: BaseUnit; label: string; help: string }> = [
  { value: "kg", label: "kg - kilograms", help: "Use kg for solid stock items like flour, meat, sugar, coffee, rice, and spices." },
  { value: "L", label: "L - liters", help: "Use L for liquid stock items like oil, milk, water, juice, and sauces." },
  { value: "pcs", label: "pcs - pieces", help: "Use pcs for countable items like eggs, bottles, packs, and cartons." },
];

function itemUnit(item?: Pick<InventoryItem, "base_unit" | "unit"> | null): BaseUnit {
  const unit = item?.base_unit ?? item?.unit;
  return unit === "kg" || unit === "L" || unit === "pcs" ? unit : "pcs";
}

function canCreateInventoryItem() {
  return can(inventoryPermissions.create) || can("inventory.create");
}

function canEditInventoryItem() {
  return can(inventoryPermissions.update) || can("inventory.update");
}

function PageHeader() {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-primary/10 p-2 text-primary"><Package className="h-5 w-5" /></div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory Items</h1>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">Create and maintain stock items. Quantities are saved in SI units only.</p>
      </div>
      <Badge variant="secondary" className="w-fit">SI units: kg / L / pcs</Badge>
    </div>
  );
}

export function InventoryItemsPage({ scope = "admin" }: { scope?: Scope }) {
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const query = useInventoryItemsQuery({ search, per_page: 20 }, scope);
  const rows = query.data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader />
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Items</CardTitle>
              <CardDescription>Search stock items and monitor current quantity. Add and edit forms use kg / L / pcs only.</CardDescription>
            </div>
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <div className="relative md:w-72">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Search item..." />
              </div>
              <Dialog open={showCreate} onOpenChange={setShowCreate}>
                {canCreateInventoryItem() && (
                  <DialogTrigger asChild>
                    <Button><Plus className="mr-2 h-4 w-4" />New item</Button>
                  </DialogTrigger>
                )}
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Create inventory item</DialogTitle>
                    <DialogDescription>Only F&B Controller/Admin should create master inventory items.</DialogDescription>
                  </DialogHeader>
                  <InventoryItemForm item={null} scope={scope} onCancel={() => setShowCreate(false)} />
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent><InventoryItemsTable rows={rows} loading={query.isLoading} scope={scope} /></CardContent>
      </Card>
    </div>
  );
}

function InventoryItemsTable({ rows, loading, scope }: { rows: InventoryItem[]; loading?: boolean; scope: Scope }) {
  if (loading) return <p className="text-sm text-muted-foreground">Loading inventory...</p>;
  if (!rows.length) return <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No inventory items found.</p>;

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
              <TableCell><p className="font-medium">{row.name}</p><p className="text-xs text-muted-foreground">{row.sku ?? "No SKU"}</p></TableCell>
              <TableCell><Badge variant="outline">{itemUnit(row)}</Badge></TableCell>
              <TableCell>{formatBaseQuantity(row.current_stock, itemUnit(row))}</TableCell>
              <TableCell>{formatBaseQuantity(row.minimum_quantity, itemUnit(row))}</TableCell>
              <TableCell>{formatMoney(row.average_purchase_price)} ETB</TableCell>
              <TableCell><Badge variant={row.is_active === false ? "destructive" : "secondary"}>{row.is_active === false ? "Inactive" : "Active"}</Badge></TableCell>
              <TableCell className="text-right"><InventoryRowActions item={row} scope={scope} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function InventoryRowActions({ item, scope }: { item: InventoryItem; scope: Scope }) {
  const [editOpen, setEditOpen] = useState(false);

  if (!canEditInventoryItem()) return <span className="text-xs text-muted-foreground">View only</span>;

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Actions for ${item.name}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onSelect={(event) => { event.preventDefault(); setEditOpen(true); }}><Edit className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit inventory item</DialogTitle>
            <DialogDescription>Update item master data. Quantities remain in kg / L / pcs. No conversion is used.</DialogDescription>
          </DialogHeader>
          <InventoryItemForm item={item} scope={scope} onCancel={() => setEditOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function InventoryItemForm({ item, scope, onCancel }: { item: InventoryItem | null; scope: Scope; onCancel: () => void }) {
  const create = useCreateInventoryItemMutation(onCancel, scope);
  const update = useUpdateInventoryItemMutation(onCancel, scope);
  const categoriesQuery = useItemCategoryOptions();
  const categories = categoriesQuery.data ?? [];
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
      base_unit: form.base_unit as BaseUnit,
      current_stock: Number(form.current_stock || 0),
      minimum_quantity: Number(form.minimum_quantity || 0),
      average_purchase_price: Number(form.average_purchase_price || 0),
      is_active: true,
    };

    if (item) update.mutate({ id: item.id, payload });
    else create.mutate(payload);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{item ? "Edit item" : "New item"}</CardTitle>
        <CardDescription>Enter quantities directly in kg, L, or pcs. No unit conversion table is used.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2"><Label>Name</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="space-y-2"><Label>SKU</Label><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={form.item_category_id} onValueChange={(value) => setForm({ ...form, item_category_id: value })} disabled={categoriesQuery.isLoading}>
              <SelectTrigger><SelectValue placeholder={categoriesQuery.isLoading ? "Loading categories..." : "Select category"} /></SelectTrigger>
              <SelectContent>{categories.map((category) => <SelectItem key={category.id} value={String(category.id)}>{category.name}</SelectItem>)}</SelectContent>
            </Select>
            {!categoriesQuery.isLoading && categories.length === 0 && <p className="text-xs text-destructive">Create an item category before saving an inventory item.</p>}
          </div>
          <div className="space-y-2">
            <Label>Base unit</Label>
            <Select value={form.base_unit} onValueChange={(value) => setForm({ ...form, base_unit: value as BaseUnit })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{unitOptions.map((unit) => <SelectItem key={unit.value} value={unit.value}>{unit.label}</SelectItem>)}</SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{unitOptions.find((unit) => unit.value === form.base_unit)?.help}</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2"><Label>Current stock</Label><Input type="number" min="0" step="0.001" value={form.current_stock} onChange={(e) => setForm({ ...form, current_stock: e.target.value })} /></div>
            <div className="space-y-2"><Label>Minimum quantity</Label><Input type="number" min="0" step="0.001" value={form.minimum_quantity} onChange={(e) => setForm({ ...form, minimum_quantity: e.target.value })} /></div>
          </div>
          <div className="space-y-2"><Label>Average purchase price</Label><Input type="number" min="0" step="0.01" value={form.average_purchase_price} onChange={(e) => setForm({ ...form, average_purchase_price: e.target.value })} /></div>
          <div className="space-y-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="flex gap-2"><Button type="submit" disabled={create.isPending || update.isPending || categoriesQuery.isLoading || !form.item_category_id}>{item ? "Update" : "Create"}</Button>{item && <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>}</div>
        </form>
      </CardContent>
    </Card>
  );
}
