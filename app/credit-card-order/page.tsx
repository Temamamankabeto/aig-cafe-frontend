"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
const url = (path: string) => `${API_BASE}${path}`;

function money(value: unknown) {
  return Number(value || 0).toFixed(2);
}

function verifyCode(value: string) {
  const raw = value.replace(/[^A-Za-z0-9]/g, "").slice(-10).padStart(10, "0");
  return `AIG-${raw}`;
}

function MiniQr({ value }: { value: string }) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  const cells = Array.from({ length: 81 }, (_, i) => ((hash >> (i % 20)) + i + hash) % 3 === 0);
  const locator = (i: number) => [0, 1, 2, 9, 18, 60, 69, 78, 70, 71, 80].includes(i);
  return <div className="mx-auto grid h-20 w-20 grid-cols-9 gap-px bg-white p-1">{cells.map((on, i) => <span key={i} className={(on || locator(i)) ? "bg-black" : "bg-white"} />)}</div>;
}

function PrintableAigBill({ receipt, cardNumber, validated }: { receipt: any; cardNumber: string; validated: any }) {
  const items = receipt?.items || [];
  const subtotal = items.reduce((sum: number, item: any) => sum + Number(item.line_total || 0), 0);
  const total = Number(receipt?.total || 0);
  const taxAndService = Math.max(0, total - subtotal);
  const dateText = new Date().toLocaleString();
  const reference = verifyCode(`${receipt?.order_number || ""}${receipt?.bill_number || ""}${cardNumber}`);

  return (
    <section id="thermal-receipt" className="mx-auto w-full max-w-sm bg-white text-black print:w-[80mm] print:max-w-[80mm]">
      <style jsx global>{`
        @media print {
          @page { size: 80mm auto; margin: 3mm; }
          html, body { background: white !important; width: 80mm !important; margin: 0 !important; padding: 0 !important; }
          body * { visibility: hidden !important; }
          #thermal-receipt, #thermal-receipt * { visibility: visible !important; }
          #thermal-receipt { position: absolute !important; left: 0 !important; top: 0 !important; width: 74mm !important; max-width: 74mm !important; margin: 0 !important; padding: 0 !important; box-shadow: none !important; border: 0 !important; }
          .receipt-no-print { display: none !important; }
          .receipt-card { border: 0 !important; box-shadow: none !important; border-radius: 0 !important; }
          .receipt-content { padding: 0 !important; font-size: 10px !important; line-height: 1.25 !important; }
          .receipt-title { font-size: 14px !important; }
          .receipt-total { font-size: 12px !important; }
        }
      `}</style>
      <Card className="receipt-card border shadow-sm print:border-0 print:shadow-none">
        <CardContent className="receipt-content space-y-2 p-4 font-mono text-xs">
          <div className="text-center">
            <div className="mx-auto mb-1 flex h-10 w-10 items-center justify-center rounded-full border-2 border-black text-sm font-black">AIG</div>
            <h2 className="receipt-title text-base font-black tracking-wide">AIG CAFETERIA</h2>
            <p>Adama Investment Group</p>
            <p>TIN: __________</p>
            <p className="font-bold">CREDIT ORDER RECEIPT</p>
          </div>

          <div className="border-t border-dashed border-black pt-2">
            <div className="flex justify-between gap-2"><span>Order No</span><strong className="text-right">{receipt?.order_number || "-"}</strong></div>
            <div className="flex justify-between gap-2"><span>Bill No</span><strong className="text-right">{receipt?.bill_number || "-"}</strong></div>
            <div className="flex justify-between gap-2"><span>Date</span><span className="text-right">{dateText}</span></div>
            <div className="flex justify-between gap-2"><span>Payment</span><strong>CREDIT</strong></div>
            <div className="flex justify-between gap-2"><span>Ref</span><strong>{reference}</strong></div>
          </div>

          <div className="border-t border-dashed border-black pt-2">
            <p><strong>Account:</strong> {receipt?.account?.name || validated?.account?.name || "-"}</p>
            <p><strong>User:</strong> {validated?.authorized_user?.full_name || "Account holder"}</p>
            <p><strong>Card:</strong> {cardNumber}</p>
          </div>

          <div className="border-t border-dashed border-black pt-2">
            <div className="grid grid-cols-[1fr_24px_48px_54px] gap-1 font-bold">
              <span>ITEM</span><span className="text-right">Q</span><span className="text-right">PRICE</span><span className="text-right">TOTAL</span>
            </div>
            {items.map((item: any, index: number) => (
              <div key={index} className="grid grid-cols-[1fr_24px_48px_54px] gap-1">
                <span className="truncate">{item.name}</span>
                <span className="text-right">{Number(item.quantity || 0)}</span>
                <span className="text-right">{money(item.unit_price)}</span>
                <span className="text-right">{money(item.line_total)}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed border-black pt-2">
            <div className="flex justify-between"><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
            <div className="flex justify-between"><span>Tax/Service</span><strong>{money(taxAndService)}</strong></div>
            <div className="receipt-total flex justify-between border-t border-black pt-1 text-sm font-black"><span>TOTAL</span><strong>{money(total)} ETB</strong></div>
            <div className="flex justify-between"><span>Remaining Credit</span><strong>{money(receipt?.account?.remaining_limit)}</strong></div>
          </div>

          <div className="border-t border-dashed border-black pt-2">
            <p className="font-bold">Tickets</p>
            {receipt?.tickets?.length ? receipt.tickets.map((ticket: any, index: number) => (
              <p key={index}>{ticket.ticket_number || `TICKET-${index + 1}`} / {ticket.station || "station"} / {ticket.item_name || "item"}</p>
            )) : <p>-</p>}
          </div>

          <div className="border-t border-dashed border-black pt-2 text-center">
            <p><strong>Estimated Preparation:</strong> {receipt?.preparation_estimate_minutes || 15} minutes</p>
            <MiniQr value={reference} />
            <p className="font-bold">{reference}</p>
            <p className="mt-1">Thank you!</p>
            <p>AIG Cafeteria POS System</p>
          </div>

          <div className="receipt-no-print flex justify-center gap-2 pt-3">
            <Button onClick={() => window.print()}>Print bill</Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

export default function CreditCardOrderPage() {
  const [cardNumber, setCardNumber] = useState("");
  const [message, setMessage] = useState("");
  const [validated, setValidated] = useState<any>(null);
  const [menu, setMenu] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [receipt, setReceipt] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const total = cart.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0);
  const grandTotal = total; // Menu prices already include 15% VAT
  const dailyRemaining = Number(validated?.daily_remaining ?? 0);
  const hasDailyLimit = validated?.daily_remaining !== null && validated?.daily_remaining !== undefined && Number.isFinite(dailyRemaining) && dailyRemaining >= 0;
  const exceedsDailyLimit = Boolean(validated) && hasDailyLimit && grandTotal > dailyRemaining;

  async function validateCard() {
    if (!cardNumber.trim()) return toast.error("Enter card number first");
    setLoading(true);
    setMessage("Checking card...");
    setReceipt(null);
    try {
      const res = await fetch(url("/api/public/credit-card/validate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card_number: cardNumber.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setValidated(null);
        setMessage(data.message || "Card validation failed");
        return;
      }
      setValidated(data.data);
      setMessage(`Monthly available credit: ${Number(data.data.available_limit || 0).toFixed(2)}`);
      const menuRes = await fetch(url("/api/public/credit-card/menu"));
      const menuData = await menuRes.json();
      setMenu(Array.isArray(menuData.data) ? menuData.data : []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Card validation failed");
    } finally {
      setLoading(false);
    }
  }

  function addItem(item: any) {
    setCart((current) => {
      const old = current.find((x) => String(x.id) === String(item.id));
      if (old) return current.map((x) => String(x.id) === String(item.id) ? { ...x, quantity: x.quantity + 1 } : x);
      return [...current, { ...item, quantity: 1 }];
    });
  }

  async function submitOrder() {
    if (!validated) return toast.error("Validate card first");
    if (!cart.length) return toast.error("Add menu items first");
    if (grandTotal > Number(validated.available_limit || 0)) return toast.error("Monthly credit limit exceeded");
    if (exceedsDailyLimit) {
      const confirmed = window.confirm(`This order exceeds the optional daily limit. Daily remaining is ${dailyRemaining.toFixed(2)} ETB, but this order total is ${grandTotal.toFixed(2)} ETB. Continue and deduct from monthly limit?`);
      if (!confirmed) return;
    }
    setLoading(true);
    try {
      const res = await fetch(url("/api/public/credit-card/orders"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          card_number: cardNumber.trim(),
          items: cart.map((item) => ({ menu_item_id: item.id, quantity: item.quantity })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) return toast.error(data.message || "Order failed");
      setReceipt(data.data);
      setCart([]);
      setTimeout(() => window.print(), 400);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Order failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-muted/30 p-4 md:p-6 print:bg-white print:p-0">
      <div className="mx-auto max-w-6xl space-y-6 print:m-0 print:max-w-none print:space-y-0">
        <div className="print:hidden">
          <Button variant="outline" asChild className="mb-3"><Link href="/login">Back to login</Link></Button>
          <h1 className="text-3xl font-bold">Credit Card Self-Order Kiosk</h1>
          <p className="text-muted-foreground">Validate card first, then select menu items and submit credit order.</p>
        </div>

        <Card className="print:hidden">
          <CardHeader><CardTitle>1. Validate card</CardTitle><CardDescription>Card must be active and have monthly available credit.</CardDescription></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-[1fr_auto]">
            <Input value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") validateCard(); }} placeholder="Scan or enter card number" />
            <Button onClick={validateCard} disabled={loading}>{loading ? "Please wait..." : "Validate"}</Button>
            {message && <p className="md:col-span-2 text-sm text-muted-foreground">{message}</p>}
            {validated && hasDailyLimit && <p className="md:col-span-2 text-sm text-muted-foreground">Optional daily remaining: {dailyRemaining.toFixed(2)} ETB</p>}
          </CardContent>
        </Card>

        {validated && <div className="grid gap-6 lg:grid-cols-[1fr_360px] print:hidden">
          <Card>
            <CardHeader><CardTitle>2. Menu</CardTitle><CardDescription>Choose items to order.</CardDescription></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {menu.map((item) => <Card key={item.id} className="overflow-hidden">
                <div className="h-36 bg-muted">{item.image_url ? <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-muted-foreground">No image</div>}</div>
                <CardHeader className="pb-2"><CardTitle className="text-base">{item.name}</CardTitle><CardDescription>{Number(item.price || 0).toFixed(2)} ETB</CardDescription></CardHeader>
                <CardContent><Button size="sm" onClick={() => addItem(item)}>Add to cart</Button></CardContent>
              </Card>)}
            </CardContent>
          </Card>

          <Card className="h-fit">
            <CardHeader><CardTitle>Cart</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {!cart.length && <p className="text-muted-foreground">No items selected.</p>}
              {cart.map((item) => <div key={item.id} className="flex justify-between rounded border p-2"><span>{item.name} x {item.quantity}</span><strong>{(Number(item.price || 0) * item.quantity).toFixed(2)}</strong></div>)}
              <div className="rounded bg-muted p-3"><div className="flex justify-between"><span>Total (VAT included)</span><strong>{grandTotal.toFixed(2)}</strong></div><div className="flex justify-between"><span>Monthly available</span><strong>{Number(validated.available_limit || 0).toFixed(2)}</strong></div>{hasDailyLimit && <div className="flex justify-between"><span>Optional daily remaining</span><strong>{dailyRemaining.toFixed(2)}</strong></div>}</div>
              {exceedsDailyLimit && <p className="text-sm text-amber-700">This order is above the optional daily limit. You can continue only after confirming.</p>}
              <Button className="w-full" onClick={submitOrder} disabled={loading || !cart.length || grandTotal > Number(validated.available_limit || 0)}>Submit credit order</Button>
            </CardContent>
          </Card>
        </div>}

        {receipt && <PrintableAigBill receipt={receipt} cardNumber={cardNumber} validated={validated} />}
      </div>
    </main>
  );
}
