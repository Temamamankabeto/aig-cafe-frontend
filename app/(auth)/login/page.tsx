"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, User } from "lucide-react";
import { toast } from "sonner";
import { authService } from "@/services/auth/auth.service";
import { getDashboardForRole } from "@/config/dashboard.config";

export default function LoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
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
      toast.error(message, {
        id: "login-error",
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  }


  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0b0906] px-6 py-12">
      {/*
        Ambient warm-lounge background, built entirely in CSS — no photo
        asset to source, host, or keep in sync with the design.
      */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 800px 600px at 20% 15%, rgba(201,160,80,0.10), transparent 60%)," +
            "radial-gradient(ellipse 700px 500px at 85% 80%, rgba(201,160,80,0.08), transparent 60%)," +
            "radial-gradient(ellipse 900px 700px at 50% 50%, rgba(60,45,25,0.35), transparent 70%)",
        }}
        aria-hidden
      />
      {/* Fine vignette so the card reads clearly at every screen size */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/50"
        aria-hidden
      />

      {/* Content */}
      <div className="relative z-10 flex w-full max-w-md flex-col items-center px-4 text-center">
        {/* Logo mark: fork + spoon inside a circle, with a small leaf accent */}
        <svg
          viewBox="0 0 120 120"
          className="h-24 w-24 text-[#cda869]"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
        >
          <circle cx="60" cy="58" r="46" />
          {/* fork */}
          <g strokeLinecap="round">
            <line x1="46" y1="34" x2="46" y2="82" />
            <line x1="41" y1="34" x2="41" y2="48" />
            <line x1="51" y1="34" x2="51" y2="48" />
            <path d="M41 48 C41 55 51 55 51 48" />
          </g>
          {/* spoon */}
          <g strokeLinecap="round">
            <line x1="66" y1="52" x2="66" y2="82" />
            <ellipse cx="66" cy="42" rx="7" ry="10" />
          </g>
          {/* leaf accent */}
          <g strokeLinecap="round">
            <path d="M84 40 C92 44 94 54 88 60" />
            <path d="M84 40 C86 46 86 52 88 60" />
          </g>
        </svg>

        <h1 className="mt-5 font-serif text-4xl font-medium tracking-[0.12em] text-white sm:text-5xl">
          AIG RESTAURANT
        </h1>
        <p className="mt-3 text-xs font-medium tracking-[0.35em] text-[#cda869] sm:text-sm">
          GOOD FOOD, GREAT MOMENTS
        </p>

        <div className="mt-5 h-px w-10 bg-[#cda869]/60" />

        <form onSubmit={onSubmit} className="mt-8 w-full space-y-4" noValidate>
          <div className="relative">
            <User
              className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50"
              strokeWidth={1.75}
            />
            <input
              id="login"
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              required
              autoComplete="username"
              placeholder="Username"
              disabled={loading}
              className="h-14 w-full rounded-full border border-white/15 bg-black/35 pl-12 pr-5 text-sm text-white placeholder:text-white/50 backdrop-blur-md outline-none transition-colors focus:border-[#cda869]/70 disabled:opacity-60"
            />
          </div>

          <div className="relative">
            <Lock
              className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50"
              strokeWidth={1.75}
            />
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="Password"
              disabled={loading}
              className="h-14 w-full rounded-full border border-white/15 bg-black/35 pl-12 pr-5 text-sm text-white placeholder:text-white/50 backdrop-blur-md outline-none transition-colors focus:border-[#cda869]/70 disabled:opacity-60"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#e0bd7c] to-[#c9a050] text-sm font-semibold tracking-[0.2em] text-[#241a08] transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "SIGNING IN…" : "LOGIN"}
          </button>
        </form>

        <div className="mt-5 flex items-center gap-4 text-sm">
          <a
            href="/forgot-password"
            className="text-[#cda869] transition-colors hover:text-[#e0bd7c] hover:underline underline-offset-4"
          >
            Forgot Password?
          </a>
          <span className="text-white/30">•</span>
          <a
            href="/register"
            className="text-[#cda869] transition-colors hover:text-[#e0bd7c] hover:underline underline-offset-4"
          >
            Create customer account
          </a>
        </div>
      </div>
    </main>
  );
}
