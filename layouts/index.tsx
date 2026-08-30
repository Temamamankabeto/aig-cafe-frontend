"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardHeader from "@/layouts/components/DashboardHeader";
import Sidebar from "@/layouts/components/Sidebar";
import SessionInactivityGuard from "@/components/auth/session-inactivity-guard";
import { cn } from "@/lib/utils";
import { authService } from "@/services/auth/auth.service";

export default function DashboardLayoutShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("sidebarCollapsed");
    if (saved === "true") setSidebarCollapsed(true);
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed((value) => {
      const next = !value;
      localStorage.setItem("sidebarCollapsed", String(next));
      return next;
    });
  };

  useEffect(() => {
    let cancelled = false;

    authService
      .hydrateSession()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch(() => {
        if (!cancelled) router.replace("/login");
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!ready) return null;

  return (
    <>
      <SessionInactivityGuard />
      <div className={cn("min-h-screen bg-muted/30 transition-[padding] duration-300", sidebarCollapsed ? "md:pl-20" : "md:pl-72")}>
        <Sidebar collapsed={sidebarCollapsed} />
        <div className="flex min-h-screen min-w-0 flex-col">
          <DashboardHeader
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={toggleSidebar}
          />
          <main className="min-w-0 flex-1 overflow-x-hidden p-4 md:p-6">
            <div className="mx-auto w-full max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </>
  );
}
