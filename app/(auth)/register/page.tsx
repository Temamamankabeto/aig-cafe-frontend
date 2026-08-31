"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { CheckCircle2, Eye, EyeOff, Loader2, Mail, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { customerRegisterSchema } from "@/lib/auth/auth.schema";
import { authService } from "@/services/auth/auth.service";

const initialForm = {
  name: "",
  email: "",
  phone: "",
  address: "",
  password: "",
  password_confirmation: "",
};

type RegisterForm = typeof initialForm;
type FieldErrors = Partial<Record<keyof RegisterForm, string>>;

export default function RegisterPage() {
  const [form, setForm] = useState<RegisterForm>(initialForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  function updateField(name: keyof RegisterForm, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});

    const parsed = customerRegisterSchema.safeParse({
      ...form,
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      address: form.address.trim(),
    });

    if (!parsed.success) {
      const nextErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof RegisterForm;
        if (field && !nextErrors[field]) nextErrors[field] = issue.message;
      }
      setErrors(nextErrors);
      toast.error("Please correct the highlighted fields");
      return;
    }

    setLoading(true);
    try {
      const response = await authService.registerCustomer(parsed.data);
      const email = response.data?.email ?? parsed.data.email;
      setRegisteredEmail(email);
      setForm(initialForm);

      toast.success(response.message ?? "Account created. Check your email to verify your account.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }


  async function resendVerification() {
    if (!registeredEmail) return;

    setResending(true);
    try {
      const response = await authService.resendVerification(registeredEmail);
      toast.success(response.message ?? "Verification email requested.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to resend verification email.");
    } finally {
      setResending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-8">
      <Card className="w-full max-w-xl rounded-2xl shadow-lg">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-2xl font-bold">Create customer account</CardTitle>
          <CardDescription>
            Register yourself as a customer, then browse the menu and place orders.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {registeredEmail ? (
            <div className="space-y-5 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-semibold">Verify your email</h2>
                <p className="text-sm text-muted-foreground">
                  We sent a verification link to <span className="font-medium text-foreground">{registeredEmail}</span>.
                  Open that email and verify your account before signing in.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Button type="button" variant="outline" onClick={resendVerification} disabled={resending}>
                  {resending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                  {resending ? "Sending..." : "Resend email"}
                </Button>
                <Button asChild>
                  <Link href="/login">Go to sign in</Link>
                </Button>
              </div>
            </div>
          ) : (
          <div>
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                autoComplete="name"
                disabled={loading}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(event) => updateField("email", event.target.value)}
                  autoComplete="email"
                  disabled={loading}
                />
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(event) => updateField("phone", event.target.value)}
                  autoComplete="tel"
                  disabled={loading}
                />
                {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={form.address}
                onChange={(event) => updateField("address", event.target.value)}
                autoComplete="street-address"
                disabled={loading}
              />
              {errors.address && <p className="text-xs text-destructive">{errors.address}</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(event) => updateField("password", event.target.value)}
                    autoComplete="new-password"
                    disabled={loading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password_confirmation">Confirm password</Label>
                <div className="relative">
                  <Input
                    id="password_confirmation"
                    type={showConfirmation ? "text" : "password"}
                    value={form.password_confirmation}
                    onChange={(event) => updateField("password_confirmation", event.target.value)}
                    autoComplete="new-password"
                    disabled={loading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmation((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showConfirmation ? "Hide confirmation" : "Show confirmation"}
                  >
                    {showConfirmation ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password_confirmation && (
                  <p className="text-xs text-destructive">{errors.password_confirmation}</p>
                )}
              </div>
            </div>

            <p className="text-xs leading-5 text-muted-foreground">
              Password must be at least 8 characters and contain uppercase, lowercase, number and symbol.
            </p>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
              {loading ? "Creating account..." : "Create account"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
              Sign in
            </Link>
          </p>
          </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
