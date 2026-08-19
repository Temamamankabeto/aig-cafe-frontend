"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  UserRound,
  PackageCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import api from "@/lib/api";
import { authService, type AuthUser } from "@/services/auth/auth.service";
import SidebarContent from "@/layouts/components/SidebarContent";

type DashboardHeaderProps = {
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
};

export default function DashboardHeader({
  sidebarCollapsed = false,
  onToggleSidebar,
}: DashboardHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [readyOrdersCount, setReadyOrdersCount] = useState(0);

  useEffect(() => {
    setUser(authService.getStoredUser());
  }, [pathname]);

  const displayName = user?.name ?? user?.email ?? "User";
  const roles = user?.roles ?? (user?.role ? [user.role] : []);
  const isWaiter = roles.some((role) => String(role).toLowerCase().includes("waiter"));

  useEffect(() => {
    if (!isWaiter) {
      setReadyOrdersCount(0);
      return;
    }

    let mounted = true;

    async function loadReadyOrders() {
      try {
        const response = await api.get("/waiter/orders/ready", { params: { per_page: 1 } });
        const total = Number(response.data?.meta?.total ?? response.data?.data?.length ?? 0);
        if (mounted) setReadyOrdersCount(total);
      } catch {
        if (mounted) setReadyOrdersCount(0);
      }
    }

    loadReadyOrders();
    const interval = window.setInterval(loadReadyOrders, 30000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [isWaiter, pathname]);

  async function logout() {
    await authService.logout();
    toast.success("Logged out successfully");
    router.replace("/login");
  }

  function openProfile() {
    router.push("/dashboard/profile");
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur md:px-6">
      <div className="flex items-center gap-3">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="md:hidden">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SidebarContent />
          </SheetContent>
        </Sheet>

        <Button
          type="button"
          variant="outline"
          size="icon"
          className="hidden md:inline-flex"
          onClick={onToggleSidebar}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>

        <div className="leading-tight">
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-muted-foreground">
            EnterPos
          </p>
          <h1 className="text-base font-bold tracking-wide md:text-lg">ENTERPS</h1>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isWaiter && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="relative"
            aria-label="Ready order notifications"
            onClick={() => router.push("/dashboard/order-management/orders?status=ready")}
          >
            <Bell className="h-4 w-4" />
            {readyOrdersCount > 0 && (
              <Badge className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px]">
                {readyOrdersCount > 99 ? "99+" : readyOrdersCount}
              </Badge>
            )}
          </Button>
        )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2">
            <UserRound className="h-4 w-4" />
            <span className="hidden max-w-40 truncate sm:inline">{displayName}</span>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <span className="block text-xs text-muted-foreground">User name</span>
            <span className="block truncate text-sm font-semibold">{displayName}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={openProfile}>
            <UserRound className="mr-2 h-4 w-4" />
            Profile
          </DropdownMenuItem>
          {user?.department_id && (
            <DropdownMenuItem onClick={() => router.push("/dashboard/my-department-stock")}>
              <PackageCheck className="mr-2 h-4 w-4" />
              My Department Stock
            </DropdownMenuItem>
          )}
          <DropdownMenuItem variant="destructive" onClick={logout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      </div>
    </header>
  );
}
