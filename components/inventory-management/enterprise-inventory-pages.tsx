"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  Link2,
  PackageSearch,
  ShoppingCart,
  TrendingUp,
  Wine,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { formatBaseQuantity, formatMoney } from "@/lib/inventory-management";
import api from "@/lib/api";
import { authService } from "@/services/auth/auth.service";
import { normalizeRole } from "@/config/dashboard.config";
import inventoryService, { type InventoryRoleScope } from "@/services/inventory-management/inventory.service";

import type {
  InventoryBatch,
  InventoryItem,
  InventoryTransaction,
  MenuItemOption,
} from "@/types/inventory-management";

/* -------------------- TYPES -------------------- */

type EnterpriseView =
  | "drink-links"
  | "valuation-methods"
  | "expiry-alerts"
  | "purchase-suggestions"
  | "forecast";

type EnterpriseProps = { view: EnterpriseView };

/* -------------------- HELPERS -------------------- */

function scopeFromRole(): InventoryRoleScope {
  const roles = authService.getStoredRoles();
  const user = authService.getStoredUser();

  const roleKey = normalizeRole(roles[0] ?? user?.role ?? "admin");

  if (roleKey === "fb-controller") return "food-controller";
  if (roleKey === "stock-keeper") return "stock-keeper";
  if (roleKey === "purchaser") return "purchaser";
  return "admin";
}

function itemName(item?: Pick<InventoryItem, "name" | "sku"> | null) {
  if (!item) return "—";
  return item.sku ? `${item.name} (${item.sku})` : item.name;
}

function itemUnit(item?: Pick<InventoryItem, "base_unit" | "unit"> | null) {
  return item?.base_unit ?? item?.unit ?? "pcs";
}

function Header({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: any;
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5" />
        <h1 className="text-2xl font-bold">{title}</h1>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

/* -------------------- HOOKS -------------------- */

function useInventoryItems(scope: InventoryRoleScope) {
  return useQuery({
    queryKey: ["inventory-items", scope],
    queryFn: () => inventoryService.items({ per_page: 100 }, scope),
  });
}

function useMenuItems(scope: InventoryRoleScope) {
  return useQuery({
    queryKey: ["menu-items", scope],
    queryFn: () =>
      inventoryService.menuItems(
        { per_page: 100, is_active: true },
        scope
      ),
  });
}

function useMovements(scope: InventoryRoleScope) {
  return useQuery({
    queryKey: ["movements", scope],
    queryFn: () => inventoryService.transactions({ per_page: 300 }, scope),
  });
}

function useBatches(scope: InventoryRoleScope) {
  return useQuery({
    queryKey: ["batches", scope],
    queryFn: () => inventoryService.batches({ per_page: 100 }, scope),
  });
}

/* -------------------- DRINK LINK -------------------- */

function DrinkAutoLinkPage({ scope }: { scope: InventoryRoleScope }) {
  const qc = useQueryClient();

  const drinks = useMenuItems(scope);
  const items = useInventoryItems(scope);

  const [menuItemId, setMenuItemId] = useState("");
  const [inventoryItemId, setInventoryItemId] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      return api.patch(`/${scope}/menu/items/${menuItemId}`, {
        direct_inventory_item_id: Number(inventoryItemId),
        inventory_tracking_mode: "direct",
        stock_deduction_mode: "direct",
      });
    },
    onSuccess: () => {
      toast.success("Drink linked");
      qc.invalidateQueries({ queryKey: ["menu-items"] });
      setMenuItemId("");
      setInventoryItemId("");
    },
    onError: () => toast.error("Failed to link"),
  });

  return (
    <div className="space-y-4">
      <Header
        title="Drink Inventory Linking"
        description="Link packaged drinks directly to stock"
        icon={Wine}
      />

      <Card>
        <CardHeader>
          <CardTitle>Link drink</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div>
            <Label>Drink</Label>
            <Select value={menuItemId} onValueChange={setMenuItemId}>
              <SelectTrigger />
              <SelectContent>
                {(drinks.data?.data ?? []).map((d) => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Inventory item</Label>
            <Select value={inventoryItemId} onValueChange={setInventoryItemId}>
              <SelectTrigger />
              <SelectContent>
                {(items.data?.data ?? []).map((i) => (
                  <SelectItem key={i.id} value={String(i.id)}>
                    {itemName(i)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            disabled={!menuItemId || !inventoryItemId}
            onClick={() => mutation.mutate()}
          >
            <Link2 className="w-4 h-4 mr-2" />
            Link
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/* -------------------- FORECAST -------------------- */

function ForecastPage({ scope }: { scope: InventoryRoleScope }) {
  const items = useInventoryItems(scope);
  const moves = useMovements(scope);

  const forecast = useMemo(() => {
    const map = new Map<
      string,
      { item?: InventoryItem; stock: number; out: number }
    >();

    for (const i of items.data?.data ?? []) {
      map.set(String(i.id), {
        item: i,
        stock: Number(i.current_stock ?? 0),
        out: 0,
      });
    }

    for (const m of moves.data?.data ?? []) {
      const key = String(m.inventory_item_id);
      const row = map.get(key);
      if (row) row.out += Math.abs(Number(m.quantity ?? 0));
    }

    return Array.from(map.values()).map((r) => {
      const daily = r.out / 30;
      return {
        ...r,
        daily,
        daysLeft: daily ? r.stock / daily : Infinity,
      };
    });
  }, [items.data, moves.data]);

  return (
    <div className="space-y-4">
      <Header
        title="Forecast"
        description="30-day consumption estimate"
        icon={TrendingUp}
      />

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Daily usage</TableHead>
                <TableHead>Days left</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {forecast.map((r, i) => (
                <TableRow key={i}>
                  <TableCell>{itemName(r.item)}</TableCell>
                  <TableCell>{r.stock}</TableCell>
                  <TableCell>{r.daily.toFixed(2)}</TableCell>
                  <TableCell>
                    {Number.isFinite(r.daysLeft)
                      ? r.daysLeft.toFixed(1)
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* -------------------- MAIN -------------------- */

export default function EnterpriseInventoryPage({
  view,
}: EnterpriseProps) {
  const scope = useMemo(() => scopeFromRole(), []);

  if (view === "drink-links") return <DrinkAutoLinkPage scope={scope} />;
  if (view === "forecast") return <ForecastPage scope={scope} />;

  return (
    <Header
      title="Inventory Enterprise"
      description="Module hub"
      icon={PackageSearch}
    />
  );
}