"use client";

import { useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ReportRow = { item: string; order_type: string; payment_status: string; payment_type: string; qty: number; unit_price: number; item_status: string; total: number };
type Report = { waiter_name: string; rows: ReportRow[]; grand_total: number };
const currency = (value: number) => `${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`;
export default function MyWaiterOrdersPage() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [orderType, setOrderType] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [paymentType, setPaymentType] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function load(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError(""); setReport(null);
    try {
      const response = await api.post("/public/waiter-orders/report", { phone: phone.trim(), password, from: from || undefined, to: to || undefined, order_type: orderType || undefined, payment_status: paymentStatus || undefined, payment_type: paymentType || undefined });
      setReport(response.data.data);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err.response?.data?.message || "Unable to load report.");
    } finally { setLoading(false); }
  }
  return <main className="min-h-screen bg-slate-50 p-4 md:p-8"><div className="mx-auto max-w-7xl"><header className="mb-6 flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-bold">My Orders Report</h1><Link className="text-blue-700 underline" href="/waiter-order">Back to Waiter Ordering</Link></header>
    <form onSubmit={load} className="mb-5 grid gap-3 rounded-lg border bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-sm">Registered phone<Input required inputMode="tel" autoComplete="off" value={phone} onChange={e=>setPhone(e.target.value)} /></label>
      <label className="text-sm">Password<Input required type="password" autoComplete="off" value={password} onChange={e=>setPassword(e.target.value)} /></label>
      <label className="text-sm">From date<Input type="date" value={from} onChange={e=>setFrom(e.target.value)} /></label>
      <label className="text-sm">To date<Input type="date" min={from || undefined} value={to} onChange={e=>setTo(e.target.value)} /></label>
      <label className="text-sm">Order type<select className="block h-10 w-full rounded-md border px-2" value={orderType} onChange={e=>setOrderType(e.target.value)}><option value="">All</option><option value="dine_in">Dine In</option><option value="takeaway">Takeaway</option><option value="delivery">Delivery</option></select></label>
      <label className="text-sm">Payment status<select className="block h-10 w-full rounded-md border px-2" value={paymentStatus} onChange={e=>setPaymentStatus(e.target.value)}><option value="">All</option><option value="paid">Paid</option><option value="unpaid">Unpaid</option><option value="credit_pending">Credit Pending</option><option value="partial">Partial</option></select></label>
      <label className="text-sm">Payment type<select className="block h-10 w-full rounded-md border px-2" value={paymentType} onChange={e=>setPaymentType(e.target.value)}><option value="">All</option><option value="cash">Cash</option><option value="credit">Credit</option><option value="regular">Regular</option></select></label>
      <div className="flex items-end gap-2"><Button type="submit" disabled={loading}>{loading ? "Loading..." : "See Your Report"}</Button><Button type="button" variant="outline" onClick={()=>{setReport(null);setPassword("");}}>Clear session</Button></div>
    </form>
    {error && <p role="alert" className="mb-4 text-red-700">{error}</p>}
    {report && <section aria-label="Filtered waiter orders"><p className="mb-3 font-medium">Waiter: {report.waiter_name}</p><div className="overflow-x-auto rounded-lg border bg-white"><table className="w-full min-w-[800px] text-left text-sm"><thead className="bg-slate-100"><tr>{["Item", "Order type", "Payment status", "Qty", "Unit price", "Item status", "Total"].map(column=><th key={column} scope="col" className="px-4 py-3">{column}</th>)}</tr></thead><tbody>{report.rows.map((row,index)=><tr key={index} className="border-t"><td className="px-4 py-3">{row.item}</td><td className="px-4 py-3">{row.order_type}</td><td className="px-4 py-3">{row.payment_status}</td><td className="px-4 py-3">{row.qty}</td><td className="px-4 py-3">{currency(row.unit_price)}</td><td className="px-4 py-3">{row.item_status}</td><td className="px-4 py-3">{currency(row.total)}</td></tr>)}{report.rows.length===0 && <tr><td colSpan={7} className="px-4 py-8 text-center">No matching orders.</td></tr>}</tbody><tfoot><tr className="border-t bg-slate-100 font-bold"><td colSpan={6} className="px-4 py-4 text-right">Grand Total (ETB)</td><td className="px-4 py-4">{currency(report.grand_total)}</td></tr></tfoot></table></div></section>}
  </div></main>;
}
