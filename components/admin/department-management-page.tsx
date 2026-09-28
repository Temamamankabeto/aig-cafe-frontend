"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit, MoreHorizontal, Plus, Power, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import inventoryService from "@/services/inventory-management/inventory.service";
import type { Department, DepartmentPayload } from "@/types/inventory-management";

const emptyForm: DepartmentPayload = { name: "", code: "", description: "", is_active: true };
const message = (error: unknown) => error instanceof Error ? error.message : "The request could not be completed.";

export function DepartmentManagementPage() {
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Department | null>(null);
  const [form, setForm] = useState<DepartmentPayload>(emptyForm);
  const [dialogOpen, setDialogOpen] = useState(false);

  const query = useQuery({
    queryKey: ["admin", "departments", search],
    queryFn: () => inventoryService.departments({ search, per_page: 100 }, "admin"),
  });

  const refresh = () => client.invalidateQueries({ queryKey: ["admin", "departments"] });

  const save = useMutation({
    mutationFn: () => editing
      ? inventoryService.updateDepartment(editing.id, form, "admin")
      : inventoryService.createDepartment(form, "admin"),
    onSuccess: (response) => {
      toast.success(response.message ?? "Department saved");
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
      refresh();
    },
    onError: (error) => toast.error(message(error)),
  });

  const toggleStatus = useMutation({
    mutationFn: (row: Department) => inventoryService.updateDepartment(row.id, { is_active: !row.is_active }, "admin"),
    onSuccess: (response) => {
      toast.success(response.data?.is_active ? "Department enabled" : "Department disabled");
      refresh();
    },
    onError: (error) => toast.error(message(error)),
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(row: Department) {
    setEditing(row);
    setForm({ name: row.name, code: row.code ?? "", description: row.description ?? "", is_active: row.is_active });
    setDialogOpen(true);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (form.name.trim()) save.mutate();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Departments</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}>
            <RefreshCcw className={`mr-2 h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} />Refresh
          </Button>
          <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Add Department</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="border-b p-4">
            <Input className="max-w-md" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search department name or code" />
          </div>
          <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[70px]">#</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead className="w-[80px] text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(query.data?.data ?? []).map((row, index) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>{row.code || "—"}</TableCell>
                    <TableCell className="max-w-[420px] whitespace-normal break-words">{row.description || "—"}</TableCell>
                    <TableCell><Badge variant={row.is_active ? "secondary" : "outline"}>{row.is_active ? "Active" : "Disabled"}</Badge></TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <Button type="button" variant="ghost" size="icon" aria-label={`Actions for ${row.name}`}><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => openEdit(row)}><Edit className="h-4 w-4" />Edit</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => toggleStatus.mutate(row)} disabled={toggleStatus.isPending}>
                            <Power className="h-4 w-4" />{row.is_active ? "Disable" : "Enable"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {!query.isLoading && (query.data?.data ?? []).length === 0 && (
                  <TableRow><TableCell colSpan={6} className="h-28 text-center text-muted-foreground">No departments found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditing(null); setForm(emptyForm); } }}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader><DialogTitle>{editing ? "Edit Department" : "Add Department"}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="department-name">Name</Label><Input id="department-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="space-y-2"><Label htmlFor="department-code">Code</Label><Input id="department-code" value={form.code ?? ""} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label htmlFor="department-description">Description</Label><Textarea id="department-description" rows={4} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="space-y-2"><Label>Status</Label><Select value={form.is_active === false ? "inactive" : "active"} onValueChange={(value) => setForm({ ...form, is_active: value === "active" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Disabled</SelectItem></SelectContent></Select></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={save.isPending || !form.name.trim()}>{save.isPending ? "Saving..." : editing ? "Save Changes" : "Add Department"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
