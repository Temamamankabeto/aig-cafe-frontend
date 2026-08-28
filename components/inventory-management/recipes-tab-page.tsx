"use client";

import { FormEvent, useMemo, useState } from "react";
import { ChefHat, GlassWater, PackageSearch, Plus, Search, Trash2, Utensils } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { formatBaseQuantity } from "@/lib/inventory-management";
import { useCreateRecipeMutation, useUpdateRecipeMutation, useInventoryItemsQuery, useMenuItemsQuery, useRecipesQuery } from "@/hooks/inventory-management";
import type { BaseUnit, InventoryItem, RecipeIngredient, Recipe } from "@/types/inventory-management";

type Scope =
  | "admin"
  | "food-controller"
  | "stock-keeper"
  | "purchaser";

type DraftIngredient = RecipeIngredient & {
  inventory_item: InventoryItem;
};

const PAGE_SIZE = 8;

function normalizeUnit(value?: string | null): BaseUnit {
  if (value === "kg" || value === "L" || value === "pcs") return value;
  return "pcs";
}

function itemUnit(item?: Pick<InventoryItem, "base_unit" | "unit"> | null): BaseUnit {
  return normalizeUnit(item?.base_unit ?? item?.unit);
}

function itemName(item?: Pick<InventoryItem, "name" | "sku"> | null) {
  if (!item) return "—";
  return item.sku ? `${item.name} (${item.sku})` : item.name;
}

function recipeMenuName(recipe: Recipe) {
  return recipe.menu_item?.name ?? recipe.name ?? `Menu item #${recipe.menu_item_id}`;
}

function recipeItems(recipe: Recipe) {
  return recipe.items ?? recipe.recipe_items ?? [];
}

function menuType(recipe: Recipe): string {
  const menuItem = recipe.menu_item as
    | { type?: string }
    | undefined;

  return String(menuItem?.type ?? "").toLowerCase();
}

function menuCategory(recipe: Recipe): string {
  const menuItem = recipe.menu_item as unknown as { category?: { name?: string }; menu_category?: { name?: string } } | undefined;
  return menuItem?.category?.name ?? menuItem?.menu_category?.name ?? "Uncategorized";
}

function fallbackStockItem(ingredient: RecipeIngredient): InventoryItem {
  return {
    id: ingredient.inventory_item_id,
    name: `Inventory item #${ingredient.inventory_item_id}`,
    sku: null,
    base_unit: normalizeUnit(ingredient.base_unit ?? ingredient.unit),
    unit: normalizeUnit(ingredient.base_unit ?? ingredient.unit),
    current_stock: 0,
    minimum_quantity: 0,
  };
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-dashed p-8 text-center">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function StatCard({ title, value, note, icon: Icon }: { title: string; value: number | string; note: string; icon: typeof ChefHat }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{note}</p>
        </div>
        <div className="rounded-full border bg-muted/30 p-3">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}

export function RecipesTabPage({ scope = "food-controller" }: { scope?: Scope }) {
  const recipesQuery = useRecipesQuery({ per_page: 100 }, scope);
  const recipes = recipesQuery.data?.data ?? [];

  const menuItems = useMenuItemsQuery({ per_page: 100, is_active: true }, scope);
  const inventoryItems = useInventoryItemsQuery({ per_page: 100 }, scope);

  const createRecipe = useCreateRecipeMutation(undefined, scope);
  const updateRecipe = useUpdateRecipeMutation(undefined, scope);

  const [menuItemId, setMenuItemId] = useState("");
  const [inventoryItemId, setInventoryItemId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [ingredients, setIngredients] = useState<DraftIngredient[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(1);

  const stockRows = inventoryItems.data?.data ?? [];
  const menuRows = menuItems.data?.data ?? [];
  const selectedItem = stockRows.find((item) => String(item.id) === inventoryItemId);

  const selectedIngredientIds = useMemo(
    () => new Set(ingredients.map((item) => String(item.inventory_item_id))),
    [ingredients],
  );

  const recipeMenuIds = useMemo(() => new Set(recipes.map((recipe: Recipe) => Number(recipe.menu_item_id))), [recipes]);

  const filteredRecipes = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return recipes.filter((recipe: Recipe) => {
      const items = recipeItems(recipe);
      const type = menuType(recipe);
      const matchesType = typeFilter === "all" || type === typeFilter;
      const searchable = [
        recipeMenuName(recipe),
        menuCategory(recipe),
        type,
        ...items.map((ingredient) => itemName(ingredient.inventory_item ?? ingredient.inventoryItem)),
      ]
        .join(" ")
        .toLowerCase();

      return matchesType && (!keyword || searchable.includes(keyword));
    });
  }, [recipes, search, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRecipes.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedRecipes = filteredRecipes.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const stats = useMemo(() => {
    const food = recipes.filter((recipe: Recipe) => menuType(recipe) === "food").length;
    const drink = recipes.filter((recipe: Recipe) => menuType(recipe) === "drink").length;
    const ingredientCount = recipes.reduce((total: number, recipe: Recipe) => total + recipeItems(recipe).length, 0);
    const missingRecipes = menuRows.filter((item) => !recipeMenuIds.has(Number(item.id))).length;

    return { food, drink, ingredientCount, missingRecipes };
  }, [menuRows, recipeMenuIds, recipes]);

  function draftIngredientsFromRecipe(recipe?: Recipe): DraftIngredient[] {
    if (!recipe) return [];

    return recipeItems(recipe).map((ingredient) => {
      const relationItem = ingredient.inventory_item ?? ingredient.inventoryItem;
      const stockItem =
        stockRows.find((item) => Number(item.id) === Number(ingredient.inventory_item_id)) ??
        relationItem ??
        fallbackStockItem(ingredient);

      return {
        inventory_item_id: Number(ingredient.inventory_item_id),
        quantity: Number(ingredient.quantity),
        base_unit: itemUnit(stockItem),
        inventory_item: stockItem,
      };
    });
  }

  function loadRecipeForMenu(menuId: string) {
    setMenuItemId(menuId);
    setInventoryItemId("");
    setQuantity("");

    const existingRecipe = recipes.find((recipe: Recipe) => String(recipe.menu_item_id) === menuId);
    setIngredients(draftIngredientsFromRecipe(existingRecipe));
  }

  function loadRecipeForEdit(recipe: Recipe) {
    setMenuItemId(String(recipe.menu_item_id));
    setInventoryItemId("");
    setQuantity("");
    setIngredients(draftIngredientsFromRecipe(recipe));
  }

  function clearForm() {
    setMenuItemId("");
    setInventoryItemId("");
    setQuantity("");
    setIngredients([]);
  }

  function addIngredient() {
    const numericQuantity = Number(quantity);
    if (!selectedItem || !Number.isFinite(numericQuantity) || numericQuantity <= 0) return;

    setIngredients((current) => [
      ...current,
      {
        inventory_item_id: selectedItem.id,
        quantity: numericQuantity,
        base_unit: itemUnit(selectedItem),
        inventory_item: selectedItem,
      },
    ]);

    setInventoryItemId("");
    setQuantity("");
  }

  function removeIngredient(inventoryItemIdToRemove: number) {
    setIngredients((current) => current.filter((item) => Number(item.inventory_item_id) !== Number(inventoryItemIdToRemove)));
  }

  function updateIngredientQuantity(inventoryItemIdToUpdate: number, nextQuantity: string) {
    const numericQuantity = Number(nextQuantity);

    setIngredients((current) =>
      current.map((item) =>
        Number(item.inventory_item_id) === Number(inventoryItemIdToUpdate)
          ? {
              ...item,
              quantity: Number.isFinite(numericQuantity) && numericQuantity > 0 ? numericQuantity : 0,
            }
          : item,
      ),
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!menuItemId || ingredients.length < 1) return;

    const validIngredients = ingredients.filter((item) => Number(item.quantity) > 0);
    if (validIngredients.length < 1) return;

    const existingRecipe = recipes.find((r: Recipe) => String(r.menu_item_id) === menuItemId);
    const payload = {
      menu_item_id: Number(menuItemId),
      items: validIngredients.map((item) => ({
        inventory_item_id: Number(item.inventory_item_id),
        quantity: Number(item.quantity),
      })),
    };

    if (existingRecipe) updateRecipe.mutate({ id: existingRecipe.id, payload });
    else createRecipe.mutate(payload);

    setInventoryItemId("");
    setQuantity("");
  }

  const selectedRecipe = recipes.find((recipe: Recipe) => String(recipe.menu_item_id) === menuItemId);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge variant="secondary" className="mb-2">Recipe control center</Badge>
          <h1 className="text-2xl font-bold tracking-tight">Recipe Management</h1>
          <p className="text-sm text-muted-foreground">
            Build, search, and maintain ingredient recipes for many menu items with stock-safe units.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={clearForm}>Clear editor</Button>
          <Button type="button" onClick={() => document.getElementById("recipe-editor-form")?.scrollIntoView({ behavior: "smooth" })}>
            <Plus className="mr-2 h-4 w-4" /> New recipe
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total recipes" value={recipes.length} note={`${stats.ingredientCount} linked ingredients`} icon={ChefHat} />
        <StatCard title="Food recipes" value={stats.food} note="Kitchen routed menu items" icon={Utensils} />
        <StatCard title="Drink recipes" value={stats.drink} note="Bar routed menu items" icon={GlassWater} />
        <StatCard title="Missing recipes" value={stats.missingRecipes} note="Active menu items without recipe" icon={PackageSearch} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[430px_1fr]">
        <Card id="recipe-editor-form" className="xl:sticky xl:top-4 xl:self-start">
          <CardHeader>
            <CardTitle>{selectedRecipe ? "Edit recipe" : "Create recipe"}</CardTitle>
            <CardDescription>
              Select a menu item, add ingredients, then edit quantities directly before saving.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label>Menu item</Label>
                <Select value={menuItemId} onValueChange={loadRecipeForMenu}>
                  <SelectTrigger><SelectValue placeholder="Select menu item" /></SelectTrigger>
                  <SelectContent>
                    {menuRows.map((menuItem) => (
                      <SelectItem key={menuItem.id} value={String(menuItem.id)}>{menuItem.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="space-y-3 rounded-xl border bg-muted/20 p-3">
                <div className="space-y-2">
                  <Label>Ingredient</Label>
                  <Select value={inventoryItemId} onValueChange={setInventoryItemId}>
                    <SelectTrigger><SelectValue placeholder="Select stock item" /></SelectTrigger>
                    <SelectContent>
                      {stockRows.map((item) => (
                        <SelectItem key={item.id} value={String(item.id)} disabled={selectedIngredientIds.has(String(item.id))}>
                          {itemName(item)} — {itemUnit(item)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Quantity {selectedItem ? `(${itemUnit(selectedItem)})` : ""}</Label>
                  <Input type="number" min="0.001" step="0.001" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
                </div>

                <Button type="button" variant="outline" className="w-full" onClick={addIngredient} disabled={!selectedItem || Number(quantity) <= 0}>
                  <Plus className="mr-2 h-4 w-4" /> Add ingredient
                </Button>
              </div>

              {ingredients.length > 0 && (
                <div className="space-y-2 rounded-xl border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">Recipe ingredients</p>
                    <Badge variant="secondary">{ingredients.length}</Badge>
                  </div>
                  {ingredients.map((ingredient) => {
                    const unit = itemUnit(ingredient.inventory_item);

                    return (
                      <div
                        key={ingredient.inventory_item_id}
                        className="grid gap-3 rounded-lg bg-muted/40 px-3 py-3 text-sm sm:grid-cols-[1fr_150px_40px] sm:items-end"
                      >
                        <div>
                          <p className="font-medium">{itemName(ingredient.inventory_item)}</p>
                          <p className="text-xs text-muted-foreground">Unit: {unit}</p>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Quantity</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min="0.001"
                              step="0.001"
                              value={String(ingredient.quantity)}
                              onChange={(event) => updateIngredientQuantity(ingredient.inventory_item_id, event.target.value)}
                            />
                            <span className="min-w-8 text-xs text-muted-foreground">{unit}</span>
                          </div>
                        </div>

                        <Button type="button" variant="ghost" size="icon" onClick={() => removeIngredient(ingredient.inventory_item_id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={!menuItemId || ingredients.length < 1 || ingredients.some((item) => Number(item.quantity) <= 0) || createRecipe.isPending || updateRecipe.isPending}>
                  {createRecipe.isPending || updateRecipe.isPending ? "Saving..." : selectedRecipe ? "Update recipe" : "Save recipe"}
                </Button>
                <Button type="button" variant="outline" onClick={clearForm}>Clear</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle>Recipe catalog</CardTitle>
                <CardDescription>
                  Search by menu item, category, type, or ingredient. Click any row to edit.
                </CardDescription>
              </div>
              <Badge variant="outline">{filteredRecipes.length} shown</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-[1fr_180px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Search menu item or ingredient..."
                  className="pl-9"
                />
              </div>
              <Select
                value={typeFilter}
                onValueChange={(value) => {
                  setTypeFilter(value);
                  setPage(1);
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="food">Food</SelectItem>
                  <SelectItem value="drink">Drink</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {recipesQuery.isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((item) => <div key={item} className="h-24 animate-pulse rounded-xl bg-muted" />)}
              </div>
            ) : paginatedRecipes.length ? (
              <div className="space-y-3">
                {paginatedRecipes.map((recipe) => {
                  const items = recipeItems(recipe);
                  const active = String(recipe.menu_item_id) === menuItemId;
                  const type = menuType(recipe) || "not set";

                  return (
                    <button
                      type="button"
                      key={recipe.id}
                      onClick={() => loadRecipeForEdit(recipe)}
                      className={cn(
                        "w-full rounded-xl border p-4 text-left transition hover:bg-muted/40",
                        active && "border-primary bg-primary/5",
                      )}
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold">{recipeMenuName(recipe)}</p>
                            <Badge variant={type === "food" ? "default" : "secondary"}>{type}</Badge>
                            <Badge variant="outline">{menuCategory(recipe)}</Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {items.length} ingredient{items.length === 1 ? "" : "s"} linked to inventory deduction
                          </p>
                        </div>
                        <Badge variant="secondary">Edit</Badge>
                      </div>

                      <div className="mt-4 grid gap-2 md:grid-cols-2">
                        {items.slice(0, 6).map((ingredient) => {
                          const stockItem = ingredient.inventory_item ?? ingredient.inventoryItem;
                          const unit = normalizeUnit(ingredient.base_unit ?? ingredient.unit ?? stockItem?.base_unit ?? stockItem?.unit);
                          return (
                            <div key={`${recipe.id}-${ingredient.inventory_item_id}`} className="flex items-center justify-between gap-3 rounded-lg bg-muted/30 px-3 py-2 text-sm">
                              <span className="truncate">{itemName(stockItem)}</span>
                              <span className="shrink-0 font-medium">{formatBaseQuantity(ingredient.quantity, unit)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <EmptyState title="No recipes found" description="Adjust the search/filter or create a recipe from the editor." />
            )}

            <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages} · {filteredRecipes.length} recipe{filteredRecipes.length === 1 ? "" : "s"}
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                  Previous
                </Button>
                <Button type="button" variant="outline" disabled={currentPage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
