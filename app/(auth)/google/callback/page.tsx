"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { authService } from "@/services/auth/auth.service";
import { getDashboardForRole } from "@/config/dashboard.config";

export default function GoogleCallbackPage() {
  const router = useRouter();
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const user = await authService.hydrateSession();
        if (!active) return;
        const roles = authService.getStoredRoles();
        const role = roles[0] ?? user.role;
        const dashboard = getDashboardForRole(role);
        if (!dashboard) throw new Error("Your account does not have a supported system role. Contact the administrator.");
        toast.success("Signed in with Google");
        router.replace(dashboard.route);
      } catch (error) {
        if (!active) return;
        toast.error(error instanceof Error ? error.message : "Google sign-in failed");
        router.replace("/login?google_error=1");
      }
    })();
    return () => { active = false; };
  }, [router]);

  return <main className="flex min-h-[100dvh] items-center justify-center bg-[#041a38] px-4 text-white"><div className="text-center"><div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-[#f4be4b]"/><h1 className="text-xl font-bold">Completing Google sign-in…</h1><p className="mt-2 text-sm text-slate-300">Please wait while your AIG Cafeteria account is verified.</p></div></main>;
}
