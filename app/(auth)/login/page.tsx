"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { authService } from "@/services/auth/auth.service";
import { getDashboardForRole } from "@/config/dashboard.config";

export default function LoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setLoading(true);

    try {
      const response = await authService.login({ login, password });
      authService.saveSession(response);

      const role = response.roles?.[0] ?? response.user?.roles?.[0] ?? response.user?.role;
      const dashboard = getDashboardForRole(role);

      if (!dashboard) {
        await authService.logout();
        throw new Error("Your account does not have a supported system role. Contact the administrator.");
      }

      toast.success("Logged in successfully");
      router.replace(dashboard.route);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed";
      toast.error(message, { id: "login-error", duration: 5000 });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-[100dvh] overflow-x-hidden bg-[#041a38] text-white">
      {/* Desktop/tablet reference layout: preserve the existing exact design. */}
      <div className="absolute inset-0 hidden md:block">
        <img
          src="/images/login-exact-reference.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover object-center"
          draggable={false}
        />

        <form onSubmit={onSubmit} className="absolute inset-0 z-10" noValidate>
          <label htmlFor="login-desktop" className="sr-only">Username</label>
          <input
            id="login-desktop" name="login" type="text" value={login}
            onChange={(event) => setLogin(event.target.value)} required autoComplete="username"
            disabled={loading} aria-label="Username" placeholder=" "
            className="absolute rounded-[13px] border-0 bg-transparent pl-[3.25%] pr-[1.1%] text-[clamp(12px,0.82vw,15px)] text-white caret-[#f4be4b] outline-none transition-colors focus:bg-[#071f42]/95 disabled:cursor-not-allowed disabled:opacity-70 [&:not(:placeholder-shown)]:bg-[#071f42]/95"
            style={{ left: "37.20%", top: "52.99%", width: "25.55%", height: "6.61%" }}
          />

          <label htmlFor="password-desktop" className="sr-only">Password</label>
          <input
            id="password-desktop" name="password" type="password" value={password}
            onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password"
            disabled={loading} aria-label="Password" placeholder=" "
            className="absolute rounded-[13px] border-0 bg-transparent pl-[3.25%] pr-[1.1%] text-[clamp(12px,0.82vw,15px)] text-white caret-[#f4be4b] outline-none transition-colors focus:bg-[#071f42]/95 disabled:cursor-not-allowed disabled:opacity-70 [&:not(:placeholder-shown)]:bg-[#071f42]/95"
            style={{ left: "37.20%", top: "61.08%", width: "25.55%", height: "6.61%" }}
          />

          <button type="submit" disabled={loading} aria-label={loading ? "Signing in" : "Login"}
            className="absolute cursor-pointer rounded-full bg-transparent outline-none transition focus-visible:ring-2 focus-visible:ring-[#ffd166] focus-visible:ring-offset-2 focus-visible:ring-offset-[#061a38] disabled:cursor-wait"
            style={{ left: "37.20%", top: "69.97%", width: "25.55%", height: "7.10%" }}>
            <span className="sr-only">{loading ? "Signing in…" : "Login"}</span>
          </button>
          <a href="/forgot-password" aria-label="Forgot Password?" className="absolute rounded outline-none focus-visible:ring-2 focus-visible:ring-[#ffd166]" style={{ left: "40.32%", top: "79.63%", width: "7.15%", height: "3.55%" }}><span className="sr-only">Forgot Password?</span></a>
          <a href="/register" aria-label="Create customer account" className="absolute rounded outline-none focus-visible:ring-2 focus-visible:ring-[#ffd166]" style={{ left: "49.90%", top: "79.63%", width: "11.55%", height: "3.55%" }}><span className="sr-only">Create customer account</span></a>
        </form>
      </div>

      {/* Mobile layout: native responsive controls instead of scaling the desktop screenshot. */}
      <div className="relative z-20 flex min-h-[100dvh] items-center justify-center px-4 py-8 sm:px-6 md:hidden">
        <div className="w-full max-w-[420px]">
          <div className="mb-7 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#f4be4b]/35 bg-[#0a2850] shadow-lg shadow-black/20">
              <span className="text-2xl font-extrabold text-[#f4be4b]">CP</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Cafe POS</h1>
            <p className="mt-2 text-sm text-slate-300">Sign in to continue to your dashboard</p>
          </div>

          <form onSubmit={onSubmit} noValidate className="rounded-[28px] border border-white/10 bg-[#071f42]/95 p-5 shadow-2xl shadow-black/30 backdrop-blur sm:p-7">
            <div className="space-y-5">
              <div>
                <label htmlFor="login-mobile" className="mb-2 block text-sm font-semibold text-slate-100">Username</label>
                <input id="login-mobile" name="login" type="text" value={login} onChange={(event) => setLogin(event.target.value)} required autoComplete="username" disabled={loading}
                  placeholder="Enter username"
                  className="h-12 w-full rounded-xl border border-white/15 bg-[#041a38] px-4 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-[#f4be4b] focus:ring-2 focus:ring-[#f4be4b]/20 disabled:opacity-70" />
              </div>
              <div>
                <label htmlFor="password-mobile" className="mb-2 block text-sm font-semibold text-slate-100">Password</label>
                <input id="password-mobile" name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" disabled={loading}
                  placeholder="Enter password"
                  className="h-12 w-full rounded-xl border border-white/15 bg-[#041a38] px-4 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-[#f4be4b] focus:ring-2 focus:ring-[#f4be4b]/20 disabled:opacity-70" />
              </div>
              <button type="submit" disabled={loading}
                className="flex h-12 w-full items-center justify-center rounded-xl bg-[#f4be4b] px-4 text-base font-bold text-[#041a38] shadow-lg shadow-[#f4be4b]/10 transition active:scale-[0.99] disabled:cursor-wait disabled:opacity-70">
                {loading ? "Signing in…" : "Login"}
              </button>
            </div>
            <div className="mt-5 flex flex-col items-center justify-center gap-3 text-sm min-[390px]:flex-row min-[390px]:gap-5">
              <a href="/forgot-password" className="font-medium text-[#f4be4b] hover:underline">Forgot Password?</a>
              <span className="hidden text-white/20 min-[390px]:inline">•</span>
              <a href="/register" className="font-medium text-slate-200 hover:text-[#f4be4b]">Create customer account</a>
            </div>
          </form>
          <p className="mt-6 text-center text-xs text-slate-500">AIG Cafeteria Management System</p>
        </div>
      </div>
    </main>
  );
}
