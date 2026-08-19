"use client";

import { useMemo, useState } from "react";
import { ReceiptText, RefreshCcw, Search, WalletCards } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import api, { unwrap } from "@/lib/api";
import { PaymentManagementPage } from "@/components/payment-management/payment-management-page";
import { RefundManagementPage } from "@/components/refund-management/refund-management-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Scope = "cashier" | "admin";

type Bill = {
  id: number | string;
  bill_number?: string | null;
  total?: number | string;
  paid_amount?: number | string;
  balance?: number | string;
  status?: string;
  created_at?: string;
  order?: {
    order_number?: string | null;
    customer_name?: string | null;
  } | null;
};

type Receipt = {
  id: number | string;
  receipt_number?: string | null;
  amount?: number | string;
  total?: number | string;
  payment_method?: string | null;
  method?: string | null;
  status?: string | null;
  created_at?: string;
  bill?: Bill | null;
  order?: {
    order_number?: string | null;
    customer_name?: string | null;
  } | null;
};

type ListEnvelope<T> = {
  data?: T[];
  meta?: Record<string, unknown>;
};

function money(value: unknown) {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number.isFinite(n) ? n : 0);
}

function listBase(scope: Scope, resource: "bills" | "receipts") {
  if (scope === "cashier") {
    return resource === "bills" ? "/cashier/bills" : "/cashier/payments";
  }

  return resource === "bills" ? "/finance/bills" : "/admin/payments";
}

async function fetchList<T>(scope: Scope, resource: "bills" | "receipts", search: string, status?: string) {
  const res = await api.get(listBase(scope, resource), {
    params: {
      search: search || undefined,
      status: resource === "receipts" ? "paid" : status,
      per_page: 100,
    },
  });

  const payload = unwrap<ListEnvelope<T> | T[]>(res);
  return Array.isArray(payload) ? payload : payload?.data ?? [];
}

function statusVariant(status?: string | null) {
  if (["paid", "issued", "completed"].includes(status ?? "")) return "default";
  if (["partial", "draft", "pending"].includes(status ?? "")) return "secondary";
  if (["void", "cancelled", "failed", "refunded"].includes(status ?? "")) return "destructive";
  return "outline";
}

function BillsTab({ scope, statusFilter }: { scope: Scope; statusFilter?: string }) {
  const [search, setSearch] = useState("");
  const { data = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ["finance-management", scope, "bills", search, statusFilter],
    queryFn: () => fetchList<Bill>(scope, "bills", search, statusFilter),
  });

  const totals = useMemo(() => data.reduce(
    (acc, bill) => {
      acc.count += 1;
      acc.total += Number(bill.total ?? 0);
      acc.paid += Number(bill.paid_amount ?? 0);
      acc.balance += Number(bill.balance ?? 0);
      return acc;
    },
    { count: 0, total: 0, paid: 0, balance: 0 },
  ), [data]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardDescription>Bills</CardDescription><CardTitle>{totals.count}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Total</CardDescription><CardTitle>{money(totals.total)}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Paid</CardDescription><CardTitle>{money(totals.paid)}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Balance</CardDescription><CardTitle>{money(totals.balance)}</CardTitle></CardHeader></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><WalletCards className="h-5 w-5" /> Bills</CardTitle>
          <CardDescription>{statusFilter === "paid" ? "Paid bills stored after successful payment records." : "Issued, partial, paid, void, and refunded bills."}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search bill, order, customer..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching}><RefreshCcw className="mr-2 h-4 w-4" /> Refresh</Button>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bill</TableHead>
                  <TableHead>Order / Customer</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Loading bills...</TableCell></TableRow>
                ) : data.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No bills found.</TableCell></TableRow>
                ) : data.map((bill) => (
                  <TableRow key={bill.id}>
                    <TableCell className="font-medium">{bill.bill_number ?? `Bill #${bill.id}`}</TableCell>
                    <TableCell>
                      <div>{bill.order?.order_number ?? "-"}</div>
                      <div className="text-xs text-muted-foreground">{bill.order?.customer_name ?? "Walk-in customer"}</div>
                    </TableCell>
                    <TableCell>{money(bill.total)}</TableCell>
                    <TableCell>{money(bill.paid_amount)}</TableCell>
                    <TableCell>{money(bill.balance)}</TableCell>
                    <TableCell><Badge variant={statusVariant(bill.status) as any}>{bill.status ?? "-"}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ReceiptsTab({ scope }: { scope: Scope }) {
  const [search, setSearch] = useState("");
  const { data = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ["finance-management", scope, "receipts", search],
    queryFn: () => fetchList<Receipt>(scope, "receipts", search),
  });

  const totalAmount = useMemo(() => data.reduce((sum, row) => sum + Number(row.amount ?? row.total ?? 0), 0), [data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ReceiptText className="h-5 w-5" /> Receipts</CardTitle>
        <CardDescription>Paid payments are displayed as receipts for completed customer bills.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Card><CardHeader className="pb-2"><CardDescription>Receipts</CardDescription><CardTitle>{data.length}</CardTitle></CardHeader></Card>
          <Card><CardHeader className="pb-2"><CardDescription>Total Receipt Amount</CardDescription><CardTitle>{money(totalAmount)}</CardTitle></CardHeader></Card>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search receipt, order, customer..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}><RefreshCcw className="mr-2 h-4 w-4" /> Refresh</Button>
        </div>

        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Receipt</TableHead>
                <TableHead>Bill / Order</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Loading receipts...</TableCell></TableRow>
              ) : data.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No receipts found.</TableCell></TableRow>
              ) : data.map((receipt) => (
                <TableRow key={receipt.id}>
                  <TableCell className="font-medium">{receipt.receipt_number ?? `PAY-${receipt.id}`}</TableCell>
                  <TableCell>
                    <div>{receipt.bill?.bill_number ?? receipt.order?.order_number ?? "-"}</div>
                    <div className="text-xs text-muted-foreground">{receipt.bill?.order?.customer_name ?? receipt.order?.customer_name ?? "Walk-in customer"}</div>
                  </TableCell>
                  <TableCell className="capitalize">{receipt.payment_method ?? receipt.method ?? "-"}</TableCell>
                  <TableCell>{money(receipt.amount ?? receipt.total)}</TableCell>
                  <TableCell><Badge variant={statusVariant(receipt.status) as any}>{receipt.status ?? "generated"}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export function FinanceManagementPage({ scope = "admin", initialTab = "payments", billStatus }: { scope?: Scope; initialTab?: "payments" | "bills" | "receipts"; billStatus?: string }) {
  if (scope === "admin" && initialTab === "payments") {
    return <PaymentManagementPage scope="admin" />;
  }

  if (scope === "admin" && initialTab === "bills") {
    return <div className="space-y-4"><h1 className="text-2xl font-bold">Bills & Refunds</h1><Tabs defaultValue="bills"><TabsList><TabsTrigger value="bills">Bills</TabsTrigger><TabsTrigger value="refunds">Refunds</TabsTrigger></TabsList><TabsContent value="bills"><BillsTab scope="admin" statusFilter={billStatus}/></TabsContent><TabsContent value="refunds"><RefundManagementPage/></TabsContent></Tabs></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Finance Management</h1>
        <p className="text-muted-foreground">Manage payments, bills, and receipts from one page.</p>
      </div>

      <Tabs defaultValue={initialTab} className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-3 md:w-fit">
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="bills">Bills</TabsTrigger>
          <TabsTrigger value="receipts">Receipts</TabsTrigger>
        </TabsList>

        <TabsContent value="payments" className="space-y-4">
          <PaymentManagementPage scope={scope} />
        </TabsContent>

        <TabsContent value="bills" className="space-y-4">
          <BillsTab scope={scope} statusFilter={billStatus} />
        </TabsContent>

        <TabsContent value="receipts" className="space-y-4">
          <ReceiptsTab scope={scope} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
