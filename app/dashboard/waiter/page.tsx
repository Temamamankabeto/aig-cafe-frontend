"use client";

import { ClipboardList, PlusCircle, ShoppingCart, Users } from "lucide-react";
import { SecuredRoleDashboard } from "@/components/dashboards/secured-role-dashboard";

export default function WaiterDashboardPage() {
  return <SecuredRoleDashboard roleKey="waiter" title="Waiter Dashboard" description="Create table orders, track kitchen and bar preparation, and serve ready customer orders." endpoint="/waiter/dashboard" icon={Users} actions={[
    { label: "Create Order", description: "Create a new customer or table order.", href: "/dashboard/order-management/orders/create", icon: PlusCircle, permission: "orders.create" },
    { label: "My Orders", description: "Track your pending, ready, and served orders.", href: "/dashboard/order-management/orders", icon: ShoppingCart, permission: "orders.read" },
    { label: "Menu", description: "Browse the active restaurant menu.", href: "/dashboard/modules/waiter/menu", icon: ClipboardList, permission: "menu.read" },
  ]} />;
}
