"use client";

import Link from "next/link";
import { FormEvent, Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, LockKeyhole } from "lucide-react";
import { authService } from "@/services/auth/auth.service";

const PASSWORD_HINT = "Minimum 8 characters with uppercase, lowercase, number and symbol.";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const email = searchParams.get("email") ?? "";

  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const linkIsValid = useMemo(() => Boolean(token && email), [token, email]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!linkIsValid) {
      setError("This password reset link is incomplete. Please request a new one.");
      return;
    }

    if (password !== confirmation) {
      setError("Password confirmation does not match.");
      return;
    }

    setLoading(true);
    try {
      const response = await authService.resetPassword({
        token,
        email,
        password,
        password_confirmation: confirmation,
      });
      setPassword("");
      setConfirmation("");
      setMessage(response.message || "Password reset successfully. You can now sign in.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reset the password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#090807] px-4 py-10 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(205,168,105,0.14),transparent_42%)]" />

      <div className="relative z-10 w-full max-w-md rounded-[2rem] border border-white/10 bg-black/45 p-7 shadow-2xl backdrop-blur-xl sm:p-9">
        <div className="mb-7 text-center">
          <p className="text-xs font-semibold tracking-[0.34em] text-[#cda869]">AIG RESTAURANT</p>
          <h1 className="mt-4 text-3xl font-semibold">Create new password</h1>
          <p className="mt-3 text-sm leading-6 text-white/60">
            {email ? `Resetting the password for ${email}.` : "Use the secure link from your reset email."}
          </p>
        </div>

        {!linkIsValid ? (
          <div className="space-y-5">
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-100">
              This password reset link is invalid or incomplete.
            </div>
            <Link
              href="/forgot-password"
              className="flex h-12 items-center justify-center rounded-full border border-[#cda869]/40 text-sm font-medium text-[#e0bd7c] hover:bg-[#cda869]/10"
            >
              Request a new reset link
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="password" className="mb-2 block text-sm text-white/75">
                New password
              </label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="h-14 w-full rounded-full border border-white/15 bg-black/35 pl-12 pr-12 text-sm text-white outline-none transition-colors focus:border-[#cda869]/70"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-white/45 hover:text-white"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-2 text-xs leading-5 text-white/45">{PASSWORD_HINT}</p>
            </div>

            <div>
              <label htmlFor="password_confirmation" className="mb-2 block text-sm text-white/75">
                Confirm new password
              </label>
              <input
                id="password_confirmation"
                type={showPassword ? "text" : "password"}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="h-14 w-full rounded-full border border-white/15 bg-black/35 px-5 text-sm text-white outline-none transition-colors focus:border-[#cda869]/70"
              />
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

            {message ? (
              <Link
                href="/login"
                className="flex h-14 items-center justify-center rounded-full bg-gradient-to-b from-[#e0bd7c] to-[#c9a050] text-sm font-semibold tracking-[0.12em] text-[#241a08]"
              >
                GO TO LOGIN
              </Link>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#e0bd7c] to-[#c9a050] text-sm font-semibold tracking-[0.12em] text-[#241a08] transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? "RESETTING…" : "RESET PASSWORD"}
              </button>
            )}
          </form>
        )}
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#090807]" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
