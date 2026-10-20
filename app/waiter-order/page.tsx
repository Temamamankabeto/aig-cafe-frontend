"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Minus, Plus, Search, ShoppingCart, Trash2, UtensilsCrossed } from "lucide-react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { OrderTicketPreviewDialog } from "@/components/order-management/order-ticket-preview-dialog";
import type { MenuCategory, MenuItem } from "@/types/menu-management";

type TableOption = { id: number | string; table_number?: string | number; name?: string };
type CreditPerson = { id: number; name: string };
type CreditAgreement = { id: number; name: string; authorized_persons: CreditPerson[] };
type CreditAccount = { id: number; name: string; agreements: CreditAgreement[] };
type CartLine = { item: MenuItem; quantity: number };
type OrderType = "dine_in" | "takeaway";
const money = (v: number | string) => `${Number(v || 0).toFixed(2)} ETB`;

export default function PublicWaiterOrderPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [tables, setTables] = useState<TableOption[]>([]);
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [orderType, setOrderType] = useState<OrderType>("dine_in");
  const [tableId, setTableId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [notes, setNotes] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [paymentType, setPaymentType] = useState<"cash" | "credit">("cash");
  const [creditAccounts, setCreditAccounts] = useState<CreditAccount[]>([]);
  const [creditLoading, setCreditLoading] = useState(false);
  const [creditVerified, setCreditVerified] = useState(false);
  const [creditPersonId, setCreditPersonId] = useState("");
  const [creditAccountId, setCreditAccountId] = useState("");
  const [creditAgreementId, setCreditAgreementId] = useState("");
  const [checkout, setCheckout] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [completed, setCompleted] = useState<{ order_number: string; total: number; waiter_name: string; waiterId: number; id: number; lines: { name: string; quantity: number; price: number }[]; orderType: OrderType; table: string; tableId: number; placedAt: string; notes: string } | null>(null);
  const [ticketOpen, setTicketOpen] = useState(false);

  useEffect(() => {
    Promise.all([api.get("/public/menu"), api.get("/public/menu/categories"), api.get("/public/tables")])
      .then(([menu, cats, table]) => {
        setItems(Array.isArray(menu.data?.data) ? menu.data.data : []);
        setCategories(Array.isArray(cats.data?.data) ? cats.data.data : []);
        setTables(Array.isArray(table.data?.data) ? table.data.data : []);
      })
      .catch(() => setError("Could not load the menu. Please retry."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => items.filter(item => {
    const term = search.trim().toLowerCase();
    return Boolean(item.is_active) && Boolean(item.is_available) &&
      (category === "all" || String(item.category_id ?? item.menu_category_id) === category) &&
      (!term || item.name.toLowerCase().includes(term) || String(item.description ?? "").toLowerCase().includes(term));
  }), [items, category, search]);
  const total = cart.reduce((n, line) => n + Number(line.item.price) * line.quantity, 0);
  const add = (item: MenuItem) => setCart(old => old.some(x => x.item.id === item.id)
    ? old.map(x => x.item.id === item.id ? { ...x, quantity: x.quantity + 1 } : x)
    : [...old, { item, quantity: 1 }]);
  const change = (id: MenuItem["id"], delta: number) => setCart(old => old.map(x => x.item.id === id ? { ...x, quantity: x.quantity + delta } : x).filter(x => x.quantity > 0));

  async function loadCreditOptions() {
    if (!phone.trim() || !password) return setError("Enter Head Waiter phone and password to verify identity.");
    setCreditLoading(true); setError("");
    try {
      const response = await api.post("/public/waiter-orders/credit-options", { phone: phone.trim(), password });
      setCreditAccounts(Array.isArray(response.data?.data) ? response.data.data : []);
      setCreditVerified(true);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err.response?.data?.message || "Unable to load active credit options.");
      setCreditAccounts([]);
      setCreditVerified(false);
    } finally { setCreditLoading(false); }
  }

  const selectedCreditAccount = creditAccounts.find(a => String(a.id) === creditAccountId);
  const selectedCreditAgreement = selectedCreditAccount?.agreements.find(a => String(a.id) === creditAgreementId);

  async function placeOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!cart.length) return setError("Add at least one item.");
    if (orderType === "dine_in" && !tableId) return setError("Select a table.");
    setSubmitting(true);
    try {
      const response = await api.post("/public/waiter-orders", {
        phone: phone.trim(), password, order_type: orderType, payment_type: paymentType,
        ...(paymentType === "credit" ? { credit_account_id: Number(creditAccountId), credit_agreement_id: Number(creditAgreementId), credit_account_user_id: Number(creditPersonId) } : {}),
        table_id: orderType === "dine_in" ? Number(tableId) : null,
        customer_name: customerName.trim() || "Guest", notes: notes.trim(),
        items: cart.map(line => ({ menu_item_id: line.item.id, quantity: line.quantity })),
      });
      const order = response.data?.data;
      setCompleted({ order_number: order?.order_number || "Created", total: Number(order?.total ?? total), waiter_name: order?.waiter_name || "Waiter", waiterId: Number(order?.waiter_id ?? order?.waiter?.id ?? order?.created_by ?? 0), id: Number(order?.id), lines: cart.map(line => ({ name: line.item.name, quantity: line.quantity, price: Number(line.item.price) })), orderType, tableId: orderType === "dine_in" ? Number(tableId) : 0, table: tables.find(t => String(t.id) === tableId)?.name || (tables.find(t => String(t.id) === tableId)?.table_number != null ? `Table ${tables.find(t => String(t.id) === tableId)?.table_number}` : ""), placedAt: new Date().toLocaleString(), notes: notes.trim() });
      setCart([]); setPhone(""); setPassword(""); setCreditVerified(false); setCreditAccounts([]); setCreditAccountId(""); setCreditAgreementId(""); setCreditPersonId(""); setCustomerName(""); setNotes(""); setTableId(""); setCheckout(false);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err.response?.data?.message || "Order could not be submitted. Please verify your waiter phone and password.");
      setPassword("");
    } finally { setSubmitting(false); }
  }

  const [confirmed, setConfirmed] = useState(false);

  function resetForNextOrder() {
    setTicketOpen(false);
    setCompleted(null); setConfirmed(false); setCart([]); setOrderType("dine_in");
    setCategory("all"); setSearch(""); setTableId(""); setCustomerName("");
    setNotes(""); setPhone(""); setPassword(""); setPaymentType("cash");
    setCreditVerified(false); setCreditAccounts([]); setCreditAccountId("");
    setCreditAgreementId(""); setCreditPersonId(""); setCheckout(false); setError("");
  }

  async function confirmAndPrint() {
    if (!completed || confirmed) return;
    const credentials = window.prompt("Enter registered waiter phone number to confirm:");
    if (!credentials) return;
    const secret = window.prompt("Enter waiter password:");
    if (!secret) return;
    try {
      const result = await api.post(`/public/waiter-orders/${completed.id}/confirm`, { phone: credentials.trim(), password: secret });
      if (result.data?.success !== true) throw new Error(result.data?.message || "Confirmation failed");
      setConfirmed(true);
      setTicketOpen(true);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      window.alert(err.response?.data?.message || err.message || "Order confirmation failed.");
    }
  }

  if (completed) return <>
    <main className="min-h-screen bg-[#f7f4ed] p-6 flex items-center justify-center"><section className="w-full max-w-lg rounded-3xl bg-white p-8 text-center shadow-lg">
      <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-600"/><h1 className="mt-4 text-2xl font-bold">Order submitted</h1>
      <p className="mt-3">Waiter: <strong>{completed.waiter_name}</strong></p><p>Order: <strong>{completed.order_number}</strong></p>
      <p className="mt-2 text-xl font-bold">{money(completed.total)}</p><p className="mt-4 rounded-xl bg-amber-50 p-3 text-amber-900">{confirmed ? "Order Confirmed — Sent to Kitchen/Bar." : "Order submitted. Confirm & Print to send it to Kitchen/Bar without Cashier confirmation."}</p>
      <Button className="mt-6 h-12 w-full" onClick={confirmed ? () => setTicketOpen(true) : confirmAndPrint}>{confirmed ? "View & Print Ticket" : "Confirm & Print Order"}</Button>
      <Button className="mt-3 h-12 w-full" onClick={resetForNextOrder}>New Waiter Order</Button>
    </section></main>
    {confirmed && <OrderTicketPreviewDialog
      open={ticketOpen}
      onOpenChange={(open) => { setTicketOpen(open); if (!open) resetForNextOrder(); }}
      order={{
        id: completed.id,
        order_number: completed.order_number,
        created_at: completed.placedAt,
        order_type: completed.orderType,
        table: { id: completed.tableId, name: completed.table, table_number: completed.table },
        customer_name: "Guest",
        waiter: { id: completed.waiterId, name: completed.waiter_name },
        items: completed.lines.map((line, index) => ({
          id: index + 1,
          name: line.name,
          quantity: line.quantity,
          unit_price: line.price,
          station: "kitchen",
        })),
        total: completed.total,
      }}
    />}
  </>;

  return <main className="min-h-screen bg-[#f7f4ed] text-slate-900">
    <header className="bg-[#071a34] px-5 py-5 text-white"><div className="mx-auto flex max-w-[1500px] items-center justify-between"><div className="flex items-center gap-3"><UtensilsCrossed className="text-amber-400"/><div><h1 className="text-xl font-black">AIG Smart Hotel — Shared Waiter Ordering</h1><p className="text-xs text-slate-300">All waiters • One device • Verify identity at checkout</p></div></div><div className="flex items-center gap-4"><Link href="/waiter-order/my-orders" className="rounded-md bg-amber-400 px-4 py-2 font-semibold text-slate-950">See Your Report</Link><span><ShoppingCart className="mr-1 inline"/> {cart.reduce((n,x)=>n+x.quantity,0)}</span></div></div></header>
    <div className="mx-auto grid max-w-[1500px] gap-5 p-4 lg:grid-cols-[1fr_380px]">
      <section><div className="relative mb-4"><Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400"/><Input className="h-12 bg-white pl-12" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search food or drinks..."/></div>
        <div className="mb-4 flex gap-2 overflow-x-auto"><Button variant={category === "all" ? "default" : "outline"} onClick={()=>setCategory("all")}>All</Button>{categories.map(c=><Button key={String(c.id)} variant={category === String(c.id) ? "default" : "outline"} onClick={()=>setCategory(String(c.id))}>{c.name}</Button>)}</div>
        {loading ? <p>Loading menu...</p> : <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">{filtered.map(item=><button key={String(item.id)} onClick={()=>add(item)} className="overflow-hidden rounded-2xl border bg-white text-left shadow-sm hover:shadow-lg"><div className="flex aspect-[4/3] items-center justify-center bg-amber-50">{item.image_url || item.image_path ? <img src={item.image_url ?? item.image_path ?? ""} alt={item.name} className="h-full w-full object-cover"/> : <UtensilsCrossed className="h-10 w-10 text-amber-500"/>}</div><div className="p-3"><strong>{item.name}</strong><p className="mt-2 font-bold text-amber-700">{money(item.price)}</p><span className="text-sm">+ Add</span></div></button>)}</div>}
      </section>
      <aside className="rounded-3xl border bg-white p-5 shadow-lg"><h2 className="text-2xl font-black">Order Cart</h2><div className="mt-4 flex gap-2"><Button className="flex-1" variant={orderType === "dine_in" ? "default" : "outline"} onClick={()=>setOrderType("dine_in")}>Dine In</Button><Button className="flex-1" variant={orderType === "takeaway" ? "default" : "outline"} onClick={()=>setOrderType("takeaway")}>Takeaway</Button></div>
        {orderType === "dine_in" && <select className="mt-3 h-11 w-full rounded-md border px-3" value={tableId} onChange={e=>setTableId(e.target.value)}><option value="">Select table</option>{tables.map(t=><option key={String(t.id)} value={String(t.id)}>{t.name || `Table ${t.table_number ?? t.id}`}</option>)}</select>}
        <div className="my-4 space-y-3">{cart.length === 0 && <p className="py-6 text-center text-slate-500">Select menu items to begin.</p>}{cart.map(line=><div key={String(line.item.id)} className="rounded-xl bg-slate-50 p-3"><div className="flex justify-between"><strong>{line.item.name}</strong><button aria-label="Remove item" onClick={()=>setCart(c=>c.filter(x=>x.item.id !== line.item.id))}><Trash2 className="h-4 w-4 text-red-600"/></button></div><div className="mt-2 flex items-center justify-between"><div className="flex items-center gap-2"><Button size="icon" variant="outline" onClick={()=>change(line.item.id,-1)}><Minus className="h-4 w-4"/></Button>{line.quantity}<Button size="icon" variant="outline" onClick={()=>change(line.item.id,1)}><Plus className="h-4 w-4"/></Button></div><strong>{money(Number(line.item.price)*line.quantity)}</strong></div></div>)}</div>
        <div className="my-3"><label className="text-sm font-semibold" htmlFor="waiter-payment-type">Payment type</label><select id="waiter-payment-type" className="mt-1 h-11 w-full rounded-md border px-3" value={paymentType} onChange={e=>{setPaymentType(e.target.value as "cash" | "credit");setCheckout(false);setCreditVerified(false);setCreditAccounts([]);setCreditAccountId("");setCreditAgreementId("");setCreditPersonId("");}}><option value="cash">Cash</option><option value="credit">Credit (Head Waiter only)</option></select>{paymentType === "credit" && <div className="mt-2 space-y-2">
          <p className="text-xs text-slate-600">Sign in as Head Waiter to retrieve active credit accounts, agreements and authorized persons.</p>
          <label className="block text-sm font-medium" htmlFor="head-waiter-phone">Head Waiter phone number</label>
          <Input id="head-waiter-phone" inputMode="tel" autoComplete="off" value={phone} onChange={e => { setPhone(e.target.value); setCreditVerified(false); setCreditAccounts([]); setCreditAccountId(""); setCreditAgreementId(""); setCreditPersonId(""); }} placeholder="Registered phone number" />
          <label className="block text-sm font-medium" htmlFor="head-waiter-password">Head Waiter password</label>
          <Input id="head-waiter-password" type="password" autoComplete="off" value={password} onChange={e => { setPassword(e.target.value); setCreditVerified(false); setCreditAccounts([]); setCreditAccountId(""); setCreditAgreementId(""); setCreditPersonId(""); }} placeholder="Password" />
          <Button type="button" variant="outline" className="w-full" disabled={creditLoading || !phone.trim() || !password || creditVerified} onClick={loadCreditOptions}>{creditLoading ? "Verifying..." : creditVerified ? "Head Waiter verified" : "Verify Head Waiter"}</Button>
          {creditVerified && creditAccounts.length === 0 && <p className="text-sm text-amber-700">No active credit accounts with agreements are available.</p>}
          <select aria-label="Active credit account" className="h-11 w-full rounded-md border px-3" required value={creditAccountId} onChange={e => { setCreditAccountId(e.target.value); setCreditAgreementId(""); setCreditPersonId(""); }}><option value="">Select active credit account</option>{creditAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
          <select aria-label="Active credit agreement" className="h-11 w-full rounded-md border px-3" required value={creditAgreementId} onChange={e => { setCreditAgreementId(e.target.value); setCreditPersonId(""); }}><option value="">Select active agreement</option>{selectedCreditAccount?.agreements.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
          <select aria-label="Authorized person" className="h-11 w-full rounded-md border px-3" required value={creditPersonId} onChange={e => setCreditPersonId(e.target.value)}><option value="">Select authorized person</option>{selectedCreditAgreement?.authorized_persons.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        </div>}</div>
        <Input className="mb-3" value={customerName} onChange={e=>setCustomerName(e.target.value)} placeholder="Guest name (optional)"/><Textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Order notes (optional)"/>
        <div className="my-4 flex justify-between text-xl font-black"><span>Total (VAT included)</span><span>{money(total)}</span></div>
        <Button className="h-12 w-full" disabled={!cart.length || (orderType === "dine_in" && !tableId) || (paymentType === "credit" && (!creditVerified || !creditAccountId || !creditAgreementId || !creditPersonId))} onClick={()=>{setCheckout(true);setError("");}}>Place Order</Button>
        {checkout && paymentType === "credit" && <form onSubmit={placeOrder} className="mt-4 space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4"><p className="text-sm">Credit account and Head Waiter identity verified.</p><Button type="submit" disabled={submitting || !creditVerified} className="w-full">{submitting ? "Submitting..." : "Submit Credit Order"}</Button><Button type="button" variant="outline" className="w-full" onClick={()=>setCheckout(false)}>Cancel</Button></form>}
        {checkout && paymentType === "cash" && <form onSubmit={placeOrder} className="mt-4 space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4"><h3 className="font-bold">Verify the waiter placing this order</h3><p className="text-sm">Enter your own registered waiter phone and password. No customer login is required.</p><Input autoComplete="off" inputMode="tel" required value={phone} onChange={e=>{setPhone(e.target.value);setCreditAccounts([]);setCreditAccountId("");setCreditAgreementId("");setCreditPersonId("");}} placeholder="Waiter phone number"/><Input type="password" autoComplete="off" required value={password} onChange={e=>{setPassword(e.target.value);setCreditAccounts([]);setCreditAccountId("");setCreditAgreementId("");setCreditPersonId("");}} placeholder="Waiter password"/><Button type="submit" disabled={submitting} className="w-full">{submitting ? "Submitting..." : "Verify Waiter & Submit to Cashier"}</Button><Button type="button" variant="outline" className="w-full" onClick={()=>{setCheckout(false);setPassword("");}}>Cancel</Button></form>}
        {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
      </aside>
    </div>
  </main>;
}
