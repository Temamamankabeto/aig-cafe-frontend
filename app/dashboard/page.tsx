"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getDashboardForRole } from "@/config/dashboard.config";
import { authService } from "@/services/auth/auth.service";
export default function DashboardIndexPage() {
  const router = useRouter();
  useEffect(() => {
    const user = authService.getStoredUser();
    const role = authService.getStoredRoles()[0] ?? user?.role;
    const dashboard = getDashboardForRole(role);
    router.replace(dashboard?.route ?? "/login");
  }, [router]);
  return null;
}
