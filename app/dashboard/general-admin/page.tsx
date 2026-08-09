"use client";

import { BarChart3, ClipboardList, Settings, ShieldCheck, Users, Warehouse } from "lucide-react";
import { SecuredRoleDashboard } from "@/components/dashboards/secured-role-dashboard";

export default function GeneralAdminDashboardPage() {
  return <SecuredRoleDashboard roleKey="general-admin" title="General Admin Dashboard" description="Administer users, roles, permissions, operational master data, audit records, and system-wide activity." endpoint="/admin/general/dashboard" icon={ShieldCheck} actions={[
    { label: "Users", description: "Create, update, disable, and assign users.", href: "/dashboard/users", icon: Users, permission: "users.read" },
    { label: "Roles", description: "Review roles and their permission assignments.", href: "/dashboard/users/roles", icon: ShieldCheck, permission: "roles.read" },
    { label: "Inventory", description: "Review and administer inventory records.", href: "/dashboard/inventory/items", icon: Warehouse, permission: "inventory.read" },
    { label: "Orders", description: "Monitor restaurant order activity.", href: "/dashboard/order-management/orders", icon: ClipboardList, permission: "orders.read" },
    { label: "Audit Log", description: "Review security and operational audit events.", href: "/dashboard/audit-logs", icon: Settings, permission: "audit.read" },
    { label: "Reports", description: "Open sales and operational reports.", href: "/dashboard/modules/reports/cash-sales", icon: BarChart3, permission: "reports.sales.read" },
  ]} />;
}
