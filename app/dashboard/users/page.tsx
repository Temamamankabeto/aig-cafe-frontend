"use client";

import { FormEvent, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import Link from "next/link";
import {
  Edit,
  Eye,
  KeyRound,
  Loader2,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserCheck,
  UserX,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useCreateUserMutation,
  useDeleteUserMutation,
  useResetUserPasswordMutation,
  useToggleUserMutation,
  useUpdateUserMutation,
  useUserRolesLiteQuery,
  useUsersQuery,
} from "@/hooks";
import {
  createUserSchema,
  resetUserPasswordSchema,
  updateUserSchema,
} from "@/lib/schemas/user.schema";
import type {
  CreateUserPayload,
  UpdateUserPayload,
  UserItem,
  UserStatus,
} from "@/types/user-management/user.type";
import { inventoryService } from "@/services/inventory-management/inventory.service";
import type { Department } from "@/types/inventory-management";

const emptyCreate: CreateUserPayload = {
  name: "",
  email: "",
  phone: "",
  password: "",
  role: "",
  department_id: "",
};
const emptyEdit: UpdateUserPayload = {
  name: "",
  email: "",
  phone: "",
  role: "",
  department_id: "",
};

function roleOf(user: UserItem) {
  if (user.role) return user.role;
  const first = user.roles?.[0];
  return !first ? "—" : typeof first === "string" ? first : first.name;
}

function firstValidationMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error && "issues" in error) {
    const issues = (error as { issues?: Array<{ message?: string }> }).issues;
    return issues?.[0]?.message ?? fallback;
  }

  if (error instanceof Error) return error.message;

  return fallback;
}

function mutationErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;

  if (typeof error === "object" && error && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }

  return fallback;
}

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<UserStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [deleteUser, setDeleteUser] = useState<UserItem | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [createForm, setCreateForm] = useState<CreateUserPayload>(emptyCreate);
  const [editForm, setEditForm] = useState<UpdateUserPayload>(emptyEdit);
  const [newPassword, setNewPassword] = useState("");

  const params = useMemo(
    () => ({ search, status, page, per_page: 10 }),
    [search, status, page],
  );
  const usersQuery = useUsersQuery(params);
  const roles = useUserRolesLiteQuery().data ?? [];
  const departmentsQuery = useQuery({
    queryKey: ["admin", "departments", "active", "user-assignment"],
    queryFn: () => inventoryService.departments({ is_active: true, per_page: 200 }, "admin"),
  });
  const departments = departmentsQuery.data?.data ?? [];
  const createUser = useCreateUserMutation();
  const updateUser = useUpdateUserMutation();
  const toggleUser = useToggleUserMutation();
  const removeUser = useDeleteUserMutation();
  const resetPassword = useResetUserPasswordMutation();

  const rows = usersQuery.data?.data ?? [];
  const meta = usersQuery.data?.meta;
  const busy =
    createUser.isPending || updateUser.isPending || resetPassword.isPending;

  function openEdit(user: UserItem) {
    const role = roleOf(user);
    setSelectedUser(user);
    setEditForm({
      name: user.name ?? "",
      email: user.email ?? "",
      phone: user.phone ?? "",
      role: role === "—" ? "" : role,
      department_id: user.department_id ? String(user.department_id) : "",
    });
    setEditOpen(true);
  }

  function openReset(user: UserItem) {
    setSelectedUser(user);
    setNewPassword("");
    setResetOpen(true);
  }

  function submitCreate(e: FormEvent) {
    e.preventDefault();

    const parsed = createUserSchema.safeParse(createForm);

if (!parsed.success) {
  toast.error(
    firstValidationMessage(parsed.error, "Please correct the highlighted fields."),
  );
  return;
}

    createUser.mutate(parsed.data, {
      onSuccess: () => {
        setCreateOpen(false);
        setCreateForm(emptyCreate);
        toast.success("User created successfully.");
      },
      onError: (error) => {
        toast.error(mutationErrorMessage(error, "Failed to create user."));
      },
    });
  }

  function submitEdit(e: FormEvent) {
    e.preventDefault();
    if (!selectedUser) return;

    const parsed = updateUserSchema.safeParse(editForm);

    if (!parsed.success) {
      toast.error(
        firstValidationMessage(
          parsed.error,
          "Please correct the highlighted fields.",
        ),
      );
      return;
    }

    updateUser.mutate(
      { id: selectedUser.id, payload: parsed.data },
      {
        onSuccess: () => {
          setEditOpen(false);
          setSelectedUser(null);
          toast.success("User updated successfully.");
        },
        onError: (error) => {
          toast.error(mutationErrorMessage(error, "Failed to update user."));
        },
      },
    );
  }

  function submitReset(e: FormEvent) {
    e.preventDefault();
    if (!selectedUser) return;

    const parsed = resetUserPasswordSchema.safeParse({
      new_password: newPassword,
    });

    if (!parsed.success) {
      toast.error(
        firstValidationMessage(
          parsed.error,
          "Please enter a valid new password.",
        ),
      );
      return;
    }

    resetPassword.mutate(
      { id: selectedUser.id, payload: parsed.data },
      {
        onSuccess: () => {
          setResetOpen(false);
          setSelectedUser(null);
          setNewPassword("");
          toast.success("Password reset successfully.");
        },
        onError: (error) => {
          toast.error(mutationErrorMessage(error, "Failed to reset password."));
        },
      },
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-muted-foreground">
            Manage users, roles, status, and password resets.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> New User
        </Button>
      </div>

      <div className="flex w-fit items-center gap-1 rounded-xl border bg-card p-1">
        <Button asChild size="sm" className="rounded-lg">
          <Link href="/dashboard/users">
            Users
            <Badge variant="secondary" className="ml-2">
              {meta?.total ?? rows.length}
            </Badge>
          </Link>
        </Button>
        <Button asChild size="sm" variant="ghost" className="rounded-lg">
          <Link href="/dashboard/users/roles">
            Roles
            <Badge variant="outline" className="ml-2">
              {roles.length}
            </Badge>
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle>User List</CardTitle>
            <div className="flex flex-col gap-2 md:flex-row">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8 md:w-72"
                  placeholder="Search name, email or phone..."
                  value={search}
                  onChange={(e) => {
                    setPage(1);
                    setSearch(e.target.value);
                  }}
                />
              </div>
              <Select
                value={status}
                onValueChange={(v) => {
                  setPage(1);
                  setStatus(v as UserStatus | "all");
                }}
              >
                <SelectTrigger className="md:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => usersQuery.refetch()}>
                <RefreshCw className="mr-2 h-4 w-4" /> Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {usersQuery.isLoading ? (
            <div className="flex justify-center py-10 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading users...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="py-8 text-center text-muted-foreground"
                      >
                        No users found
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.name}
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{user.phone ?? "—"}</TableCell>
                        <TableCell>{roleOf(user)}</TableCell>
                        <TableCell>{user.department?.name ?? "—"}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              user.status === "disabled"
                                ? "secondary"
                                : "default"
                            }
                          >
                            {user.status ?? "active"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                              <Button type="button" variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/dashboard/users/${user.id}`}>
                                  <Eye className="mr-2 h-4 w-4" /> View
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() =>
                                  setTimeout(() => openEdit(user), 0)
                                }
                              >
                                <Edit className="mr-2 h-4 w-4" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() =>
                                  setTimeout(
                                    () => toggleUser.mutate(user.id),
                                    0,
                                  )
                                }
                              >
                                {user.status === "disabled" ? (
                                  <UserCheck className="mr-2 h-4 w-4" />
                                ) : (
                                  <UserX className="mr-2 h-4 w-4" />
                                )}
                                {user.status === "disabled"
                                  ? "Enable"
                                  : "Disable"}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() =>
                                  setTimeout(() => openReset(user), 0)
                                }
                              >
                                <KeyRound className="mr-2 h-4 w-4" /> Reset
                                password
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onSelect={() =>
                                  setTimeout(() => setDeleteUser(user), 0)
                                }
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
          {meta && meta.last_page > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Page {meta.current_page} of {meta.last_page} • {meta.total}{" "}
                users
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= meta.last_page}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create User</DialogTitle>
            <DialogDescription>
              Add a new user and assign one backend role.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submitCreate}>
           <UserFields
  form={createForm}
  roles={roles.map((r) => r.name)}
  departments={departments}
  includePassword
  onChange={(value) => setCreateForm(value as CreateUserPayload)}
/>
            <Button className="w-full" disabled={busy}>
              {createUser.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}{" "}
              Save user
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user profile information and role.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submitEdit}>
            <UserFields
  form={editForm}
  roles={roles.map((r) => r.name)}
  departments={departments}
  onChange={(value) => setEditForm(value as UpdateUserPayload)}
/>
            <Button className="w-full" disabled={busy}>
              {updateUser.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}{" "}
              Update user
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for {selectedUser?.name ?? "this user"}.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submitReset}>
            <div className="grid gap-2">
              <Label>New Password</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <Button className="w-full" disabled={resetPassword.isPending}>
              {resetPassword.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}{" "}
              Reset password
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={Boolean(deleteUser)}
        onOpenChange={(open) => !open && setDeleteUser(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete {deleteUser?.name}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteUser) removeUser.mutate(deleteUser.id);
                setDeleteUser(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function UserFields<T extends CreateUserPayload | UpdateUserPayload>({
  form,
  roles,
  departments,
  onChange,
  includePassword = false,
}: {
  form: T;
  roles: string[];
  departments: Department[];
  includePassword?: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <>
      <div className="grid gap-2">
        <Label>Name</Label>
        <Input
          value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
          required
        />
      </div>
      <div className="grid gap-2">
        <Label>Email</Label>
        <Input
          type="email"
          value={form.email}
          onChange={(e) => onChange({ ...form, email: e.target.value })}
          required
        />
      </div>
      <div className="grid gap-2">
        <Label>Phone</Label>
        <Input
          value={form.phone}
          onChange={(e) => onChange({ ...form, phone: e.target.value })}
          required
        />
      </div>
      <div className="grid gap-2">
        <Label>Role</Label>
        <Select
          value={form.role}
          onValueChange={(role) => onChange({ ...form, role })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select role" />
          </SelectTrigger>
          <SelectContent>
            {roles.map((role) => (
              <SelectItem key={role} value={role}>
                {role}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label>Department</Label>
        <Select
          value={String(form.department_id ?? "")}
          onValueChange={(department_id) => onChange({ ...form, department_id })}
        >
          <SelectTrigger>
            <SelectValue placeholder={departments.length ? "Select department" : "No active departments"} />
          </SelectTrigger>
          <SelectContent>
            {departments.map((department) => (
              <SelectItem key={department.id} value={String(department.id)}>
                {department.name}{department.code ? ` (${department.code})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!departments.length && (
          <p className="text-xs text-destructive">Create or activate a department before assigning a user.</p>
        )}
      </div>
      {includePassword && "password" in form && (
        <div className="grid gap-2">
          <Label>Password</Label>
          <Input
            type="password"
            value={form.password}
            onChange={(e) => onChange({ ...form, password: e.target.value })}
            required
            minLength={6}
          />
        </div>
      )}
    </>
  );
}
