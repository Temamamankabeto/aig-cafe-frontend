"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type StockRow = { id: number; store: string; item: string; unit: string; purchase_request: number; stock_in: number; stock_out: number; available: number; reserved: number; status: string };
type StockResponse = { data: StockRow[]; meta: { count: number; generated_at: string; note: string } };
const headers = ["No", "Store", "Item", "Purchase Request", "Stock In", "Stock Out", "Available", "Reserved", "Status"];
const quantity = (value: number, unit: string) => `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(value)} ${unit || ""}`.trim();
const statusName = (status: string) => ({ in_stock: "In Stock", low_stock: "Low Stock", out_of_stock: "Out of Stock" }[status] || status);
const csv = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;

export default function ManagerStockBalancePage() {
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("all");
  const query = useQuery({
    queryKey: ["manager-stock-balance", search, from, to, status],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (status !== "all") params.set("status", status);
      return unwrap<StockResponse>(await api.get(`/manager/reports/stock-balance?${params.toString()}`));
    },
  });
  const rows = query.data?.data || [];
  const exportRows = useMemo(() => rows.map((row, index) => [index + 1, row.store, row.item, quantity(row.purchase_request, row.unit), quantity(row.stock_in, row.unit), quantity(row.stock_out, row.unit), quantity(row.available, row.unit), quantity(row.reserved, row.unit), statusName(row.status)]), [rows]);
  const downloadCsv = () => {
    const content = "\uFEFF" + [headers, ...exportRows].map(row => row.map(csv).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "manager-stock-balance.csv"; link.click(); URL.revokeObjectURL(url);
  };
  return <div className="space-y-5 p-4 md:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3 print:hidden"><div><h1 className="text-2xl font-bold">Stock Balance For Manager</h1><p className="text-sm text-muted-foreground">Purchase requests, stock movements and available stock</p></div><div className="flex gap-2"><Button variant="outline" onClick={downloadCsv} disabled={!rows.length}>Export Excel (CSV)</Button><Button variant="outline" onClick={() => window.print()}>Print / Save PDF</Button></div></div>
    <h1 className="hidden text-center text-xl font-bold print:block">Stock Balance For Manager</h1>
    <div className="flex flex-wrap gap-3 print:hidden"><Input className="w-56" placeholder="Search item" value={search} onChange={e => setSearch(e.target.value)} /><label className="text-sm">From <Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label><label className="text-sm">To <Input type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} /></label><label className="text-sm">Status <select className="block h-10 rounded-md border bg-background px-3" value={status} onChange={e => setStatus(e.target.value)}><option value="all">All</option><option value="in_stock">In Stock</option><option value="low_stock">Low Stock</option><option value="out_of_stock">Out of Stock</option></select></label></div>
    {query.isLoading && <p>Loading stock balance…</p>}{query.isError && <p className="text-destructive">Unable to load stock balance. Check manager access and server logs.</p>}
    <div className="overflow-x-auto rounded-lg border bg-card"><table className="w-full min-w-[900px] border-collapse text-sm"><thead><tr><th colSpan={9} className="border-b bg-muted/50 p-3 text-center font-bold">Stock Balance For Manager</th></tr><tr className="bg-muted/30">{headers.map(h => <th key={h} className="border-b p-2 text-left">{h}</th>)}</tr></thead><tbody>{exportRows.map((cells, i) => <tr key={rows[i].id} className="border-b">{cells.map((cell, j) => <td key={j} className="p-2">{cell}</td>)}</tr>)}{!query.isLoading && !rows.length && <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">No stock records found.</td></tr>}<tr className="bg-muted/30 font-semibold"><td className="p-2">Total</td><td colSpan={8} className="p-2">{rows.length} items — quantities use different base units and cannot be summed together.</td></tr></tbody></table></div>
    {query.data?.meta?.note && <p className="text-xs text-muted-foreground">{query.data.meta.note}</p>}
  </div>;
}
