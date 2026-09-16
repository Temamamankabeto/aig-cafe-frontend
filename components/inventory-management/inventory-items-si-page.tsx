"use client";

import { FormEvent, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Edit, MoreHorizontal, Package, Plus, RefreshCw, Search, SlidersHorizontal, Trash2 } from "lucide-react";
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { formatBaseQuantity, formatMoney } from "@/lib/inventory-management";
import { can, inventoryPermissions } from "@/lib/auth/permissions";
import { useAdjustStockMutation, useCreateInventoryItemMutation, useDeleteInventoryItemMutation, useInventoryItemsQuery, useUpdateInventoryItemMutation } from "@/hooks/inventory-management";
import type { BaseUnit, InventoryItem } from "@/types/inventory-management";
import api from "@/lib/api";

type Scope =
  | "admin"
  | "food-controller"
  | "stock-keeper"
  | "purchaser";

type UnitOption = { id: number; name: string; symbol: string };
type ItemCategoryOption = { id: number; name: string };

function normalizeUnit(value?: string | null): BaseUnit {
  return (value ?? "").trim();
}

function useUnitOptions() {
  return useQuery({
    queryKey: ["unit-options"],
    queryFn: async () => {
      const response = await api.get("/units/options");
      return (response.data?.data ?? []) as UnitOption[];
    },
    staleTime: 60_000,
  });
}

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

function itemUnit(item?: Pick<InventoryItem, "base_unit" | "unit"> | null): BaseUnit {
  return normalizeUnit(item?.base_unit ?? item?.unit) || "pcs";
}

function itemDisplayName(item?: Pick<InventoryItem, "name" | "sku"> | null) {
  if (!item) return "—";
  return item.sku ? `${item.name} (${item.sku})` : item.name;
}

function generateSkuFromName(name: string) {
  const prefix = (name || "ITEM")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 12) || "ITEM";

  const datePart = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();

  return `${prefix}-${datePart}-${randomPart}`;
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

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed p-8 text-center">
      <p className="font-medium">No inventory items</p>
      <p className="mt-1 text-sm text-muted-foreground">Create the first stock item and select its base unit from Unit master data.</p>
    </div>
  );
}

export function InventoryItemsSiPage({ scope = "admin" }: { scope?: Scope }) {
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const query = useInventoryItemsQuery({ search, per_page: 20 }, scope);
  const rows = query.data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-primary/10 p-2 text-primary"><Package className="h-5 w-5" /></div>
            <h1 className="text-2xl font-bold tracking-tight">Inventory Items</h1>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Create and edit stock items using Unit master data.</p>
        </div>
        <Badge variant="secondary" className="w-fit">Base units: Unit master data</Badge>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div><CardTitle>Items</CardTitle><CardDescription>All stock, minimum quantity, adjustment, purchase, receiving, and recipe quantities must use the selected strict unit.</CardDescription></div>
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <div className="relative md:w-72"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Search item..." /></div>
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                {canCreateInventoryItem() && (
                  <DialogTrigger asChild>
                    <Button><Plus className="mr-2 h-4 w-4" />New item</Button>
                  </DialogTrigger>
                )}
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Create inventory item</DialogTitle>
                    <DialogDescription>SKU is optional. Use Generate SKU when you want the system to create one for you.</DialogDescription>
                  </DialogHeader>
                  <InventoryItemSiForm item={null} scope={scope} onDone={() => setCreateOpen(false)} />
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>{query.isLoading ? <p className="text-sm text-muted-foreground">Loading inventory...</p> : rows.length ? <InventoryItemsTable rows={rows} scope={scope} /> : <EmptyState />}</CardContent>
      </Card>
    </div>
  );
}

function InventoryItemsTable({ rows, scope }: { rows: InventoryItem[]; scope: Scope }) {
  return <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Unit</TableHead><TableHead>Current stock</TableHead><TableHead>Minimum quantity</TableHead><TableHead>Avg price / unit</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{rows.map((row) => { const unit = itemUnit(row); return <TableRow key={row.id}><TableCell><p className="font-medium">{row.name}</p><p className="text-xs text-muted-foreground">{row.sku ?? "No SKU"}</p></TableCell><TableCell><Badge variant="outline">{unit}</Badge></TableCell><TableCell>{formatBaseQuantity(row.current_stock, unit)}</TableCell><TableCell>{formatBaseQuantity(row.minimum_quantity, unit)}</TableCell><TableCell>{formatMoney(row.average_purchase_price)} ETB / {unit}</TableCell><TableCell><Badge variant={row.is_active === false ? "destructive" : "secondary"}>{row.is_active === false ? "Inactive" : "Active"}</Badge></TableCell><TableCell className="text-right"><InventoryRowActions item={row} scope={scope} /></TableCell></TableRow>; })}</TableBody></Table></div>;
}

function InventoryRowActions({ item, scope }: { item: InventoryItem; scope: Scope }) {
  const [editOpen, setEditOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const remove = useDeleteInventoryItemMutation(scope);
  const hasAnyAction = canEditInventoryItem() || canAdjustInventoryItem() || canDeleteInventoryItem();
  if (!hasAnyAction) return <span className="text-xs text-muted-foreground">View only</span>;

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Actions for ${item.name}`}><MoreHorizontal className="h-4 w-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {canEditInventoryItem() && <DropdownMenuItem onSelect={(event) => { event.preventDefault(); setEditOpen(true); }}><Edit className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>}
          {canAdjustInventoryItem() && <DropdownMenuItem onSelect={(event) => { event.preventDefault(); setAdjustOpen(true); }}><SlidersHorizontal className="mr-2 h-4 w-4" /> Adjust</DropdownMenuItem>}
          {canDeleteInventoryItem() && <DropdownMenuItem className="text-destructive" onSelect={(event) => { event.preventDefault(); setDeleteOpen(true); }}><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit inventory item</DialogTitle>
            <DialogDescription>SKU is optional. Use Generate SKU when you want to replace or add one.</DialogDescription>
          </DialogHeader>
          <InventoryItemSiForm item={item} scope={scope} onDone={() => setEditOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <AdjustStockSiDialog item={item} scope={scope} onDone={() => setAdjustOpen(false)} />
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {item.name}?</AlertDialogTitle>
            <AlertDialogDescription>This removes the inventory item from active use.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => remove.mutate(item.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function InventoryItemSiForm({ item, scope, onDone }: { item: InventoryItem | null; scope: Scope; onDone: () => void }) {
  const create = useCreateInventoryItemMutation(onDone, scope);
  const update = useUpdateInventoryItemMutation(onDone, scope);
  const unitsQuery = useUnitOptions();
  const categoriesQuery = useItemCategoryOptions();
  const units = unitsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const initialUnit = item ? itemUnit(item) : "";
  const [form, setForm] = useState({ name: item?.name ?? "", sku: item?.sku ?? "", description: item?.description ?? "", item_category_id: item?.item_category_id ? String(item.item_category_id) : "", base_unit: initialUnit, current_stock: String(item?.current_stock ?? 0), minimum_quantity: String(item?.minimum_quantity ?? 0), average_purchase_price: String(item?.average_purchase_price ?? 0) });
  const selectedUnit = normalizeUnit(form.base_unit);
  const selectedUnitRecord = units.find((unit) => unit.symbol === selectedUnit);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const sku = form.sku.trim();
    const payload = {
      name: form.name.trim(),
      sku: sku || undefined,
      description: form.description.trim(),
      item_category_id: Number(form.item_category_id),
      base_unit: selectedUnit,
      current_stock: Number(form.current_stock || 0),
      minimum_quantity: Number(form.minimum_quantity || 0),
      average_purchase_price: Number(form.average_purchase_price || 0),
      is_active: item?.is_active ?? true,
    };

    if (item) update.mutate({ id: item.id, payload });
    else create.mutate(payload);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">
        <p className="font-medium">Inventory item rule</p>
        <p className="text-muted-foreground">Name, category and base unit are required. SKU can be typed manually or generated automatically.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2"><Label>Name</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="space-y-2">
          <Label>SKU</Label>
          <div className="flex gap-2">
            <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="Optional SKU" />
            <Button type="button" variant="outline" onClick={() => setForm((current) => ({ ...current, sku: generateSkuFromName(current.name) }))}>
              <RefreshCw className="mr-2 h-4 w-4" /> Generate
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Leave empty when SKU is not needed.</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Category</Label>
        <Select value={form.item_category_id} onValueChange={(value) => setForm({ ...form, item_category_id: value })} disabled={categoriesQuery.isLoading}>
          <SelectTrigger><SelectValue placeholder={categoriesQuery.isLoading ? "Loading categories..." : "Select category"} /></SelectTrigger>
          <SelectContent>
            {categories.map((category) => <SelectItem key={category.id} value={String(category.id)}>{category.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {!categoriesQuery.isLoading && categories.length === 0 && <p className="text-xs text-destructive">Create an item category in General Admin → Item Categories before saving an inventory item.</p>}
      </div>

      <div className="space-y-2">
        <Label>Base unit</Label>
        <Select value={selectedUnit} onValueChange={(value) => setForm({ ...form, base_unit: normalizeUnit(value) })} disabled={unitsQuery.isLoading}>
          <SelectTrigger><SelectValue placeholder={unitsQuery.isLoading ? "Loading units..." : "Select base unit"} /></SelectTrigger>
          <SelectContent>
            {units.map((unit) => <SelectItem key={unit.id} value={unit.symbol}>{unit.name} ({unit.symbol})</SelectItem>)}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{selectedUnitRecord ? `Unit ID: ${selectedUnitRecord.id} · ${selectedUnitRecord.name} (${selectedUnitRecord.symbol})` : "Choose a unit created in General Admin → Units."}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-2">
          <Label>Current stock ({selectedUnit})</Label>
          <Input type="number" min="0" step="0.001" value={form.current_stock} onChange={(e) => setForm({ ...form, current_stock: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Minimum quantity ({selectedUnit})</Label>
          <Input type="number" min="0" step="0.001" value={form.minimum_quantity} onChange={(e) => setForm({ ...form, minimum_quantity: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Avg purchase price / {selectedUnit}</Label>
          <Input type="number" min="0" step="0.01" value={form.average_purchase_price} onChange={(e) => setForm({ ...form, average_purchase_price: e.target.value })} />
        </div>
      </div>

      <div className="space-y-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={create.isPending || update.isPending || unitsQuery.isLoading || categoriesQuery.isLoading || !form.item_category_id || !selectedUnit}>{item ? "Update item" : "Create item"}</Button>
      </div>
    </form>
  );
}

function AdjustStockSiDialog({ item, scope, onDone }: { item: InventoryItem; scope: Scope; onDone: () => void }) {
  const adjust = useAdjustStockMutation(onDone, scope);
  const unit = itemUnit(item);
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    adjust.mutate({ id: item.id, payload: { quantity: Number(quantity), reason: reason.trim() || "Manual stock adjustment" } });
  }

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Adjust stock</DialogTitle>
        <DialogDescription>Adjustment quantity must use the item base unit: {unit}.</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-lg bg-muted p-3 text-sm">
          <p>Item: <strong>{itemDisplayName(item)}</strong></p>
          <p>Current stock: <strong>{formatBaseQuantity(item.current_stock, unit)}</strong></p>
          <p>Minimum: <strong>{formatBaseQuantity(item.minimum_quantity, unit)}</strong></p>
        </div>
        <div className="space-y-2"><Label>Quantity ({unit})</Label><Input required type="number" step="0.001" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></div>
        <div className="space-y-2"><Label>Reason</Label><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></div>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onDone}>Cancel</Button><Button type="submit" disabled={adjust.isPending}>Save adjustment</Button></div>
      </form>
    </DialogContent>
  );
}
