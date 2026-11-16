"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChefHat, Clock3, ClipboardList, ImageOff, RefreshCw, UtensilsCrossed } from "lucide-react";

const rawBase = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "https://api.aigcafe.com/api";
const apiBase = rawBase.replace(/\/+$/, "").endsWith("/api") ? rawBase.replace(/\/+$/, "") : `${rawBase.replace(/\/+$/, "")}/api`;

type OrderItem = { name: string; quantity: number; image_url: string | null; status: string };
type OrderRow = { order_number: string; status: string; items: OrderItem[]; ordered_at: string | null };
type BoardResponse = { success: boolean; message: string; data: OrderRow[]; meta: { refreshed_at: string; refresh_seconds: number } };

const statusLabels: Record<string, string> = {
  pending: "Confirmed", confirmed: "Confirmed", in_progress: "Preparing", preparing: "Preparing", ready: "Ready for pickup",
  served: "Served", out_for_delivery: "Out for delivery", delivered: "Delivered", completed: "Completed",
};
const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-950", confirmed: "bg-amber-100 text-amber-950",
  in_progress: "bg-amber-100 text-amber-950", ready: "bg-orange-100 text-orange-950",
  served: "bg-stone-100 text-stone-900", out_for_delivery: "bg-indigo-100 text-indigo-950",
  delivered: "bg-slate-100 text-slate-800", completed: "bg-slate-100 text-slate-800",
};

async function fetchBoard(signal?: AbortSignal): Promise<BoardResponse> {
  const response = await fetch(`${apiBase}/public/order-status-board`, {
    method: "GET", cache: "no-store", signal, headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Unable to load order status (${response.status}).`);
  const payload: BoardResponse = await response.json();
  if (!payload.success || !Array.isArray(payload.data)) throw new Error("Invalid order status response.");
  return payload;
}

// Keep image URLs supplied by the API; do not substitute unrelated stock photos.
function MenuPhoto({ item, className = "" }: { item: OrderItem; className?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [item.image_url]);
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br from-amber-50 via-stone-100 to-orange-50 ${className}`}>
      {item.image_url && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.image_url} alt={item.name} loading="lazy" onError={() => setFailed(true)} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-2 text-center text-amber-900/60">
          <ImageOff className="h-6 w-6" aria-hidden="true" />
          <span className="line-clamp-2 text-[10px] font-semibold sm:text-xs">{item.name}</span>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 via-slate-950/65 to-transparent px-2 pb-2 pt-7 text-white">
        <p className="line-clamp-2 text-[11px] font-bold leading-tight sm:text-xs">{item.name}</p>
        <span className="mt-0.5 inline-block rounded-full bg-amber-300 px-2 py-0.5 text-[11px] font-extrabold text-emerald-950">× {item.quantity}</span>
      </div>
    </div>
  );
}

function OrderPreview({ order }: { order: OrderRow }) {
  const items = order.items;
  return (
    <div className="relative mx-auto w-full max-w-[560px] overflow-hidden rounded-[22px] border border-amber-100 bg-[#f5eee5] p-2 shadow-[0_8px_22px_rgba(91,54,28,0.13)] sm:p-3" aria-label={`Combined menu preview for ${order.order_number}`}>
      <div className="pointer-events-none absolute -right-12 -top-20 h-48 w-48 rounded-full bg-amber-300/25 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-12 h-48 w-48 rounded-full bg-orange-300/25 blur-2xl" />
      {items.length ? (
        <div className={`relative grid gap-1.5 overflow-hidden rounded-2xl bg-white/80 p-1.5 sm:gap-2 sm:p-2 ${items.length === 1 ? "grid-cols-1" : items.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
          {items.map((item, index) => (
            <MenuPhoto key={`${index}-${item.name}`} item={item} className={`min-h-[112px] rounded-xl shadow-sm sm:min-h-[140px] ${items.length === 1 ? "h-[190px] sm:h-[220px]" : "h-[145px] sm:h-[175px]"}`} />
          ))}
        </div>
      ) : <div className="flex min-h-36 items-center justify-center gap-2 text-amber-900"><UtensilsCrossed aria-hidden="true" /> No menu items</div>}
    </div>
  );
}


function OrderRows({ orders }: { orders: OrderRow[] }) {
  return (
    <table className="w-full min-w-[900px] table-fixed border-separate border-spacing-0 text-left">
      <colgroup><col style={{ width: "22%" }} /><col style={{ width: "27%" }} /><col style={{ width: "36%" }} /><col style={{ width: "15%" }} /></colgroup>
      <tbody className="divide-y divide-amber-50">
                {orders.map(order => (
                  <tr key={order.order_number} className="align-middle">
                    <td className="w-[22%] px-4 py-5 sm:px-5">
                      <div className="flex min-h-[170px] flex-col items-center justify-center gap-4 rounded-2xl bg-gradient-to-br from-[#fff8ed] to-[#f4e1cd] px-3 py-5 text-center">
                        <ClipboardList className="h-8 w-8 text-[#a35d37]" aria-hidden="true" />
                        <strong className="break-all text-lg font-extrabold tracking-tight text-[#38241b] sm:text-xl">{order.order_number}</strong>
                      </div>
                    </td>
                    <td className="w-[27%] px-3 py-5 sm:px-5"><div className="space-y-2">
                      {order.items.map((item, index) => <div key={`${index}-${item.name}`} className="flex items-center justify-between gap-2 rounded-2xl bg-[#faf1e7] px-3 py-3 text-[#3d2a21]">
                        <div className="flex min-w-0 items-center gap-2"><UtensilsCrossed className="h-5 w-5 shrink-0 text-[#a35d37]" aria-hidden="true" /><span className="break-words text-sm font-bold sm:text-base">{item.name}</span></div>
                        <span className="shrink-0 rounded-xl bg-amber-200 px-3 py-1 text-sm font-extrabold text-emerald-950">× {item.quantity}</span>
                      </div>)}
                      {order.items.length === 0 && <span className="text-slate-500">No menu items</span>}
                    </div></td>
                    <td className="w-[36%] px-3 py-4 sm:px-5"><OrderPreview order={order} /></td>
                    <td className="w-[15%] px-3 py-5 sm:px-5"><div className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-base font-extrabold shadow-sm sm:text-lg ${statusColors[order.status] ?? "bg-slate-100 text-slate-800"}`}>
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#a35d37] text-white"><Check className="h-4 w-4" aria-hidden="true" /></span>
                      <span className="whitespace-nowrap">{statusLabels[order.status] ?? order.status.replaceAll("_", " ")}</span>
                    </div></td>
                  </tr>
                ))}
      </tbody>
    </table>
  );
}

export default function PublicOrderStatusPage() {
  const [clock, setClock] = useState("");
  const { data, isPending, error, isFetching } = useQuery({
    queryKey: ["public", "order-status-board"], queryFn: ({ signal }) => fetchBoard(signal),
    refetchInterval: 5000, refetchIntervalInBackground: true, staleTime: 4000, retry: 2,
  });
  useEffect(() => {
    const update = () => setClock(new Date().toLocaleTimeString());
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);
  // Defense in depth: hide terminal orders even if an older API returns them.
  // Backend remains the source of truth for live order statuses.
  const hiddenStatuses = new Set(["served", "completed", "delivered", "cancelled", "canceled", "void", "voided"]);
  const rows = (data?.data ?? []).filter((order) => !hiddenStatuses.has(order.status.toLowerCase()));
  const priorityOrders = rows.filter((order) => ["in_progress", "preparing", "ready"].includes(order.status.toLowerCase()));
  const movingOrders = rows.filter((order) => !["in_progress", "preparing", "ready"].includes(order.status.toLowerCase()));

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#fffaf3] to-[#f5eee5] px-2 py-3 text-slate-900 sm:px-4 sm:py-5 lg:px-6">
      <div className="mx-auto max-w-[1900px] space-y-4">
        <header className="relative isolate overflow-hidden rounded-[24px] bg-gradient-to-r from-[#2b1b16] via-[#633b28] to-[#3b251e] px-5 py-5 text-white shadow-[0_10px_28px_rgba(65,35,22,0.18)] sm:px-8 sm:py-6">
          <div className="pointer-events-none absolute -right-16 -top-36 h-72 w-72 rounded-full bg-amber-300/20 blur-3xl" />
          <div className="pointer-events-none absolute bottom-[-100px] left-1/2 h-48 w-96 rounded-full bg-orange-400/20 blur-3xl" />
          <div className="relative flex flex-wrap items-center justify-between gap-5">
            <div className="flex flex-wrap items-center gap-4 sm:gap-7">
              <div className="flex items-center gap-3 border-white/20 sm:border-r sm:pr-7">
                <ChefHat className="h-10 w-10 text-amber-200" aria-hidden="true" />
                <p className="whitespace-nowrap text-lg font-extrabold tracking-tight sm:text-2xl">AIG <span className="text-orange-300">ENTERPOS</span></p>
              </div>
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight sm:text-4xl">Live Order Status</h1>
                <p className="mt-1 text-sm text-amber-50/85 sm:text-base">Follow your order from preparation to pickup or service.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 sm:gap-5">
              <div className="text-right">
                <p className="flex items-center justify-end gap-2 text-lg font-extrabold tabular-nums sm:text-2xl"><Clock3 className="h-5 w-5" aria-hidden="true" />{clock}</p>
                <p className="mt-1 flex items-center justify-end gap-2 text-xs text-amber-100"><span className="h-2 w-2 rounded-full bg-amber-300" /> Auto-refresh every 5 seconds</p>
              </div>
              <div aria-label="Automatic updates enabled" className="rounded-2xl bg-amber-700/50 p-3"><RefreshCw className={`h-6 w-6 ${isFetching ? "animate-spin" : ""}`} aria-hidden="true" /></div>
            </div>
          </div>
        </header>
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error instanceof Error ? error.message : "Could not load orders."} The board will retry automatically.</div>}
        <section aria-label="Live orders" className="overflow-hidden rounded-[26px] border border-amber-100 bg-white p-2 shadow-[0_14px_35px_rgba(73,45,28,0.12)] sm:p-3">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] table-fixed border-separate border-spacing-0 text-left">
              <colgroup><col style={{ width: "22%" }} /><col style={{ width: "27%" }} /><col style={{ width: "36%" }} /><col style={{ width: "15%" }} /></colgroup>
              <thead className="bg-gradient-to-r from-[#8a4c2f] via-[#70402d] to-[#4a2d23] text-white">
                <tr>
                  <th scope="col" className="rounded-l-xl px-5 py-5 text-base font-extrabold uppercase tracking-wide"><span className="flex items-center gap-3"><ClipboardList className="h-5 w-5" aria-hidden="true" />Order Number</span></th>
                  <th scope="col" className="px-5 py-5 text-base font-extrabold uppercase tracking-wide"><span className="flex items-center gap-3"><UtensilsCrossed className="h-5 w-5" aria-hidden="true" />Menu Items</span></th>
                  <th scope="col" className="px-5 py-5 text-base font-extrabold uppercase tracking-wide">Order Preview</th>
                  <th scope="col" className="rounded-r-xl px-5 py-5 text-base font-extrabold uppercase tracking-wide">Status</th>
                </tr>
              </thead>
            </table>
            {priorityOrders.length > 0 && (
              <div aria-label="Preparing and ready orders stay visible" className="relative z-10 bg-white shadow-[0_12px_22px_rgba(65,35,22,0.12)]">
                <OrderRows orders={priorityOrders} />
              </div>
            )}
            {movingOrders.length > 0 && (
              <div className="relative overflow-hidden rounded-b-2xl bg-gradient-to-b from-[#fffaf3] via-white to-[#f9f0e6] shadow-inner">
                <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-gradient-to-b from-[#8b6245]/20 to-transparent" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-12 bg-gradient-to-t from-[#f9f0e6] to-transparent" />
                <div className="enterpos-scroll-area max-h-[62vh] min-h-[210px] overflow-y-auto" aria-label="Other active orders, automatically scrolling upward">
                  <div className={movingOrders.length > 1 ? "enterpos-moving-track" : ""}>
                    <OrderRows orders={movingOrders} />
                    {movingOrders.length > 1 && <div aria-hidden="true"><OrderRows orders={movingOrders} /></div>}
                  </div>
                </div>
              </div>
            )}
            {!isPending && rows.length === 0 && <p className="px-6 py-20 text-center text-lg font-medium text-slate-500">No confirmed orders to display yet.</p>}
            {isPending && <p className="px-6 py-20 text-center text-lg font-medium text-slate-500">Loading order statuses...</p>}
          </div>
        </section>
        <style jsx global>{`
          @keyframes enterpos-rise { from { transform: translateY(0); } to { transform: translateY(-50%); } }
          .enterpos-moving-track { animation: enterpos-rise 36s linear infinite; will-change: transform; }
          .enterpos-scroll-area:hover .enterpos-moving-track,
          .enterpos-scroll-area:focus-within .enterpos-moving-track { animation-play-state: paused; }
          @media (prefers-reduced-motion: reduce) { .enterpos-moving-track { animation: none; } }
        `}</style>
      </div>
    </main>
  );
}
