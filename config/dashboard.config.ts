import { BarChart3, ClipboardList, Coffee, CreditCard, ShieldCheck, ShoppingCart, Store, Truck, Users, Warehouse, Wine } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type AppRoleKey =
  | "general-admin"
  | "cafeteria-manager"
  | "fb-controller"
  | "finance-manager"
  | "stock-keeper"
  | "purchaser"
  | "cashier"
  | "kitchen-staff"
  | "barman"
  | "waiter"
  | "customer";

export type DashboardDefinition = {
  key: AppRoleKey;
  roleName: string;
  title: string;
  subtitle: string;
  route: string;
  icon: LucideIcon;
};

export const roleHome: Record<AppRoleKey, string> = {
  "general-admin": "/dashboard/general-admin",
  "cafeteria-manager": "/dashboard/cafeteria-manager",
  "fb-controller": "/dashboard/fb-controller",
  "finance-manager": "/dashboard/finance-manager",
  "stock-keeper": "/dashboard/stock-keeper",
  purchaser: "/dashboard/purchaser",
  cashier: "/dashboard/cashier",
  "kitchen-staff": "/dashboard/kitchen-staff",
  barman: "/dashboard/barman",
  waiter: "/dashboard/waiter",
  customer: "/dashboard/customer",
};

export const dashboardConfig: Record<AppRoleKey, DashboardDefinition> = {
  "general-admin": {
    key: "general-admin",
    roleName: "General Admin",
    title: "General Admin Dashboard",
    subtitle: "System administration, users, access control, configuration, audit, and operational oversight.",
    route: roleHome["general-admin"],
    icon: ShieldCheck,
  },
  "cafeteria-manager": {
    key: "cafeteria-manager",
    roleName: "Manager",
    title: "Manager Dashboard",
    subtitle: "Restaurant operations, approvals, staff, sales, inventory, and reports.",
    route: roleHome["cafeteria-manager"],
    icon: Store,
  },
  "fb-controller": {
    key: "fb-controller",
    roleName: "F&B Controller",
    title: "F&B Controller Dashboard",
    subtitle: "Menu costing, inventory control, recipes, procurement validation, and stock reports.",
    route: roleHome["fb-controller"],
    icon: ClipboardList,
  },
  "finance-manager": {
    key: "finance-manager",
    roleName: "Finance",
    title: "Finance Dashboard",
    subtitle: "Payments, outstanding bills, refunds, credit settlements, and finance reports.",
    route: roleHome["finance-manager"],
    icon: BarChart3,
  },
  "stock-keeper": {
    key: "stock-keeper",
    roleName: "Store Keeper",
    title: "Store Keeper Dashboard",
    subtitle: "Receiving, stock balances, movements, adjustments, and low-stock alerts.",
    route: roleHome["stock-keeper"],
    icon: Warehouse,
  },
  purchaser: {
    key: "purchaser",
    roleName: "Purchaser",
    title: "Purchaser Dashboard",
    subtitle: "Suppliers, purchase requests, validation feedback, and procurement tracking.",
    route: roleHome.purchaser,
    icon: Truck,
  },
  cashier: {
    key: "cashier",
    roleName: "Cashier",
    title: "Cashier Dashboard",
    subtitle: "POS orders, payments, receipts, pending bills, and cash shifts.",
    route: roleHome.cashier,
    icon: CreditCard,
  },
  "kitchen-staff": {
    key: "kitchen-staff",
    roleName: "Kitchen Staff",
    title: "Kitchen Staff Dashboard",
    subtitle: "Kitchen tickets, preparation status, and ready food orders.",
    route: roleHome["kitchen-staff"],
    icon: Coffee,
  },
  barman: {
    key: "barman",
    roleName: "Barman",
    title: "Barman Dashboard",
    subtitle: "Bar tickets, beverage preparation, and ready orders.",
    route: roleHome.barman,
    icon: Wine,
  },
  waiter: {
    key: "waiter",
    roleName: "Waiter",
    title: "Waiter Dashboard",
    subtitle: "Table service, customer orders, ready items, and served orders.",
    route: roleHome.waiter,
    icon: Users,
  },
  customer: {
    key: "customer",
    roleName: "Customer",
    title: "Customer Dashboard",
    subtitle: "Public menu, personal orders, bills, and payment status.",
    route: roleHome.customer,
    icon: ShoppingCart,
  },
};

export const dashboardList = Object.values(dashboardConfig);

export function normalizeRole(role?: string | null): AppRoleKey | null {
  const value = String(role ?? "").toLowerCase().replace(/&/g, "and").replace(/_/g, " ").replace(/-/g, " ").trim();
  if (["general admin", "general administrator", "admin"].includes(value)) return "general-admin";
  if (["manager", "cafeteria manager"].includes(value)) return "cafeteria-manager";
  if (value.includes("f") && value.includes("b") && value.includes("controller")) return "fb-controller";
  if (value.includes("finance")) return "finance-manager";
  if (value.includes("stock") || value.includes("store keeper") || value.includes("storekeeper")) return "stock-keeper";
  if (value.includes("purchase") || value.includes("purchaser")) return "purchaser";
  if (value.includes("cashier")) return "cashier";
  if (value.includes("kitchen")) return "kitchen-staff";
  if (value.includes("bar") || value.includes("barman")) return "barman";
  if (value.includes("waiter")) return "waiter";
  if (value.includes("customer")) return "customer";
  return null;
}

export function getDashboardForRole(role?: string | null) {
  const roleKey = normalizeRole(role);
  return roleKey ? dashboardConfig[roleKey] : null;
}
