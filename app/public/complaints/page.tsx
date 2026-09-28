"use client";

import { FormEvent, ReactNode, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, MessageSquareWarning } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

const categories = ["Food Quality", "Service", "Billing", "Order", "Cleanliness", "Other"];

export default function PublicComplaintPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [complaintNo, setComplaintNo] = useState<string | null>(null);
  const [form, setForm] = useState({ customer_name: "", customer_phone: "", order_number: "", category: "", subject: "", description: "" });

  const setField = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const response = await api.post("/public/complaints", form);
      const number = response.data?.data?.complaint_no;
      setComplaintNo(number ?? "Submitted");
      toast.success("Complaint submitted successfully");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Unable to submit complaint. Please check the information and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (complaintNo) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[#041a38] px-4 py-10 text-white">
        <section className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#071f42] p-8 text-center shadow-2xl">
          <CheckCircle2 className="mx-auto h-14 w-14 text-[#f4be4b]" />
          <h1 className="mt-5 text-2xl font-bold">Complaint Submitted</h1>
          <p className="mt-2 text-slate-300">Your complaint number is</p>
          <p className="mt-3 text-2xl font-extrabold tracking-wide text-[#f4be4b]">{complaintNo}</p>
          <p className="mt-3 text-sm text-slate-400">Please keep this number for reference.</p>
          <button type="button" onClick={() => router.push("/login")} className="mt-7 h-12 w-full rounded-xl bg-[#f4be4b] font-bold text-[#041a38]">Back to Login</button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-[#041a38] px-4 py-8 text-white sm:py-12">
      <section className="mx-auto w-full max-w-2xl rounded-3xl border border-white/10 bg-[#071f42] p-5 shadow-2xl sm:p-8">
        <button type="button" onClick={() => router.push("/login")} className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-[#f4be4b]"><ArrowLeft className="h-4 w-4" /> Back to Login</button>
        <div className="mb-7 flex items-start gap-4">
          <div className="rounded-2xl bg-[#f4be4b]/10 p-3"><MessageSquareWarning className="h-7 w-7 text-[#f4be4b]" /></div>
          <div><h1 className="text-2xl font-bold sm:text-3xl">Public Complaint</h1><p className="mt-1 text-sm text-slate-300">Submit a complaint without signing in. Fields marked * are required.</p></div>
        </div>
        <form onSubmit={submit} className="grid gap-5 sm:grid-cols-2">
          <Field label="Your Name *"><input required value={form.customer_name} onChange={(e) => setField("customer_name", e.target.value)} className="field" /></Field>
          <Field label="Phone Number *"><input required value={form.customer_phone} onChange={(e) => setField("customer_phone", e.target.value)} className="field" /></Field>
          <Field label="Order Number"><input value={form.order_number} onChange={(e) => setField("order_number", e.target.value)} placeholder="e.g. AIG-20260928-0012" className="field" /></Field>
          <Field label="Category *"><select required value={form.category} onChange={(e) => setField("category", e.target.value)} className="field"><option value="">Select category</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></Field>
          <div className="sm:col-span-2"><Field label="Subject *"><input required maxLength={180} value={form.subject} onChange={(e) => setField("subject", e.target.value)} className="field" /></Field></div>
          <div className="sm:col-span-2"><Field label="Complaint Details *"><textarea required maxLength={5000} rows={5} value={form.description} onChange={(e) => setField("description", e.target.value)} className="field min-h-32 resize-y" /></Field></div>
          <div className="sm:col-span-2"><button disabled={submitting} type="submit" className="h-12 w-full rounded-xl bg-[#f4be4b] px-5 font-bold text-[#041a38] transition hover:bg-[#ffd166] disabled:cursor-wait disabled:opacity-60">{submitting ? "Submitting…" : "Submit Complaint"}</button></div>
        </form>
      </section>
      <style jsx>{` .field { width: 100%; min-height: 3rem; border-radius: .75rem; border: 1px solid rgba(255,255,255,.15); background: #041a38; padding: .75rem 1rem; color: white; outline: none; } .field:focus { border-color: #f4be4b; box-shadow: 0 0 0 2px rgba(244,190,75,.15); } select.field option { background: #041a38; } `}</style>
    </main>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-200">{label}</span>{children}</label>;
}
