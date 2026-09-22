"use client";

import { useRef, useState } from "react";
import { BrowserQRCodeReader, IScannerControls } from "@zxing/browser";
import { CreditCard, QrCode, Search, X } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type VerifiedPerson = { user_id:number|string; name:string; phone?:string|null; email?:string|null; card_status:string; balance_account?:{id:number|string;balance:number}|null };

export function EmployeeCardScanner({ endpoint, onVerified, value }:{ endpoint:string; onVerified:(person:VerifiedPerson)=>void; value?:VerifiedPerson|null }) {
  const [code,setCode]=useState(""); const [busy,setBusy]=useState(false); const [camera,setCamera]=useState(false);
  const videoRef=useRef<HTMLVideoElement|null>(null); const controls=useRef<IScannerControls|null>(null);
  async function verify(raw=code){ const card_code=raw.trim(); if(!card_code)return; setBusy(true); try { const r=await api.post(endpoint,{card_code}); const person=r.data?.data; onVerified(person); setCode(""); setCamera(false); controls.current?.stop(); toast.success(`Verified: ${person.name}`); } catch(e:any){ toast.error(e?.response?.data?.message || e?.response?.data?.errors?.card_code?.[0] || "Card verification failed"); } finally { setBusy(false); } }
  async function startCamera(){ setCamera(true); setTimeout(async()=>{ try { const reader=new BrowserQRCodeReader(undefined,{delayBetweenScanAttempts:150}); controls.current=await reader.decodeFromConstraints({video:{facingMode:"environment"}}, videoRef.current!, (result)=>{ if(result){ controls.current?.stop(); verify(result.getText()); }}); } catch { setCamera(false); toast.error("Could not start camera. You can use a USB scanner or enter the card code."); } },50); }
  return <div className="rounded-xl border bg-slate-50 p-3">
    <div className="mb-2 flex items-center justify-between"><div className="flex items-center gap-2 font-semibold"><CreditCard className="h-4 w-4"/>Employee / Meal Card</div>{value&&<span className="text-xs font-medium text-emerald-700">Verified</span>}</div>
    {value ? <div className="rounded-lg border bg-white p-3 text-sm"><div className="font-bold">{value.name}</div><div className="text-slate-500">User ID: {value.user_id}{value.phone?` · ${value.phone}`:""}</div>{value.balance_account&&<div className="mt-1 font-medium">Balance: {Number(value.balance_account.balance).toFixed(2)} ETB</div>}</div> : <div className="flex gap-2"><Input value={code} onChange={e=>setCode(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")verify();}} placeholder="Scan or enter card code"/><Button type="button" variant="outline" onClick={()=>verify()} disabled={busy||!code.trim()}><Search className="h-4 w-4"/></Button><Button type="button" variant="outline" onClick={startCamera}><QrCode className="h-4 w-4"/></Button></div>}
    {camera&&<div className="relative mt-3 overflow-hidden rounded-lg bg-black"><video ref={videoRef} className="h-48 w-full object-cover"/><button type="button" className="absolute right-2 top-2 rounded-full bg-white p-1" onClick={()=>{controls.current?.stop();setCamera(false)}}><X className="h-4 w-4"/></button></div>}
  </div>;
}
