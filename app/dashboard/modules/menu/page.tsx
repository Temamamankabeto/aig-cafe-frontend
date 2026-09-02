"use client";

import { useEffect, useState } from "react";
import { MenuManagementPage } from "@/components/menu-management";
import { authService, canonicalRoleName } from "@/services/auth/auth.service";
import type { MenuRoleScope } from "@/types/menu-management";

export default function MenuPage() {
  const [scope, setScope] = useState<MenuRoleScope | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function resolveScope() {
      try {
        const user = await authService.hydrateSession();

        const roles = [
          ...authService.getStoredRoles(),
          ...(user.roles ?? []),
          ...(user.role ? [user.role] : []),
        ];
        const canonicalRoles = roles
          .map((role) => canonicalRoleName(role))
          .filter((role): role is string => Boolean(role));

        const resolvedScope: MenuRoleScope | null = canonicalRoles.includes("F&B Controller")
          ? "food-controller"
          : canonicalRoles.includes("General Admin")
            ? "admin"
            : null;

        if (!cancelled) {
          setScope(resolvedScope);
        }
      } catch {
        if (!cancelled) {
          setScope(null);
        }
      }
    }

    void resolveScope();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!scope) {
    return (
      <div className="flex min-h-[240px] items-center justify-center text-sm text-muted-foreground">
        Loading menu...
      </div>
    );
  }

  return <MenuManagementPage scope={scope} />;
}
