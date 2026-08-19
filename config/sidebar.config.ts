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

const section = (title: string, items: SidebarItem[]): SidebarSection => ({ title, items });

const dashboardItem = (role: AppRoleKey): SidebarItem => ({
  label: "Dashboard",
  href: dashboardConfig[role].route,
  icon: LayoutDashboard,
});

const group = (label: string, icon: LucideIcon, children: SidebarChildItem[]): SidebarItem => ({
  label,
  icon,
  children,
});

/**
 * Every role receives one Dashboard link and at most two grouped menus.
 * This keeps the sidebar at three top-level entries or fewer while allowing
 * each role's complete workflow to remain available as submenu links.
 */
const roleSidebar = (role: AppRoleKey, icon: LucideIcon, menuItems: SidebarItem[]): RoleSidebar => ({
  title: dashboardConfig[role].roleName,
  icon,
  sections: [section("Main", [dashboardItem(role), ...menuItems])],
});

const orderBase = "/dashboard/order-management";

const salesReportChildren: SidebarChildItem[] = [
  {
    label: "Sales Report",
    href: "/dashboard/modules/reports/sold-items",
    permission: "reports.sales.read",
  },
];

export const sidebarConfig: Record<AppRoleKey, RoleSidebar> = {
  "general-admin": roleSidebar("general-admin", ShieldCheck, [
    group("Administration", Settings, [
      { label: "Users", href: "/dashboard/users", permission: "users.read" },
      { label: "Roles", href: "/dashboard/users/roles", permission: "roles.read" },
      { label: "Departments", href: "/dashboard/general-admin/departments", permission: "inventory.read" },
      { label: "Tables & Waiters", href: "/dashboard/modules/tables", permission: "tables.read" },
    ]),
    group("Operations & Reports", BarChart3, [
      { label: "Orders", href: `${orderBase}/orders`, permission: "orders.read" },
      { label: "Inventory", href: "/dashboard/inventory/overview", permission: "inventory.read" },
      { label: "Purchase Approval", href: "/dashboard/purchases/requests", permission: "purchase_orders.read" },
      { label: "Credit Accounts", href: `${orderBase}/credit-accounts`, permission: "credit.accounts.read" },
      { label: "Catering Packages", href: `${orderBase}/packages` },
      ...salesReportChildren,
    ]),
  ]),

  "cafeteria-manager": roleSidebar("cafeteria-manager", Store, [
    group("Operations & Approvals", ClipboardList, [
      { label: "Tables & Waiters", href: "/dashboard/modules/tables", permission: "tables.read" },
      { label: "Orders", href: `${orderBase}/orders`, permission: "orders.read" },
      { label: "Kitchen Queue", href: "/dashboard/modules/kitchen/tickets" },
      { label: "Bar Queue", href: "/dashboard/modules/bar/tickets" },
      { label: "Purchase Approvals", href: "/dashboard/purchases/requests", permission: "purchase_orders.read" },
      { label: "Credit Accounts", href: `${orderBase}/credit-accounts`, permission: "credit.accounts.read" },
      { label: "Credit Orders", href: `${orderBase}/credit-orders` },
      { label: "Catering Packages", href: `${orderBase}/packages` },
      { label: "Package Orders", href: `${orderBase}/package-orders` },
    ]),
    group("Inventory & Reports", BarChart3, [
      { label: "Inventory Overview", href: "/dashboard/cafeteria-manager/inventory", permission: "inventory.read" },
      { label: "Low-stock Items", href: "/dashboard/inventory/low-stock", permission: "inventory.read" },
      { label: "Stock Valuation", href: "/dashboard/inventory/valuation", permission: "inventory.read" },
      ...salesReportChildren,
    ]),
  ]),

  "fb-controller": roleSidebar("fb-controller", ClipboardList, [
    group("Operations & Approval", ClipboardList, [
      { label: "Menu Management", href: "/dashboard/modules/menu", permission: "menu.read" },
      { label: "Orders", href: `${orderBase}/orders` },
      { label: "Purchase Validation", href: "/dashboard/purchases/validation" },
      { label: "Stock-out Validation", href: "/dashboard/fb-controller/stockout-validation" },
    ]),
    group("Inventory & Reports", BarChart3, [
      { label: "Inventory Items", href: "/dashboard/inventory/items", permission: "inventory.read" },
      { label: "Kitchen & Bar Consumption", href: "/dashboard/fb-controller/stockout-report", permission: "inventory.read" },
      { label: "Consumption Report", href: "/dashboard/fb-controller/consumption-report", permission: "inventory.read" },
      { label: "Sales Report", href: "/dashboard/modules/reports/sold-items", permission: "reports.sales.read" },
    ]),
  ]),

  "finance-manager": roleSidebar("finance-manager", BarChart3, [
    group("Finance Operations", CreditCard, [
      { label: "Finance Overview", href: "/dashboard/modules/finance" },
      { label: "Bills & Refunds", href: "/dashboard/modules/bills" },
      { label: "Credit Accounts", href: `${orderBase}/credit-accounts`, permission: "credit.accounts.read" },
      { label: "Credit Orders", href: `${orderBase}/credit-orders` },
      { label: "Package Orders", href: `${orderBase}/package-orders` },
    ]),
    group("Reports", BarChart3, [
      { label: "Profit & Expenses", href: "/dashboard/modules/finance/profit" },
      ...salesReportChildren,
    ]),
  ]),

  purchaser: roleSidebar("purchaser", Truck, [
    group("Procurement", Truck, [
      { label: "Procurement Workspace", href: "/dashboard/purchaser/procurement-workspace" },
      { label: "Suppliers", href: "/dashboard/purchases/suppliers" },
      { label: "Purchase Requests", href: "/dashboard/purchases/requests", permission: "purchase_orders.read" },
      { label: "Receiving Records", href: "/dashboard/purchaser/receiving" },
    ]),
  ]),

  "stock-keeper": roleSidebar("stock-keeper", Warehouse, [
    group("Stock Operations", Warehouse, [
      { label: "Stock Workspace", href: "/dashboard/stock-keeper/stock-workspace" },
      { label: "Receive Stock / Stock In", href: "/dashboard/purchases/receiving", permission: "inventory.read" },
      { label: "Inventory Items", href: "/dashboard/inventory/items", permission: "inventory.read" },
      { label: "Stock-out", href: "/dashboard/inventory/stockout", permission: "inventory.adjustments.create" },
      { label: "Return to Store", href: "/dashboard/inventory/returns", permission: "inventory.read" },
    ]),
    group("Stock Control", BarChart3, [
      { label: "Stock Balance", href: "/dashboard/inventory/stock-balance", permission: "inventory.read" },
      { label: "Stock Card", href: "/dashboard/inventory/stock-card", permission: "inventory.read" },
      { label: "Low Stock Items", href: "/dashboard/inventory/low-stock", permission: "inventory.read" },
      { label: "Purchase Requests", href: "/dashboard/purchases/requests", permission: "purchase_requests.create" },
    ]),
  ]),

  cashier: roleSidebar("cashier", CreditCard, [
    group("POS & Payments", ShoppingCart, [
      { label: "POS Orders", href: `${orderBase}/pos/orders`, permission: "orders.read" },
    ]),
    group("Reports", BarChart3, [
      { label: "Sales Report", href: "/dashboard/modules/reports/sold-items", permission: "reports.sales.read" },
    ]),
  ]),

  "kitchen-staff": roleSidebar("kitchen-staff", ChefHat, [
    group("Kitchen Operations", ChefHat, [
      { label: "Kitchen Orders", href: "/dashboard/modules/kitchen/tickets", permission: "kitchen.queue.read" },
      { label: "Order Report", href: "/dashboard/modules/kitchen/order-report", permission: "kitchen.queue.read" },
      { label: "Stock & Consumption", href: "/dashboard/my-department-stock" },
      { label: "Consumption Report", href: "/dashboard/my-department-stock/consumption-report" },
    ]),
  ]),

  barman: roleSidebar("barman", Wine, [
    group("Bar Operations", Wine, [
      { label: "Bar Orders", href: "/dashboard/modules/bar/tickets", permission: "bar.queue.read" },
      { label: "Order Report", href: "/dashboard/modules/bar/order-report", permission: "bar.queue.read" },
      { label: "Stock & Consumption", href: "/dashboard/my-department-stock" },
      { label: "Consumption Report", href: "/dashboard/my-department-stock/consumption-report" },
    ]),
  ]),

  waiter: roleSidebar("waiter", Users, [
    {
      label: "My Orders",
      href: `${orderBase}/orders`,
      icon: ShoppingCart,
      permission: "orders.read",
    },
  ]),

  customer: roleSidebar("customer", Users, [
    group("My Ordering", ShoppingCart, [
      { label: "Browse Menu", href: "/dashboard/modules/public/menu", permission: "menu.read" },
      { label: "My Orders", href: "/dashboard/modules/customer/orders", permission: "orders.read" },
    ]),
  ]),
};

export function getSidebarForRole(role?: string | null): RoleSidebar {
  const roleKey = normalizeRole(role);
  return roleKey ? sidebarConfig[roleKey] : sidebarConfig.customer;
}

export function filterSidebarByPermissions(roleSidebar: RoleSidebar, permissions: string[] = []) {
  return roleSidebar.sections
    .map((sidebarSection) => ({
      ...sidebarSection,
      items: sidebarSection.items
        .map((sidebarItem) => {
          const children = sidebarItem.children?.filter(
            (child) => !child.permission || permissions.includes(child.permission),
          );

          if (sidebarItem.children) {
            return children?.length ? { ...sidebarItem, children } : null;
          }

          return !sidebarItem.permission || permissions.includes(sidebarItem.permission) ? sidebarItem : null;
        })
        .filter(Boolean) as SidebarItem[],
    }))
    .filter((sidebarSection) => sidebarSection.items.length > 0);
}
