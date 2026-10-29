"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Minus, Plus, Search, ShoppingCart, Trash2, UtensilsCrossed } from "lucide-react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OrderTicketPreviewDialog } from "@/components/order-management/order-ticket-preview-dialog";
import { WaiterOrderCardScanner } from "@/components/identity/waiter-order-card-scanner";
import type { MenuCategory, MenuItem } from "@/types/menu-management";

type TableOption = { id: number | string; table_number?: string | number; name?: string; status?: string };
type CreditPerson = { id: number; name: string };
type CreditMealType = { id: number; name: string; category: string | null; price_per_person: string | number | null; menu_item_ids: number[] };
type CreditAgreement = { id: number; name: string; authorized_persons: CreditPerson[]; meal_types: CreditMealType[] };
type CreditAccount = { id: number; name: string; agreements: CreditAgreement[]; authorized_persons: CreditPerson[] };
type CreditMealCategory = { slug: string; name: string; is_active: boolean };
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
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const submissionLock = useRef(false);
  const [paymentType, setPaymentType] = useState<"cash" | "credit">("cash");
  const [creditAccounts, setCreditAccounts] = useState<CreditAccount[]>([]);
  const [creditLoading, setCreditLoading] = useState(false);
  const [creditVerified, setCreditVerified] = useState(false);
  const [creditPersonId, setCreditPersonId] = useState("");
  const [creditPersonCount, setCreditPersonCount] = useState(1);
  const [creditAccountId, setCreditAccountId] = useState("");
  const [creditMealCategory, setCreditMealCategory] = useState("");
  const [creditMealCategories, setCreditMealCategories] = useState<CreditMealCategory[]>([]);
  const [creditMealTypeId, setCreditMealTypeId] = useState("");
  const [checkout, setCheckout] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [completed, setCompleted] = useState<{ order_number: string; total: number; waiter_name: string; waiterId: number; id: number; lines: { name: string; quantity: number; price: number }[]; numberOfPersons: number | null; paymentType: "cash" | "credit"; orderType: OrderType; table: string; tableId: number; placedAt: string; notes: string } | null>(null);
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

  const selectedCreditAccount = creditAccounts.find(a => String(a.id) === creditAccountId);
  const eligibleMealTypes = selectedCreditAccount?.agreements.flatMap(a => a.meal_types || []) || [];
  const mealCategories = creditMealCategories.filter(c => c.is_active && eligibleMealTypes.some(t => t.category === c.slug));
  const mealTypesInCategory = eligibleMealTypes.filter((t, i, all) =>
    t.category === creditMealCategory && all.findIndex(x => x.id === t.id) === i);
  const selectedMealType = eligibleMealTypes.find(t => String(t.id) === creditMealTypeId);
  const isOrderBased = selectedMealType?.category === "order_based";
  const eligibleAgreements = selectedCreditAccount?.agreements.filter(a =>
    a.meal_types?.some(t => String(t.id) === creditMealTypeId)) || [];
  const authorizedPersons = isOrderBased
    ? (selectedCreditAccount?.authorized_persons || [])
    : [...new Map(eligibleAgreements.flatMap(a => a.authorized_persons || []).map(p => [p.id, p])).values()];
  const permittedMenuItemIds = selectedMealType && !isOrderBased ? new Set(selectedMealType.menu_item_ids.map(String)) : null;


  const filtered = useMemo(() => items.filter(item => {
    if (paymentType === "credit" && (!selectedMealType || (permittedMenuItemIds && !permittedMenuItemIds.has(String(item.id))))) return false;
    const term = search.trim().toLowerCase();
    return Boolean(item.is_active) && Boolean(item.is_available) &&
      (category === "all" || String(item.category_id ?? item.menu_category_id) === category) &&
      (!term || item.name.toLowerCase().includes(term) || String(item.description ?? "").toLowerCase().includes(term));
  }), [items, category, search, paymentType, selectedMealType, permittedMenuItemIds]);
  const isFixedMeal = paymentType === "credit" && Boolean(selectedMealType) && !isOrderBased;
  const total = isFixedMeal ? Number(selectedMealType?.price_per_person || 0) * creditPersonCount : cart.reduce((n, line) => n + Number(line.item.price) * line.quantity, 0);
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
      setCreditMealCategories(Array.isArray(response.data?.meta?.meal_categories) ? response.data.meta.meal_categories : []);
      setCreditVerified(true);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err.response?.data?.message || "Unable to load active credit options.");
      setCreditAccounts([]);
      setCreditMealCategories([]);
      setCreditVerified(false);
    } finally { setCreditLoading(false); }
  }


  async function placeOrder(event?: React.FormEvent<HTMLFormElement>, scannedCard?: string) {
    event?.preventDefault();
    if (submissionLock.current) return;
    if (paymentType === "cash" && !scannedCard) return setError("Scan a valid waiter card first.");
    setError("");
    if (!isFixedMeal && !cart.length) return setError("Add at least one item.");
    if (isFixedMeal && !(Number(selectedMealType?.price_per_person) > 0)) return setError("Set a valid price per person in Meal Types before ordering.");
    if (paymentType === "credit" && selectedMealType && !isOrderBased && (!Number.isInteger(creditPersonCount) || creditPersonCount < 1)) return setError("Enter a valid number of persons.");
    if (orderType === "dine_in" && !tableId) return setError("Select a table.");
    submissionLock.current = true;
    setSubmitting(true);
    try {
      const response = await api.post("/public/waiter-orders", {
        ...(paymentType === "cash" ? { card_code: scannedCard } : { phone: phone.trim(), password }), order_type: orderType, payment_type: paymentType,
        ...(paymentType === "credit" ? { credit_account_id: Number(creditAccountId), ...(isOrderBased ? { credit_account_user_id: Number(creditPersonId) } : { number_of_person: creditPersonCount }), credit_meal_type_id: Number(creditMealTypeId) } : {}),
        table_id: orderType === "dine_in" ? Number(tableId) : null,
        customer_name: "Guest", notes: "",
        items: cart.map(line => ({ menu_item_id: line.item.id, quantity: line.quantity })),
      });
      const order = response.data?.data;
      // Order is created first. Confirmation is a separate, retryable operation; never recreate on confirmation failure.
      let autoConfirmed = false;
      if (paymentType === "cash") {
        try {
          const confirmation = await api.post(`/public/waiter-orders/${order.id}/confirm`, { card_code: scannedCard });
          if (confirmation.data?.success !== true) throw new Error(confirmation.data?.message || "Confirmation failed");
          autoConfirmed = true;
        } catch (confirmationError: unknown) {
          const e = confirmationError as { response?: { data?: { message?: string } }; message?: string };
          setError(`Order ${order.order_number} was created, but confirmation failed: ${e.response?.data?.message || e.message || "Unknown error"}. Scan the card again on the order screen to retry; do not place a new order.`);
        }
      }
      setConfirmed(autoConfirmed);
      if (autoConfirmed) setTicketOpen(true);
      setCompleted({ order_number: order?.order_number || "Created", total: Number(order?.total ?? total), waiter_name: order?.waiter_name || "Waiter", waiterId: Number(order?.waiter_id ?? order?.waiter?.id ?? order?.created_by ?? 0), id: Number(order?.id), numberOfPersons: paymentType === "credit" ? (Number(order?.number_of_person) > 0 ? Number(order.number_of_person) : (isOrderBased ? 1 : creditPersonCount)) : null, paymentType, lines: isFixedMeal ? [{ name: selectedMealType!.name, quantity: creditPersonCount, price: Number(selectedMealType!.price_per_person) }] : cart.map(line => ({ name: line.item.name, quantity: line.quantity, price: Number(line.item.price) })), orderType, tableId: orderType === "dine_in" ? Number(tableId) : 0, table: tables.find(t => String(t.id) === tableId)?.name || (tables.find(t => String(t.id) === tableId)?.table_number != null ? `Table ${tables.find(t => String(t.id) === tableId)?.table_number}` : ""), placedAt: new Date().toLocaleString(), notes: "" });
      setCart([]); setPhone(""); setPassword(""); setCreditVerified(false); setCreditAccounts([]); setCreditAccountId(""); setCreditMealCategory(""); setCreditMealTypeId(""); setCreditPersonId(""); setCreditPersonCount(1); setTableId(""); setCheckout(false);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err.response?.data?.message || "Order could not be submitted. Check the QR card and try again.");
      setPassword("");
    } finally { setSubmitting(false); submissionLock.current = false; }
  }

  const [confirmed, setConfirmed] = useState(false);

  function resetForNextOrder() {
    setTicketOpen(false);
    setCompleted(null); setConfirmed(false); setCart([]); setOrderType("dine_in");
    setCategory("all"); setSearch(""); setTableId(""); setPhone(""); setPassword(""); setPaymentType("cash");
    setCreditVerified(false); setCreditAccounts([]); setCreditAccountId("");
    setCreditMealCategory(""); setCreditMealTypeId(""); setCreditPersonId(""); setCreditPersonCount(1); setCheckout(false); setError("");
  }

  async function confirmAndPrint(scannedCard: string) {
    if (!completed || confirmed || submissionLock.current || completed.paymentType !== "cash") return;
    submissionLock.current = true;
    setSubmitting(true);
    try {
      const result = await api.post(`/public/waiter-orders/${completed.id}/confirm`, { card_code: scannedCard });
      if (result.data?.success !== true) throw new Error(result.data?.message || "Confirmation failed");
      setConfirmed(true);
      setTicketOpen(true);
      setError("");
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setError(err.response?.data?.message || err.message || "Order confirmation failed. Scan the same waiter's card to retry.");
    } finally { setSubmitting(false); submissionLock.current = false; }
  }

  async function confirmCreditOrder() {
    if (!completed || completed.paymentType !== "credit" || submitting) return;
    const enteredPhone = window.prompt("Head Waiter phone number:");
    if (!enteredPhone) return;
    const enteredPassword = window.prompt("Head Waiter password:");
    if (!enteredPassword) return;
    setSubmitting(true);
    try {
      const result = await api.post(`/public/waiter-orders/${completed.id}/confirm`, { phone: enteredPhone.trim(), password: enteredPassword });
      if (result.data?.success !== true) throw new Error(result.data?.message || "Confirmation failed");
      setConfirmed(true);
      setTicketOpen(true);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setError(err.response?.data?.message || err.message || "Credit order confirmation failed.");
    } finally { setSubmitting(false); }
  }

  if (completed) return <>
    <main className="min-h-screen bg-[#f7f4ed] p-6 flex items-center justify-center"><section className="w-full max-w-lg rounded-3xl bg-white p-8 text-center shadow-lg">
      <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-600"/><h1 className="mt-4 text-2xl font-bold">Order submitted</h1>
      <p className="mt-3">Waiter: <strong>{completed.waiter_name}</strong></p><p>Order: <strong>{completed.order_number}</strong></p>
      <p className="mt-2 text-xl font-bold">{money(completed.total)}</p><p className="mt-4 rounded-xl bg-amber-50 p-3 text-amber-900">{confirmed ? "Order Confirmed — Sent to Kitchen/Bar." : "Order submitted. Confirm & Print to send it to Kitchen/Bar without Cashier confirmation."}</p>
      {confirmed ? <Button className="mt-6 h-12 w-full" onClick={() => setTicketOpen(true)}>View & Print Ticket</Button> : completed.paymentType === "cash" ? <div className="mt-6"><p className="mb-2 text-sm text-amber-800">Order already created. Scan the same waiter card to retry confirmation; do not submit another order.</p><WaiterOrderCardScanner onScan={confirmAndPrint} disabled={submitting} buttonLabel={submitting ? "Confirming..." : "Scan Card to Retry Confirm & Print"}/></div> : <Button className="mt-6 h-12 w-full" disabled={submitting} onClick={confirmCreditOrder}>Confirm Credit Order & Print (Head Waiter)</Button>}
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
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
        number_of_person: completed.numberOfPersons,
        payment_type: completed.paymentType,
        total: completed.total,
      }}
    />}
  </>;

  return <main className="min-h-screen bg-[#f7f4ed] text-slate-900">
    <header className="bg-[#071a34] px-4 py-4 text-white sm:px-6 sm:py-5"><div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><UtensilsCrossed className="text-amber-400"/><div><h1 className="text-base font-black leading-tight sm:text-xl">AIG Smart Hotel — Shared Waiter Ordering</h1><p className="text-xs text-slate-300">All waiters • One device • Verify identity at checkout</p></div></div><div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end"><Link href="/waiter-order/my-orders" className="rounded-lg bg-amber-400 px-3 py-2 text-sm font-semibold text-slate-950 sm:px-4">See Your Report</Link><span><ShoppingCart className="mr-1 inline"/> {cart.reduce((n,x)=>n+x.quantity,0)}</span></div></div></header>
    <div className="mx-auto grid max-w-[1500px] grid-cols-1 items-start gap-4 p-3 sm:p-5 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section className="min-w-0">{isFixedMeal ? <div className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm sm:p-6"><h2 className="text-xl font-bold">{selectedMealType?.name}</h2><p className="mt-2">Price per person: {money(selectedMealType?.price_per_person || 0)}</p><p>Persons: {creditPersonCount}</p><p className="mt-3 text-lg font-bold">Total: {money(total)}</p><p className="mt-2 text-sm text-slate-600">No menu items need to be added to the cart for this meal type.</p></div> : <><div className="relative mb-4"><Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400"/><Input className="h-12 bg-white pl-12" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search food or drinks..."/></div>
        <div className="mb-4 flex gap-2 overflow-x-auto"><Button variant={category === "all" ? "default" : "outline"} onClick={()=>setCategory("all")}>All</Button>{categories.map(c=><Button key={String(c.id)} variant={category === String(c.id) ? "default" : "outline"} onClick={()=>setCategory(String(c.id))}>{c.name}</Button>)}</div>
        {loading ? <p>Loading menu...</p> : <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 xl:grid-cols-4">{filtered.map(item=><button key={String(item.id)} onClick={()=>add(item)} className="min-w-0 overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition-shadow hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-600"><div className="flex aspect-[4/3] items-center justify-center bg-amber-50">{item.image_url || item.image_path ? <img src={item.image_url ?? item.image_path ?? ""} alt={item.name} className="h-full w-full object-cover"/> : <UtensilsCrossed className="h-10 w-10 text-amber-500"/>}</div><div className="p-3"><strong>{item.name}</strong><p className="mt-2 font-bold text-amber-700">{money(item.price)}</p><span className="text-sm">+ Add</span></div></button>)}</div>}
      </>}</section>
      <aside className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto"><h2 className="text-xl font-bold tracking-tight sm:text-2xl">{isFixedMeal ? "Meal order" : "Order cart"}</h2><div className="mt-4 flex gap-2"><Button className="flex-1" variant={orderType === "dine_in" ? "default" : "outline"} onClick={()=>setOrderType("dine_in")}>Dine In</Button><Button className="flex-1" variant={orderType === "takeaway" ? "default" : "outline"} onClick={()=>setOrderType("takeaway")}>Takeaway</Button></div>
        {orderType === "dine_in" && <select className="mt-3 h-11 w-full rounded-md border px-3" value={tableId} onChange={e=>setTableId(e.target.value)}><option value="">Select table</option>{tables.map(t=><option key={String(t.id)} value={String(t.id)}>{t.name || `Table ${t.table_number ?? t.id}`} — {String(t.status || "unknown").replace(/_/g, " ")}</option>)}</select>}
        {!isFixedMeal && <div className="my-4 space-y-3">{cart.length === 0 && <p className="py-6 text-center text-slate-500">Select menu items to begin.</p>}{cart.map(line=><div key={String(line.item.id)} className="rounded-xl bg-slate-50 p-3"><div className="flex justify-between"><strong>{line.item.name}</strong><button aria-label="Remove item" onClick={()=>setCart(c=>c.filter(x=>x.item.id !== line.item.id))}><Trash2 className="h-4 w-4 text-red-600"/></button></div><div className="mt-2 flex items-center justify-between"><div className="flex items-center gap-2"><Button size="icon" variant="outline" onClick={()=>change(line.item.id,-1)}><Minus className="h-4 w-4"/></Button>{line.quantity}<Button size="icon" variant="outline" onClick={()=>change(line.item.id,1)}><Plus className="h-4 w-4"/></Button></div><strong>{money(Number(line.item.price)*line.quantity)}</strong></div></div>)}</div>}
        <div className="my-3"><label className="text-sm font-semibold" htmlFor="waiter-payment-type">Payment type</label><select id="waiter-payment-type" className="mt-1 h-11 w-full rounded-md border px-3" value={paymentType} onChange={e=>{setPaymentType(e.target.value as "cash" | "credit");setCheckout(false);setCreditVerified(false);setCreditAccounts([]);setCreditMealCategories([]);setCreditAccountId("");setCreditPersonId("");}}><option value="cash">Cash</option><option value="credit">Credit (Head Waiter only)</option></select>{paymentType === "credit" && <div className="mt-2 space-y-2">
          <p className="text-xs text-slate-600">Sign in as Head Waiter to retrieve active credit accounts, agreements and authorized persons.</p>
          <label className="block text-sm font-medium" htmlFor="head-waiter-phone">Head Waiter phone number</label>
          <Input id="head-waiter-phone" inputMode="tel" autoComplete="off" value={phone} onChange={e => { setPhone(e.target.value); setCreditVerified(false); setCreditAccounts([]); setCreditAccountId(""); setCreditMealCategory(""); setCreditMealTypeId(""); setCreditPersonId(""); }} placeholder="Registered phone number" />
          <label className="block text-sm font-medium" htmlFor="head-waiter-password">Head Waiter password</label>
          <Input id="head-waiter-password" type="password" autoComplete="off" value={password} onChange={e => { setPassword(e.target.value); setCreditVerified(false); setCreditAccounts([]); setCreditAccountId(""); setCreditMealCategory(""); setCreditMealTypeId(""); setCreditPersonId(""); }} placeholder="Password" />
          <Button type="button" variant="outline" className="w-full" disabled={creditLoading || !phone.trim() || !password || creditVerified} onClick={loadCreditOptions}>{creditLoading ? "Verifying..." : creditVerified ? "Head Waiter verified" : "Verify Head Waiter"}</Button>
          {creditVerified && creditAccounts.length === 0 && <p className="text-sm text-amber-700">No active credit accounts with agreements are available.</p>}
          <select aria-label="Active credit account" className="h-11 w-full rounded-md border px-3" required value={creditAccountId} onChange={e => { setCreditAccountId(e.target.value); setCreditMealCategory(""); setCreditMealTypeId(""); setCreditPersonId(""); }}><option value="">Select active credit account</option>{creditAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
          <select aria-label="Meal category" className="h-11 w-full rounded-md border px-3" value={creditMealCategory} onChange={e => { setCreditMealCategory(e.target.value); setCreditMealTypeId(""); setCreditPersonId(""); setCart([]); }}><option value="">Select meal category</option>{mealCategories.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select>
          <select aria-label="Meal type" className="h-11 w-full rounded-md border px-3" value={creditMealTypeId} onChange={e => { setCreditMealTypeId(e.target.value); setCreditPersonId(""); setCreditPersonCount(1); setCart([]); }}><option value="">Select meal type</option>{mealTypesInCategory.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
          {selectedMealType && (isOrderBased ? (
            <select aria-label="Authorized person" className="h-11 w-full rounded-md border px-3" required value={creditPersonId} onChange={e => setCreditPersonId(e.target.value)}><option value="">Select authorized person</option>{authorizedPersons.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          ) : (
            <div><label htmlFor="credit-person-count" className="mb-1 block text-sm font-medium">Number of persons</label><Input id="credit-person-count" type="number" min={1} max={1000} step={1} required value={creditPersonCount} onChange={e => setCreditPersonCount(Number(e.target.value))} /></div>
          ))}
          {selectedMealType && !isOrderBased && <p className="text-xs text-slate-600">Fixed-price meal: {money(selectedMealType.price_per_person || 0)} per person. No cart items required.</p>}

        </div>}</div>
        
        <div className="my-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4 text-lg font-bold sm:text-xl"><span>Total (VAT included)</span><span>{money(total)}</span></div>
        {paymentType === "cash" ? <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-medium">Scan AIG Restaurant Digital Card to verify the waiter, confirm the order and open the print ticket.</p>
          <WaiterOrderCardScanner buttonLabel={submitting ? "Processing order..." : "Verify Waiter, Confirm & Print Order"} disabled={submitting || !cart.length || (orderType === "dine_in" && !tableId)} onScan={code => { void placeOrder(undefined, code); }}/>
        </div> : <>
          <Button className="h-12 w-full text-base font-semibold" disabled={(!isFixedMeal && !cart.length) || (isFixedMeal && !(Number(selectedMealType?.price_per_person) > 0)) || (orderType === "dine_in" && !tableId) || (!creditVerified || !creditAccountId || !creditMealTypeId || (isOrderBased ? !creditPersonId : !Number.isInteger(creditPersonCount) || creditPersonCount < 1))} onClick={()=>{setCheckout(true);setError("");}}>Place Credit Order</Button>
          {checkout && <form onSubmit={placeOrder} className="mt-4 space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4"><p className="text-sm">Credit account and Head Waiter identity verified.</p><Button type="submit" disabled={submitting || !creditVerified} className="w-full">{submitting ? "Submitting..." : "Submit Credit Order"}</Button><Button type="button" variant="outline" className="w-full" onClick={()=>setCheckout(false)}>Cancel</Button></form>}
        </>}
        {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
      </aside>
    </div>
  </main>;
}
