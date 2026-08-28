"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { authService } from "@/services/auth/auth.service";
import { procurementService } from "@/services/inventory-management/procurement.service";
import { filterSidebarByPermissions, getSidebarForRole, type SidebarChildItem } from "@/config/sidebar.config";
import { normalizeRole } from "@/config/dashboard.config";
import { cn } from "@/lib/utils";

type SidebarContentProps = {
  collapsed?: boolean;
};

function isRouteActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function MiniBadge({ value }: { value?: number }) {
  if (!value || value < 1) return null;
  return <Badge className="ml-2 h-5 min-w-5 justify-center rounded-full px-1.5 text-[10px]">{value > 99 ? "99+" : value}</Badge>;
}

export default function SidebarContent({ collapsed = false }: SidebarContentProps) {
  const pathname = usePathname();
  const user = authService.getStoredUser();
  const roles = authService.getStoredRoles();
  const role = roles[0] ?? user?.role;
  const roleKey = normalizeRole(role);
  const permissions = authService.getStoredPermissions();

  const roleSidebar = useMemo(() => getSidebarForRole(role), [role]);
  const sections = filterSidebarByPermissions(roleSidebar, permissions);

  const validationCount = useQuery({
    queryKey: ["sidebar-purchase-count", "submitted"],
    queryFn: () => procurementService.purchaseOrders({ status: "submitted", per_page: 1 }, "food-controller"),
    enabled: !collapsed && roleKey === "fb-controller",
    staleTime: 30000,
    retry: false,
  });

  const approvalCount = useQuery({
    queryKey: ["sidebar-purchase-count", "food_validated"],
    queryFn: () => procurementService.purchaseOrders({ status: "food_validated", per_page: 1 }, "manager"),
    enabled: !collapsed && roleKey === "cafeteria-manager",
    staleTime: 30000,
    retry: false,
  });

  const receivingCount = useQuery({
    queryKey: ["sidebar-purchase-count", "approved"],
    queryFn: () => procurementService.purchaseOrders({ status: "approved", per_page: 1 }, "manager"),
    enabled: !collapsed && roleKey === "stock-keeper",
    staleTime: 30000,
    retry: false,
  });

  function purchaseBadgeValue(href: string) {
    if (href === "/dashboard/purchases/validation") return validationCount.data?.meta.total ?? 0;
    if (href === "/dashboard/purchases/requests") return approvalCount.data?.meta.total ?? 0;
    if (href === "/dashboard/purchases/receiving") return receivingCount.data?.meta.total ?? 0;
    return 0;
  }

  const RoleIcon = roleSidebar.icon;
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});

  function toggleMenu(label: string) {
    setOpenMenus((current) => ({ ...current, [label]: !current[label] }));
  }

  function childTreeIsActive(child: SidebarChildItem): boolean {
    const selfActive = child.href ? isRouteActive(pathname, child.href) : false;
    return selfActive || Boolean(child.children?.some(childTreeIsActive));
  }

  function renderChild(child: SidebarChildItem, depth = 0) {
    const childActive = child.href ? isRouteActive(pathname, child.href) : false;
    const hasNestedChildren = Boolean(child.children?.length);
    const nestedActive = Boolean(child.children?.some(childTreeIsActive));
    const menuKey = `child:${depth}:${child.label}`;
    const isNestedOpen = openMenus[menuKey] ?? nestedActive;

    if (hasNestedChildren) {
      return (
        <div key={menuKey} className="space-y-1">
          <div className="flex items-center">
            {child.href ? (
              <Link
                href={child.href}
                className={cn(
                  "min-w-0 flex-1 rounded-lg px-3 py-2 text-sm transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  childActive &&
                    "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground",
                )}
              >
                <span className="truncate">{child.label}</span>
              </Link>
            ) : (
              <span className="min-w-0 flex-1 px-3 py-2 text-sm font-medium">{child.label}</span>
            )}
            <button
              type="button"
              aria-label={`${isNestedOpen ? "Collapse" : "Expand"} ${child.label}`}
              onClick={() => toggleMenu(menuKey)}
              className="rounded-lg p-2 text-sidebar-foreground/70 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <ChevronRight
                className={cn(
                  "h-3 w-3 transition-transform duration-200",
                  isNestedOpen && "rotate-90",
                )}
              />
            </button>
          </div>

          {isNestedOpen && (
            <div className="ml-4 space-y-1 border-l border-sidebar-border pl-2">
              {child.children?.map((nestedChild) => renderChild(nestedChild, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    if (!child.href) return null;

    const badgeValue = purchaseBadgeValue(child.href);
    return (
      <Link
        key={child.href}
        href={child.href}
        className={cn(
          "flex items-center justify-between rounded-lg px-3 py-2 text-sm transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          childActive &&
            "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground",
        )}
      >
        <span className="truncate">{child.label}</span>
        <MiniBadge value={badgeValue} />
      </Link>
    );
  }

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="border-b border-sidebar-border p-4">
        <div
          className={cn(
            "flex items-center rounded-2xl bg-sidebar-accent p-3",
            collapsed ? "justify-center" : "gap-3",
          )}
        >
          <div className="rounded-xl bg-sidebar-primary p-2 text-sidebar-primary-foreground">
            <RoleIcon className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="truncate text-sm font-bold">AIG Cafeteria</h1>
              <p className="truncate text-xs text-sidebar-foreground/70">{roleSidebar.title}</p>
            </div>
          )}
        </div>
      </div>

      <nav className={cn("flex-1 space-y-5 overflow-y-auto", collapsed ? "p-2" : "p-4")}>
        {sections.map((section) => (
          <div key={section.title} className="space-y-2">
            {!collapsed && (
              <p className="px-2 text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/50">
                {section.title}
              </p>
            )}

            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = item.href ? isRouteActive(pathname, item.href) : false;
                const hasChildren = Boolean(item.children?.length);
                const childIsActive = Boolean(
                  item.children?.some(childTreeIsActive),
                );
                const isOpen =
                  openMenus[item.label] ??
                  (childIsActive || item.children?.length === 1);

                if (hasChildren) {
                  return (
                    <div key={item.label} className="space-y-1">
                      <button
                        type="button"
                        title={collapsed ? item.label : undefined}
                        onClick={() => toggleMenu(item.label)}
                        className={cn(
                          "flex w-full items-center rounded-xl text-sm font-medium text-sidebar-foreground/80 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                          collapsed ? "justify-center px-2 py-2" : "gap-2 px-3 py-2",
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {!collapsed && (
                          <>
                            <span className="flex-1 text-left">{item.label}</span>
                            <ChevronRight
                              className={cn(
                                "h-3 w-3 shrink-0 transition-transform duration-200",
                                isOpen && "rotate-90",
                              )}
                            />
                          </>
                        )}
                      </button>

                      {!collapsed && isOpen && (
                        <div className="ml-6 space-y-1 border-l border-sidebar-border pl-2">
                          {item.children?.map((child) => renderChild(child))}
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.href ?? item.label}
                    href={item.href ?? "#"}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "flex items-center rounded-xl text-sm font-medium transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      collapsed ? "justify-center px-2 py-2" : "gap-2 px-3 py-2",
                      active &&
                        "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );
}
