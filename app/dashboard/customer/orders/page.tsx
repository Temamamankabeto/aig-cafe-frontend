"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { orderService } from "@/services/order-management/order.service";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function money(value: unknown) {
  return Number(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function CustomerOrdersPage() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [paymentType, setPaymentType] = useState("all");

  const query = useQuery({
    queryKey: ["customer-my-orders", dateFrom, dateTo, paymentType],
    queryFn: () => orderService.myAuthorizedCreditOrders({
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      payment_type: paymentType === "all" ? undefined : paymentType,
      per_page: 100,
    }),
  });

  const orders = query.data?.data ?? [];
  const summary = (query.data?.meta as any)?.summary ?? {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Orders</h1>
        <p className="text-muted-foreground">Track cash and credit orders, their status, and your total order cost for any date range.</p>
      </div>

      <Card>
        <CardContent className="grid gap-4 pt-6 md:grid-cols-3">
          <div className="space-y-2"><Label>From</Label><Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></div>
          <div className="space-y-2"><Label>To</Label><Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></div>
          <div className="space-y-2"><Label>Payment type</Label><Select value={paymentType} onValueChange={setPaymentType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="cash">Cash</SelectItem><SelectItem value="credit">Credit</SelectItem></SelectContent></Select></div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Orders</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{summary.orders_count ?? 0}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total cost</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{money(summary.total_cost)} ETB</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Cash total</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{money(summary.cash_total)} ETB</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Credit total</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{money(summary.credit_total)} ETB</CardContent></Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Order No.</TableHead><TableHead>Date</TableHead><TableHead>Payment</TableHead><TableHead>Status</TableHead><TableHead>Credit status</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
              <TableBody>
                {orders.map((order: any) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.order_number ?? `#${order.id}`}</TableCell>
                    <TableCell>{String(order.ordered_at ?? order.created_at ?? "").replace("T", " ").slice(0, 16) || "—"}</TableCell>
                    <TableCell className="capitalize">{order.payment_type === "credit" ? "Credit" : "Cash"}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{String(order.status ?? "pending").replaceAll("_", " ")}</Badge></TableCell>
                    <TableCell>{order.payment_type === "credit" ? <Badge variant="outline" className="capitalize">{String(order.credit_status ?? "credit pending").replaceAll("_", " ")}</Badge> : "—"}</TableCell>
                    <TableCell className="text-right font-semibold">{money(order.total)} ETB</TableCell>
                  </TableRow>
                ))}
                {!query.isLoading && !orders.length && <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No orders found for the selected filters.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
