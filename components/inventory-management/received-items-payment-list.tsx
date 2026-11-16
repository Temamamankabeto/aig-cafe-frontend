"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { procurementService, type ReceivedStockItem } from "@/services/inventory-management/procurement.service";

const money = (value: number) => new Intl.NumberFormat("en-ET", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

export function ReceivedItemsPaymentList() {
  const client = useQueryClient();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [padStatus, setPadStatus] = useState<"all" | "registered" | "not_registered">("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number[]>([]);
  const [confirm, setConfirm] = useState(false);
  const queryKey = ["stock-keeper", "received-items", dateFrom, dateTo, padStatus, page];
  const query = useQuery({
    queryKey,
    queryFn: () => procurementService.receivedStockItems({
      date_from: dateFrom || undefined, date_to: dateTo || undefined, pad_status: padStatus, page, per_page: 20,
    }),
  });
  const rows = query.data?.data ?? [];
  const notRegistered = useMemo(() => rows.filter((item) => !item.pad_registered_at), [rows]);
  const visibleIds = notRegistered.map((item) => item.id);
  const selectedOnPage = selected.filter((id) => visibleIds.includes(id));
  const selectedTotal = rows.filter((row) => selected.includes(row.id)).reduce((sum, row) => sum + Number(row.total_price), 0);
  const registerPad = useMutation({
    mutationFn: () => procurementService.registerReceivedStockItemsPad(selectedOnPage),
    onSuccess: async (result) => {
      toast.success(`${result.updated_count} item(s) registered for PAD`);
      setSelected([]);
      setConfirm(false);
      await client.invalidateQueries({ queryKey: ["stock-keeper", "received-items"] });
    },
    onError: (error: unknown) => { setConfirm(false); toast.error(error instanceof Error ? error.message : "Unable to update PAD registration"); },
  });
  const setFilter = (update: () => void) => { update(); setPage(1); setSelected([]); setConfirm(false); };
  const invalidDates = Boolean(dateFrom && dateTo && dateFrom > dateTo);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Received items</CardTitle>
        <CardDescription>Review received stock by date and register manual supplier PAD documents for individual received items. Registration does not mean the supplier has been paid.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-sm font-medium">From date<Input type="date" value={dateFrom} onChange={(e) => setFilter(() => setDateFrom(e.target.value))} /></label>
          <label className="space-y-1 text-sm font-medium">To date<Input type="date" value={dateTo} onChange={(e) => setFilter(() => setDateTo(e.target.value))} /></label>
          <label className="space-y-1 text-sm font-medium">PAD status
            <select className="flex h-10 rounded-md border border-input bg-background px-3 text-sm" value={padStatus} onChange={(e) => setFilter(() => setPadStatus(e.target.value as "all" | "registered" | "not_registered"))}>
              <option value="all">All</option><option value="not_registered">Not Registered</option><option value="registered">PAD Registered</option>
            </select>
          </label>
          <Button variant="outline" onClick={() => setFilter(() => { setDateFrom(""); setDateTo(""); setPadStatus("all"); })}>Clear filters</Button>
        </div>
        {invalidDates && <p className="text-sm text-destructive">The end date cannot be before the start date.</p>}
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader><TableRow>
              <TableHead className="w-12"><Checkbox aria-label="Select all items without registered PAD on this page" checked={visibleIds.length > 0 && selectedOnPage.length === visibleIds.length} onCheckedChange={(checked) => setSelected(checked ? visibleIds : [])} /></TableHead>
              <TableHead>Date</TableHead><TableHead>PO</TableHead><TableHead>Item</TableHead><TableHead className="text-right">Received amount</TableHead><TableHead className="text-right">Unit price (ETB)</TableHead><TableHead className="text-right">Total price (ETB)</TableHead><TableHead>Status</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {query.isLoading ? <TableRow><TableCell colSpan={8}>Loading received items...</TableCell></TableRow> : query.isError ? <TableRow><TableCell colSpan={8} className="text-destructive">Unable to load received items.</TableCell></TableRow> : rows.length === 0 ? <TableRow><TableCell colSpan={8}>No received items match these filters.</TableCell></TableRow> : rows.map((item: ReceivedStockItem) => (
                <TableRow key={item.id}>
                  <TableCell><Checkbox aria-label={`Select ${item.inventory_item?.name ?? `item ${item.id}`}`} disabled={Boolean(item.pad_registered_at)} checked={selected.includes(item.id)} onCheckedChange={(checked) => setSelected((previous) => checked ? [...previous, item.id] : previous.filter((id) => id !== item.id))} /></TableCell>
                  <TableCell className="whitespace-nowrap">{item.stock_receiving?.received_at ? new Date(item.stock_receiving.received_at).toLocaleDateString() : "—"}</TableCell>
                  <TableCell>{item.stock_receiving?.purchase_order?.po_number ?? "—"}</TableCell>
                  <TableCell>{item.inventory_item?.name ?? `Item #${item.inventory_item_id}`}</TableCell>
                  <TableCell className="text-right tabular-nums">{Number(item.quantity_received).toLocaleString()} {item.base_unit ?? ""}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(Number(item.unit_cost))}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{money(Number(item.total_price))}</TableCell>
                  <TableCell>{item.pad_registered_at ? <span className="text-emerald-700">PAD Registered</span> : <span className="text-amber-700">Not Registered</span>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">Selected: {selectedOnPage.length} item(s) · {money(selectedTotal)} ETB</span>
          {!confirm ? <Button disabled={!selectedOnPage.length || invalidDates} onClick={() => setConfirm(true)}>Mark selected as PAD registered</Button> : <div className="flex flex-wrap items-center gap-2"><span className="text-sm">Confirm registering PAD for {selectedOnPage.length} item(s)?</span><Button variant="outline" onClick={() => setConfirm(false)}>Cancel</Button><Button disabled={registerPad.isPending} onClick={() => registerPad.mutate()}>{registerPad.isPending ? "Saving..." : "Confirm"}</Button></div>}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={page <= 1 || query.isFetching} onClick={() => { setPage((p) => p - 1); setSelected([]); }}>Previous</Button>
          <span className="self-center text-sm">Page {page} of {query.data?.meta.last_page ?? 1}</span>
          <Button variant="outline" disabled={page >= (query.data?.meta.last_page ?? 1) || query.isFetching} onClick={() => { setPage((p) => p + 1); setSelected([]); }}>Next</Button>
        </div>
      </CardContent>
    </Card>
  );
}
