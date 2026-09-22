"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2, QrCode, Printer, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { userService } from "@/services/user-management/user.service";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  useAssignUserRoleMutation,
  useResetUserPasswordMutation,
  useUserQuery,
  useUserRolesLiteQuery,
} from "@/hooks";

/* ---------------- helpers ---------------- */

function getUserRole(user: any) {
  if (!user) return "";
  if (user.role) return user.role;

  const firstRole = user.roles?.[0];
  if (!firstRole) return "";

  return typeof firstRole === "string" ? firstRole : firstRole.name;
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleString() : "—";
}

/* ---------------- page ---------------- */

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();

  const userQuery = useUserQuery(id);
  const rolesQuery = useUserRolesLiteQuery();

  const [selectedRole, setSelectedRole] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [qrCard, setQrCard] = useState<{ qr_token: string; issued_at?: string } | null>(null);
  const [qrBusy, setQrBusy] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceAmount, setBalanceAmount] = useState("");
  const [balanceBusy, setBalanceBusy] = useState(false);

  const user = userQuery.data;
  const roles = rolesQuery.data ?? [];

  const currentRole = getUserRole(user);
  const effectiveRole = selectedRole || currentRole;

  /* ✅ FIX: hooks take NO arguments */
  const assignRole = useAssignUserRoleMutation();
  const resetPassword = useResetUserPasswordMutation();

  useEffect(() => {
    if (!id) return;
    userService.balanceAccount(id).then((data) => setBalance(Number(data.balance ?? 0))).catch(() => setBalance(null));
  }, [id]);

  async function adjustBalance() {
    const amount = Number(balanceAmount);
    if (!Number.isFinite(amount) || amount === 0) return toast.error("Enter a non-zero amount.");
    setBalanceBusy(true);
    try {
      const data = await userService.adjustBalanceAccount(id, amount, amount > 0 ? "Balance top-up" : "Balance adjustment");
      setBalance(Number(data.balance ?? 0));
      setBalanceAmount("");
      toast.success("Balance account updated.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Failed to update balance."); }
    finally { setBalanceBusy(false); }
  }

  /* ---------------- actions ---------------- */

  function saveRole() {
    if (!user || !effectiveRole) return;

    assignRole.mutate(
      { id: user.id, payload: { role: effectiveRole } },
      {
        onSuccess: () => {
          userQuery.refetch();
        },
      }
    );
  }

  function submitPassword(event: FormEvent) {
    event.preventDefault();
    if (!user || !newPassword) return;

    resetPassword.mutate(
      { id: user.id, payload: { new_password: newPassword } },
      {
        onSuccess: () => setNewPassword(""),
      }
    );
  }

  async function issueQrCard() {
    if (!user || qrBusy) return;
    setQrBusy(true);
    try {
      const data = await userService.issueQrCard(user.id);
      setQrCard({ qr_token: data.qr_token, issued_at: data.issued_at });
      toast.success("QR login card issued. Print or save it now; the secure code is only returned when issued.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Failed to issue QR card."); }
    finally { setQrBusy(false); }
  }

  async function revokeQrCard() {
    if (!user || qrBusy) return;
    setQrBusy(true);
    try { await userService.revokeQrCard(user.id); setQrCard(null); toast.success("QR login card revoked."); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Failed to revoke QR card."); }
    finally { setQrBusy(false); }
  }

  function printQrCard() {
    if (!user || !qrCard) return;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(qrCard.qr_token)}`;
    const win = window.open("", "_blank", "width=520,height=680");
    if (!win) return;
    win.document.write(`<html><head><title>QR Login Card</title><style>body{font-family:Arial;text-align:center;padding:40px}img{width:260px;height:260px}.card{border:1px solid #ddd;border-radius:18px;padding:30px}h2{margin-bottom:4px}.muted{color:#666}</style></head><body><div class="card"><h2>AIG Cafeteria</h2><p class="muted">Secure QR Login Card</p><img src="${qrUrl}"/><h3>${user.name}</h3><p>User ID: ${user.id}</p><p><strong>Secure code:</strong><br/><span style="font-family:monospace;word-break:break-all">${qrCard.qr_token}</span></p><p class="muted">Keep this card private. If lost, ask an administrator to revoke and regenerate it.</p></div><script>setTimeout(()=>window.print(),800)<\/script></body></html>`);
    win.document.close();
  }

  /* ---------------- loading ---------------- */

  if (userQuery.isLoading) {
    return (
      <div className="flex justify-center py-12 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading user...
      </div>
    );
  }

  if (!user) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          User not found.
        </CardContent>
      </Card>
    );
  }

  /* ---------------- UI ---------------- */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-3">
            <Link href="/dashboard/users">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to users
            </Link>
          </Button>

          <h1 className="text-2xl font-bold">User Detail</h1>
          <p className="text-muted-foreground">
            View profile, update role, and reset password.
          </p>
        </div>

        <Badge
          variant={user.status === "disabled" ? "secondary" : "default"}
        >
          {user.status ?? "active"}
        </Badge>
      </div>

      {/* Main grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>

          <CardContent className="grid gap-4 md:grid-cols-2">
            <Info label="Name" value={user.name} />
            <Info label="Email" value={user.email} />
            <Info label="Phone" value={user.phone ?? "—"} />
            <Info label="Role" value={currentRole || "—"} />
            <Info label="Created" value={formatDate(user.created_at)} />
            <Info label="Updated" value={formatDate(user.updated_at)} />
          </CardContent>
        </Card>

        {/* Side panel */}
        <div className="space-y-6">
          {/* Role */}
          <Card>
            <CardHeader>
              <CardTitle>Role Assignment</CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label>Role</Label>

                <Select
                  value={effectiveRole}
                  onValueChange={setSelectedRole}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>

                  <SelectContent>
                    {roles.map((role: any) => (
                      <SelectItem key={role.id} value={role.name}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                className="w-full"
                onClick={saveRole}
                disabled={
                  !effectiveRole ||
                  effectiveRole === currentRole ||
                  assignRole.isPending
                }
              >
                {assignRole.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save role
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Balance Account</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-muted/40 p-4">
                <div className="text-xs text-muted-foreground">Available balance</div>
                <div className="text-2xl font-bold">{balance === null ? "—" : `${balance.toFixed(2)} ETB`}</div>
              </div>
              <div className="grid gap-2">
                <Label>Adjustment amount</Label>
                <Input type="number" step="0.01" value={balanceAmount} onChange={(e) => setBalanceAmount(e.target.value)} placeholder="e.g. 500 or -100" />
                <p className="text-xs text-muted-foreground">Positive amount adds funds. Negative amount reduces funds without allowing a negative balance.</p>
              </div>
              <Button className="w-full" onClick={adjustBalance} disabled={balanceBusy || !balanceAmount || Number(balanceAmount) === 0}>
                {balanceBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Update balance
              </Button>
            </CardContent>
          </Card>

          {/* Password reset */}
          <Card>
            <CardHeader>
              <CardTitle>Reset Password</CardTitle>
            </CardHeader>

            <CardContent>
              <form className="space-y-4" onSubmit={submitPassword}>
                <div className="grid gap-2">
                  <Label>New Password</Label>

                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={8}
                    required
                  />
                </div>

                <Button
                  className="w-full"
                  disabled={
                    resetPassword.isPending || newPassword.length < 6
                  }
                >
                  {resetPassword.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Reset password
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><QrCode className="h-5 w-5" />QR Login Card</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">Issue a secure QR card for passwordless login. Regenerating automatically invalidates the previous card.</p>
              {qrCard ? (
                <>
                  <div className="rounded-xl border bg-white p-4 text-center">
                    <img className="mx-auto h-44 w-44" alt="User QR login card" src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrCard.qr_token)}`} />
                    <p className="mt-2 text-xs text-slate-500">User ID: {user.id}</p>
                    <p className="mt-2 break-all rounded-lg bg-slate-50 p-2 font-mono text-[10px] text-slate-600"><span className="font-sans font-semibold">Secure code (manual login):</span><br />{qrCard.qr_token}</p>
                  </div>
                  <Button type="button" variant="outline" className="w-full" onClick={printQrCard}><Printer className="mr-2 h-4 w-4"/>Print QR Card</Button>
                  <Button type="button" variant="outline" className="w-full" onClick={issueQrCard} disabled={qrBusy}><RefreshCw className="mr-2 h-4 w-4"/>Regenerate</Button>
                  <Button type="button" variant="destructive" className="w-full" onClick={revokeQrCard} disabled={qrBusy}><Trash2 className="mr-2 h-4 w-4"/>Revoke Card</Button>
                </>
              ) : (
                <Button type="button" className="w-full" onClick={issueQrCard} disabled={qrBusy}>{qrBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Issue QR Login Card</Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ---------------- reusable UI ---------------- */

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-xs font-semibold uppercase text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-medium">{value}</p>
    </div>
  );
}