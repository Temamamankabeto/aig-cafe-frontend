"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { complaintService } from "@/services/complaint-management/complaint.service";
import { orderService } from "@/services/order-management/order.service";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Plus, RefreshCw } from "lucide-react";

const categories = ["Food Quality", "Service Delay", "Staff Behavior", "Wrong Order", "Missing Item", "Billing / Payment", "Cleanliness", "Table / Facility", "Delivery / Takeaway", "Product Quality", "Safety", "Other"];
const emptyForm = { order_id: "none", category: "Food Quality", subject: "", description: "", priority: "medium" };

function dateTime(value: any) { return value ? new Date(value).toLocaleString() : "—"; }
function statusText(value: any) { return String(value ?? "new").replaceAll("_", " "); }

export default function CustomerComplaintsPage() {
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const orderFromUrl = params.get("order_id");
  const [createOpen, setCreateOpen] = useState(Boolean(orderFromUrl));
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm, order_id: orderFromUrl || "none" });
  const [reopenNote, setReopenNote] = useState("");
  const [message, setMessage] = useState("");

  const complaints = useQuery({ queryKey: ["customer-complaints"], queryFn: () => complaintService.list({ per_page: 100 }) });
  const summary = useQuery({ queryKey: ["customer-complaints-summary"], queryFn: () => complaintService.summary() });
  const ordersQuery = useQuery({ queryKey: ["customer-orders-for-complaint"], queryFn: () => orderService.myAuthorizedCreditOrders({ per_page: 100 }) });
  const detail = useQuery({ queryKey: ["customer-complaint", selectedId], queryFn: () => complaintService.one(selectedId!), enabled: Boolean(selectedId) });

  const rows: any[] = complaints.data?.data?.data ?? complaints.data?.data ?? [];
  const orders: any[] = ordersQuery.data?.data ?? [];
  const counts: any = summary.data ?? {};

  const createComplaint = useMutation({
    mutationFn: () => complaintService.create({ ...form, order_id: form.order_id === "none" ? null : Number(form.order_id) }),
    onSuccess: () => { setCreateOpen(false); setForm(emptyForm); setMessage("Complaint submitted successfully."); queryClient.invalidateQueries({ queryKey: ["customer-complaints"] }); queryClient.invalidateQueries({ queryKey: ["customer-complaints-summary"] }); },
    onError: (e: any) => setMessage(e?.response?.data?.message ?? "Unable to submit complaint."),
  });

  const reopen = useMutation({
    mutationFn: () => complaintService.status(selectedId!, { status: "reopened", note: reopenNote || "Customer requested the complaint to be reopened." }),
    onSuccess: () => { setReopenNote(""); queryClient.invalidateQueries({ queryKey: ["customer-complaint", selectedId] }); queryClient.invalidateQueries({ queryKey: ["customer-complaints"] }); queryClient.invalidateQueries({ queryKey: ["customer-complaints-summary"] }); },
  });

  const selected: any = detail.data;
  const canReopen = selected && ["resolved", "closed"].includes(selected.status);
  const orderLabel = useMemo(() => (id: any) => orders.find(o => String(o.id) === String(id))?.order_number ?? `#${id}`, [orders]);

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-bold">My Complaints</h1><p className="text-muted-foreground">Report a problem and follow its resolution.</p></div>
      <Button onClick={() => { setMessage(""); setCreateOpen(true); }}><Plus className="mr-2 h-4 w-4"/>New Complaint</Button>
    </div>
    {message && <div className="rounded-md border px-4 py-3 text-sm">{message}</div>}

    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{counts.total ?? 0}</CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">New</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{counts.new ?? 0}</CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">In Progress</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{(counts.acknowledged ?? 0)+(counts.assigned ?? 0)+(counts.in_progress ?? 0)+(counts.reopened ?? 0)}</CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Resolved / Closed</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{(counts.resolved ?? 0)+(counts.closed ?? 0)}</CardContent></Card>
    </div>

    <Card><CardContent className="pt-6"><div className="overflow-x-auto"><Table>
      <TableHeader><TableRow><TableHead>Complaint No.</TableHead><TableHead>Date</TableHead><TableHead>Category</TableHead><TableHead>Related Order</TableHead><TableHead>Priority</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
      <TableBody>{rows.map((c:any)=><TableRow key={c.id}><TableCell className="font-medium">{c.complaint_no}</TableCell><TableCell>{dateTime(c.created_at)}</TableCell><TableCell>{c.category}</TableCell><TableCell>{c.order?.order_number ?? "—"}</TableCell><TableCell className="capitalize">{c.priority}</TableCell><TableCell><Badge variant="outline" className="capitalize">{statusText(c.status)}</Badge></TableCell><TableCell className="text-right"><Button size="sm" variant="outline" onClick={()=>setSelectedId(c.id)}>View</Button></TableCell></TableRow>)}
      {!complaints.isLoading && !rows.length && <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">You have not submitted any complaints.</TableCell></TableRow>}</TableBody>
    </Table></div></CardContent></Card>

    <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>New Complaint</DialogTitle></DialogHeader><div className="space-y-4">
      <div className="space-y-2"><Label>Related Order (optional)</Label><Select value={form.order_id} onValueChange={v=>setForm({...form,order_id:v})}><SelectTrigger><SelectValue placeholder="Select your order"/></SelectTrigger><SelectContent><SelectItem value="none">No related order</SelectItem>{orders.map((o:any)=><SelectItem key={o.id} value={String(o.id)}>{o.order_number ?? `#${o.id}`} — {dateTime(o.ordered_at ?? o.created_at)}</SelectItem>)}</SelectContent></Select></div>
      <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Category</Label><Select value={form.category} onValueChange={v=>setForm({...form,category:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{categories.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Priority</Label><Select value={form.priority} onValueChange={v=>setForm({...form,priority:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem></SelectContent></Select></div></div>
      <div className="space-y-2"><Label>Subject</Label><Input value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})} placeholder="Short summary of the problem"/></div>
      <div className="space-y-2"><Label>Description</Label><Textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} rows={5} placeholder="Explain what happened and what you expected."/></div>
      <Button className="w-full" disabled={!form.subject.trim() || !form.description.trim() || createComplaint.isPending} onClick={()=>createComplaint.mutate()}>{createComplaint.isPending ? "Submitting..." : "Submit Complaint"}</Button>
    </div></DialogContent></Dialog>

    <Dialog open={Boolean(selectedId)} onOpenChange={o=>!o&&setSelectedId(null)}><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>{selected?.complaint_no ?? "Complaint Details"}</DialogTitle></DialogHeader>{selected && <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2"><div><span className="text-sm text-muted-foreground">Category</span><div className="font-medium">{selected.category}</div></div><div><span className="text-sm text-muted-foreground">Status</span><div><Badge variant="outline" className="capitalize">{statusText(selected.status)}</Badge></div></div><div><span className="text-sm text-muted-foreground">Related order</span><div className="font-medium">{selected.order?.order_number ?? (selected.order_id ? orderLabel(selected.order_id) : "—")}</div></div><div><span className="text-sm text-muted-foreground">Submitted</span><div className="font-medium">{dateTime(selected.created_at)}</div></div></div>
      <div><div className="font-semibold">{selected.subject}</div><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{selected.description}</p></div>
      {selected.resolution && <div className="rounded-md border p-4"><div className="font-semibold">Resolution</div><p className="mt-1 whitespace-pre-wrap text-sm">{selected.resolution}</p></div>}
      <div><div className="mb-2 font-semibold">Activity</div><div className="space-y-2">{(selected.activities ?? []).map((a:any)=><div key={a.id} className="rounded-md border p-3 text-sm"><div className="flex justify-between gap-3"><span className="font-medium capitalize">{statusText(a.meta?.status ?? a.action)}</span><span className="text-muted-foreground">{dateTime(a.created_at)}</span></div>{a.note && <div className="mt-1 text-muted-foreground">{a.note}</div>}</div>)}</div></div>
      {canReopen && <div className="space-y-2 border-t pt-4"><Label>Still not resolved?</Label><Textarea value={reopenNote} onChange={e=>setReopenNote(e.target.value)} placeholder="Tell the manager why this needs to be reopened."/><Button variant="outline" disabled={reopen.isPending} onClick={()=>reopen.mutate()}><RefreshCw className="mr-2 h-4 w-4"/>Reopen Complaint</Button></div>}
    </div>}</DialogContent></Dialog>
  </div>;
}
