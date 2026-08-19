import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ADMIN = "General Admin";

type AccessRule = { prefixes: string[]; roles: string[]; anyPermissions?: string[] };

const ROUTE_ROLE_RULES: AccessRule[] = [
  { prefixes: ["/dashboard/users/roles"], roles: [ADMIN], anyPermissions: ["roles.read"] },
  { prefixes: ["/dashboard/users/permissions"], roles: [ADMIN], anyPermissions: ["permissions.read"] },
  { prefixes: ["/dashboard/users"], roles: [ADMIN], anyPermissions: ["users.read"] },
  { prefixes: ["/dashboard/audit-logs"], roles: [ADMIN], anyPermissions: ["audit.read"] },
  { prefixes: ["/dashboard/general-admin"], roles: [ADMIN], anyPermissions: ["general.dashboard"] },
  { prefixes: ["/dashboard/cafeteria-manager"], roles: ["Manager", ADMIN], anyPermissions: ["manager.dashboard"] },
  { prefixes: ["/dashboard/fb-controller"], roles: ["F&B Controller", ADMIN], anyPermissions: ["food-controller.dashboard"] },
  { prefixes: ["/dashboard/finance-manager"], roles: ["Finance", ADMIN], anyPermissions: ["finance.dashboard"] },
  { prefixes: ["/dashboard/stock-keeper"], roles: ["Store Keeper", ADMIN], anyPermissions: ["inventory.read"] },
  { prefixes: ["/dashboard/purchaser"], roles: ["Purchaser", ADMIN], anyPermissions: ["purchase_orders.read"] },
  { prefixes: ["/dashboard/cashier"], roles: ["Cashier", ADMIN], anyPermissions: ["cashier.dashboard"] },
  { prefixes: ["/dashboard/kitchen-staff", "/dashboard/modules/kitchen"], roles: ["Kitchen Staff", ADMIN], anyPermissions: ["kitchen.queue.read"] },
  { prefixes: ["/dashboard/barman", "/dashboard/modules/bar"], roles: ["Barman", ADMIN], anyPermissions: ["bar.queue.read"] },
  { prefixes: ["/dashboard/waiter", "/dashboard/modules/waiter"], roles: ["Waiter", ADMIN], anyPermissions: ["orders.read", "menu.read"] },
  { prefixes: ["/dashboard/customer", "/dashboard/modules/customer"], roles: ["Customer", ADMIN], anyPermissions: ["orders.read"] },
  { prefixes: ["/dashboard/modules/public/menu"], roles: ["Customer", "Waiter", ADMIN], anyPermissions: ["menu.read"] },
  { prefixes: ["/dashboard/purchases/validation"], roles: ["F&B Controller", ADMIN], anyPermissions: ["food-controller.dashboard"] },
  { prefixes: ["/dashboard/purchases"], roles: ["Manager", "F&B Controller", "Purchaser", "Store Keeper", ADMIN], anyPermissions: ["purchase_orders.read", "purchases.read"] },
  { prefixes: ["/dashboard/inventory"], roles: ["Manager", "F&B Controller", "Purchaser", "Store Keeper", "Finance", ADMIN], anyPermissions: ["inventory.read", "inventory.items.read"] },
  {
    prefixes: ["/dashboard/order-management/orders"],
    roles: ["Manager", "F&B Controller", "Waiter", ADMIN],
    anyPermissions: ["orders.read", "food-controller.dashboard"],
  },
  { prefixes: ["/dashboard/order-management"], roles: ["Manager", "Cashier", "Waiter", "Finance", ADMIN], anyPermissions: ["orders.read", "credit.accounts.read", "package.orders.read"] },
  { prefixes: ["/dashboard/modules/cashier"], roles: ["Cashier", ADMIN], anyPermissions: ["payments.read", "cash_shift.read"] },
  { prefixes: ["/dashboard/modules/finance", "/dashboard/modules/bills", "/dashboard/modules/cash-shifts"], roles: ["Finance", "Cashier", ADMIN], anyPermissions: ["payments.read", "bills.read", "cash_shift.read"] },
  { prefixes: ["/dashboard/modules/tables"], roles: ["Manager", ADMIN], anyPermissions: ["tables.read"] },
  { prefixes: ["/dashboard/modules/menu"], roles: ["Manager", "F&B Controller", ADMIN], anyPermissions: ["menu.read"] },
  { prefixes: ["/dashboard/modules/reports"], roles: ["Manager", "F&B Controller", "Finance", "Cashier", ADMIN], anyPermissions: ["reports.sales.read", "reports.inventory.read", "reports.financial.read"] },
];

const ROLE_ALIASES: Record<string, string> = {
  admin: ADMIN,
  "general administrator": ADMIN,
  "cafeteria manager": "Manager",
  "finance manager": "Finance",
  "f and b controller": "F&B Controller",
  "food controller": "F&B Controller",
};

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/&/g, "and").replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function canonicalRole(value: string) {
  const normalized = normalize(value);
  return ROLE_ALIASES[normalized] ?? value.trim();
}

function parseRoles(raw?: string) {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    if (Array.isArray(parsed)) return parsed.map((role) => canonicalRole(String(role)));
    if (typeof parsed === "string") return [canonicalRole(parsed)];
  } catch {
    // Support old comma-separated role cookies during the migration period.
  }

  return raw.split(",").map((role) => canonicalRole(role)).filter(Boolean);
}

function parseListCookie(raw?: string) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    return Array.isArray(parsed) ? parsed.map(String) : typeof parsed === "string" ? [parsed] : [];
  } catch {
    return raw.split(",").map((value) => value.trim()).filter(Boolean);
  }
}

function hasAllowedRole(userRoles: string[], allowedRoles: string[]) {
  const normalizedUserRoles = userRoles.map((role) => normalize(canonicalRole(role)));
  return allowedRoles.some((role) => normalizedUserRoles.includes(normalize(role)));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const forwardedProto = request.headers.get("x-forwarded-proto");

  if (process.env.NODE_ENV === "production" && forwardedProto === "http") {
    const secureUrl = request.nextUrl.clone();
    secureUrl.protocol = "https:";
    return NextResponse.redirect(secureUrl, 308);
  }

  const token = request.cookies.get("token")?.value;

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("returnTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const rolesCookie = request.cookies.get("roles")?.value ?? request.cookies.get("role")?.value;
  const userRoles = parseRoles(rolesCookie);
  const userPermissions = parseListCookie(request.cookies.get("permissions")?.value);

  if (userRoles.length === 0) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const matchedRule = ROUTE_ROLE_RULES.find((rule) =>
    rule.prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)),
  );

  if (matchedRule && !hasAllowedRole(userRoles, matchedRule.roles)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (
    matchedRule?.anyPermissions?.length &&
    !userRoles.some((role) => normalize(role) === normalize(ADMIN)) &&
    !matchedRule.anyPermissions.some((permission) => userPermissions.includes(permission))
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
