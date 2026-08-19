"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import orderService from "@/services/order-management/order.service";

const statuses = ["all", "pending", "confirmed", "preparing", "ready", "served", "rejected", "delayed"];

export function PreparationOrderReportPage({ kind }: { kind: "kitchen" | "bar" }) {
  const [status, setStatus] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const query = useQuery({
    queryKey: [kind, "order-report", status, dateFrom, dateTo],
    queryFn: () => orderService.prepTickets(kind, { status, date_from: dateFrom, date_to: dateTo, report: 1, per_page: 200 }),
  });
  const rows = query.data?.data ?? [];
  const label = kind === "kitchen" ? "Kitchen" : "Bar";

  return <div className="space-y-6">
    <header><h1 className="flex items-center gap-2 text-2xl font-bold"><BarChart3 className="h-6 w-6" />{label} Order Report</h1><p className="mt-1 text-sm text-muted-foreground">View {label.toLowerCase()} orders across every status and filter them by status and date range.</p></header>
    <Card><CardHeader><CardTitle>Report Filters</CardTitle><CardDescription>Dates are based on the time the preparation ticket was created.</CardDescription></CardHeader><CardContent><div className="grid gap-4 md:grid-cols-4"><div className="space-y-2"><Label>Status</Label><Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{statuses.map((value) => <SelectItem key={value} value={value}>{value.replaceAll("_", " ")}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>From date</Label><Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></div><div className="space-y-2"><Label>To date</Label><Input type="date" min={dateFrom || undefined} value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></div><div className="flex items-end"><Button variant="outline" className="w-full" onClick={() => query.refetch()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button></div></div></CardContent></Card>
    <Card><CardHeader><CardTitle>{label} orders</CardTitle><CardDescription>{query.data?.meta.total ?? rows.length} matching ticket(s).</CardDescription></CardHeader><CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Ticket</TableHead><TableHead>Order</TableHead><TableHead>Item</TableHead><TableHead>Quantity</TableHead><TableHead>Waiter / Table</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead></TableRow></TableHeader><TableBody>{query.isLoading ? <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">Loading report...</TableCell></TableRow> : rows.length ? rows.map((ticket) => <TableRow key={String(ticket.id)}><TableCell className="font-medium">{ticket.ticket_number ?? `#${ticket.id}`}</TableCell><TableCell>{ticket.order_number ?? ticket.order?.order_number ?? "—"}</TableCell><TableCell>{ticket.item_name ?? ticket.order_item?.menu_item?.name ?? "—"}</TableCell><TableCell>{ticket.quantity ?? ticket.order_item?.quantity ?? 0}</TableCell><TableCell>{ticket.waiter_name ?? ticket.order?.waiter?.name ?? "—"}<span className="block text-xs text-muted-foreground">{ticket.table_number ?? ticket.order?.table?.table_number ?? "No table"}</span></TableCell><TableCell><Badge variant="secondary" className="capitalize">{String(ticket.status ?? ticket.ticket_status ?? "pending").replaceAll("_", " ")}</Badge></TableCell><TableCell>{ticket.created_at ? new Date(ticket.created_at).toLocaleString() : "—"}</TableCell></TableRow>) : <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">No orders match the selected filters.</TableCell></TableRow>}</TableBody></Table></div></CardContent></Card>
  </div>;
}
