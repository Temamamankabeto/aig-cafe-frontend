"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Minus, Plus, Printer, Search, ShoppingCart, Trash2, UtensilsCrossed } from "lucide-react";
import { BarcodeFormat, QRCodeWriter } from "@zxing/library";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { MenuCategory, MenuItem } from "@/types/menu-management";
import { EmployeeCardScanner } from "@/components/identity/employee-card-scanner";

type TableOption = { id: number | string; table_number?: string | number; name?: string };
type CartLine = { item: MenuItem; quantity: number };
type OrderType = "dine_in" | "takeaway";
type CompletedOrder = { order_number?: string; total?: number; customer_name: string; order_type: OrderType; table_name?: string; notes?: string; items: { name: string; quantity: number; price: number }[]; created_at: string };

function money(value: number | string) { return `${Number(value || 0).toFixed(2)} ETB`; }

export default function KioskOrderPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [tables, setTables] = useState<TableOption[]>([]);
  const [category, setCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [orderType, setOrderType] = useState<OrderType>("takeaway");
  const [tableId, setTableId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [identifiedCustomer, setIdentifiedCustomer] = useState<any>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [completed, setCompleted] = useState<CompletedOrder | null>(null);

  useEffect(() => {
    Promise.all([api.get("/public/menu"), api.get("/public/menu/categories"), api.get("/public/tables")])
      .then(([menuRes, categoryRes, tableRes]) => {
        const menuBody = menuRes.data;
        const categoryBody = categoryRes.data;
        setItems(Array.isArray(menuBody?.data) ? menuBody.data : []);
        setCategories(Array.isArray(categoryBody?.data) ? categoryBody.data : []);
        setTables(Array.isArray(tableRes.data?.data) ? tableRes.data.data : []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load kiosk menu."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => items.filter((item) => {
    const matchesCategory = category === "all" || String(item.category_id ?? item.menu_category_id) === category;
    const term = search.trim().toLowerCase();
    const matchesSearch = !term || item.name.toLowerCase().includes(term) || String(item.description ?? "").toLowerCase().includes(term);
    return matchesCategory && matchesSearch && Boolean(item.is_active) && Boolean(item.is_available);
  }), [items, category, search]);

  const subtotal = useMemo(() => cart.reduce((sum, line) => sum + Number(line.item.price) * line.quantity, 0), [cart]);
  const tax = subtotal * 0.10;
  const serviceCharge = subtotal * 0.05;
  const total = subtotal + tax + serviceCharge;

  function add(item: MenuItem) {
    setCart((current) => {
      const found = current.find((line) => String(line.item.id) === String(item.id));
      return found ? current.map((line) => String(line.item.id) === String(item.id) ? { ...line, quantity: line.quantity + 1 } : line) : [...current, { item, quantity: 1 }];
    });
  }

  function change(id: MenuItem["id"], delta: number) {
    setCart((current) => current.map((line) => String(line.item.id) === String(id) ? { ...line, quantity: Math.max(0, line.quantity + delta) } : line).filter((line) => line.quantity > 0));
  }

  async function submit() {
    setError("");
    if (!cart.length) return setError("Add at least one menu item.");
    if (orderType === "dine_in" && !tableId) return setError("Select a table for dine-in.");
    setSubmitting(true);
    try {
      const response = await api.post("/public/orders", {
        order_type: orderType,
        order_source: "kiosk",
        table_id: orderType === "dine_in" ? Number(tableId) : undefined,
        customer_name: identifiedCustomer?.name || customerName.trim() || "Kiosk Guest",
        customer_user_id: identifiedCustomer?.user_id || undefined,
        notes: notes.trim() || undefined,
        items: cart.map((line) => ({ menu_item_id: line.item.id, quantity: line.quantity })),
      });
      const order = response.data?.data ?? response.data?.order ?? response.data;
      setCompleted({
        order_number: order?.order_number,
        total: Number(order?.total ?? total),
        customer_name: identifiedCustomer?.name || customerName.trim() || "Kiosk Guest",
        order_type: orderType,
        table_name: orderType === "dine_in" ? (tables.find((t) => String(t.id) === tableId)?.name ?? `Table ${tables.find((t) => String(t.id) === tableId)?.table_number ?? tableId}`) : undefined,
        notes: notes.trim() || undefined,
        items: cart.map((line) => ({ name: line.item.name, quantity: line.quantity, price: Number(line.item.price) })),
        created_at: new Date().toLocaleString(),
      });
      setCart([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not place the order.");
    } finally { setSubmitting(false); }
  }

  function newOrder() {
    setCompleted(null); setCart([]); setCustomerName(""); setNotes(""); setTableId(""); setOrderType("takeaway"); setIdentifiedCustomer(null); setError("");
  }

  function qrSvg(value: string) {
    try {
      const matrix = new QRCodeWriter().encode(value, BarcodeFormat.QR_CODE, 180, 180, new Map());
      let cells = "";
      for (let y = 0; y < matrix.getHeight(); y++) for (let x = 0; x < matrix.getWidth(); x++) if (matrix.get(x, y)) cells += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${matrix.getWidth()} ${matrix.getHeight()}" width="180" height="180"><rect width="100%" height="100%" fill="white"/><g fill="black">${cells}</g></svg>`;
    } catch { return ""; }
  }

  function printTicket() {
    if (!completed) return;
    const ref = completed.order_number ?? "KIOSK-ORDER";
    const itemRows = completed.items.map((line) => `<tr><td>${line.quantity} × ${line.name}</td><td style="text-align:right">${money(line.price * line.quantity)}</td></tr>`).join("");
    const popup = window.open("", "_blank", "width=430,height=720");
    if (!popup) return setError("Allow pop-ups to print the order ticket.");
    popup.document.write(`<!doctype html><html><head><title>Order Ticket ${ref}</title><style>body{font-family:Arial,sans-serif;margin:0;padding:22px;color:#111}.ticket{max-width:360px;margin:auto}.center{text-align:center}.brand{font-size:22px;font-weight:800}.muted{color:#555;font-size:12px}.status{margin:14px 0;padding:10px;border:2px dashed #111;text-align:center;font-weight:800}table{width:100%;border-collapse:collapse;margin:14px 0}td{padding:6px 0;border-bottom:1px dashed #bbb;font-size:13px}.total{font-size:18px;font-weight:800;display:flex;justify-content:space-between;margin:14px 0}.qr{display:flex;justify-content:center;margin:12px 0}@media print{body{padding:0}.ticket{max-width:none}}</style></head><body><div class="ticket"><div class="center"><div class="brand">AIG Cafeteria</div><div class="muted">Kiosk Order Payment Ticket</div><h2>${ref}</h2></div><div><b>Date:</b> ${completed.created_at}</div><div><b>Customer:</b> ${completed.customer_name}</div><div><b>Order:</b> ${completed.order_type === "dine_in" ? "Dine In" : "Takeaway"}${completed.table_name ? ` — ${completed.table_name}` : ""}</div><table>${itemRows}</table><div class="total"><span>Total</span><span>${money(completed.total ?? 0)}</span></div><div class="status">PENDING PAYMENT</div><div class="qr">${qrSvg(ref)}</div><div class="center"><b>${ref}</b><p>Please present this ticket to the Cashier for payment.</p><div class="muted">Kitchen/Bar preparation starts only after Cashier payment confirmation.</div></div></div><script>window.onload=()=>{window.print();}</script></body></html>`);
    popup.document.close();
  }

  if (completed) return (
    <main className="min-h-screen bg-[#f7f4ed] p-4 md:p-10 flex items-center justify-center">
      <section className="w-full max-w-xl rounded-3xl border bg-white p-8 text-center shadow-xl md:p-12">
        <CheckCircle2 className="mx-auto h-20 w-20 text-emerald-600" />
        <h1 className="mt-5 text-3xl font-bold text-slate-900">Order placed — payment required</h1>
        <p className="mt-2 text-slate-500">Print the order ticket and present it to the Cashier. Kitchen/Bar receives the order only after Cashier payment confirmation.</p>
        <div className="my-7 rounded-2xl bg-slate-950 p-6 text-white"><div className="text-sm uppercase tracking-widest text-slate-400">Order number</div><div className="mt-2 text-4xl font-black">{completed.order_number ?? "Created"}</div></div>
        <p className="text-xl font-semibold">Amount to pay: {money(completed.total ?? 0)}</p>
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">Status: Pending Payment Confirmation</div>
        <Button className="mt-6 h-14 w-full bg-amber-500 text-lg font-black text-slate-950 hover:bg-amber-400" onClick={printTicket}><Printer className="mr-2 h-5 w-5" />View / Print Order Ticket</Button>
        <Button className="mt-3 h-14 w-full text-lg" variant="outline" onClick={newOrder}>Start New Order</Button>
      </section>
    </main>
  );

  return (
    <main className="min-h-screen bg-[#f7f4ed] text-slate-900">
      <header className="sticky top-0 z-20 border-b bg-[#071a34] px-4 py-4 text-white shadow md:px-8">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4">
          <div className="flex items-center gap-3"><div className="rounded-xl bg-amber-400 p-2 text-[#071a34]"><UtensilsCrossed className="h-7 w-7" /></div><div><h1 className="text-xl font-black md:text-2xl">Cafe POS Kiosk</h1><p className="text-xs text-slate-300 md:text-sm">Touch, order and submit</p></div></div>
          <div className="rounded-full bg-white/10 px-4 py-2 font-semibold"><ShoppingCart className="mr-2 inline h-5 w-5" />{cart.reduce((n, x) => n + x.quantity, 0)} items</div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1600px] gap-5 p-4 lg:grid-cols-[1fr_390px] lg:p-6">
        <section className="min-w-0">
          <div className="mb-4 flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm md:flex-row md:items-center">
            <div className="relative flex-1"><Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"/><Input className="h-12 pl-12 text-base" placeholder="Search food or drink..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          </div>
          <div className="mb-5 flex gap-2 overflow-x-auto pb-2">
            <Button className="h-12 shrink-0 rounded-full px-6" variant={category === "all" ? "default" : "outline"} onClick={() => setCategory("all")}>All</Button>
            {categories.map((c) => <Button key={String(c.id)} className="h-12 shrink-0 rounded-full px-6" variant={category === String(c.id) ? "default" : "outline"} onClick={() => setCategory(String(c.id))}>{c.name}</Button>)}
          </div>
          {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-red-700">{error}</div>}
          {loading ? <div className="py-24 text-center text-lg text-slate-500">Loading menu...</div> : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
              {filtered.map((item) => <button key={String(item.id)} onClick={() => add(item)} className="group overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg active:scale-[.98]">
                <div className="flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100">
                  {item.image_url || item.image_path ? <img src={item.image_url ?? item.image_path ?? ""} alt={item.name} className="h-full w-full object-cover" /> : <UtensilsCrossed className="h-12 w-12 text-amber-500" />}
                </div>
                <div className="p-4"><div className="line-clamp-1 text-lg font-bold">{item.name}</div><div className="mt-1 line-clamp-2 min-h-10 text-sm text-slate-500">{item.description || item.type}</div><div className="mt-3 flex items-center justify-between"><span className="font-black text-amber-700">{money(item.price)}</span><span className="rounded-full bg-[#071a34] px-3 py-1 text-sm font-bold text-white">+ Add</span></div></div>
              </button>)}
              {!filtered.length && <div className="col-span-full py-20 text-center text-slate-500">No available menu items match your search.</div>}
            </div>
          )}
        </section>

        <aside className="lg:sticky lg:top-24 lg:h-[calc(100vh-7rem)]">
          <div className="flex h-full flex-col rounded-3xl border bg-white shadow-lg">
            <div className="border-b p-5"><h2 className="text-2xl font-black">Your Order</h2><div className="mt-4 grid grid-cols-2 gap-2"><Button className="h-12" variant={orderType === "takeaway" ? "default" : "outline"} onClick={() => setOrderType("takeaway")}>Takeaway</Button><Button className="h-12" variant={orderType === "dine_in" ? "default" : "outline"} onClick={() => setOrderType("dine_in")}>Dine In</Button></div></div>
            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              {!cart.length && <div className="py-14 text-center text-slate-400"><ShoppingCart className="mx-auto mb-3 h-12 w-12"/>Tap menu items to add them.</div>}
              {cart.map((line) => <div key={String(line.item.id)} className="rounded-2xl bg-slate-50 p-3"><div className="flex justify-between gap-3"><div><div className="font-bold">{line.item.name}</div><div className="text-sm text-slate-500">{money(line.item.price)} each</div></div><button onClick={() => setCart((c) => c.filter((x) => String(x.item.id) !== String(line.item.id)))}><Trash2 className="h-5 w-5 text-red-500"/></button></div><div className="mt-3 flex items-center justify-between"><div className="flex items-center gap-2"><Button size="icon" variant="outline" onClick={() => change(line.item.id, -1)}><Minus className="h-4 w-4"/></Button><span className="w-8 text-center text-lg font-bold">{line.quantity}</span><Button size="icon" variant="outline" onClick={() => change(line.item.id, 1)}><Plus className="h-4 w-4"/></Button></div><strong>{money(Number(line.item.price) * line.quantity)}</strong></div></div>)}
              <EmployeeCardScanner endpoint="/public/employee-card/verify" value={identifiedCustomer} onVerified={(person) => { setIdentifiedCustomer(person); setCustomerName(person.name); }} />
              {!identifiedCustomer && <Input placeholder="Customer name (optional)" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />}
              {orderType === "dine_in" && <select className="h-11 w-full rounded-md border bg-white px-3" value={tableId} onChange={(e) => setTableId(e.target.value)}><option value="">Select table</option>{tables.map((t) => <option key={String(t.id)} value={String(t.id)}>{t.name ?? `Table ${t.table_number ?? t.id}`}</option>)}</select>}
              <Textarea placeholder="Order notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div className="border-t p-5"><div className="space-y-2 text-sm"><div className="flex justify-between"><span>Subtotal</span><span>{money(subtotal)}</span></div><div className="flex justify-between text-slate-500"><span>Tax (10%)</span><span>{money(tax)}</span></div><div className="flex justify-between text-slate-500"><span>Service (5%)</span><span>{money(serviceCharge)}</span></div><div className="flex justify-between border-t pt-3 text-xl font-black"><span>Total</span><span>{money(total)}</span></div></div><Button className="mt-5 h-14 w-full bg-amber-500 text-lg font-black text-slate-950 hover:bg-amber-400" disabled={submitting || !cart.length} onClick={submit}>{submitting ? "Placing Order..." : "Place Order"}</Button></div>
          </div>
        </aside>
      </div>
    </main>
  );
}
