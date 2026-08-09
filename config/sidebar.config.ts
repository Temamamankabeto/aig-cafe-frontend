import {
  BarChart3,
  ChefHat,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Store,
  Truck,
  Users,
  Warehouse,
  Wine,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { dashboardConfig, normalizeRole, type AppRoleKey } from "@/config/dashboard.config";

export type SidebarChildItem = {
  label: string;
  href: string;
  permission?: string;
};

export type SidebarItem = {
  label: string;
  href?: string;
  icon: LucideIcon;
  permission?: string;
  children?: SidebarChildItem[];
};

export type SidebarSection = {
  title: string;
  items: SidebarItem[];
};

export type RoleSidebar = {
  title: string;
  icon: LucideIcon;
  sections: SidebarSection[];
};

const s = (title: string, items: SidebarItem[]): SidebarSection => ({ title, items });

const dashboardItem = (role: AppRoleKey): SidebarItem => ({
  label: "Dashboard",
  href: dashboardConfig[role].route,
  icon: LayoutDashboard,
});

const item = (label: string, href: string, icon: LucideIcon, permission?: string): SidebarItem => ({
  label,
  href,
  icon,
  permission,
});

const group = (label: string, icon: LucideIcon, children: SidebarChildItem[]): SidebarItem => ({
  label,
  icon,
  children,
});

const roleSidebar = (
  role: AppRoleKey,
  icon: LucideIcon,
  menuItems: SidebarItem[],
  includeDashboard = true,
): RoleSidebar => ({
  title: dashboardConfig[role].roleName,
  icon,
  sections: [
    ...(includeDashboard ? [s("Main", [dashboardItem(role)])] : []),
    s("Menu", menuItems),
  ],
});

const orderBase = "/dashboard/order-management";

const cashCreditReportChildren: SidebarChildItem[] = [
  { label: "Cash Sales", href: "/dashboard/modules/reports/cash-sales", permission: "reports.sales.read" },
  { label: "Credit Sales", href: "/dashboard/modules/reports/credit-sales", permission: "credit.reports.read" },
];

export const sidebarConfig: Record<AppRoleKey, RoleSidebar> = {
  "general-admin": roleSidebar("general-admin", ShieldCheck, [
    item("Users", "/dashboard/users", Users, "users.read"),
    item("Roles", "/dashboard/users/roles", ShieldCheck, "roles.read"),
    item("Permissions", "/dashboard/users/permissions", Settings, "permissions.read"),
    item("Table Management", "/dashboard/modules/tables", Store, "tables.read"),
    item("Menu Management", "/dashboard/modules/menu", ClipboardList, "menu.read"),
    item("Inventory", "/dashboard/inventory/items", Warehouse, "inventory.read"),
    item("Purchase Requests", "/dashboard/purchases/requests", Truck, "purchase_orders.read"),
    item("Orders", `${orderBase}/orders`, ShoppingCart, "orders.read"),
    group("Report", BarChart3, cashCreditReportChildren),
    group("Setting", Settings, [{ label: "Audit Log", href: "/dashboard/audit-logs", permission: "audit.read" }]),
  ]),
  "cafeteria-manager": roleSidebar("cafeteria-manager", Store, [
    item("Users", "/dashboard/users", Users, "users.read"),
    item("Table Management", "/dashboard/modules/tables", Store, "tables.read"),
    item("Credit Account", `${orderBase}/credit-accounts`, CreditCard, "credit.accounts.read"),
    item("Purchase Request", "/dashboard/purchases/requests", Truck, "purchase_orders.read"),
    item("Order List", `${orderBase}/orders`, ShoppingCart, "orders.read"),
    group("Report", BarChart3, cashCreditReportChildren),
    group("Setting", Settings, [{ label: "Audit Log", href: "/dashboard/audit-logs", permission: "audit.read" }]),
  ]),

  "fb-controller": roleSidebar("fb-controller", ClipboardList, [
    item("Menu Management", "/dashboard/modules/menu", ClipboardList, "menu.read"),
    item("Inventory Items", "/dashboard/inventory/items", Warehouse, "inventory.read"),
    group("Report", BarChart3, cashCreditReportChildren),
  ]),

  "finance-manager": roleSidebar("finance-manager", BarChart3, [
    group("Report", BarChart3, cashCreditReportChildren),
  ]),

  "stock-keeper": roleSidebar("stock-keeper", Warehouse, [
    item("Request Purchase", "/dashboard/purchases/requests", Truck, "purchase_requests.create"),
    item("Inventory Items", "/dashboard/inventory/items", Warehouse, "inventory.read"),
    item("Record Stockout", "/dashboard/inventory/stockout", ClipboardList, "inventory.waste.create"),
  ]),

  purchaser: roleSidebar("purchaser", Truck, [
    item("Purchase Request", "/dashboard/purchases/requests", Truck, "purchase_orders.read"),
  ]),

  cashier: roleSidebar(
    "cashier",
    CreditCard,
    [
      item("Orders", `${orderBase}/pos/orders`, ShoppingCart, "orders.read"),
      item("Sales", "/dashboard/order-management/orders/sold-items", BarChart3, "reports.sales.read"),
    ],
    true,
  ),

  waiter: roleSidebar(
    "waiter",
    Users,
    [item("My Orders", `${orderBase}/orders`, ShoppingCart, "orders.read")],
    true,
  ),

  "kitchen-staff": roleSidebar("kitchen-staff", ChefHat, [
    item("Kitchen Order", "/dashboard/modules/kitchen/tickets", ChefHat, "kitchen.queue.read"),
  ]),

  barman: roleSidebar("barman", Wine, [
    item("Bar Order", "/dashboard/modules/bar/tickets", Wine, "bar.queue.read"),
  ]),

  customer: roleSidebar("customer", Users, [
    item("Public Menu", "/dashboard/modules/public/menu", ShoppingCart, "menu.read"),
    item("My Orders", "/dashboard/modules/customer/orders", ShoppingCart, "orders.read"),
  ]),
};

export function getSidebarForRole(role?: string | null): RoleSidebar {
  const roleKey = normalizeRole(role);
  return roleKey ? sidebarConfig[roleKey] : sidebarConfig.customer;
}

export function filterSidebarByPermissions(roleSidebar: RoleSidebar, permissions: string[] = []) {
  return roleSidebar.sections
    .map((section) => ({
      ...section,
      items: section.items
        .map((sidebarItem) => {
          const children = sidebarItem.children?.filter((child) => !child.permission || permissions.includes(child.permission));

          if (sidebarItem.children) {
            return children?.length ? { ...sidebarItem, children } : null;
          }

          return !sidebarItem.permission || permissions.includes(sidebarItem.permission) ? sidebarItem : null;
        })
        .filter(Boolean) as SidebarItem[],
    }))
    .filter((section) => section.items.length > 0);
}
