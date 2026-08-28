"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";

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

  const user = userQuery.data;
  const roles = rolesQuery.data ?? [];

  const currentRole = getUserRole(user);
  const effectiveRole = selectedRole || currentRole;

  /* ✅ FIX: hooks take NO arguments */
  const assignRole = useAssignUserRoleMutation();
  const resetPassword = useResetUserPasswordMutation();

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