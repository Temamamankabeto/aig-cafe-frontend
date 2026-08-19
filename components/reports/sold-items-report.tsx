"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Banknote, CreditCard, Printer, RefreshCcw } from "lucide-react";
import api from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { normalizeRole } from "@/config/dashboard.config";
import { authService } from "@/services/auth/auth.service";

type PaymentType = "cash" | "credit";
type Filters = { payment_type: PaymentType; date_from: string; date_to: string; cashier_id: string; page: number; per_page: number };
type Row = {
  menu_item_id: number;
  item_name: string;
  category_name?: string | null;
  total_quantity: number;
  average_unit_price: number;
  total_sales: number;
  payment_method: string;
};
type Summary = { total_quantity: number; total_sales: number };
type Response = {
  success: boolean;
  message: string;
  data: Row[];
  meta: { current_page: number; last_page: number; per_page: number; total: number; summary: Summary };
};
type CategoryGroup = { category: string; items: Row[] };
type CashierOption = { id: number; name?: string | null; email?: string | null; phone?: string | null };
type CashiersResponse = { success: boolean; message: string; data: CashierOption[]; meta?: { total: number } };

const defaults: Filters = { payment_type: "cash", date_from: "", date_to: "", cashier_id: "all", page: 1, per_page: 25 };
const emptySummary: Summary = { total_quantity: 0, total_sales: 0 };

const money = (value: unknown) => Number(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const quantity = (value: unknown) => Number(value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
const escapeHtml = (value: unknown) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");

function groupByCategory(rows: Row[]): CategoryGroup[] {
  const groups = new Map<string, Row[]>();
  rows.forEach((row) => {
    const category = row.category_name?.trim() || "Uncategorized";
    groups.set(category, [...(groups.get(category) ?? []), row]);
  });
  return Array.from(groups, ([category, items]) => ({ category, items }));
}

function dateRangeLabel(filters: Filters) {
  if (!filters.date_from && !filters.date_to) return "All dates";
  return `${filters.date_from || "Beginning"} to ${filters.date_to || "Today"}`;
}

function requestParams(filters: Filters, overrides: Partial<Filters> = {}) {
  const values = { ...filters, ...overrides };
  return {
    ...values,
    period: "custom",
    cashier_id: values.cashier_id === "all" ? undefined : values.cashier_id,
  };
}

export function SoldItemsReport() {
  const [draft, setDraft] = useState(defaults);
  const [filters, setFilters] = useState(defaults);
  const [isPrinting, setIsPrinting] = useState(false);
  const roles = authService.getStoredRoles();
  const user = authService.getStoredUser();
  const roleKey = normalizeRole(roles[0] ?? user?.role);
  const isCashierUser = roleKey === "cashier";

  const cashiersQuery = useQuery({
    queryKey: ["reports", "cashiers"],
    queryFn: async () => (await api.get<CashiersResponse>("/reports/cashiers")).data,
    enabled: !isCashierUser,
    staleTime: 5 * 60 * 1000,
  });
  const cashiers = cashiersQuery.data?.data ?? [];

  const report = useQuery({
    queryKey: ["reports", "sold-items", filters],
    queryFn: async () => (await api.get<Response>("/reports/sold-items", { params: requestParams(filters) })).data,
  });

  const rows = report.data?.data ?? [];
  const groups = useMemo(() => groupByCategory(rows), [rows]);
  const meta = report.data?.meta;
  const summary = meta?.summary ?? emptySummary;
  const invalidRange = Boolean(draft.date_from && draft.date_to && draft.date_to < draft.date_from);
  const cashierLabel = filters.cashier_id === "all"
    ? "All cashiers"
    : cashiers.find((cashier) => String(cashier.id) === filters.cashier_id)?.name ?? `Cashier #${filters.cashier_id}`;

  function changeTab(payment_type: PaymentType) {
    setDraft((value) => ({ ...value, payment_type, page: 1 }));
    setFilters((value) => ({ ...value, payment_type, page: 1 }));
  }

  function applyFilters() {
    if (!invalidRange) setFilters({ ...draft, page: 1 });
  }

  function resetFilters() {
    const reset = { ...defaults, payment_type: filters.payment_type };
    setDraft(reset);
    setFilters(reset);
  }

  function changePage(page: number) {
    setFilters((value) => ({ ...value, page }));
    setDraft((value) => ({ ...value, page }));
  }

  async function fetchAllRows() {
    const first = (await api.get<Response>("/reports/sold-items", { params: requestParams(filters, { page: 1, per_page: 100 }) })).data;
    const allRows = [...(first.data ?? [])];
    const pages = first.meta?.last_page ?? 1;
    if (pages > 1) {
      const rest = await Promise.all(Array.from({ length: pages - 1 }, (_, index) => api.get<Response>("/reports/sold-items", { params: requestParams(filters, { page: index + 2, per_page: 100 }) })));
      rest.forEach((result) => allRows.push(...(result.data.data ?? [])));
    }
    return { rows: allRows, summary: first.meta?.summary ?? emptySummary };
  }

  async function printReport() {
    const printWindow = window.open("", "_blank", "width=1100,height=800");
    if (!printWindow) return;
    printWindow.document.write("<p style='font-family:Arial;padding:24px'>Preparing report...</p>");
    setIsPrinting(true);
    try {
      const printable = await fetchAllRows();
      const body = groupByCategory(printable.rows).flatMap((group) => group.items.map((row, index) => `
        <tr>
          ${index === 0 ? `<td rowspan="${group.items.length}" class="category">${escapeHtml(group.category)}</td>` : ""}
          <td>${escapeHtml(row.item_name)}</td>
          <td class="number">${escapeHtml(quantity(row.total_quantity))}</td>
          <td class="number">${escapeHtml(money(row.average_unit_price))}</td>
          <td class="number strong">${escapeHtml(money(row.total_sales))}</td>
          <td class="payment">${escapeHtml(row.payment_method)}</td>
        </tr>`)).join("");

      printWindow.document.open();
      printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Sales Report</title><style>
        @page{size:A4 portrait;margin:12mm}*{box-sizing:border-box}body{color:#111827;font-family:Arial,sans-serif;font-size:10px;margin:0}
        h1{font-size:19px;margin:0 0 4px;text-align:center}.subtitle{color:#4b5563;margin-bottom:14px;text-align:center;text-transform:capitalize}
        table{border-collapse:collapse;width:100%}th,td{border:1px solid #9ca3af;padding:6px 7px;vertical-align:top}th{background:#e5e7eb;text-align:left}
        .category,tfoot td{background:#f3f4f6;font-weight:700}.number{text-align:right;white-space:nowrap}.payment{text-transform:capitalize}.strong{font-weight:700}
        .footer{color:#6b7280;font-size:9px;margin-top:8px}
      </style></head><body>
        <h1>AIG Cafeteria Sales Report</h1><div class="subtitle">${escapeHtml(filters.payment_type)} sales · ${escapeHtml(dateRangeLabel(filters))} · ${escapeHtml(cashierLabel)}</div>
        <table><thead><tr><th>Category</th><th>Menu Item</th><th class="number">Quantity</th><th class="number">Price</th><th class="number">Total Price</th><th>Payment Method</th></tr></thead>
        <tbody>${body || '<tr><td colspan="6" style="padding:20px;text-align:center">No sales found.</td></tr>'}</tbody>
        <tfoot><tr><td colspan="2">Filtered Summary</td><td class="number">${escapeHtml(quantity(printable.summary.total_quantity))}</td><td></td><td class="number">${escapeHtml(money(printable.summary.total_sales))}</td><td></td></tr></tfoot></table>
        <div class="footer">Printed ${escapeHtml(new Date().toLocaleString())}</div><script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()};<\/script>
      </body></html>`);
      printWindow.document.close();
    } catch {
      printWindow.document.open();
      printWindow.document.write("<p style='font-family:Arial;padding:24px;color:#b91c1c'>Unable to prepare the sales report.</p>");
      printWindow.document.close();
    } finally {
      setIsPrinting(false);
    }
  }

  return <div className="space-y-6">
    <Tabs value={filters.payment_type} onValueChange={(value) => changeTab(value as PaymentType)} className="w-full">
      <TabsList className="grid h-auto w-full grid-cols-2 p-1 sm:w-[420px]">
        <TabsTrigger value="cash" className="gap-2 py-2.5"><Banknote className="h-4 w-4" />Cash Sales</TabsTrigger>
        <TabsTrigger value="credit" className="gap-2 py-2.5"><CreditCard className="h-4 w-4" />Credit Sales</TabsTrigger>
      </TabsList>
    </Tabs>

    <Card className="rounded-2xl"><CardHeader>
      <CardTitle>Report Filters</CardTitle><CardDescription>Filter the {filters.payment_type} sales report by date range.</CardDescription>
      <div className="grid gap-3 pt-2 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5"><label htmlFor="sales-date-from" className="text-sm font-medium">Date From</label><Input id="sales-date-from" type="date" value={draft.date_from} onChange={(event) => setDraft((value) => ({ ...value, date_from: event.target.value }))} /></div>
        <div className="space-y-1.5"><label htmlFor="sales-date-to" className="text-sm font-medium">Date To</label><Input id="sales-date-to" type="date" min={draft.date_from || undefined} value={draft.date_to} onChange={(event) => setDraft((value) => ({ ...value, date_to: event.target.value }))} /></div>
        {!isCashierUser && <div className="space-y-1.5"><label className="text-sm font-medium">Cashier</label><Select value={draft.cashier_id} onValueChange={(cashier_id) => setDraft((value) => ({ ...value, cashier_id }))}><SelectTrigger><SelectValue placeholder={cashiersQuery.isLoading ? "Loading cashiers..." : "All cashiers"} /></SelectTrigger><SelectContent><SelectItem value="all">All Cashiers</SelectItem>{cashiers.map((cashier) => <SelectItem key={cashier.id} value={String(cashier.id)}>{cashier.name ?? cashier.email ?? cashier.phone ?? `Cashier #${cashier.id}`}</SelectItem>)}</SelectContent></Select></div>}
      </div>
      {invalidRange && <p className="pt-2 text-sm text-destructive">The end date must be the same as or later than the start date.</p>}
      <div className="flex flex-col gap-2 pt-3 sm:flex-row"><Button type="button" onClick={applyFilters} disabled={invalidRange}>Apply Filters</Button><Button type="button" variant="outline" onClick={resetFilters}><RefreshCcw className="mr-2 h-4 w-4" />Reset</Button></div>
    </CardHeader></Card>

    <Card className="rounded-2xl"><CardHeader className="gap-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div><CardTitle className="capitalize">{filters.payment_type} Sales Report</CardTitle><CardDescription>{dateRangeLabel(filters)}{!isCashierUser ? ` · ${cashierLabel}` : ""}</CardDescription></div>
      <Button type="button" variant="outline" onClick={printReport} disabled={report.isLoading || isPrinting || rows.length === 0}><Printer className="mr-2 h-4 w-4" />{isPrinting ? "Preparing..." : "Print Report"}</Button>
    </div></CardHeader><CardContent className="space-y-4">
      {report.isError && <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{report.error instanceof Error ? report.error.message : "Unable to load the sales report."}</div>}
      <div className="overflow-x-auto rounded-xl border"><Table><TableHeader><TableRow>
        <TableHead>Category</TableHead><TableHead>Menu Item</TableHead><TableHead className="text-right">Quantity</TableHead><TableHead className="text-right">Price</TableHead><TableHead className="text-right">Total Price</TableHead><TableHead>Payment Method</TableHead>
      </TableRow></TableHeader><TableBody>
        {report.isLoading ? <TableRow><TableCell colSpan={6} className="h-28 text-center text-muted-foreground">Loading sales report...</TableCell></TableRow>
          : groups.length ? groups.flatMap((group) => group.items.map((row, index) => <TableRow key={`${group.category}-${row.menu_item_id}`}>
            {index === 0 && <TableCell rowSpan={group.items.length} className="align-top bg-muted/40 font-semibold">{group.category}</TableCell>}
            <TableCell className="font-medium">{row.item_name}</TableCell><TableCell className="text-right">{quantity(row.total_quantity)}</TableCell><TableCell className="text-right">{money(row.average_unit_price)}</TableCell><TableCell className="text-right font-semibold">{money(row.total_sales)}</TableCell><TableCell><Badge variant="outline" className="capitalize">{row.payment_method}</Badge></TableCell>
          </TableRow>))
          : <TableRow><TableCell colSpan={6} className="h-28 text-center text-muted-foreground">No sales found for the selected date range and payment type.</TableCell></TableRow>}
      </TableBody><TableFooter><TableRow><TableCell colSpan={2} className="font-bold">Filtered Summary</TableCell><TableCell className="text-right font-bold">{quantity(summary.total_quantity)}</TableCell><TableCell /><TableCell className="text-right font-bold">{money(summary.total_sales)}</TableCell><TableCell /></TableRow></TableFooter></Table></div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-muted-foreground">Page {meta?.current_page ?? 1} of {meta?.last_page ?? 1} · {meta?.total ?? 0} grouped menu items</p><div className="flex gap-2">
        <Button type="button" variant="outline" disabled={(meta?.current_page ?? 1) <= 1 || report.isFetching} onClick={() => changePage(Math.max(1, (meta?.current_page ?? 1) - 1))}>Previous</Button>
        <Button type="button" variant="outline" disabled={(meta?.current_page ?? 1) >= (meta?.last_page ?? 1) || report.isFetching} onClick={() => changePage(Math.min(meta?.last_page ?? 1, (meta?.current_page ?? 1) + 1))}>Next</Button>
      </div></div>
    </CardContent></Card>
  </div>;
}
