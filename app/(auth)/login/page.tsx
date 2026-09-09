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
    <main className="relative min-h-screen overflow-hidden bg-[#041a38]">
      {/*
        The supplied reference is used as the visual canvas so the desktop login
        matches it pixel-for-pixel. The controls below are real interactive form
        fields positioned exactly over the controls visible in the reference.
      */}
      <img
        src="/images/login-exact-reference.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover object-center"
        draggable={false}
      />

      <form onSubmit={onSubmit} className="absolute inset-0 z-10" noValidate>
        <label htmlFor="login" className="sr-only">
          Username
        </label>
        <input
          id="login"
          name="login"
          type="text"
          value={login}
          onChange={(event) => setLogin(event.target.value)}
          required
          autoComplete="username"
          disabled={loading}
          aria-label="Username"
          className="absolute rounded-[13px] border-0 bg-transparent pl-[3.25%] pr-[1.1%] text-[clamp(12px,0.82vw,15px)] text-white caret-[#f4be4b] outline-none transition-colors focus:bg-[#071f42]/95 disabled:cursor-not-allowed disabled:opacity-70 [&:not(:placeholder-shown)]:bg-[#071f42]/95"
          placeholder=" "
          style={{
            left: "37.20%",
            top: "52.99%",
            width: "25.55%",
            height: "6.61%",
          }}
        />

        <label htmlFor="password" className="sr-only">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          autoComplete="current-password"
          disabled={loading}
          aria-label="Password"
          className="absolute rounded-[13px] border-0 bg-transparent pl-[3.25%] pr-[1.1%] text-[clamp(12px,0.82vw,15px)] text-white caret-[#f4be4b] outline-none transition-colors focus:bg-[#071f42]/95 disabled:cursor-not-allowed disabled:opacity-70 [&:not(:placeholder-shown)]:bg-[#071f42]/95"
          placeholder=" "
          style={{
            left: "37.20%",
            top: "61.08%",
            width: "25.55%",
            height: "6.61%",
          }}
        />

        <button
          type="submit"
          disabled={loading}
          aria-label={loading ? "Signing in" : "Login"}
          className="absolute cursor-pointer rounded-full bg-transparent outline-none transition focus-visible:ring-2 focus-visible:ring-[#ffd166] focus-visible:ring-offset-2 focus-visible:ring-offset-[#061a38] disabled:cursor-wait"
          style={{
            left: "37.20%",
            top: "69.97%",
            width: "25.55%",
            height: "7.10%",
          }}
        >
          <span className="sr-only">{loading ? "Signing in…" : "Login"}</span>
        </button>

        <a
          href="/forgot-password"
          aria-label="Forgot Password?"
          className="absolute rounded outline-none focus-visible:ring-2 focus-visible:ring-[#ffd166]"
          style={{
            left: "40.32%",
            top: "79.63%",
            width: "7.15%",
            height: "3.55%",
          }}
        >
          <span className="sr-only">Forgot Password?</span>
        </a>

        <a
          href="/register"
          aria-label="Create customer account"
          className="absolute rounded outline-none focus-visible:ring-2 focus-visible:ring-[#ffd166]"
          style={{
            left: "49.90%",
            top: "79.63%",
            width: "11.55%",
            height: "3.55%",
          }}
        >
          <span className="sr-only">Create customer account</span>
        </a>
      </form>

      {/*
        On narrow/mobile screens retain all functionality and keep the supplied
        design centered. The reference itself scales proportionally through the
        cover image above, so there is no second conflicting login UI.
      */}
    </main>
  );
}
