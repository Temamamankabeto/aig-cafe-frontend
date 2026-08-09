"use client";

import { ClipboardList, ShoppingCart, User } from "lucide-react";
import { SecuredRoleDashboard } from "@/components/dashboards/secured-role-dashboard";

export default function CustomerDashboardPage() {
  return <SecuredRoleDashboard roleKey="customer" title="Customer Dashboard" description="Browse the menu, review your orders, and monitor preparation and payment status." endpoint="/customer/dashboard" icon={User} actions={[
    { label: "Browse Menu", description: "View currently available food and beverages.", href: "/dashboard/modules/public/menu", icon: ClipboardList, permission: "menu.read" },
    { label: "My Orders", description: "Review and track your submitted orders.", href: "/dashboard/modules/customer/orders", icon: ShoppingCart, permission: "orders.read" },
  ]} />;
}
