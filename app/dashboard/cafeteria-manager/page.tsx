"use client";

import { BarChart3, ClipboardCheck, ShoppingCart, Store, Warehouse } from "lucide-react";
import { SecuredRoleDashboard } from "@/components/dashboards/secured-role-dashboard";

export default function ManagerDashboardPage() {
  return <SecuredRoleDashboard roleKey="manager" title="Manager Dashboard" description="Review daily operations, procurement approvals, tables, inventory risks, sales, and management reports." endpoint="/manager/dashboard" icon={Store} actions={[
    { label: "Purchase Approvals", description: "Review F&B-validated purchase requests.", href: "/dashboard/purchases/requests", icon: ClipboardCheck, permission: "purchase_requests.approve" },
    { label: "Orders", description: "Monitor active and completed restaurant orders.", href: "/dashboard/order-management/orders", icon: ShoppingCart, permission: "orders.read" },
    { label: "Inventory", description: "Review stock movement and low-stock risks.", href: "/dashboard/inventory/items", icon: Warehouse, permission: "inventory.read" },
    { label: "Reports", description: "Open operational and sales reports.", href: "/dashboard/modules/reports/cash-sales", icon: BarChart3, permission: "reports.sales.read" },
  ]} />;
}
