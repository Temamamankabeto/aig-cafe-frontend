"use client";

import { useEffect, useMemo, useState } from "react";
import { CreditCard, ExternalLink, RefreshCcw, Search, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useApproveFinancePaymentsMutation, useApprovePaymentMutation, useFailPaymentMutation, useFinancePaymentsQuery, usePaymentsQuery, useReturnPaymentMutation } from "@/hooks/payment-management/use-payments";
import type { Payment, PaymentFilters, PaymentMethod, PaymentStatus } from "@/types/payment-management/payment.type";

type Props = {
  scope?: "cashier" | "admin";
};

function money(value: unknown) {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number.isFinite(n) ? n : 0);
}

function statusVariant(status?: string) {
  if (status === "paid") return "default";
  if (status === "submitted") return "secondary";
  if (status === "failed" || status === "returned") return "destructive";
  return "outline";
}

export function PaymentManagementPage({ scope = "admin" }: Props) {
  if (scope === "admin") return <FinanceCashierPayments />;

  return <CashierPayments />;
}

function CashierPayments() {
  const scope = "cashier" as const;
  const [filters, setFilters] = useState<PaymentFilters>({ per_page: 20, status: "all", method: "all" });
  const { data, isLoading, isFetching, refetch } = usePaymentsQuery(filters, scope);
  const approve = useApprovePaymentMutation();
  const returnPayment = useReturnPaymentMutation();
  const fail = useFailPaymentMutation();

  const payments = data?.data ?? [];
  const totals = useMemo(() => {
    return payments.reduce(
      (acc, p) => {
        acc.count += 1;
        acc.amount += Number(p.amount ?? 0);
        if (p.status === "paid") acc.paid += Number(p.amount ?? 0);
        if (p.status === "submitted") acc.submitted += Number(p.amount ?? 0);
        return acc;
      },
      { count: 0, amount: 0, paid: 0, submitted: 0 },
    );
  }, [payments]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payment Management</h1>
          <p className="text-muted-foreground">Track bill payments, cashier receipts, approvals, and settlement status.</p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCcw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardDescription>Total Records</CardDescription><CardTitle>{totals.count}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Total Amount</CardDescription><CardTitle>{money(totals.amount)}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Paid Amount</CardDescription><CardTitle>{money(totals.paid)}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Submitted</CardDescription><CardTitle>{money(totals.submitted)}</CardTitle></CardHeader></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" /> Payments</CardTitle>
          <CardDescription>Cash payments require an open cashier shift. Non-cash payments can use references.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_180px_180px]">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search order, customer, reference..." value={filters.search ?? ""} onChange={(e) => setFilters((v) => ({ ...v, search: e.target.value }))} />
            </div>
            <Select value={filters.method ?? "all"} onValueChange={(method) => setFilters((v) => ({ ...v, method: method as PaymentMethod | "all" }))}>
              <SelectTrigger><SelectValue placeholder="Method" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All methods</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="mobile">Mobile</SelectItem>
                <SelectItem value="transfer">Transfer</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.status ?? "all"} onValueChange={(status) => setFilters((v) => ({ ...v, status: status as PaymentStatus | "all" }))}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="returned">Returned</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payment</TableHead>
                  <TableHead>Bill / Order</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Received By</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Loading payments...</TableCell></TableRow>
                ) : payments.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No payments found.</TableCell></TableRow>
                ) : payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">#{payment.id}<div className="text-xs text-muted-foreground">{payment.reference || "No reference"}</div></TableCell>
                    <TableCell>
                      <div>{payment.bill?.bill_number ?? `Bill #${payment.bill_id}`}</div>
                      <div className="text-xs text-muted-foreground">{payment.bill?.order?.order_number ?? ""} {payment.bill?.order?.customer_name ? `• ${payment.bill.order.customer_name}` : ""}</div>
                    </TableCell>
                    <TableCell className="capitalize">{payment.method}</TableCell>
                    <TableCell>{money(payment.amount)}</TableCell>
                    <TableCell><Badge variant={statusVariant(payment.status) as any}>{payment.status}</Badge></TableCell>
                    <TableCell>{payment.receiver?.name ?? "-"}</TableCell>
                    <TableCell className="space-x-2 text-right">
                      {scope !== "cashier" && payment.status === "submitted" ? (
                        <>
                          <Button size="sm" onClick={() => approve.mutate(payment.id)} disabled={approve.isPending}>Approve</Button>
                          <Button size="sm" variant="outline" onClick={() => returnPayment.mutate(payment.id)} disabled={returnPayment.isPending}>Return</Button>
                          <Button size="sm" variant="destructive" onClick={() => fail.mutate(payment.id)} disabled={fail.isPending}>Fail</Button>
                        </>
                      ) : <span className="text-xs text-muted-foreground">No action</span>}
                    </TableCell>
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

function FinanceCashierPayments() {
  const [filters, setFilters] = useState<PaymentFilters>({ per_page: 100, finance_status: "all", method: "all", date_from: "", date_to: "" });
  const [selectedIds, setSelectedIds] = useState<Array<number | string>>([]);
  const [selectAllFiltered, setSelectAllFiltered] = useState(false);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const query = useFinancePaymentsQuery(filters);
  const approvePayments = useApproveFinancePaymentsMutation(() => {
    setApprovalOpen(false);
    setSelectedIds([]);
    setSelectAllFiltered(false);
    setReceipt(null);
    setNote("");
  });
  const payments = query.data?.data ?? [];
  const summary = query.data?.meta?.summary;

  const orderFor = (payment: Payment) => payment.order ?? payment.bill?.order;
  const pendingPayments = payments.filter((payment) => payment.finance_status === "pending");
  const pendingIds = pendingPayments.map((payment) => payment.id);
  const allVisiblePendingSelected = pendingIds.length > 0 && pendingIds.every((id) => selectedIds.includes(id));
  const selectionCount = selectAllFiltered ? Number(summary?.pending_count ?? pendingIds.length) : selectedIds.length;
  const selectedTotal = selectAllFiltered
    ? Number(summary?.pending_amount ?? 0)
    : payments
        .filter((payment) => selectedIds.includes(payment.id))
        .reduce((total, payment) => total + Number(payment.amount ?? 0), 0);

  useEffect(() => {
    setSelectedIds([]);
    setSelectAllFiltered(false);
  }, [filters.search, filters.method, filters.finance_status, filters.date_from, filters.date_to]);

  function togglePayment(id: number | string, checked: boolean) {
    setSelectAllFiltered(false);
    setSelectedIds((current) => checked ? Array.from(new Set([...current, id])) : current.filter((value) => value !== id));
  }

  function toggleVisible(checked: boolean) {
    setSelectAllFiltered(false);
    setSelectedIds((current) => checked ? Array.from(new Set([...current, ...pendingIds])) : current.filter((id) => !pendingIds.includes(id)));
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-3 lg:grid-cols-[1fr_150px_160px_160px_160px]">
            <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Order, bill, customer, reference..." value={filters.search ?? ""} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} /></div>
            <Input aria-label="Date from" type="date" value={filters.date_from ?? ""} onChange={(event) => setFilters((current) => ({ ...current, date_from: event.target.value }))} />
            <Input aria-label="Date to" type="date" min={filters.date_from || undefined} value={filters.date_to ?? ""} onChange={(event) => setFilters((current) => ({ ...current, date_to: event.target.value }))} />
            <Select value={filters.method ?? "all"} onValueChange={(method) => setFilters((current) => ({ ...current, method: method as PaymentMethod | "all" }))}><SelectTrigger><SelectValue placeholder="Method" /></SelectTrigger><SelectContent><SelectItem value="all">All methods</SelectItem><SelectItem value="cash">Cash</SelectItem><SelectItem value="card">Card</SelectItem><SelectItem value="mobile">Mobile</SelectItem><SelectItem value="transfer">Transfer</SelectItem></SelectContent></Select>
            <Select value={filters.finance_status ?? "all"} onValueChange={(finance_status) => setFilters((current) => ({ ...current, finance_status: finance_status as "pending" | "approved" | "all" }))}><SelectTrigger><SelectValue placeholder="Payment status" /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="approved">Approved</SelectItem></SelectContent></Select>
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}><RefreshCcw className="mr-2 h-4 w-4" /> Refresh</Button>
          </div>

          <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <label className="flex items-center gap-2"><Checkbox checked={allVisiblePendingSelected} onCheckedChange={(checked) => toggleVisible(checked === true)} disabled={pendingIds.length === 0} /> Select visible pending</label>
              <label className="flex items-center gap-2"><Checkbox checked={selectAllFiltered} onCheckedChange={(checked) => { setSelectAllFiltered(checked === true); setSelectedIds([]); }} disabled={Number(summary?.pending_count ?? 0) === 0} /> Select all filtered pending payments</label>
              <span className="text-muted-foreground">{selectionCount} selected</span>
            </div>
            <Button disabled={selectionCount === 0} onClick={() => setApprovalOpen(true)}><Upload className="mr-2 h-4 w-4" /> Receive and approve selected</Button>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader><TableRow><TableHead className="w-12">Select</TableHead><TableHead>Payment</TableHead><TableHead>Order / Customer</TableHead><TableHead>Cashier</TableHead><TableHead>Method</TableHead><TableHead>Amount</TableHead><TableHead>Payment date</TableHead><TableHead>Payment status</TableHead><TableHead className="text-right">Receipt</TableHead></TableRow></TableHeader>
              <TableBody>
                {query.isLoading ? <TableRow><TableCell colSpan={9} className="py-8 text-center text-muted-foreground">Loading cashier payments...</TableCell></TableRow> : payments.length === 0 ? <TableRow><TableCell colSpan={9} className="py-8 text-center text-muted-foreground">No cashier payments match the selected filters.</TableCell></TableRow> : payments.map((payment) => {
                  const order = orderFor(payment);
                  return <TableRow key={payment.id}>
                    <TableCell><Checkbox aria-label={`Select PAY-${payment.id}`} checked={(selectAllFiltered && payment.finance_status === "pending") || selectedIds.includes(payment.id)} disabled={payment.finance_status !== "pending" || selectAllFiltered} onCheckedChange={(checked) => togglePayment(payment.id, checked === true)} /></TableCell>
                    <TableCell className="font-medium">PAY-{payment.id}<div className="text-xs text-muted-foreground">{payment.bill?.bill_number ?? "Direct order payment"}</div></TableCell>
                    <TableCell><div>{order?.order_number ?? "-"}</div><div className="text-xs text-muted-foreground">{order?.customer_name ?? "Walk-in customer"}</div></TableCell>
                    <TableCell>{payment.receiver?.name ?? "-"}</TableCell>
                    <TableCell className="capitalize">{payment.method}</TableCell>
                    <TableCell>{money(payment.amount)}</TableCell>
                    <TableCell>{payment.paid_at ? new Date(payment.paid_at).toLocaleString() : "-"}</TableCell>
                    <TableCell><Badge variant={["approved", "received"].includes(payment.finance_status ?? "") ? "default" : "secondary"}>{["approved", "received"].includes(payment.finance_status ?? "") ? "Approved" : "Pending"}</Badge></TableCell>
                    <TableCell className="text-right">{payment.finance_receipt_url ? <Button size="sm" variant="outline" asChild><a href={payment.finance_receipt_url} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" /> Receipt</a></Button> : <span className="text-xs text-muted-foreground">Not uploaded</span>}</TableCell>
                  </TableRow>;
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={approvalOpen} onOpenChange={setApprovalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Receive and approve cashier payments</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-3 rounded-lg border bg-muted/30 p-4 text-sm">
              <div className="flex justify-between gap-4"><span>Selection</span><strong className="text-right">{selectAllFiltered ? "All filtered pending payments" : `${selectedIds.length} selected payment(s)`}</strong></div>
              <div className="flex justify-between gap-4 border-t pt-3"><span>Total selected amount</span><strong>{money(selectedTotal)} ETB</strong></div>
            </div>
            <div className="space-y-2"><Label htmlFor="finance-receipt">Bank receipt <span className="text-destructive">*</span></Label><Input id="finance-receipt" type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={(event) => setReceipt(event.target.files?.[0] ?? null)} /><p className="text-xs text-muted-foreground">JPG, PNG, or PDF; maximum 5 MB.</p></div>
            <div className="space-y-2"><Label htmlFor="finance-note">Note</Label><Textarea id="finance-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional bank deposit or reconciliation note" maxLength={1000} /></div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setApprovalOpen(false)}>Cancel</Button><Button disabled={!receipt || approvePayments.isPending} onClick={() => receipt && approvePayments.mutate({ selection_mode: selectAllFiltered ? "filtered" : "selected", payment_ids: selectAllFiltered ? undefined : selectedIds, filters, receipt, note })}>{approvePayments.isPending ? "Approving..." : "Receive and approve"}</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
