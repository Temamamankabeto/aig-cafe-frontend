"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const money=(value:unknown)=>`${Number(value??0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} ETB`;

export function ProfitExpensePage(){
  const client=useQueryClient(), [from,setFrom]=useState(""), [to,setTo]=useState(""), [open,setOpen]=useState(false);
  const [form,setForm]=useState({category:"",expense_account_id:"",payment_account_id:"",payment_status:"paid",description:"",amount:"",expense_date:new Date().toISOString().slice(0,10),reference:""}), [file,setFile]=useState<File|null>(null);
  const filters={date_from:from||undefined,date_to:to||undefined};
  const accounts=useQuery({queryKey:["finance","accounting","expense-accounts"],queryFn:async()=>unwrap<any>(await api.get("/finance/accounting/accounts"))});
  const profit=useQuery({queryKey:["finance","profit",filters],queryFn:async()=>unwrap<any>(await api.get("/finance/reports/profit",{params:filters}))});
  const expenses=useQuery({queryKey:["finance","expenses",filters],queryFn:async()=>unwrap<any>(await api.get("/finance/expenses",{params:{...filters,per_page:100}}))});
  const create=useMutation({mutationFn:async()=>{const body=new FormData();Object.entries(form).forEach(([key,value])=>body.append(key,value));if(file)body.append("attachment",file);return unwrap<any>(await api.post("/finance/expenses",body,{headers:{"Content-Type":"multipart/form-data"}}));},onSuccess:()=>{toast.success("Expense recorded");setOpen(false);setFile(null);setForm({category:"",expense_account_id:"",payment_account_id:"",payment_status:"paid",description:"",amount:"",expense_date:new Date().toISOString().slice(0,10),reference:""});client.invalidateQueries({queryKey:["finance","expenses"]});client.invalidateQueries({queryKey:["finance","profit"]});},onError:(error)=>toast.error(error instanceof Error?error.message:"Could not record expense")});
  const remove=useMutation({mutationFn:async(id:number|string)=>unwrap(await api.delete(`/finance/expenses/${id}`)),onSuccess:()=>{toast.success("Expense deleted");client.invalidateQueries({queryKey:["finance","expenses"]});client.invalidateQueries({queryKey:["finance","profit"]});}});
  const summary=profit.data?.data??profit.data??{}, rows=expenses.data?.data??[];
  const approvedCash=Number(summary.approved_cash_sales??0), approvedCredit=Number(summary.approved_credit_sales??0);
  const consumption=Number(summary.approved_consumption_cost??0);
  const expenseCategories=(summary.expense_by_category??[]) as {name:string;amount:number}[];
  const isLoading=profit.isLoading||expenses.isLoading;
  const netProfit=Number(summary.net_profit??0);
  return <div className="mx-auto max-w-7xl space-y-5 pb-10">
  <header className="flex flex-wrap items-center justify-between gap-3">
    <div><h1 className="text-2xl font-bold tracking-tight text-foreground">Profit & Expenses</h1><p className="mt-1 text-sm text-muted-foreground">Financial performance</p></div>
    <Button className="gap-2" onClick={()=>setOpen(true)}>+ Record expense</Button>
  </header>
  <section aria-label="Report filters" className="rounded-2xl border bg-card p-4 shadow-sm">
    <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto] md:items-end">
      <div className="space-y-1.5"><Label htmlFor="profit-from">From date</Label><Input id="profit-from" type="date" value={from} onChange={e=>setFrom(e.target.value)}/></div>
      <div className="space-y-1.5"><Label htmlFor="profit-to">To date</Label><Input id="profit-to" type="date" min={from||undefined} value={to} onChange={e=>setTo(e.target.value)}/></div>
      <Button variant="outline" onClick={()=>{setFrom("");setTo("")}} disabled={!from&&!to}>Clear</Button>
      <Button variant="outline" onClick={()=>{profit.refetch();expenses.refetch()}} disabled={profit.isFetching||expenses.isFetching}>Refresh report</Button>
    </div>
  </section>
  <section className="overflow-hidden rounded-2xl border bg-card shadow-sm" aria-label="Financial summary">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-4"><h2 className="text-base font-semibold">Financial summary</h2><span className="text-xs font-medium text-muted-foreground">Amounts in ETB</span></div>
    {isLoading?<p className="p-6 text-sm text-muted-foreground">Loading financial report...</p>:profit.isError?<p className="p-6 text-sm text-destructive">Unable to load financial summary. Please refresh the report.</p>:<Table>
      <TableHeader><TableRow className="bg-muted/30"><TableHead className="pl-5">Description</TableHead><TableHead className="pr-5 text-right">Amount (ETB)</TableHead></TableRow></TableHeader>
      <TableBody>
        <TableRow><TableCell className="pl-5">Approved Cash Sales</TableCell><TableCell className="pr-5 text-right tabular-nums">{money(approvedCash)}</TableCell></TableRow>
        <TableRow><TableCell className="pl-5">Approved Credit Sales</TableCell><TableCell className="pr-5 text-right tabular-nums">{money(approvedCredit)}</TableCell></TableRow>
        <TableRow><TableCell className="pl-5 text-muted-foreground">Less: Processed Refunds</TableCell><TableCell className="pr-5 text-right tabular-nums">{money(summary.refunds)}</TableCell></TableRow>
        <TableRow className="bg-muted/30 font-semibold"><TableCell className="pl-5">Total Revenue</TableCell><TableCell className="pr-5 text-right tabular-nums">{money(summary.net_revenue)}</TableCell></TableRow>
        <TableRow><TableCell className="pl-5">Inventory Consumption <span className="text-xs text-muted-foreground">(including staff consumption recorded at cost)</span></TableCell><TableCell className="pr-5 text-right tabular-nums">{money(consumption)}</TableCell></TableRow>
        {expenseCategories.map(entry=><TableRow key={entry.name}><TableCell className="pl-5 capitalize">{entry.name}</TableCell><TableCell className="pr-5 text-right tabular-nums">{money(entry.amount)}</TableCell></TableRow>)}
        <TableRow className="bg-muted/30 font-semibold"><TableCell className="pl-5">Total Expenses</TableCell><TableCell className="pr-5 text-right tabular-nums">{money(summary.total_expenses)}</TableCell></TableRow>
        <TableRow className="border-t-2 font-bold"><TableCell className="py-4 pl-5">Net Profit</TableCell><TableCell className={`py-4 pr-5 text-right text-lg tabular-nums ${netProfit<0?"text-destructive":"text-emerald-700"}`}>{money(netProfit)}</TableCell></TableRow>
      </TableBody>
    </Table>}
  </section>
  <section className="overflow-hidden rounded-2xl border bg-card shadow-sm" aria-label="Expense records">
    <div className="flex items-center justify-between border-b px-5 py-4"><h2 className="text-base font-semibold">Expense records</h2><span className="text-xs text-muted-foreground">{rows.length} records</span></div>
    <div className="overflow-x-auto"><Table><TableHeader><TableRow className="bg-muted/30"><TableHead className="pl-5">Expense</TableHead><TableHead>Date</TableHead><TableHead>Category</TableHead><TableHead>Description</TableHead><TableHead>Reference</TableHead><TableHead className="text-right">Amount (ETB)</TableHead><TableHead>Recorded by</TableHead><TableHead className="pr-5 text-right">Action</TableHead></TableRow></TableHeader><TableBody>
      {expenses.isLoading?<TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">Loading expenses...</TableCell></TableRow>:expenses.isError?<TableRow><TableCell colSpan={8} className="py-10 text-center text-destructive">Unable to load expense records.</TableCell></TableRow>:rows.length?rows.map((row:any)=><TableRow key={row.id}><TableCell className="pl-5 font-medium">{row.expense_number}</TableCell><TableCell className="whitespace-nowrap">{row.expense_date?new Date(row.expense_date).toLocaleDateString():"—"}</TableCell><TableCell className="capitalize">{row.category}</TableCell><TableCell className="max-w-[260px] truncate" title={row.description}>{row.description}</TableCell><TableCell>{row.reference??"—"}</TableCell><TableCell className="text-right tabular-nums">{money(row.amount)}</TableCell><TableCell>{row.recorder?.name??"—"}</TableCell><TableCell className="pr-5 text-right"><Button size="sm" variant="outline" className="text-destructive hover:text-destructive" disabled={remove.isPending} onClick={()=>{if(window.confirm(`Delete expense ${row.expense_number??row.id}?`))remove.mutate(row.id)}}>Delete</Button></TableCell></TableRow>):<TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">No expenses found for the selected period.</TableCell></TableRow>}
    </TableBody></Table></div>
  </section>
  <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Record operating expense</DialogTitle></DialogHeader><div className="space-y-3"><div><Label>Category *</Label><Input value={form.category} onChange={e=>setForm({...form,category:e.target.value})} placeholder="Utilities, maintenance, transport..."/></div><div className="grid gap-3 sm:grid-cols-2"><div><Label>Expense Account *</Label><Select value={form.expense_account_id} onValueChange={v=>setForm({...form,expense_account_id:v})}><SelectTrigger><SelectValue placeholder="Select expense account"/></SelectTrigger><SelectContent>{((accounts.data?.data??accounts.data??[]) as any[]).filter((a:any)=>a.type==="expense"&&a.is_posting&&a.is_active).map((a:any)=><SelectItem key={a.id} value={String(a.id)}>{a.code} · {a.name}</SelectItem>)}</SelectContent></Select></div><div><Label>Status *</Label><Select value={form.payment_status} onValueChange={v=>setForm({...form,payment_status:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="paid">Paid</SelectItem><SelectItem value="payable">Payable</SelectItem></SelectContent></Select></div></div>{form.payment_status==="paid"&&<div><Label>Payment Account *</Label><Select value={form.payment_account_id} onValueChange={v=>setForm({...form,payment_account_id:v})}><SelectTrigger><SelectValue placeholder="Cash / Bank / Mobile"/></SelectTrigger><SelectContent>{((accounts.data?.data??accounts.data??[]) as any[]).filter((a:any)=>a.is_posting&&a.is_active&&String(a.code).startsWith("11")).map((a:any)=><SelectItem key={a.id} value={String(a.id)}>{a.code} · {a.name}</SelectItem>)}</SelectContent></Select></div>}<div><Label>Description *</Label><Textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></div><div className="grid gap-3 sm:grid-cols-2"><div><Label>Amount *</Label><Input type="number" min="0.01" step="0.01" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})}/></div><div><Label>Expense date *</Label><Input type="date" value={form.expense_date} onChange={e=>setForm({...form,expense_date:e.target.value})}/></div></div><div><Label>Reference</Label><Input value={form.reference} onChange={e=>setForm({...form,reference:e.target.value})}/></div><div><Label>Attachment</Label><Input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={e=>setFile(e.target.files?.[0]??null)}/></div><div className="flex justify-end gap-2"><Button variant="outline" onClick={()=>setOpen(false)}>Cancel</Button><Button disabled={!form.category.trim()||!form.expense_account_id||(form.payment_status==="paid"&&!form.payment_account_id)||!form.description.trim()||Number(form.amount)<=0||!form.expense_date||create.isPending} onClick={()=>create.mutate()}>Save expense</Button></div></div></DialogContent></Dialog></div>;
}
