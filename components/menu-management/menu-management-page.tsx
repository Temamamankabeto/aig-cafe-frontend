"use client";

import { useState } from "react";
import { Eye, MoreHorizontal, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { can, getStoredRoles, menuPermissions } from "@/lib/auth/permissions";
import {
  useCreateMenuCategoryMutation,
  useCreateMenuItemMutation,
  useDeleteMenuCategoryMutation,
  useDeleteMenuItemMutation,
  useMenuCategoriesQuery,
  useMenuItemAvailabilityMutation,
  useMenuItemsQuery,
  useSetMenuItemModeMutation,
  useToggleMenuCategoryMutation,
  useToggleMenuItemMutation,
  useUpdateMenuCategoryMutation,
  useUpdateMenuItemMutation,
} from "@/hooks/menu-management/menu";
import type {
  MenuCategory,
  MenuCategoryPayload,
  MenuItem,
  MenuItemPayload,
  MenuItemParams,
  MenuType,
  MenuRoleScope,
} from "@/types/menu-management";

type Props = {
  readOnly?: boolean;
  scope?: "admin" | "food-controller" | "waiter" | "public";
};

const typeOptions: Array<MenuType | "all"> = ["all", "food", "drink"];

function yes(value: unknown) {
  return value === true || value === 1 || value === "1";
}

function money(value: unknown) {
  return Number(value ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function menuImage(item?: MenuItem | null) {
  return item?.image_url || item?.image_path || "";
}

function ActionBadge({ active, trueText, falseText }: { active: boolean; trueText: string; falseText: string }) {
  return <Badge variant={active ? "default" : "secondary"}>{active ? trueText : falseText}</Badge>;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-muted/20 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm font-semibold text-foreground">{value || "—"}</div>
    </div>
  );
}

function CategoryDialog({
  open,
  onOpenChange,
  category,
  scope,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: MenuCategory | null;
  scope: MenuRoleScope;
}) {
  const [payload, setPayload] = useState<MenuCategoryPayload>({
    name: category?.name ?? "",
    description: category?.description ?? "",
    icon: category?.icon ?? "",
    sort_order: Number(category?.sort_order ?? 0),
    is_active: category ? yes(category.is_active) : true,
  });
  const create = useCreateMenuCategoryMutation(() => onOpenChange(false), scope);
  const update = useUpdateMenuCategoryMutation(() => onOpenChange(false), scope);
  const saving = create.isPending || update.isPending;

  function submit() {
    if (category) update.mutate({ id: category.id, payload });
    else create.mutate(payload);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{category ? "Edit category" : "Add category"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label>Name</Label>
            <Input
              value={payload.name}
              onChange={(event) => setPayload({ ...payload, name: event.target.value })}
              placeholder="Main Course, Hot Drinks, Dessert..."
            />
          </div>
          <div className="grid gap-2">
            <Label>Description</Label>
            <Textarea
              value={payload.description ?? ""}
              onChange={(event) => setPayload({ ...payload, description: event.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Icon</Label>
            <Input value={payload.icon ?? ""} onChange={(event) => setPayload({ ...payload, icon: event.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label>Sort order</Label>
            <Input
              type="number"
              value={payload.sort_order ?? 0}
              onChange={(event) => setPayload({ ...payload, sort_order: Number(event.target.value) })}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button disabled={saving || !payload.name} onClick={submit}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ItemDialog({
  open,
  onOpenChange,
  item,
  categories,
  scope,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: MenuItem | null;
  categories: MenuCategory[];
  scope: MenuRoleScope;
}) {
  const [payload, setPayload] = useState<MenuItemPayload>({
    category_id: item?.category_id ?? item?.menu_category_id ?? categories[0]?.id ?? "",
    name: item?.name ?? "",
    description: item?.description ?? "",
    type: item?.type ?? "food",
    price: Number(item?.price ?? 0),
    is_available: item ? yes(item.is_available) : true,
    is_active: item ? yes(item.is_active) : true,
    menu_mode: item?.menu_mode ?? "normal",
    image: null,
  });
  const create = useCreateMenuItemMutation(() => onOpenChange(false), scope);
  const update = useUpdateMenuItemMutation(() => onOpenChange(false), scope);
  const saving = create.isPending || update.isPending;

  function submit() {
    if (item) update.mutate({ id: item.id, payload });
    else create.mutate(payload);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{item ? "Edit menu item" : "Add menu item"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label>Name</Label>
            <Input value={payload.name} onChange={(event) => setPayload({ ...payload, name: event.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label>Price</Label>
            <Input type="number" value={payload.price} onChange={(event) => setPayload({ ...payload, price: Number(event.target.value) })} />
          </div>
          <div className="grid gap-2">
            <Label>Type</Label>
            <Select value={payload.type} onValueChange={(value) => setPayload({ ...payload, type: value as MenuType })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="food">Food → Kitchen</SelectItem>
                <SelectItem value="drink">Drink → Bar</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Category</Label>
            <Select value={String(payload.category_id)} onValueChange={(value) => setPayload({ ...payload, category_id: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={String(category.id)}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Menu mode</Label>
            <Select value={payload.menu_mode} onValueChange={(value) => setPayload({ ...payload, menu_mode: value as "normal" | "spatial" })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="spatial">Spatial</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2 md:col-span-2">
            <Label>Description</Label>
            <Textarea value={payload.description ?? ""} onChange={(event) => setPayload({ ...payload, description: event.target.value })} />
          </div>
          <div className="grid gap-2 md:col-span-2">
            <Label>Image</Label>
            <Input type="file" accept="image/*" onChange={(event) => setPayload({ ...payload, image: event.target.files?.[0] ?? null })} />
          </div>
          <div className="flex justify-end gap-2 md:col-span-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button disabled={saving || !payload.name || !payload.category_id} onClick={submit}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ItemDetailDialog({
  open,
  onOpenChange,
  item,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: MenuItem | null;
  categories: MenuCategory[];
}) {
  const categoryName = item?.category?.name ?? categories.find((category) => String(category.id) === String(item?.category_id))?.name ?? "—";
  const image = menuImage(item);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Menu item detail</DialogTitle>
        </DialogHeader>

        {!item ? null : (
          <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
            <div className="space-y-4">
              <div className="overflow-hidden rounded-2xl border bg-muted/20">
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image} alt={item.name} className="h-72 w-full object-cover" />
                ) : (
                  <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">No image uploaded</div>
                )}
              </div>
              <div className="rounded-2xl border p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Selling Price</p>
                <p className="mt-1 text-3xl font-bold">{money(item.price)}</p>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl font-bold tracking-tight">{item.name}</h2>
                  <Badge variant="outline">{item.type === "food" ? "Food → Kitchen" : "Drink → Bar"}</Badge>
                  <ActionBadge active={yes(item.is_active)} trueText="Active" falseText="Inactive" />
                  <ActionBadge active={yes(item.is_available)} trueText="Available" falseText="Unavailable" />
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description || "No description provided."}</p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <InfoRow label="Menu Item ID" value={String(item.id)} />
                <InfoRow label="Category" value={categoryName} />
                <InfoRow label="Type" value={item.type === "food" ? "Food" : "Drink"} />
                <InfoRow label="Station" value={item.type === "food" ? "Kitchen" : "Bar"} />
                <InfoRow label="Menu Mode" value={item.menu_mode ?? "normal"} />
                <InfoRow label="Category ID" value={String(item.category_id ?? item.menu_category_id ?? "—")} />
                <InfoRow label="Created At" value={formatDate(item.created_at)} />
                <InfoRow label="Updated At" value={formatDate(item.updated_at)} />
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function MenuManagementPage({
  readOnly = false,
  scope = "admin" as MenuRoleScope,
}: Props) {
  const roles = getStoredRoles();
  const isFoodController = roles.some((role) => role.trim().toLowerCase() === "f&b controller");
  const effectiveScope: MenuRoleScope = scope === "admin" && isFoodController ? "food-controller" : scope;
  const readonly = readOnly || effectiveScope === "waiter" || effectiveScope === "public";
  const [itemParams, setItemParams] = useState<MenuItemParams>({
    page: 1,
    per_page: 10,
    search: "",
    type: "all",
    category_id: "all",
    is_active: "all",
    is_available: "all",
  });
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [itemOpen, setItemOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<MenuCategory | null>(null);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [detailItem, setDetailItem] = useState<MenuItem | null>(null);

  const categoriesQuery = useMenuCategoriesQuery({ per_page: 100 }, effectiveScope);
  const itemsQuery = useMenuItemsQuery(itemParams, effectiveScope);
  const toggleCategory = useToggleMenuCategoryMutation(effectiveScope);
  const deleteCategory = useDeleteMenuCategoryMutation(effectiveScope);
  const toggleItem = useToggleMenuItemMutation(effectiveScope);
  const availability = useMenuItemAvailabilityMutation(effectiveScope);
  const mode = useSetMenuItemModeMutation(effectiveScope);
  const deleteItem = useDeleteMenuItemMutation(effectiveScope);

  const categories = categoriesQuery.data?.data ?? [];
  const items = itemsQuery.data?.data ?? [];
  const meta = itemsQuery.data?.meta;

  const canManage = !readonly && can(menuPermissions.update);
  const canCreate = !readonly && can(menuPermissions.create);
  const canDisable = !readonly && can(menuPermissions.disable);
  const canDelete = !readonly && (can(menuPermissions.delete) || can(menuPermissions.update));

  function updateItems(next: Partial<MenuItemParams>) {
    setItemParams((current) => ({ ...current, ...next, page: next.page ?? 1 }));
  }

  function openCategoryDialog(category: MenuCategory | null) {
    setSelectedCategory(category);
    setCategoryOpen(true);
  }

  function openItemDialog(item: MenuItem | null) {
    setSelectedItem(item);
    setItemOpen(true);
  }

  function openDetailDialog(item: MenuItem) {
    setDetailItem(item);
    setDetailOpen(true);
  }

  function handleCategoryDialogChange(open: boolean) {
    setCategoryOpen(open);
    if (!open) setSelectedCategory(null);
  }

  function handleItemDialogChange(open: boolean) {
    setItemOpen(open);
    if (!open) setSelectedItem(null);
  }

  function handleDetailDialogChange(open: boolean) {
    setDetailOpen(open);
    if (!open) setDetailItem(null);
  }

  function openFromDropdown(callback: () => void) {
    window.requestAnimationFrame(callback);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Menu Management</h1>
          <p className="text-muted-foreground">Category organizes the menu. Type routes orders: food to kitchen, drink to bar.</p>
        </div>
        {canCreate && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => openCategoryDialog(null)}>
              <Plus className="mr-2 h-4 w-4" /> Category
            </Button>
            <Button onClick={() => openItemDialog(null)}>
              <Plus className="mr-2 h-4 w-4" /> Menu item
            </Button>
          </div>
        )}
      </div>

      <Tabs defaultValue="items" className="space-y-4">
        <TabsList>
          <TabsTrigger value="items">Menu items</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
        </TabsList>

        <TabsContent value="items">
          <Card className="rounded-2xl">
            <CardHeader className="space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <CardTitle>Menu items</CardTitle>
                <div className="flex flex-col gap-2 md:flex-row">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="pl-9 md:w-64"
                      placeholder="Search item..."
                      value={itemParams.search ?? ""}
                      onChange={(event) => updateItems({ search: event.target.value })}
                    />
                  </div>
                  <Select value={String(itemParams.type ?? "all")} onValueChange={(value) => updateItems({ type: value as MenuItemParams["type"] })}>
                    <SelectTrigger className="md:w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {typeOptions.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type === "all" ? "All types" : type === "food" ? "Food / Kitchen" : "Drink / Bar"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={String(itemParams.category_id ?? "all")} onValueChange={(value) => updateItems({ category_id: value })}>
                    <SelectTrigger className="md:w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All categories</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={String(category.id)}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-x-auto rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Image</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Type / Station</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Available</TableHead>
                      {!readonly && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itemsQuery.isLoading ? (
                      <TableRow>
                        <TableCell colSpan={readonly ? 7 : 8} className="h-24 text-center text-muted-foreground">
                          Loading menu...
                        </TableCell>
                      </TableRow>
                    ) : items.length ? (
                      items.map((item) => {
                        const image = menuImage(item);
                        return (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div className="h-14 w-16 overflow-hidden rounded-lg border bg-muted/30">
                                {image ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={image} alt={item.name} className="h-full w-full object-cover" />
                                ) : (
                                  <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">No image</div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{item.name}</div>
                              <div className="max-w-72 truncate text-xs text-muted-foreground">{item.description || "—"}</div>
                            </TableCell>
                            <TableCell>{item.category?.name ?? categories.find((category) => String(category.id) === String(item.category_id))?.name ?? "—"}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{item.type === "food" ? "Food → Kitchen" : "Drink → Bar"}</Badge>
                            </TableCell>
                            <TableCell>{money(item.price)}</TableCell>
                            <TableCell>
                              <ActionBadge active={yes(item.is_active)} trueText="Active" falseText="Inactive" />
                            </TableCell>
                            <TableCell>
                              <ActionBadge active={yes(item.is_available)} trueText="Available" falseText="Unavailable" />
                            </TableCell>
                            {!readonly && (
                              <TableCell className="text-right">
                                <DropdownMenu modal={false}>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onSelect={() => openFromDropdown(() => openDetailDialog(item))}>
                                      <Eye className="mr-2 h-4 w-4" /> View detail
                                    </DropdownMenuItem>
                                    {canManage && <DropdownMenuItem onSelect={() => openFromDropdown(() => openItemDialog(item))}>Edit</DropdownMenuItem>}
                                    {canDisable && <DropdownMenuItem onClick={() => availability.mutate({ id: item.id, isAvailable: !yes(item.is_available) })}>Toggle availability</DropdownMenuItem>}
                                    {canDisable && <DropdownMenuItem onClick={() => toggleItem.mutate(item.id)}>Toggle active</DropdownMenuItem>}
                                    {canManage && <DropdownMenuItem onClick={() => mode.mutate({ id: item.id, mode: item.menu_mode === "spatial" ? "normal" : "spatial" })}>Switch {item.menu_mode === "spatial" ? "normal" : "spatial"}</DropdownMenuItem>}
                                    {canDelete && (
                                      <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem className="text-destructive" onClick={() => deleteItem.mutate(item.id)}>Delete</DropdownMenuItem>
                                      </>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={readonly ? 7 : 8} className="h-24 text-center text-muted-foreground">
                          No menu items found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <p className="text-sm text-muted-foreground">
                  Page {meta?.current_page ?? 1} of {meta?.last_page ?? 1} • {meta?.total ?? items.length} total
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={(meta?.current_page ?? 1) <= 1 || itemsQuery.isFetching}
                    onClick={() => updateItems({ page: Math.max(1, (meta?.current_page ?? 1) - 1) })}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    disabled={(meta?.current_page ?? 1) >= (meta?.last_page ?? 1) || itemsQuery.isFetching}
                    onClick={() => updateItems({ page: (meta?.current_page ?? 1) + 1 })}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Sort</TableHead>
                      <TableHead>Status</TableHead>
                      {!readonly && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categoriesQuery.isLoading ? (
                      <TableRow>
                        <TableCell colSpan={readonly ? 4 : 5} className="h-24 text-center text-muted-foreground">
                          Loading categories...
                        </TableCell>
                      </TableRow>
                    ) : categories.length ? (
                      categories.map((category) => (
                        <TableRow key={category.id}>
                          <TableCell className="font-medium">{category.name}</TableCell>
                          <TableCell>
                            <div className="max-w-96 truncate text-xs text-muted-foreground">{category.description || "—"}</div>
                          </TableCell>
                          <TableCell>{category.sort_order ?? 0}</TableCell>
                          <TableCell>
                            <ActionBadge active={yes(category.is_active)} trueText="Active" falseText="Inactive" />
                          </TableCell>
                          {!readonly && (
                            <TableCell className="text-right">
                              <DropdownMenu modal={false}>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {canManage && <DropdownMenuItem onSelect={() => openFromDropdown(() => openCategoryDialog(category))}>Edit</DropdownMenuItem>}
                                  {canDisable && <DropdownMenuItem onClick={() => toggleCategory.mutate(category.id)}>Toggle active</DropdownMenuItem>}
                                  {canDelete && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem className="text-destructive" onClick={() => deleteCategory.mutate(category.id)}>Delete</DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={readonly ? 4 : 5} className="h-24 text-center text-muted-foreground">
                          No categories found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {!readonly && (
        <>
          <CategoryDialog key={selectedCategory?.id ?? "new-category"} open={categoryOpen} onOpenChange={handleCategoryDialogChange} category={selectedCategory} scope={effectiveScope} />
          <ItemDialog key={selectedItem?.id ?? "new-item"} open={itemOpen} onOpenChange={handleItemDialogChange} item={selectedItem} categories={categories} scope={effectiveScope} />
          <ItemDetailDialog key={detailItem?.id ?? "detail"} open={detailOpen} onOpenChange={handleDetailDialogChange} item={detailItem} categories={categories} />
        </>
      )}
    </div>
  );
}

export default MenuManagementPage;
