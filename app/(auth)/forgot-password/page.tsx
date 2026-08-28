"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { authService } from "@/services/auth/auth.service";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const response = await authService.forgotPassword(email.trim());
      setMessage(
        response.message ||
          "If an account exists for that email address, a password reset link has been sent.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send the password reset email.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#090807] px-4 py-10 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(205,168,105,0.14),transparent_42%)]" />

      <div className="relative z-10 w-full max-w-md rounded-[2rem] border border-white/10 bg-black/45 p-7 shadow-2xl backdrop-blur-xl sm:p-9">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold tracking-[0.34em] text-[#cda869]">AIG RESTAURANT</p>
          <h1 className="mt-4 text-3xl font-semibold">Forgot password?</h1>
          <p className="mt-3 text-sm leading-6 text-white/60">
            Enter the email address registered to your account. We will send you a secure password reset link.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="mb-2 block text-sm text-white/75">
              Email address
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
                placeholder="name@example.com"
                disabled={loading}
                className="h-14 w-full rounded-full border border-white/15 bg-black/35 pl-12 pr-5 text-sm text-white placeholder:text-white/40 outline-none transition-colors focus:border-[#cda869]/70 disabled:opacity-60"
              />
            </div>
          </div>

          {message && (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm leading-6 text-emerald-100">
              {message}
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-100">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#e0bd7c] to-[#c9a050] text-sm font-semibold tracking-[0.12em] text-[#241a08] transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "SENDING…" : "SEND RESET LINK"}
          </button>
        </form>

        <Link
          href="/login"
          className="mt-6 flex items-center justify-center gap-2 text-sm text-[#cda869] hover:text-[#e0bd7c]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to login
        </Link>
      </div>
    </main>
  );
}
