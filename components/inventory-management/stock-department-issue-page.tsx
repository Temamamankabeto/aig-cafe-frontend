"use client";

import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ClipboardList, PackageMinus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatBaseQuantity } from "@/lib/inventory-management";
import inventoryService from "@/services/inventory-management/inventory.service";
import type { InventoryItem, InventoryTransaction } from "@/types/inventory-management";
import { StockoutRequestQueuePage } from "@/components/inventory-management/stockout-request-queue-page";

function itemUnit(item?: Pick<InventoryItem, "base_unit" | "unit"> | null) {
  return item?.base_unit ?? item?.unit ?? "pcs";
}

function itemName(item?: Pick<InventoryItem, "name" | "sku"> | null) {
  if (!item) return "Inventory item";
  return item.sku ? `${item.name} (${item.sku})` : item.name;
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  return fallback;
}

function RecentStockoutTable({ rows, loading }: { rows: InventoryTransaction[]; loading?: boolean }) {
  if (loading) return <p className="text-sm text-muted-foreground">Loading department stockout records...</p>;

  if (!rows.length) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center">
        <p className="font-medium">No department stockout records</p>
        <p className="mt-1 text-sm text-muted-foreground">Stock issued to departments will appear here.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>Department / note</TableHead>
            <TableHead>Responsible user</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const item = row.inventory_item ?? row.inventoryItem;
            return (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{itemName(item)}</TableCell>
                <TableCell>{formatBaseQuantity(row.quantity, itemUnit(item))}</TableCell>
                <TableCell className="max-w-[360px]"><span className="font-medium">{row.department?.name ?? "Department"}</span><span className="block truncate text-xs text-muted-foreground">{row.note ?? row.reason ?? "—"}</span></TableCell>
                <TableCell><span className="font-medium">{row.responsible_user?.name ?? "—"}</span><span className="block text-xs text-muted-foreground">{row.custody_status?.replaceAll("_", " ") ?? "Legacy issue"}</span></TableCell>
                <TableCell>{row.created_at ? new Date(row.created_at).toLocaleString() : "—"}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function StockDepartmentIssuePage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [department, setDepartment] = useState("");
  const [responsibleUserId, setResponsibleUserId] = useState("");
  const [reason, setReason] = useState("");

  const departmentsQuery = useQuery({
    queryKey: ["inventory", "departments", "active"],
    queryFn: () => inventoryService.departments({ is_active: true, per_page: 200 }, "stock-keeper"),
    staleTime: 30000,
  });

  const departmentUsersQuery = useQuery({
    queryKey: ["inventory", "departments", department, "users"],
    queryFn: () => inventoryService.departmentUsers(department),
    enabled: Boolean(department),
    staleTime: 30000,
  });

  const itemsQuery = useQuery({
    queryKey: ["inventory", "stockout", "items"],
    queryFn: () => inventoryService.items({ per_page: 200 }, "stock-keeper"),
    staleTime: 30000,
  });

  const movementsQuery = useQuery({
    queryKey: ["inventory", "stockout", "movements"],
    queryFn: () => inventoryService.transactions({ reference_type: "department_stockout", per_page: 12 }, "stock-keeper"),
    staleTime: 30000,
  });

  const stockout = useMutation({
    mutationFn: () => inventoryService.stockOutItem(itemId, {
      quantity: Number(quantity),
      department_id: department,
      responsible_user_id: responsibleUserId,
      reason: reason.trim(),
    }, "stock-keeper"),
    onSuccess: () => {
      toast.success("Department stockout recorded");
      setItemId("");
      setQuantity("");
      setDepartment("");
      setResponsibleUserId("");
      setReason("");
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
    onError: (error) => toast.error(errorMessage(error, "Failed to record department stockout")),
  });

  const items = itemsQuery.data?.data ?? [];
  const departments = departmentsQuery.data?.data ?? [];
  const departmentUsers = departmentUsersQuery.data ?? [];
  const selectedItem = items.find((item) => String(item.id) === itemId);
  const quantityNumber = Number(quantity || 0);
  const exceedsStock = selectedItem ? quantityNumber > Number(selectedItem.current_stock ?? 0) : false;
  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) => `${item.name} ${item.sku ?? ""}`.toLowerCase().includes(term));
  }, [items, search]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!itemId || !department || !responsibleUserId || !reason.trim() || quantityNumber <= 0 || exceedsStock) return;
    stockout.mutate();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-primary/10 p-2 text-primary">
              <PackageMinus className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Department Stockout</h1>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Issue stock items to departments and keep the movement trail visible for inventory control.</p>
        </div>
        <Badge variant="secondary" className="w-fit">Store Keeper</Badge>
      </div>

      <StockoutRequestQueuePage mode="issue" />

      <div className="grid gap-4 xl:grid-cols-[430px_1fr]">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Record stockout item</CardTitle>
            <CardDescription>Quantity is deducted from inventory and recorded as department stockout.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label>Search item</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Search stock item" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Stock item</Label>
                <Select value={itemId} onValueChange={setItemId}>
                  <SelectTrigger><SelectValue placeholder="Select stock item" /></SelectTrigger>
                  <SelectContent>
                    {filteredItems.map((item) => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        {itemName(item)} — {formatBaseQuantity(item.current_stock, itemUnit(item))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input type="number" step="0.001" min="0.001" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="0.000" />
                  {selectedItem && <p className="text-xs text-muted-foreground">Available: {formatBaseQuantity(selectedItem.current_stock, itemUnit(selectedItem))}</p>}
                  {exceedsStock && <p className="text-xs text-destructive">Quantity cannot be greater than available stock.</p>}
                </div>

                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select value={department} onValueChange={(value) => { setDepartment(value); setResponsibleUserId(""); }}>
                    <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                    <SelectContent>
                      {departments.map((row) => <SelectItem key={row.id} value={String(row.id)}>{row.name}{row.code ? ` (${row.code})` : ""}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {!departmentsQuery.isLoading && !departments.length && <p className="text-xs text-destructive">No active departments. Ask General Admin to create or activate a department.</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Responsible user</Label>
                <Select value={responsibleUserId} onValueChange={setResponsibleUserId} disabled={!department || departmentUsersQuery.isLoading}>
                  <SelectTrigger><SelectValue placeholder={!department ? "Select department first" : "Select responsible user"} /></SelectTrigger>
                  <SelectContent>
                    {departmentUsers.map((user) => <SelectItem key={user.id} value={String(user.id)}>{user.name}{user.phone ? ` — ${user.phone}` : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
                {department && !departmentUsersQuery.isLoading && !departmentUsers.length && <p className="text-xs text-destructive">No active users are assigned to this department. General Admin must assign one first.</p>}
              </div>

              <div className="space-y-2">
                <Label>Purpose / reason</Label>
                <Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Example: issued to kitchen for daily production" />
              </div>

              <Button className="w-full" disabled={stockout.isPending || !itemId || !department || !responsibleUserId || !reason.trim() || quantityNumber <= 0 || exceedsStock} type="submit">
                <ClipboardList className="mr-2 h-4 w-4" />
                Save stockout
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Recent department stockout</CardTitle>
            <CardDescription>Latest issued stock items grouped under department stockout movements.</CardDescription>
          </CardHeader>
          <CardContent>
            <RecentStockoutTable rows={movementsQuery.data?.data ?? []} loading={movementsQuery.isLoading} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
