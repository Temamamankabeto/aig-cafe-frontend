"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Printer, ChevronDown, ChevronRight } from "lucide-react";
import { orderService } from "@/services/order-management/order.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CreditOrder } from "@/types/order-management/order.type";

const amount = (v: unknown) => Number(v ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const identifier = (v: unknown) => String(v ?? "");
// Credit APIs cap each response at 100 rows. Read all pages instead of silently
// hiding older accounts/orders when the first page is full.
async function allPages<T>(fetchPage: (page: number) => Promise<{ data: T[]; meta?: { last_page?: number } }>): Promise<T[]> {
  const result: T[] = [];
  for (let page = 1; page <= 100; page++) {
    const response = await fetchPage(page);
    result.push(...(response.data ?? []));
    if (page >= Number(response.meta?.last_page ?? 1) || !response.data?.length) break;
  }
  return result;
}

export function FinanceCreditPaymentRequest() {
  const [accountId, setAccountId] = useState("all");
  const [agreementId, setAgreementId] = useState("all");
  const [personId, setPersonId] = useState("all");
  const [status, setStatus] = useState("outstanding");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [printing, setPrinting] = useState(false);

  const accounts = useQuery({ queryKey: ["finance-credit-request-accounts"], queryFn: () => allPages(page => orderService.creditAccounts({ per_page: 100, page })) });
  const agreements = useQuery({ queryKey: ["finance-credit-request-agreements", accountId], enabled: accountId !== "all", queryFn: () => orderService.creditAgreements(accountId) });
  const orders = useQuery({ queryKey: ["finance-credit-request-orders"], queryFn: () => allPages(page => orderService.financePosCreditOrders({ per_page: 100, page })) });
  const accountRows = accounts.data ?? [];
  const agreementRows = agreements.data?.data ?? [];
  const persons = useMemo(() => {
    const all = [...agreementRows.flatMap(a => a.authorized_users ?? a.authorizedUsers ?? []), ...accountRows.filter(a => accountId === "all" || identifier(a.id) === accountId).flatMap(a => a.authorized_users ?? a.authorizedUsers ?? [])];
    return Array.from(new Map(all.map(p => [identifier(p.id), p])).values());
  }, [agreementRows, accountRows, accountId]);
  const rows = useMemo(() => (orders.data ?? []).filter(row => {
    const rowAccount = row.credit_account?.id ?? row.account?.id ?? (row as CreditOrder & {credit_account_id?: string | number}).credit_account_id;
    const rowAgreement = row.credit_agreement_id ?? row.agreement?.id;
    const rowPerson = row.credit_account_user_id ?? row.credit_account_user?.id ?? row.authorized_user?.id ?? (row as CreditOrder & {authorizedUser?: {id?: string | number}}).authorizedUser?.id;
    const date = String(row.created_at ?? "").slice(0, 10);
    return (accountId === "all" || identifier(rowAccount) === accountId)
      && (agreementId === "all" || identifier(rowAgreement) === agreementId)
      && (personId === "all" || identifier(rowPerson) === personId)
      && (!from || date >= from) && (!to || date <= to)
      && (status === "all" || (status === "outstanding" ? Number(row.remaining_amount ?? (Number(row.total_amount ?? 0) - Number(row.paid_amount ?? 0))) > 0 : status === "paid" ? Number(row.remaining_amount ?? (Number(row.total_amount ?? 0) - Number(row.paid_amount ?? 0))) <= 0 : identifier(row.status).toLowerCase() === status));
  }), [orders.data, accountId, agreementId, personId, status, from, to]);
  const ids = rows.map(r => identifier(r.id));
  const selectedRows = rows.filter(r => selected.includes(identifier(r.id)));
  const printable = selectedRows.length ? selectedRows : rows;
  const total = printable.reduce((sum, r) => sum + Number(r.remaining_amount ?? (Number(r.total_amount ?? 0) - Number(r.paid_amount ?? 0))), 0);
  const changeAccount = (id: string) => { setAccountId(id); setAgreementId("all"); setPersonId("all"); setSelected([]); };
  const changeAgreement = (id: string) => { setAgreementId(id); setPersonId("all"); setSelected([]); };
  const toggle = (id: string) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const toggleExpanded = (id: string) => setExpanded(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const accountName = (r: CreditOrder) => r.credit_account?.name ?? r.account?.name ?? accountRows.find(a => identifier(a.id) === identifier((r as CreditOrder & {credit_account_id?: string | number}).credit_account_id))?.name ?? "Unassigned";
  const personName = (r: CreditOrder) => r.credit_account_user?.full_name ?? r.authorized_user?.full_name ?? (r as CreditOrder & {authorizedUser?: {full_name?: string}}).authorizedUser?.full_name ?? r.used_by_name ?? persons.find(p => identifier(p.id) === identifier(r.credit_account_user_id))?.full_name ?? "Unassigned";
  const orderNumber = (r: CreditOrder) => r.order?.order_number ?? r.credit_reference ?? `Credit #${r.id}`;

  return <div className="space-y-5">
    <div><h2 className="text-xl font-semibold">Credit Payment Requests</h2><p className="text-sm text-muted-foreground">Filter outstanding credit orders and print an attachment to request payment. Printing does not settle any balance.</p></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div><label className="text-sm font-medium">Credit account</label><Select value={accountId} onValueChange={changeAccount}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All accounts</SelectItem>{accountRows.map(a => <SelectItem key={a.id} value={identifier(a.id)}>{a.name}</SelectItem>)}</SelectContent></Select></div>
      <div><label className="text-sm font-medium">Agreement</label><Select value={agreementId} onValueChange={changeAgreement} disabled={accountId === "all"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All agreements</SelectItem>{agreementRows.map(a => <SelectItem key={a.id} value={identifier(a.id)}>#{a.id} — {a.meal_type ?? "Agreement"}</SelectItem>)}</SelectContent></Select></div>
      <div><label className="text-sm font-medium">Authorized person</label><Select value={personId} onValueChange={v => {setPersonId(v);setSelected([]);}} disabled={!persons.length}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All persons</SelectItem>{persons.filter(p => agreementId === "all" || agreementRows.some(a => identifier(a.id) === agreementId && (a.authorized_users ?? a.authorizedUsers ?? []).some(x => identifier(x.id) === identifier(p.id)))).map(p => <SelectItem key={p.id} value={identifier(p.id)}>{p.full_name}</SelectItem>)}</SelectContent></Select></div>
      <div><label className="text-sm font-medium">From</label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
      <div><label className="text-sm font-medium">To</label><Input type="date" min={from || undefined} value={to} onChange={e => setTo(e.target.value)} /></div>
      <div><label className="text-sm font-medium">Payment status</label><Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="outstanding">Unpaid / Partially Paid</SelectItem><SelectItem value="paid">Fully paid</SelectItem><SelectItem value="all">All statuses</SelectItem></SelectContent></Select></div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-2 text-sm"><Checkbox checked={ids.length > 0 && ids.every(id => selected.includes(id))} onCheckedChange={v => setSelected(v === true ? ids : [])} /> Select all filtered orders</label><Button disabled={!printable.length || printing} onClick={() => setPrinting(true)}><Printer className="mr-2 h-4 w-4" /> Print Payment Request ({selectedRows.length || rows.length})</Button></div>
    <div className="overflow-x-auto rounded-md border"><Table><TableHeader><TableRow><TableHead>Choose</TableHead><TableHead>Order / Items</TableHead><TableHead>Credit account</TableHead><TableHead>Authorized person</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Paid</TableHead><TableHead className="text-right">Remaining</TableHead></TableRow></TableHeader><TableBody>
      {rows.map(r => { const id = identifier(r.id); const open = expanded.includes(id); return <><TableRow key={id}><TableCell><Checkbox checked={selected.includes(id)} onCheckedChange={() => toggle(id)} /></TableCell><TableCell><button type="button" className="flex items-center gap-1 text-left font-medium" onClick={() => toggleExpanded(id)}>{open ? <ChevronDown size={15}/> : <ChevronRight size={15}/>} {orderNumber(r)}</button></TableCell><TableCell>{accountName(r)}</TableCell><TableCell>{personName(r)}</TableCell><TableCell>{r.status ?? "—"}</TableCell><TableCell className="text-right">{amount(r.total_amount)}</TableCell><TableCell className="text-right">{amount(r.paid_amount)}</TableCell><TableCell className="text-right">{amount(r.remaining_amount)}</TableCell></TableRow>{open && <TableRow key={`${id}-detail`}><TableCell colSpan={8} className="bg-muted/30 text-sm">{(r.order?.items ?? []).length ? (r.order?.items ?? []).map((item: any, index: number) => <div key={index}>{item.menu_item?.name ?? item.name ?? "Item"} — Qty {item.quantity} — {amount(item.total_price ?? item.total ?? item.subtotal)}</div>) : "No item details available"}</TableCell></TableRow>}</>; })}
      {!orders.isLoading && rows.length === 0 && <TableRow><TableCell colSpan={8} className="py-8 text-center">No credit orders match these filters.</TableCell></TableRow>}{orders.isLoading && <TableRow><TableCell colSpan={8}>Loading credit orders...</TableCell></TableRow>}
    </TableBody></Table></div>
    {(orders.isError || accounts.isError || agreements.isError) && <p role="alert" className="text-sm text-destructive">Unable to load credit records: {String((orders.error ?? accounts.error ?? agreements.error) instanceof Error ? (orders.error ?? accounts.error ?? agreements.error)?.message : "Check Finance permissions and the credit APIs")}. Verify credit.orders.read and credit.accounts.read permissions for the Finance role.</p>}
    {!orders.isLoading && !orders.isError && rows.length === 0 && <p className="text-sm text-muted-foreground">{orders.data?.length ? `${orders.data.length} credit ledger record(s) loaded, but none match the current filters. Try All statuses.` : "No POS credit orders were returned. Verify Finance permissions and the credit order API."}</p>}
    <p className="text-right font-semibold">Filtered outstanding: {amount(rows.reduce((s,r) => s + Number(r.remaining_amount ?? (Number(r.total_amount ?? 0) - Number(r.paid_amount ?? 0))),0))} ETB</p>
    {printing && <div className="fixed inset-0 z-50 overflow-auto bg-black/60 p-4"><div className="mx-auto max-w-4xl rounded-lg bg-white p-6 text-black"><div className="mb-4 flex justify-end gap-2 print:hidden"><Button variant="outline" onClick={() => setPrinting(false)}>Close</Button><Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4"/> Print</Button></div><div id="finance-credit-print"><h1 className="text-center text-xl font-bold">AIG CAFETERIA</h1><h2 className="text-center font-semibold">CREDIT PAYMENT REQUEST</h2><p className="mt-4 text-sm">Period: {from || "All dates"} to {to || "All dates"}</p><p className="text-sm">Account: {accountId === "all" ? "All accounts" : accountRows.find(a => identifier(a.id) === accountId)?.name}</p><p className="text-sm">Agreement: {agreementId === "all" ? "All agreements" : `#${agreementId}`}</p><table className="mt-4 w-full border-collapse text-sm"><thead><tr>{["Order","Credit account","Authorized person","Total","Paid","Outstanding"].map(h => <th key={h} className="border p-2 text-left">{h}</th>)}</tr></thead><tbody>{printable.map(r => <tr key={r.id}><td className="border p-2">{orderNumber(r)}</td><td className="border p-2">{accountName(r)}</td><td className="border p-2">{personName(r)}</td><td className="border p-2">{amount(r.total_amount)}</td><td className="border p-2">{amount(r.paid_amount)}</td><td className="border p-2">{amount(r.remaining_amount)}</td></tr>)}</tbody></table><p className="mt-4 text-right font-bold">TOTAL AMOUNT REQUESTED: {amount(total)} ETB</p><p className="mt-4 text-xs">This is a payment request only. It is not proof of payment or a receipt.</p></div></div><style>{`@media print { body * { visibility: hidden !important; } #finance-credit-print, #finance-credit-print * { visibility: visible !important; } #finance-credit-print { position: absolute; left: 0; top: 0; width: 100%; color: black; } }`}</style></div>}
  </div>;
}
