"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Approval = { id:number; report_type:"cash"|"credit"|"consumption"; date_from:string; date_to:string; credit_account_id:string; authorized_person:string; snapshot_json:string; remarks:string|null; validated_at:string|null; validated_by:number|null; validated_by_name?:string|null; approved_by_name?:string|null };
const labels = {cash:"Cash Sales",credit:"Credit Sales",consumption:"Consumption"};
const money=(n:number)=>n.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});

export default function FbReportApprovalsPage() {
  const client=useQueryClient();
  const {data,isLoading,error}=useQuery({queryKey:["fb-manager-pending"],queryFn:async()=> (await api.get<{data:Approval[]}>("/reports/fb-finance/approvals/pending")).data.data});
  const [selected,setSelected]=useState<Approval|null>(null);
  const [remarks,setRemarks]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [action,setAction]=useState<"approve"|"return">("approve");
  const rows:Record<string,unknown>[] = selected ? (()=>{try {const value:unknown=JSON.parse(selected.snapshot_json);return Array.isArray(value)?value:[]}catch{return []}})() : [];
  const total=rows.reduce((sum,r)=>sum+Number(r.amount??0),0);
  const quantity=rows.reduce((sum,r)=>sum+Number(r.quantity??0),0);
  const submit=async()=>{
    if(!selected || busy || (action==="return"&&!remarks.trim()))return;
    setBusy(true);setMessage("");
    try {
      await api.post("/reports/fb-finance/approval",{report_type:selected.report_type,date_from:selected.date_from,date_to:selected.date_to,...(selected.credit_account_id?{credit_account_id:Number(selected.credit_account_id)}:{}),...(selected.authorized_person?{authorized_person:selected.authorized_person}:{}),action,remarks});
      setSelected(null);setRemarks("");await client.invalidateQueries({queryKey:["fb-manager-pending"]});
    } catch(e:unknown) { const err=e as {response?:{data?:{message?:string}}};setMessage(err.response?.data?.message??"Unable to process approval."); }
    finally{setBusy(false)}
  };
  return <div className="space-y-6 p-6">
    <div><h1 className="text-2xl font-semibold">F&B Report Approvals</h1><p className="text-sm text-muted-foreground">Cash Sales, Credit Sales and Consumption reports validated by F&B.</p></div>
    <div className="rounded-xl border overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-3">Report</th><th className="p-3">From</th><th className="p-3">To</th><th className="p-3">Validated</th><th className="p-3">Status</th><th className="p-3">Action</th></tr></thead><tbody>
      {isLoading?<tr><td colSpan={6} className="p-5">Loading...</td></tr>:error?<tr><td colSpan={6} className="p-5 text-destructive">Unable to load pending reports.</td></tr>:!data?.length?<tr><td colSpan={6} className="p-5 text-muted-foreground">No reports awaiting approval.</td></tr>:data.map(r=><tr key={r.id} className="border-b"><td className="p-3">{labels[r.report_type]}</td><td className="p-3">{r.date_from}</td><td className="p-3">{r.date_to}</td><td className="p-3">{r.validated_at??"—"}</td><td className="p-3">Awaiting Manager</td><td className="p-3"><Button size="sm" onClick={()=>{setSelected(r);setRemarks("");setMessage("");setAction("approve")}}>Review</Button></td></tr>)}
    </tbody></table></div>
    {selected&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div role="dialog" aria-modal="true" aria-label="Review F&B report" className="w-full max-w-2xl max-h-[90vh] overflow-y-auto space-y-4 rounded-xl bg-background p-6 shadow-xl">
      <div className="flex justify-between"><h2 className="text-xl font-semibold">{labels[selected.report_type]} — Manager Review</h2><Button variant="outline" disabled={busy} onClick={()=>setSelected(null)}>Close</Button></div>
      <div className="grid grid-cols-2 gap-3 rounded-lg border p-4 text-sm"><div>From: <b>{selected.date_from}</b></div><div>To: <b>{selected.date_to}</b></div><div>Quantity: <b>{quantity}</b></div><div>Total: <b>{money(total)} ETB</b></div><div>Validated by: <b>{selected.validated_by_name??"—"}</b></div><div>Validated: <b>{selected.validated_at??"—"}</b></div></div>
      {selected.remarks&&<div className="rounded-lg border p-3 text-sm">F&B remarks: {selected.remarks}</div>}
      <div className="max-h-52 overflow-auto rounded-lg border"><table className="w-full text-sm"><thead><tr><th className="p-2 text-left">Category / Item</th><th className="p-2 text-right">Qty</th><th className="p-2 text-right">Amount</th></tr></thead><tbody>{rows.map((r,i)=><tr className="border-t" key={i}><td className="p-2">{String(r.category??r.item_name??r.meal_category??"—")}</td><td className="p-2 text-right">{Number(r.quantity??0)}</td><td className="p-2 text-right">{money(Number(r.amount??0))}</td></tr>)}</tbody></table></div>
      <div className="space-y-2"><label className="text-sm font-medium">Manager remarks {action==="return"?"(required)":"(optional)"}</label><Input value={remarks} onChange={e=>setRemarks(e.target.value)} placeholder="Enter remarks"/></div>
      {message&&<p className="text-sm text-destructive">{message}</p>}
      <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={busy} onClick={()=>{setAction("return");setMessage("")}}>Return for Correction</Button><Button disabled={busy} onClick={()=>{if(action==="return")setAction("approve");else void submit()}}>{busy?"Processing...":action==="return"?"Switch to Approve":"Approve Report"}</Button>{action==="return"&&<Button disabled={busy||!remarks.trim()} onClick={()=>void submit()}>Confirm Return</Button>}</div>
    </div></div>}
  </div>;
}
