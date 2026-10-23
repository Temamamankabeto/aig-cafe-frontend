"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import api from "@/lib/api";

type Menu = { id: number; name: string; price: string | number; type?: string; category?: { name?: string } };
type Profile = { name: string; balance: number; has_active_account: boolean };
const money = (value: number) => `${Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`;
const brown = "#994b29";

export default function StaffPackagePage() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [menu, setMenu] = useState<Menu[]>([]);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All items");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [successOrder, setSuccessOrder] = useState<string | null>(null);
  const [mobileCart, setMobileCart] = useState(false);
  const requestId = useRef<string | null>(null);

  useEffect(() => {
    api.get("/public/menu")
      .then(r => setMenu(Array.isArray(r.data?.data) ? r.data.data : []))
      .catch(() => setMessage("Unable to load the menu. Please refresh the page."));
  }, []);

  const cart = useMemo(() => menu.filter(item => (quantities[item.id] || 0) > 0).map(item => ({ ...item, qty: quantities[item.id] })), [menu, quantities]);
  const total = useMemo(() => cart.reduce((sum, item) => sum + Number(item.price) * item.qty, 0), [cart]);
  const count = cart.reduce((sum, item) => sum + item.qty, 0);
  const categories = useMemo(() => ["All items", ...Array.from(new Set(menu.map(item => item.category?.name || item.type || "Other")))], [menu]);
  const visible = menu.filter(item => (category === "All items" || (item.category?.name || item.type || "Other") === category) && item.name.toLowerCase().includes(search.toLowerCase()));
  const canOrder = Boolean(profile?.has_active_account) && total > 0 && total <= (profile?.balance ?? 0) && !busy;

  function errorText(e: unknown) {
    if (typeof e === "object" && e !== null && "response" in e) {
      const r = (e as { response?: { data?: { message?: string } } }).response;
      return r?.data?.message || "Request failed. Please try again.";
    }
    return "Request failed. Please try again.";
  }

  async function login() {
    setBusy(true); setMessage("");
    try {
      const r = await api.post("/public/staff-package/profile", { phone, password });
      setProfile(r.data.data as Profile);
      setQuantities({});
    } catch (e) { setMessage(errorText(e)); }
    finally { setBusy(false); }
  }

  function update(id: number, delta: number) {
    if (busy) return;
    requestId.current = null;
    setQuantities(old => ({ ...old, [id]: Math.max(0, (old[id] || 0) + delta) }));
  }

  async function order() {
    if (!profile || !canOrder) return;
    if (!requestId.current) requestId.current = crypto.randomUUID();
    setBusy(true); setMessage("");
    try {
      const r = await api.post("/public/staff-package/orders", {
        phone, password, request_id: requestId.current,
        items: cart.map(item => ({ menu_item_id: item.id, quantity: item.qty })),
      });
      setProfile(old => old ? { ...old, balance: Number(r.data.data.balance) } : old);
      setSuccessOrder(String(r.data.data.order_number));
      setQuantities({});
      requestId.current = null;
      setShowConfirm(false);
      setMobileCart(false);
    } catch (e) { setMessage(errorText(e)); setShowConfirm(false); }
    finally { setBusy(false); }
  }

  function logout() {
    setProfile(null); setPhone(""); setPassword(""); setQuantities({});
    setMessage(""); setShowConfirm(false); setSuccessOrder(null); setMobileCart(false);
    requestId.current = null;
  }

  const cartPanel = <div className="flex h-full flex-col rounded-2xl border border-[#e7ded1] bg-white shadow-sm">
    <div className="flex items-center justify-between border-b border-[#eee6dc] px-5 py-5">
      <div><h2 className="text-lg font-bold">Your cart</h2><p className="text-xs text-stone-500">{count} {count === 1 ? "item" : "items"} selected</p></div>
      <span className="rounded-full bg-[#f7ece4] px-3 py-1 text-xs font-semibold text-[#994b29]">Staff balance</span>
    </div>
    <div className="max-h-[43vh] min-h-[180px] flex-1 space-y-4 overflow-y-auto px-5 py-5">
      {cart.length === 0 ? <div className="flex h-40 flex-col items-center justify-center gap-2 text-center text-stone-400"><span className="text-4xl">🛒</span><p className="font-medium text-stone-600">Your cart is empty</p><p className="text-xs">Add items from the menu to get started.</p></div> : cart.map(item => <div key={item.id} className="flex items-start justify-between gap-3 border-b border-[#f2ece5] pb-4 last:border-0">
        <div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold">{item.name}</p><p className="mt-1 text-xs text-stone-500">{money(Number(item.price))} each</p><div className="mt-2 flex items-center gap-2"><button type="button" disabled={busy} onClick={() => update(item.id, -1)} aria-label={`Remove one ${item.name}`} className="h-7 w-7 rounded-md border text-lg disabled:opacity-50">−</button><span className="w-5 text-center text-sm">{item.qty}</span><button type="button" disabled={busy} onClick={() => update(item.id, 1)} aria-label={`Add one ${item.name}`} className="h-7 w-7 rounded-md border text-lg disabled:opacity-50">+</button></div></div>
        <p className="whitespace-nowrap text-sm font-semibold">{money(Number(item.price) * item.qty)}</p>
      </div>)}
    </div>
    <div className="space-y-3 border-t border-[#eee6dc] px-5 py-5">
      <div className="flex justify-between text-sm"><span className="text-stone-500">Available balance</span><span className="font-semibold">{money(profile?.balance ?? 0)}</span></div>
      <div className="flex justify-between text-base"><span className="font-semibold">Order total</span><span className="font-bold">{money(total)}</span></div>
      <div className="flex justify-between text-sm"><span className="text-stone-500">Balance after order</span><span className={`font-bold ${total > (profile?.balance ?? 0) ? "text-red-700" : "text-green-700"}`}>{money((profile?.balance ?? 0) - total)}</span></div>
      {total > (profile?.balance ?? 0) && <p className="rounded-lg bg-red-50 p-2 text-xs text-red-700">Insufficient balance. Please remove an item.</p>}
      {!profile?.has_active_account && <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">No active balance account is available.</p>}
      <button type="button" disabled={!canOrder} onClick={() => { setMobileCart(false); setShowConfirm(true); }} className="w-full rounded-xl bg-[#994b29] px-4 py-3 font-semibold text-white transition hover:bg-[#803d20] disabled:cursor-not-allowed disabled:opacity-40">Review & place order →</button>
      <p className="text-center text-xs text-stone-400">Payment is deducted from your staff balance.</p>
    </div>
  </div>;

  return <main className="min-h-screen bg-[#faf7f1] text-[#29231d]">
    <header className="border-b border-[#e9e0d4] bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#994b29] text-xl font-bold text-white">A</div><div><h1 className="text-lg font-bold leading-tight">AIG Cafeteria</h1><p className="text-xs text-stone-500">Staff ordering</p></div></div>{profile && <button onClick={logout} className="rounded-lg border border-[#e7ded1] px-4 py-2 text-sm font-medium hover:bg-stone-50">Log out</button>}</div></header>
    <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
      {!profile ? <div className="mx-auto mt-8 max-w-md"><div className="mb-6 text-center"><h2 className="text-2xl font-bold">Welcome back</h2><p className="mt-2 text-sm text-stone-500">Sign in to order from the cafeteria menu.</p></div><form onSubmit={e => { e.preventDefault(); void login(); }} className="space-y-5 rounded-2xl border border-[#e7ded1] bg-white p-7 shadow-sm"><label className="block text-sm font-medium">Registered phone<input required autoComplete="username" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Enter phone number" className="mt-2 w-full rounded-xl border border-[#e7ded1] px-4 py-3 outline-none focus:border-[#994b29]" /></label><label className="block text-sm font-medium">Password<input required type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" className="mt-2 w-full rounded-xl border border-[#e7ded1] px-4 py-3 outline-none focus:border-[#994b29]" /></label><button disabled={busy} className="w-full rounded-xl bg-[#994b29] py-3 font-semibold text-white disabled:opacity-50">{busy ? "Signing in..." : "Sign in & view menu"}</button></form></div> : <>
        <div className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#e7ded1] bg-white p-5 shadow-sm"><div><p className="text-sm text-stone-500">Welcome,</p><h2 className="text-xl font-bold">{profile.name}</h2></div><div className="rounded-xl bg-[#edf8ee] px-5 py-3"><p className="text-xs font-medium text-green-800">Available balance</p><p className="mt-1 text-2xl font-extrabold text-green-800">{money(profile.balance)}</p></div></div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_350px] xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className="min-w-0"><div className="mb-5"><h2 className="text-2xl font-bold">Explore the menu</h2><p className="mt-1 text-sm text-stone-500">Choose your favorites and add them to your cart.</p></div><div className="mb-4 flex items-center gap-3"><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search food and drinks..." aria-label="Search menu" className="min-w-0 flex-1 rounded-xl border border-[#e7ded1] bg-white px-4 py-3 outline-none focus:border-[#994b29]" /></div><div className="mb-5 flex gap-2 overflow-x-auto pb-2">{categories.map(name => <button type="button" key={name} onClick={() => setCategory(name)} className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium ${category === name ? "border-[#994b29] bg-[#994b29] text-white" : "border-[#e7ded1] bg-white text-stone-600 hover:bg-stone-50"}`}>{name}</button>)}</div>
          {visible.length === 0 ? <p className="rounded-xl border bg-white p-8 text-center text-stone-500">No menu items match your search.</p> : <div className="grid gap-4 sm:grid-cols-2">{visible.map(item => <article key={item.id} className="flex min-h-[160px] flex-col justify-between rounded-2xl border border-[#e7ded1] bg-white p-5 shadow-sm transition hover:shadow-md"><div><span className="text-xs font-medium text-[#994b29]">{item.category?.name || item.type || "Menu"}</span><h3 className="mt-2 font-bold leading-snug">{item.name}</h3></div><div className="mt-5 flex items-center justify-between gap-2"><p className="font-bold">{money(Number(item.price))}</p>{(quantities[item.id] || 0) > 0 ? <div className="flex items-center gap-2"><button type="button" disabled={busy} onClick={() => update(item.id,-1)} aria-label={`Remove one ${item.name}`} className="h-9 w-9 rounded-lg border text-lg disabled:opacity-50">−</button><span className="w-5 text-center font-semibold">{quantities[item.id]}</span><button type="button" disabled={busy} onClick={() => update(item.id,1)} aria-label={`Add one ${item.name}`} className="h-9 w-9 rounded-lg border text-lg disabled:opacity-50">+</button></div> : <button type="button" disabled={busy} onClick={() => update(item.id,1)} className="rounded-lg bg-[#f7ece4] px-4 py-2 text-sm font-semibold text-[#994b29] hover:bg-[#f0ddce] disabled:opacity-50">+ Add</button>}</div></article>)}</div>}</section>
          <aside className="hidden self-start lg:sticky lg:top-5 lg:block">{cartPanel}</aside>
        </div>
        <div className="fixed bottom-0 left-0 right-0 z-20 border-t bg-white p-3 shadow-lg lg:hidden"><button onClick={() => setMobileCart(true)} className="flex w-full items-center justify-between rounded-xl bg-[#994b29] px-5 py-3 font-semibold text-white"><span>View cart ({count})</span><span>{money(total)} →</span></button></div><div className="h-20 lg:hidden" />
      </>}
      {message && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{message}</p>}
    </div>
    {mobileCart && profile && <div className="fixed inset-0 z-40 flex items-end bg-black/50 lg:hidden" onClick={() => setMobileCart(false)}><div className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white p-3" onClick={e => e.stopPropagation()}><div className="mb-2 flex justify-end"><button onClick={() => setMobileCart(false)} aria-label="Close cart" className="rounded-lg border px-3 py-1">✕</button></div>{cartPanel}</div></div>}
    {showConfirm && profile && <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"><div role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="mb-1 flex items-center justify-between"><h2 id="confirm-title" className="text-xl font-bold">Confirm your order</h2><button disabled={busy} onClick={() => setShowConfirm(false)} aria-label="Close" className="text-xl text-stone-500">×</button></div><p className="mb-5 text-sm text-stone-500">Review your items before placing the order.</p><div className="max-h-56 space-y-3 overflow-y-auto border-y py-4">{cart.map(item => <div key={item.id} className="flex justify-between gap-3 text-sm"><span>{item.qty} × {item.name}</span><strong className="whitespace-nowrap">{money(item.qty * Number(item.price))}</strong></div>)}</div><div className="mt-5 space-y-2"><div className="flex justify-between"><span>Total to deduct</span><strong>{money(total)}</strong></div><div className="flex justify-between text-sm text-stone-500"><span>Remaining balance</span><span>{money(profile.balance-total)}</span></div></div><div className="mt-6 flex gap-3"><button disabled={busy} onClick={() => setShowConfirm(false)} className="flex-1 rounded-xl border px-4 py-3 font-medium">Cancel</button><button disabled={!canOrder} onClick={() => void order()} className="flex-1 rounded-xl bg-[#994b29] px-4 py-3 font-semibold text-white disabled:opacity-50">{busy ? "Placing..." : "Place order"}</button></div><p className="mt-3 text-center text-xs text-stone-500">Sent directly to Kitchen / Bar. No cashier confirmation.</p></div></div>}
    {successOrder && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"><div role="dialog" aria-modal="true" aria-labelledby="success-title" className="w-full max-w-sm rounded-2xl bg-white p-7 text-center shadow-2xl"><div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl text-green-700">✓</div><h2 id="success-title" className="text-xl font-bold">Order confirmed!</h2><p className="mt-2 text-sm text-stone-500">Your order has been sent to Kitchen / Bar.</p><p className="mt-4 rounded-lg bg-stone-50 p-3 font-bold">{successOrder}</p><button onClick={() => setSuccessOrder(null)} className="mt-6 w-full rounded-xl bg-[#994b29] py-3 font-semibold text-white">Continue ordering</button></div></div>}
  </main>;
}
