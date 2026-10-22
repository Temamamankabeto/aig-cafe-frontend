"use client";

import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Printer, ChevronDown, ChevronRight } from "lucide-react";
import { orderService } from "@/services/order-management/order.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CreditOrder } from "@/types/order-management/order.type";

type FinanceOrder = CreditOrder & { credit_account_id?: string | number; meal_category?: string; meal_type_name?: string; number_of_person?: number | null; order?: CreditOrder["order"] & { ordered_at?: string; number_of_person?: string | number; credit_order_mode?: string; meal_type?: string } };
type Line = { date: string; category: string; mealType: string; price: number; persons: number; total: number; item: string };
const money = (n: unknown) => Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const idOf = (v: unknown) => String(v ?? "");
const remaining = (r: FinanceOrder) => Math.max(0, Number(r.remaining_amount ?? (Number(r.total_amount ?? 0) - Number(r.paid_amount ?? 0))));
const paid = (r: FinanceOrder) => Number(r.paid_amount ?? 0);
const orderNo = (r: FinanceOrder) => r.order?.order_number ?? r.credit_reference ?? `Credit #${r.id}`;
const dateOf = (r: FinanceOrder) => String(r.order?.ordered_at ?? r.created_at ?? "").slice(0, 10);
const isFixed = (r: FinanceOrder) => r.order?.credit_order_mode === "fixed_meal" || (!!r.number_of_person && r.meal_category !== "Order-Based (À La Carte)");
const categoryOf = (r: FinanceOrder) => isFixed(r) ? (r.meal_category || "Uncategorized") : "Order-Based (À La Carte)";
const typeOf = (r: FinanceOrder) => isFixed(r) ? (r.meal_type_name || r.order?.meal_type || "Fixed-price meal") : "Order-Based (À La Carte)";
const personOf = (r: FinanceOrder) => r.credit_account_user?.full_name ?? r.authorized_user?.full_name ?? r.used_by_name ?? "Unassigned";
function linesOf(r: FinanceOrder): Line[] {
  const date = dateOf(r);
  if (isFixed(r)) {
    const persons = Math.max(1, Number(r.number_of_person ?? r.order?.number_of_person ?? 1));
    const total = Number(r.total_amount ?? 0);
    return [{ date, category: categoryOf(r), mealType: typeOf(r), price: total / persons, persons, total, item: typeOf(r) }];
  }
  const items = r.order?.items ?? [];
  if (!items.length) return [{ date, category: categoryOf(r), mealType: typeOf(r), price: Number(r.total_amount ?? 0), persons: 1, total: Number(r.total_amount ?? 0), item: "Order items unavailable" }];
  return items.map(item => {
    const i = item as typeof item & { line_total?: number | string; unit_price?: number | string; menu_item?: { name?: string }; name?: string };
    const qty = Number(i.quantity ?? 1);
    const price = Number(i.unit_price ?? 0);
    return { date, category: categoryOf(r), mealType: typeOf(r), price, persons: qty, total: Number(i.line_total ?? price * qty), item: i.menu_item?.name ?? i.name ?? "Menu item" };
  });
}
async function allPages<T>(fetch: (page: number) => Promise<{ data: T[]; meta?: { last_page?: number } }>): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= 100; page++) { const res = await fetch(page); out.push(...(res.data ?? [])); if (!res.data?.length || page >= Number(res.meta?.last_page ?? 1)) break; }
  return out;
}
export function FinanceCreditPaymentRequest({ mode = "finance" }: { mode?: "finance" | "manager" }) {
  const [account, setAccount] = useState("all");
  const [person, setPerson] = useState("all");
  const [status, setStatus] = useState("outstanding");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [printing, setPrinting] = useState(false);
  const accounts = useQuery({ queryKey: ["finance-credit-request-accounts"], queryFn: () => allPages(page => orderService.creditAccounts({ per_page: 100, page })) });
  const agreements = useQuery({ queryKey: ["finance-credit-request-agreements", account], queryFn: () => orderService.creditAgreements(account), enabled: account !== "all" });
  const orders = useQuery({ queryKey: ["finance-credit-request-orders", mode], queryFn: () => allPages<FinanceOrder>(page => mode === "manager" ? orderService.managerPosCreditOrders({ per_page: 100, page }) : orderService.financePosCreditOrders({ per_page: 100, page })) });
  const accountRows = accounts.data ?? [];
  const accountName = (r: FinanceOrder) => r.credit_account?.name ?? r.account?.name ?? accountRows.find(a => idOf(a.id) === idOf(r.credit_account_id))?.name ?? "Unassigned";
  const persons = useMemo(() => Array.from(new Map([
    ...(agreements.data?.data ?? []).flatMap(a => a.authorized_users ?? a.authorizedUsers ?? []),
    ...accountRows.filter(a => account === "all" || idOf(a.id) === account).flatMap(a => a.authorized_users ?? a.authorizedUsers ?? [])
  ].map(p => [idOf(p.id), p])).values()), [agreements.data, accountRows, account]);
  const rows = useMemo(() => (orders.data ?? []).filter(r =>
    (account === "all" || idOf(r.credit_account_id ?? r.credit_account?.id ?? r.account?.id) === account) &&
    (person === "all" || idOf(r.credit_account_user_id ?? r.credit_account_user?.id ?? r.authorized_user?.id) === person) &&
    (!from || dateOf(r) >= from) && (!to || dateOf(r) <= to) &&
    (status === "all" || (status === "outstanding" ? remaining(r) > 0 : remaining(r) <= 0))
  ), [orders.data, account, person, from, to, status]);
  const chosen = rows.filter(r => selected.includes(idOf(r.id)));
  const printable = chosen.length ? chosen : rows;
  const sum = (data: FinanceOrder[]) => ({ total: data.reduce((s,r) => s + Number(r.total_amount ?? 0),0), paid: data.reduce((s,r) => s + paid(r),0), outstanding: data.reduce((s,r) => s + remaining(r),0) });
  const groups = useMemo(() => {
    const grouped = new Map<string, Map<string, Map<string, FinanceOrder[]>>>();
    for (const r of rows) {
      const a = accountName(r), c = categoryOf(r), t = c === "Order-Based (À La Carte)" ? personOf(r) : typeOf(r);
      if (!grouped.has(a)) grouped.set(a, new Map());
      const categories = grouped.get(a)!;
      if (!categories.has(c)) categories.set(c, new Map());
      const types = categories.get(c)!;
      if (!types.has(t)) types.set(t, []);
      types.get(t)!.push(r);
    }
    return grouped;
  }, [rows, accountRows]);
  const toggleExpanded = (key: string) => setExpanded(v => v.includes(key) ? v.filter(x => x !== key) : [...v, key]);
  const toggleSelected = (key: string) => setSelected(v => v.includes(key) ? v.filter(x => x !== key) : [...v, key]);
  const groupButton = (key: string, label: string, data: FinanceOrder[], level: number) => <button type="button" className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-3 text-left hover:bg-muted/50" style={{ paddingLeft: `${12 + level * 22}px` }} onClick={() => toggleExpanded(key)}><span className="flex items-center gap-2 font-medium">{expanded.includes(key) ? <ChevronDown size={16}/> : <ChevronRight size={16}/>} {label} <span className="text-xs font-normal text-muted-foreground">({data.length} orders)</span></span><span className="whitespace-nowrap text-sm">Outstanding: {money(sum(data).outstanding)} ETB</span></button>;
  return <div className="space-y-5">
    <div><h2 className="text-xl font-semibold">Credit Payment Requests</h2><p className="text-sm text-muted-foreground">Select outstanding credit orders and print a payment request. Printing does not settle balances.</p></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div><label className="text-sm font-medium">Credit account</label><Select value={account} onValueChange={v => {setAccount(v);setPerson("all");setSelected([]);}}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All accounts</SelectItem>{accountRows.map(a => <SelectItem key={a.id} value={idOf(a.id)}>{a.name}</SelectItem>)}</SelectContent></Select></div>
      <div><label className="text-sm font-medium">Authorized person</label><Select value={person} onValueChange={v => {setPerson(v);setSelected([]);}}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All persons</SelectItem>{persons.map(p => <SelectItem key={p.id} value={idOf(p.id)}>{p.full_name}</SelectItem>)}</SelectContent></Select></div>
      <div><label className="text-sm font-medium">Payment status</label><Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="outstanding">Unpaid / Partially Paid</SelectItem><SelectItem value="paid">Fully paid</SelectItem><SelectItem value="all">All statuses</SelectItem></SelectContent></Select></div>
      <div><label className="text-sm font-medium">From</label><Input type="date" value={from} onChange={e => setFrom(e.target.value)}/></div>
      <div><label className="text-sm font-medium">To</label><Input type="date" min={from || undefined} value={to} onChange={e => setTo(e.target.value)}/></div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-2 text-sm"><Checkbox checked={rows.length > 0 && rows.every(r => selected.includes(idOf(r.id)))} onCheckedChange={v => setSelected(v === true ? rows.map(r => idOf(r.id)) : [])}/> Select all filtered orders</label><Button disabled={!printable.length} onClick={() => setPrinting(true)}><Printer className="mr-2 h-4 w-4"/>Print Payment Request ({chosen.length || rows.length})</Button></div>
    <div className="space-y-2 rounded-lg border p-2 sm:p-3">
      {[...groups.entries()].map(([a, cats]) => { const aRows = [...cats.values()].flatMap(types => [...types.values()].flat()); const ak = `a:${a}`; return <div key={ak} className="rounded-md border"><div>{groupButton(ak, a, aRows, 0)}</div>{expanded.includes(ak) && [...cats.entries()].map(([c, types]) => {const cRows = [...types.values()].flat();const ck=`${ak}:c:${c}`;return <div key={ck} className="border-t">{groupButton(ck,c,cRows,1)}{expanded.includes(ck) && [...types.entries()].map(([t,tRows]) => {const tk=`${ck}:t:${t}`;return <div key={tk} className="border-t">{groupButton(tk,t,tRows,2)}{expanded.includes(tk) && <div className="overflow-x-auto border-t"><Table><TableHeader><TableRow><TableHead>Select</TableHead><TableHead>Order / Date</TableHead><TableHead>Meal type / Item</TableHead><TableHead className="text-right">Price</TableHead><TableHead className="text-right">Persons / Qty</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Paid</TableHead><TableHead className="text-right">Outstanding</TableHead></TableRow></TableHeader><TableBody>{tRows.map(r => <Fragment key={idOf(r.id)}>{linesOf(r).map((line,i) => <TableRow key={`${r.id}-${i}`}><TableCell>{i === 0 && <Checkbox checked={selected.includes(idOf(r.id))} onCheckedChange={() => toggleSelected(idOf(r.id))}/>}</TableCell><TableCell>{i === 0 && <><span className="font-medium">{orderNo(r)}</span><div className="text-xs text-muted-foreground">{line.date}</div></>}</TableCell><TableCell>{line.item}</TableCell><TableCell className="text-right">{money(line.price)}</TableCell><TableCell className="text-right">{line.persons}</TableCell><TableCell className="text-right">{money(line.total)}</TableCell><TableCell className="text-right">{i === 0 ? money(paid(r)) : ""}</TableCell><TableCell className="text-right">{i === 0 ? money(remaining(r)) : ""}</TableCell></TableRow>)}</Fragment>)}</TableBody></Table></div>}</div>;})}</div>;})}</div>;})}
      {!orders.isLoading && !rows.length && <p className="py-8 text-center text-muted-foreground">No credit orders match the selected filters.</p>}{orders.isLoading && <p className="py-6 text-center">Loading credit orders...</p>}
    </div>
    {(orders.isError || accounts.isError || agreements.isError) && <p role="alert" className="text-sm text-destructive">Unable to load credit data. Verify credit read permissions and the credit APIs.</p>}
    <p className="text-right font-semibold">Filtered outstanding: {money(sum(rows).outstanding)} ETB</p>
    {printing && <div className="fixed inset-0 z-50 overflow-auto bg-black/60 p-3 sm:p-6"><div className="mx-auto max-w-6xl rounded-lg bg-white p-4 text-black sm:p-6"><div className="mb-4 flex justify-end gap-2 print:hidden"><Button variant="outline" onClick={() => setPrinting(false)}>Close</Button><Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4"/>Print</Button></div><div id="finance-credit-print"><h1 className="text-center text-xl font-bold">AIG CAFETERIA</h1><h2 className="text-center font-semibold">CREDIT PAYMENT REQUEST</h2><p className="mt-4 text-sm">Period: {from || "All dates"} to {to || "All dates"}</p><p className="text-sm">Account: {account === "all" ? "All accounts" : accountRows.find(a => idOf(a.id) === account)?.name}</p><div className="mt-4 overflow-x-auto"><table className="w-full border-collapse text-xs"><thead><tr>{["Order","Date","Credit account","Meal category","Meal type / Item","Price (ETB)","Persons / Qty","Total (ETB)","Paid (ETB)","Outstanding (ETB)"].map(h => <th key={h} className="border p-2 text-left">{h}</th>)}</tr></thead><tbody>{printable.flatMap(r => linesOf(r).map((line,i) => <tr key={`${r.id}-${i}`}><td className="border p-2">{orderNo(r)}</td><td className="border p-2">{line.date}</td><td className="border p-2">{accountName(r)}</td><td className="border p-2">{line.category}</td><td className="border p-2">{line.item}</td><td className="border p-2 text-right">{money(line.price)}</td><td className="border p-2 text-right">{line.persons}</td><td className="border p-2 text-right">{money(line.total)}</td><td className="border p-2 text-right">{i === 0 ? money(paid(r)) : ""}</td><td className="border p-2 text-right">{i === 0 ? money(remaining(r)) : ""}</td></tr>))}</tbody></table></div><div className="mt-4 space-y-1 text-right text-sm"><p>Total: {money(sum(printable).total)} ETB</p><p>Paid: {money(sum(printable).paid)} ETB</p><p className="font-bold">TOTAL AMOUNT REQUESTED: {money(sum(printable).outstanding)} ETB</p></div><p className="mt-4 text-xs">Payment request only. Not proof of payment or a receipt.</p></div></div><style>{`@media print { @page { size: landscape; margin: 10mm; } body * { visibility: hidden !important; } #finance-credit-print, #finance-credit-print * { visibility: visible !important; } #finance-credit-print { position: absolute; left: 0; top: 0; width: 100%; color: black; } }`}</style></div>}
  </div>;
}
