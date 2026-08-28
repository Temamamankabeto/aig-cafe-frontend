"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit, Plus, RefreshCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
      setEditing(null); setForm(emptyForm); refresh();
    },
    onError: (error) => toast.error(message(error)),
  });
  const remove = useMutation({
    mutationFn: (id: number) => inventoryService.deleteDepartment(id, "admin"),
    onSuccess: () => { toast.success("Department deleted"); refresh(); },
    onError: (error) => toast.error(message(error)),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (form.name.trim()) save.mutate();
  }
  function edit(row: Department) {
    setEditing(row);
    setForm({ name: row.name, code: row.code ?? "", description: row.description ?? "", is_active: row.is_active });
  }

  return <div className="space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-bold">Departments</h1><p className="mt-1 text-sm text-muted-foreground">General Admin master data used by Store Keeper stock-out and return transactions.</p></div><Button variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}><RefreshCcw className={`mr-2 h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} />Refresh</Button></header>
    <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
      <Card><CardHeader><CardTitle>{editing ? "Edit department" : "Create department"}</CardTitle><CardDescription>Only active departments appear in the Store Keeper dropdown.</CardDescription></CardHeader><CardContent><form onSubmit={submit} className="space-y-4"><div className="space-y-2"><Label>Name</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div><div className="space-y-2"><Label>Code</Label><Input value={form.code ?? ""} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div><div className="space-y-2"><Label>Description</Label><Textarea value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div><div className="space-y-2"><Label>Status</Label><Select value={form.is_active === false ? "inactive" : "active"} onValueChange={(value) => setForm({ ...form, is_active: value === "active" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent></Select></div><div className="flex gap-2"><Button disabled={save.isPending || !form.name.trim()}><Plus className="mr-2 h-4 w-4" />{editing ? "Update" : "Create"}</Button>{editing && <Button type="button" variant="outline" onClick={() => { setEditing(null); setForm(emptyForm); }}>Cancel</Button>}</div></form></CardContent></Card>
      <Card><CardHeader><CardTitle>Department list</CardTitle><CardDescription>Create, update, activate, deactivate, or delete department master data.</CardDescription></CardHeader><CardContent className="space-y-4"><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or code" /><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Code</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{(query.data?.data ?? []).map((row) => <TableRow key={row.id}><TableCell className="font-medium">{row.name}<span className="block text-xs font-normal text-muted-foreground">{row.description || "No description"}</span></TableCell><TableCell>{row.code || "—"}</TableCell><TableCell><Badge variant={row.is_active ? "secondary" : "destructive"}>{row.is_active ? "Active" : "Inactive"}</Badge></TableCell><TableCell className="text-right"><Button type="button" variant="ghost" size="icon" aria-label={`Edit ${row.name}`} onClick={() => edit(row)}><Edit className="h-4 w-4" /></Button><Button type="button" variant="ghost" size="icon" className="text-destructive" aria-label={`Delete ${row.name}`} onClick={() => { if (window.confirm(`Delete ${row.name}?`)) remove.mutate(row.id); }}><Trash2 className="h-4 w-4" /></Button></TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>
    </div>
  </div>;
}
