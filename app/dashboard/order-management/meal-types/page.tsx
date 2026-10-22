"use client";

import { Fragment, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, MoreHorizontal, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { menuService } from "@/services/menu-management";
import { orderService } from "@/services/order-management/order.service";
import type { CreditMealType } from "@/types/order-management";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const emptyForm = { name: "", price_per_person: "", is_active: true, category: "", menu_item_ids: [] as (number | string)[] };
const emptyCategoryForm = { slug: "", name: "", description: "", is_active: true, sort_order: 0 };
type MealCategory = { id: number; slug: string; name: string; description?: string | null; is_active: boolean; sort_order: number; meal_types_count: number };
export default function MealTypesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [expandedMeals, setExpandedMeals] = useState<Record<string, boolean>>({});
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MealCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm);
  const categoryQuery = useQuery({ queryKey: ["credit-meal-categories"], queryFn: () => orderService.creditMealCategories() });
  const mealCategories = categoryQuery.data ?? [];
  const categoryMutation = useMutation({
    mutationFn: () => editingCategory
      ? orderService.updateCreditMealCategory(editingCategory.id, categoryForm)
      : orderService.createCreditMealCategory(categoryForm),
    onSuccess: async () => {
      toast.success(editingCategory ? "Category updated" : "Category created");
      setCategoryOpen(false);
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["credit-meal-categories"] }), queryClient.invalidateQueries({ queryKey: ["credit-meal-types"] })]);
    },
    onError: (error: any) => toast.error(error?.response?.data?.message ?? "Could not save category"),
  });
  const categoryDelete = useMutation({
    mutationFn: (id: number) => orderService.deleteCreditMealCategory(id),
    onSuccess: async () => { toast.success("Category deleted"); await queryClient.invalidateQueries({ queryKey: ["credit-meal-categories"] }); },
    onError: (error: any) => toast.error(error?.response?.data?.message ?? "Cannot delete category containing meal types"),
  });
  function editCategory(category?: MealCategory) {
    setEditingCategory(category ?? null);
    setCategoryForm(category ? { slug: category.slug, name: category.name, description: category.description ?? "", is_active: Boolean(category.is_active), sort_order: category.sort_order } : emptyCategoryForm);
    setCategoryOpen(true);
  }
  function toggleCategory(slug: string) { setExpanded((old) => ({ ...old, [slug]: !old[slug] })); }
  function toggleMeal(id: string | number) { setExpandedMeals((old) => ({ ...old, [String(id)]: !old[String(id)] })); }

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CreditMealType | null>(null);
  const [form, setForm] = useState(emptyForm);

  const query = useQuery({
    queryKey: ["credit-meal-types", search],
    queryFn: () => orderService.creditMealTypes(search.trim() ? { search: search.trim() } : {}),
  });

  const menuQuery = useQuery({ queryKey: ["meal-type-menu-items"], queryFn: () => menuService.items({ per_page: 1000 }) });
  const menuItems = menuQuery.data?.data ?? [];
  const rows = useMemo(() => query.data ?? [], [query.data]);
  const categoryGroups = [...mealCategories, { id: -1, slug: "", name: "Uncategorized", description: "Legacy meal types", is_active: true, sort_order: 9999, meal_types_count: 0 }].filter((c) => c.slug || rows.some((r) => !r.category));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { name: form.name.trim(), price_per_person: Number(form.price_per_person), is_active: form.is_active, category: form.category || null, menu_item_ids: form.category === "order_based" ? [] : form.menu_item_ids };
      if (!payload.name) throw new Error("Meal type name is required.");
      if (form.price_per_person.trim() === "" || !Number.isFinite(payload.price_per_person) || payload.price_per_person < 0) throw new Error("Enter a valid non-negative price per person.");
      if (rows.some((item) => String(item.name).trim().toLocaleLowerCase() === payload.name.toLocaleLowerCase() && String(item.id) !== String(editing?.id ?? ""))) {
        throw new Error("A meal type with this name already exists.");
      }
      return editing
        ? orderService.updateCreditMealType(editing.id, payload)
        : orderService.createCreditMealType(payload);
    },
    onSuccess: async () => {
      toast.success(editing ? "Meal type updated successfully" : "Meal type created successfully");
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
      await queryClient.invalidateQueries({ queryKey: ["credit-meal-types"] });
    },
    onError: (error: any) => toast.error(error?.response?.data?.message ?? error?.message ?? "Failed to save meal type"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string | number) => orderService.deleteCreditMealType(id),
    onSuccess: async () => {
      toast.success("Meal type deleted successfully");
      await queryClient.invalidateQueries({ queryKey: ["credit-meal-types"] });
    },
    onError: (error: any) => toast.error(error?.response?.data?.message ?? error?.message ?? "Failed to delete meal type"),
  });

  function createMealType(category = "") {
    setEditing(null);
    setForm({ ...emptyForm, category });
    setOpen(true);
  }

  function editMealType(item: CreditMealType) {
    setEditing(item);
    setForm({ name: item.name ?? "", price_per_person: String(item.price_per_person ?? ""), is_active: Boolean(item.is_active), category: item.category ?? "", menu_item_ids: (item.menu_items ?? []).map((m) => m.id) });
    setOpen(true);
  }

  async function removeMealType(item: CreditMealType) {
    if (!window.confirm(`Delete meal type "${item.name}"?`)) return;
    await deleteMutation.mutateAsync(item.id);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Credit meal types</h1>
        <Button variant="outline" onClick={() => editCategory()}><Plus className="mr-2 h-4 w-4" />Add category</Button>
      </div>

      <div className="space-y-3">
        <div className="flex gap-2">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search meal type" className="max-w-sm" />
          <Button variant="outline" size="icon" onClick={() => { query.refetch(); categoryQuery.refetch(); }} aria-label="Refresh meal types"><RefreshCw className={`h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} /></Button>
        </div>
        {categoryQuery.isLoading && <p className="text-sm text-muted-foreground">Loading categories...</p>}
        {categoryQuery.isError && <p className="text-sm text-destructive">Could not load categories. Please refresh.</p>}
        {categoryGroups.map((category) => {
          const members = rows.filter((item) => (item.category ?? "") === category.slug);
          const isExpanded = expanded[category.slug] === true;
          return <div key={category.slug || "legacy"} className="overflow-hidden rounded-lg border">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/30 px-3 py-3">
              <button type="button" className="flex min-w-0 items-center gap-2 text-left font-semibold" onClick={() => toggleCategory(category.slug)} aria-expanded={isExpanded}>
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <span>{category.name}</span><span className="text-xs font-normal text-muted-foreground">({members.length} meal types)</span>
              </button>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild><Button size="sm" variant="ghost" aria-label={`Actions for ${category.name}`}><MoreHorizontal className="h-5 w-5" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => createMealType(category.slug)}><Plus className="mr-2 h-4 w-4" />Add meal type</DropdownMenuItem>
                  {category.id !== -1 && <>
                    <DropdownMenuItem onSelect={() => editCategory(category)}><Pencil className="mr-2 h-4 w-4" />Edit category</DropdownMenuItem>
                    <DropdownMenuItem disabled={categoryDelete.isPending} onSelect={() => { window.setTimeout(() => { if (window.confirm(`Delete category "${category.name}"? Categories with meal types cannot be deleted.`)) categoryDelete.mutate(category.id); }, 0); }}><Trash2 className="mr-2 h-4 w-4" />Delete category</DropdownMenuItem>
                  </>}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {isExpanded && <div className="overflow-x-auto"><Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Menu items</TableHead><TableHead>Price/person (ETB)</TableHead><TableHead>Status</TableHead><TableHead>Used by agreements</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {members.map((item: CreditMealType & { agreements_count?: number }) => {
                  const mealOpen = expandedMeals[String(item.id)] === true;
                  const isRegular = item.category === "order_based";
                  const assigned = item.menu_items ?? [];
                  return <Fragment key={item.id}>
                    <TableRow key={`meal-${item.id}`}>
                      <TableCell className="font-medium">
                        <button type="button" onClick={() => toggleMeal(item.id)} aria-expanded={mealOpen} aria-label={`${mealOpen ? "Collapse" : "Expand"} menu for ${item.name}`} className="inline-flex items-center gap-2 text-left hover:underline">
                          {mealOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}{item.name}
                        </button>
                      </TableCell>
                      <TableCell>{isRegular ? "Regular menu" : `${assigned.length} selected`}</TableCell>
                      <TableCell>{item.price_per_person == null ? "—" : Number(item.price_per_person).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell><Badge variant={item.is_active ? "default" : "secondary"}>{item.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                      <TableCell>{item.agreements_count ?? 0}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild><Button size="sm" variant="ghost" aria-label={`Actions for ${item.name}`}><MoreHorizontal className="h-5 w-5" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => editMealType(item)}><Pencil className="mr-2 h-4 w-4" />Edit meal type / menu</DropdownMenuItem>
                            <DropdownMenuItem disabled={deleteMutation.isPending} onSelect={() => { void removeMealType(item); }}><Trash2 className="mr-2 h-4 w-4" />Delete meal type</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    {mealOpen && <TableRow key={`menu-${item.id}`}><TableCell colSpan={6} className="bg-muted/20 px-8 py-4">
                      <div className="space-y-2">
                        <div className="font-medium text-sm">{isRegular ? "Regular menu" : "Dedicated menu"}</div>
                        {isRegular ? <p className="text-sm text-muted-foreground">Uses all items from the regular menu.</p>
                          : assigned.length ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{assigned.map((menuItem) => <div key={menuItem.id} className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 text-sm"><span>{menuItem.name}</span>{menuItem.price != null && <span className="shrink-0 text-muted-foreground">{menuItem.price}</span>}</div>)}</div>
                          : <p className="text-sm text-muted-foreground">No menu items assigned. Use the three-dot menu to edit this meal type and select items.</p>}
                      </div>
                    </TableCell></TableRow>}
                  </Fragment>;
                })}
                {!members.length && <TableRow><TableCell colSpan={6} className="py-5 text-center text-muted-foreground">No meal types in this category.</TableCell></TableRow>}
              </TableBody>
            </Table></div>}
          </div>;
        })}
        {!categoryGroups.length && !categoryQuery.isLoading && <p className="text-sm text-muted-foreground">No categories found. Create one to begin.</p>}
      </div>

      <Dialog open={categoryOpen} onOpenChange={setCategoryOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editingCategory ? "Edit category" : "Create category"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>Category name</Label><Input value={categoryForm.name} onChange={(e) => setCategoryForm((v) => ({ ...v, name: e.target.value, ...(!editingCategory ? { slug: e.target.value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") } : {}) }))} placeholder="e.g. Refreshment" /></div>
            <div className="space-y-2"><Label>Category key</Label><Input value={categoryForm.slug} onChange={(e) => setCategoryForm((v) => ({ ...v, slug: e.target.value }))} placeholder="e.g. refreshment" /><p className="text-xs text-muted-foreground">Lowercase letters, numbers, and underscores only.</p></div>
            <div className="space-y-2"><Label>Description</Label><Input value={categoryForm.description} onChange={(e) => setCategoryForm((v) => ({ ...v, description: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Display order</Label><Input type="number" min={0} value={categoryForm.sort_order} onChange={(e) => setCategoryForm((v) => ({ ...v, sort_order: Number(e.target.value) || 0 }))} /></div>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={categoryForm.is_active} onCheckedChange={(checked) => setCategoryForm((v) => ({ ...v, is_active: checked === true }))} />Active category</label>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setCategoryOpen(false)}>Cancel</Button><Button disabled={categoryMutation.isPending || !categoryForm.name.trim() || !categoryForm.slug.trim()} onClick={() => categoryMutation.mutate()}>{categoryMutation.isPending ? "Saving..." : editingCategory ? "Update category" : "Create category"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit meal type" : "Create meal type"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="meal-type-name">Meal type name</Label>
              <Input id="meal-type-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Example: Breakfast" autoFocus />
            </div>
            <div className="space-y-2"><Label htmlFor="meal-price-per-person">Price per person (ETB)</Label><Input id="meal-price-per-person" type="number" min="0" step="0.01" inputMode="decimal" required value={form.price_per_person} onChange={(event) => setForm((current) => ({ ...current, price_per_person: event.target.value }))} placeholder="e.g. 350.00" /></div>
            <div className="space-y-2"><Label htmlFor="meal-category">Category</Label><select id="meal-category" className="w-full rounded-md border bg-background p-2 text-sm" value={form.category} onChange={(e) => setForm((v) => ({ ...v, category: e.target.value as typeof v.category, menu_item_ids: [] }))}><option value="">Uncategorized (legacy)</option>{mealCategories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></div>
            {(form.category === "refreshment" || form.category === "buffet") && <div className="space-y-2"><Label>Dedicated menu items ({form.menu_item_ids.length} selected)</Label><div className="max-h-52 space-y-2 overflow-y-auto rounded-md border p-3">{menuItems.map((item) => <label key={item.id} className="flex items-center gap-2 text-sm"><Checkbox checked={form.menu_item_ids.some((id) => String(id) === String(item.id))} onCheckedChange={(checked) => setForm((v) => ({ ...v, menu_item_ids: checked ? [...v.menu_item_ids, item.id] : v.menu_item_ids.filter((id) => String(id) !== String(item.id)) }))} /><span>{item.name} — {item.price}</span></label>)}{!menuItems.length && <p className="text-sm text-muted-foreground">No menu items available.</p>}</div></div>}
            {form.category === "order_based" && <p className="text-sm text-muted-foreground">Uses the regular menu; no dedicated item selection required.</p>}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div><Label htmlFor="meal-type-active">Active</Label><p className="text-xs text-muted-foreground">Allow this meal type in agreements and orders.</p></div>
              <Checkbox id="meal-type-active" checked={form.is_active} onCheckedChange={(checked) => setForm((current) => ({ ...current, is_active: checked === true }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.name.trim() || form.price_per_person.trim() === "" || !Number.isFinite(Number(form.price_per_person)) || Number(form.price_per_person) < 0}>{saveMutation.isPending ? "Saving..." : editing ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
