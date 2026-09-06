"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { orderService } from "@/services/order-management/order.service";
import type { CreditMealType } from "@/types/order-management";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const emptyForm = { name: "", is_active: true };

export default function MealTypesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CreditMealType | null>(null);
  const [form, setForm] = useState(emptyForm);

  const query = useQuery({
    queryKey: ["credit-meal-types", search],
    queryFn: () => orderService.creditMealTypes(search.trim() ? { search: search.trim() } : {}),
  });

  const rows = useMemo(() => query.data ?? [], [query.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { name: form.name.trim(), is_active: form.is_active };
      if (!payload.name) throw new Error("Meal type name is required.");
      return editing
        ? orderService.updateCreditMealType(editing.id, payload)
        : orderService.createCreditMealType(payload);
    },
    onSuccess: async () => {
      toast.success(editing ? "Meal type updated successfully" : "Meal type created successfully");
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
      await queryClient.invalidateQueries({ queryKey: ["credit-meal-types"] });
    },
    onError: (error: any) => toast.error(error?.response?.data?.message ?? error?.message ?? "Failed to save meal type"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string | number) => orderService.deleteCreditMealType(id),
    onSuccess: async () => {
      toast.success("Meal type deleted successfully");
      await queryClient.invalidateQueries({ queryKey: ["credit-meal-types"] });
    },
    onError: (error: any) => toast.error(error?.response?.data?.message ?? error?.message ?? "Failed to delete meal type"),
  });

  function createMealType() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function editMealType(item: CreditMealType) {
    setEditing(item);
    setForm({ name: item.name ?? "", is_active: Boolean(item.is_active) });
    setOpen(true);
  }

  async function removeMealType(item: CreditMealType) {
    if (!window.confirm(`Delete meal type "${item.name}"?`)) return;
    await deleteMutation.mutateAsync(item.id);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Meal Types</h1>
          <p className="text-sm text-muted-foreground">Create and maintain the meal types used by credit agreements and authorized-person orders.</p>
        </div>
        <Button onClick={createMealType}><Plus className="mr-2 h-4 w-4" />Create meal type</Button>
      </div>

      <Card className="rounded-2xl">
        <CardHeader className="gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>Credit meal types</CardTitle>
            <CardDescription>Only active meal types can be selected in new credit agreements.</CardDescription>
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search meal type" className="sm:w-64" />
            <Button variant="outline" size="icon" onClick={() => query.refetch()} aria-label="Refresh meal types">
              <RefreshCw className={`h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Used by agreements</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((item: CreditMealType & { agreements_count?: number }) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell><Badge variant={item.is_active ? "default" : "secondary"}>{item.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                  <TableCell>{item.agreements_count ?? 0}</TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => editMealType(item)}><Pencil className="mr-2 h-4 w-4" />Edit</Button>
                      <Button variant="outline" size="sm" onClick={() => removeMealType(item)} disabled={deleteMutation.isPending}><Trash2 className="mr-2 h-4 w-4" />Delete</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!rows.length && !query.isLoading && <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No meal types found.</TableCell></TableRow>}
              {query.isLoading && <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">Loading meal types...</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit meal type" : "Create meal type"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="meal-type-name">Meal type name</Label>
              <Input id="meal-type-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Example: Breakfast" autoFocus />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div><Label htmlFor="meal-type-active">Active</Label><p className="text-xs text-muted-foreground">Allow this meal type in agreements and orders.</p></div>
              <Checkbox id="meal-type-active" checked={form.is_active} onCheckedChange={(checked) => setForm((current) => ({ ...current, is_active: checked === true }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.name.trim()}>{saveMutation.isPending ? "Saving..." : editing ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
