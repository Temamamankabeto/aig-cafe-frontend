"use client";

import { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InventoryItemsSiPage } from "@/components/inventory-management/inventory-items-si-page";
import {
  InventoryBatchesPage,
  InventoryMovementsPage,
  StockActionPage,
} from "@/components/inventory-management/inventory-pages";
import { InventoryReportPage } from "@/components/inventory-management/inventory-pages";
import { PurchaseValidationConfirmPage } from "@/components/inventory-management/purchase-validation-confirm-page";
import { PurchaseApprovalTabPage } from "@/components/inventory-management/purchase-approval-tab-page";
import {
  PurchaseRequestsPage,
  OrderedItemsReceivingPage,
} from "@/components/inventory-management/procurement-pages";
import { RecipesTabPage } from "@/components/inventory-management/recipes-tab-page";
import { LowStockTabPage } from "@/components/inventory-management/low-stock-tab-page";
import {
  usePermissions,
  inventoryPermissions,
  purchasePermissions,
} from "@/lib/auth/permissions";
import { procurementService } from "@/services/inventory-management/procurement.service";
import { authService } from "@/services/auth/auth.service";
import { normalizeRole } from "@/config/dashboard.config";

type Scope = "admin" | "food-controller" | "stock-keeper";

type WorkspaceTab = {
  value: string;
  label: ReactNode;
  content: ReactNode;
  show: boolean;
};

function CountBadge({ value }: { value?: number }) {
  if (!value || value < 1) return null;

  return (
    <Badge className="ml-2 h-5 min-w-5 rounded-full px-1.5 text-[10px] leading-none">
      {value > 99 ? "99+" : value}
    </Badge>
  );
}

export function InventoryWorkspaceTabsPage({
  scope = "food-controller",
}: {
  scope?: Scope;
}) {
  const { can, canAny } = usePermissions();
  const storedUser = authService.getStoredUser();
  const storedRoles = authService.getStoredRoles();
  const roleKey = normalizeRole(storedRoles[0] ?? storedUser?.role);

  const isManager = roleKey === "cafeteria-manager";
  const isFbController = roleKey === "fb-controller";
  const isPurchaser = roleKey === "purchaser";
  const isStockKeeper = roleKey === "stock-keeper";
  const resolvedScope: Scope = isStockKeeper
    ? "stock-keeper"
    : roleKey === "general-admin"
      ? "admin"
      : scope;

  const canSeePurchaseTab =
    (isManager &&
      canAny([
        purchasePermissions.ordersApprove,
        purchasePermissions.requestsApprove,
        purchasePermissions.ordersRead,
      ])) ||
    (isFbController &&
      canAny([
        inventoryPermissions.recipeIntegrity,
        purchasePermissions.ordersRead,
      ])) ||
    (isPurchaser &&
      canAny([
        purchasePermissions.ordersRead,
        purchasePermissions.ordersCreate,
        purchasePermissions.requestsCreate,
        purchasePermissions.ordersSubmit,
      ])) ||
    (isStockKeeper &&
      canAny([
        purchasePermissions.ordersReceive,
        inventoryPermissions.receive,
      ]));

  const purchaseTab = isManager
    ? {
        value: "purchase-approval",
        label: "Purchase Approval",
        status: "food_validated" as const,
        scope: "admin" as const,
        content: <PurchaseApprovalTabPage />,
      }
    : isFbController
      ? {
          value: "purchase-validation",
          label: "Purchase Validation",
          status: "submitted" as const,
          scope: "food-controller" as const,
          content: <PurchaseValidationConfirmPage />,
        }
      : isPurchaser
        ? {
            value: "purchase-requests",
            label: "Purchase Requests",
            status: "submitted" as const,
            scope: "purchaser" as const,
            content: <PurchaseRequestsPage />,
          }
        : isStockKeeper
          ? {
              value: "receive-ordered-items",
              label: "Receive Ordered Items",
              status: "approved" as const,
              scope: "stock-keeper" as const,
              content: <OrderedItemsReceivingPage />,
            }
          : null;

  const purchaseCount = useQuery({
    queryKey: [
      "inventory-tabs",
      purchaseTab?.value ?? "purchase",
      purchaseTab?.status ?? "none",
    ],
    queryFn: () =>
      procurementService.purchaseOrders(
        { status: purchaseTab?.status, per_page: 1 },
        purchaseTab?.scope,
      ),
    enabled: Boolean(canSeePurchaseTab && purchaseTab),
    staleTime: 30000,
    retry: false,
  });

  const pendingPurchaseCount = purchaseCount.data?.meta.total ?? 0;

  const tabs: WorkspaceTab[] = [
    {
      value: "items",
      label: "Inventory Items",
      show: can(inventoryPermissions.read),
      content: <InventoryItemsSiPage scope={resolvedScope} />,
    },
    {
      value: "recipes",
      label: "Recipes",
      show: can(inventoryPermissions.recipesRead),
      content: <RecipesTabPage scope={resolvedScope} />,
    },
    {
      value: "low-stock",
      label: "Low Stock",
      show: can(inventoryPermissions.lowStock),
      content: <LowStockTabPage scope={resolvedScope} />,
    },
    {
      value: "valuation",
      label: "Stock Valuation",
      show: can(inventoryPermissions.valuation),
      content: <InventoryReportPage type="valuation" />,
    },
    {
      value: "recipe-integrity",
      label: "Recipe Integrity",
      show: isFbController && can(inventoryPermissions.recipeIntegrity),
      content: <InventoryReportPage type="recipe-integrity" />,
    },
    {
      value: purchaseTab?.value ?? "purchase",
      label: (
        <>
          {purchaseTab?.label ?? "Purchase"}
          <CountBadge value={pendingPurchaseCount} />
        </>
      ),
      show: Boolean(canSeePurchaseTab && purchaseTab),
      content: purchaseTab?.content ?? null,
    },
    {
      value: "stock-adjustments",
      label: "Adjustments",
      show: isStockKeeper && can(inventoryPermissions.adjust),
      content: <StockActionPage mode="adjust" scope="stock-keeper" />,
    },
    {
      value: "waste-damage",
      label: "Waste / Damage",
      show: isStockKeeper && can(inventoryPermissions.waste),
      content: <StockActionPage mode="waste" scope="stock-keeper" />,
    },
    {
      value: "stock-movements",
      label: "Stock Movements",
      show: isStockKeeper && can(inventoryPermissions.movements),
      content: <InventoryMovementsPage scope="stock-keeper" />,
    },
    {
      value: "batches",
      label: "Batches",
      show: isStockKeeper && can(inventoryPermissions.batches),
      content: <InventoryBatchesPage scope="stock-keeper" />,
    },
  ].filter((tab) => tab.show);

  const defaultTab = tabs[0]?.value ?? "items";

  if (!tabs.length) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center">
        <p className="font-medium">No inventory access</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Your role does not have permission to view this inventory workspace.
        </p>
      </div>
    );
  }

  return (
    <Tabs defaultValue={defaultTab} className="space-y-4">
      <div className="overflow-x-auto pb-1">
        <TabsList className="inline-flex min-w-max">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="mt-0">
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
