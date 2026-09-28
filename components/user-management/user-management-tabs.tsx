"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { authService } from "@/services/auth/auth.service";
import { getStoredRoles } from "@/lib/auth/permissions";

const tabs = [
  { label: "Users", href: "/dashboard/users", match: "/dashboard/users", permission: "users.read" },
  { label: "Customers", href: "/dashboard/customers", match: "/dashboard/customers", permission: "users.read" },
  { label: "Roles", href: "/dashboard/users/roles", match: "/dashboard/users/roles", permission: "roles.read" },
];

export default function UserManagementTabs() {
  const pathname = usePathname();
  const permissions = authService.getStoredPermissions();
  const roles = getStoredRoles().map((role) => role.toLowerCase().replace(/[\s-]+/g, "_"));
  const isManager = roles.includes("manager") || roles.includes("cafeteria_manager");

  const visibleTabs = tabs.filter((tab) => {
    if (isManager && tab.label !== "Users") return false;
    return permissions.includes(tab.permission);
  });

  return (
    <div className="flex flex-wrap gap-2 border-b pb-3">
      {visibleTabs.map((tab) => {
        const active = pathname === tab.match;
        return (
          <Button key={tab.href} asChild variant={active ? "default" : "ghost"} size="sm">
            <Link href={tab.href}>{tab.label}</Link>
          </Button>
        );
      })}
    </div>
  );
}
