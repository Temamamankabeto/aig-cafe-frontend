"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api, { unwrap } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Refund = { id:number; amount:number|string; reason:string; status:string; requested_at?:string; decision_note?:string; proof_url?:string; order?:{order_number?:string; customer_name?:string}; payment?:{id:number; method?:string; receiver?:{name?:string}}; requester?:{name?:string} };
type Envelope = { data: Refund[]; meta?: { current_page?:number; last_page?:number; total?:number } };

export function RefundManagementPage() {
  const qc = useQueryClient();
  const [status,setStatus]=useState("all"), [search,setSearch]=useState(""), [from,setFrom]=useState(""), [to,setTo]=useState("");
  const [selected,setSelected]=useState<Refund|null>(null), [action,setAction]=useState<"reject"|"process"|null>(null);
  const [note,setNote]=useState(""), [method,setMethod]=useState("cash"), [reference,setReference]=useState(""), [proof,setProof]=useState<File|null>(null);
  const query=useQuery({queryKey:["finance","refunds",status,search,from,to],queryFn:async()=>unwrap<Envelope>(await api.get("/finance/refund-requests",{params:{status:status==="all"?undefined:status,search:search||undefined,date_from:from||undefined,date_to:to||undefined,per_page:100}}))});
  const mutate=useMutation({mutationFn:async({row,kind}:{row:Refund;kind:"approve"|"reject"|"process"})=>{
    if(kind==="process"){const form=new FormData();form.append("refund_method",method);if(reference)form.append("refund_reference",reference);if(note)form.append("decision_note",note);if(proof)form.append("proof",proof);return unwrap(await api.post(`/finance/refund-requests/${row.id}/process`,form,{headers:{"Content-Type":"multipart/form-data"}}));}
    return unwrap(await api.post(`/finance/refund-requests/${row.id}/${kind}`,kind==="reject"?{decision_note:note}:{decision_note:note||undefined}));
  },onSuccess:()=>{toast.success("Refund updated");setSelected(null);setAction(null);setNote("");setReference("");setProof(null);qc.invalidateQueries({queryKey:["finance","refunds"]});}});
  const rows=query.data?.data??[];
  return <div className="space-y-4">
    <div className="flex flex-wrap gap-3"><Input className="max-w-sm" placeholder="Search order, reason, requester..." value={search} onChange={e=>setSearch(e.target.value)}/><Input type="date" className="w-44" value={from} onChange={e=>setFrom(e.target.value)}/><Input type="date" className="w-44" value={to} onChange={e=>setTo(e.target.value)}/><Select value={status} onValueChange={setStatus}><SelectTrigger className="w-44"><SelectValue/></SelectTrigger><SelectContent>{["all","requested","approved","rejected","processed"].map(x=><SelectItem key={x} value={x}>{x.replace(/^./,c=>c.toUpperCase())}</SelectItem>)}</SelectContent></Select></div>
    <div className="rounded-lg border"><Table><TableHeader><TableRow><TableHead>Refund</TableHead><TableHead>Order / Customer</TableHead><TableHead>Requested by</TableHead><TableHead>Amount</TableHead><TableHead>Reason</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{rows.length?rows.map(row=><TableRow key={row.id}><TableCell>REF-{row.id}</TableCell><TableCell>{row.order?.order_number??"—"}<div className="text-xs text-muted-foreground">{row.order?.customer_name??"Guest"}</div></TableCell><TableCell>{row.requester?.name??row.payment?.receiver?.name??"—"}</TableCell><TableCell>{Number(row.amount).toFixed(2)}</TableCell><TableCell className="max-w-64 whitespace-normal">{row.reason}</TableCell><TableCell><Badge variant={row.status==="rejected"?"destructive":"secondary"}>{row.status}</Badge></TableCell><TableCell>{row.requested_at?new Date(row.requested_at).toLocaleString():"—"}</TableCell><TableCell><div className="flex justify-end gap-2">{row.status==="requested"&&<><Button size="sm" onClick={()=>mutate.mutate({row,kind:"approve"})}>Approve</Button><Button size="sm" variant="destructive" onClick={()=>{setSelected(row);setAction("reject")}}>Reject</Button></>}{row.status==="approved"&&<Button size="sm" onClick={()=>{setSelected(row);setAction("process")}}>Process refund</Button>}{row.proof_url&&<Button size="sm" variant="outline" asChild><a href={row.proof_url} target="_blank" rel="noreferrer">Proof</a></Button>}</div></TableCell></TableRow>):<TableRow><TableCell colSpan={8} className="h-28 text-center">{query.isLoading?"Loading refunds...":"No refund requests found."}</TableCell></TableRow>}</TableBody></Table></div>
    <Dialog open={!!selected} onOpenChange={o=>{if(!o){setSelected(null);setAction(null)}}}><DialogContent><DialogHeader><DialogTitle>{action==="reject"?"Reject refund":"Process refund"}</DialogTitle></DialogHeader><div className="space-y-3"><div className="rounded border p-3">REF-{selected?.id} · {Number(selected?.amount??0).toFixed(2)}</div>{action==="process"&&<><Select value={method} onValueChange={setMethod}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{["cash","card","mobile","transfer","bank"].map(x=><SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select>{method!=="cash"&&<Input placeholder="Refund reference (required)" value={reference} onChange={e=>setReference(e.target.value)}/>}<Input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={e=>setProof(e.target.files?.[0]??null)}/></>}<Textarea placeholder={action==="reject"?"Rejection reason (required)":"Processing note (optional)"} value={note} onChange={e=>setNote(e.target.value)}/><div className="flex justify-end gap-2"><Button variant="outline" onClick={()=>setSelected(null)}>Cancel</Button><Button disabled={!selected||mutate.isPending||(action==="reject"&&!note.trim())||(action==="process"&&method!=="cash"&&!reference.trim())} onClick={()=>selected&&action&&mutate.mutate({row:selected,kind:action})}>{action==="reject"?"Reject":"Process refund"}</Button></div></div></DialogContent></Dialog>
  </div>;
}
