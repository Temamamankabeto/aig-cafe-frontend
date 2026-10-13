"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Printer, Search, WalletCards, XCircle } from "lucide-react";
import { formatBaseQuantity, formatMoney } from "@/lib/inventory-management";
import { procurementService, type PurchaseOrderRow } from "@/services/inventory-management/procurement.service";


function printApprovedRequisition(po: PurchaseOrderRow, w: Window) {
  if (!['approved', 'partially_received', 'completed'].includes(po.status)) return;
  const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const notes = po.notes ?? "";
  const noteValue = (label: string) => notes.split("\n").find((part) => part.startsWith(`${label}: `))?.slice(label.length + 2).trim() ?? "";
  const itemNote = (index: number) => notes.split("\n").find((part) => part.startsWith(`Item ${index + 1} (`)) ?? "";
  const lines = (po.items ?? []).map((line, index) => {
    const item = line.inventory_item ?? line.inventoryItem;
    const itemDetails = itemNote(index);
    const spec = itemDetails.split("Specification / Model: ")[1]?.split("; Remarks: ")[0] ?? "";
    const remarks = itemDetails.split("; Remarks: ")[1] ?? "";
    return `<tr><td>${index + 1}</td><td>${esc(item?.name ?? 'Item')}</td><td>${esc(spec)}</td><td>${esc(item?.base_unit ?? line.unit ?? '')}</td><td>${esc(line.quantity)}</td><td>${esc(formatMoney(line.unit_cost))}</td><td>${esc(formatMoney(line.line_total ?? Number(line.quantity) * Number(line.unit_cost)))}</td><td>${esc(remarks)}</td></tr>`;
  }).join('');
  const name = (v: any) => esc(v?.name ?? '________________');
  const logoUrl = `${window.location.origin}/images/aig-official-logo.png`;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Purchase Requisition</title><style>
    @page { size: A4 landscape; margin: 12mm; }
    * { box-sizing: border-box; }
    body { font: 12px Arial, Helvetica, sans-serif; color: #171717; margin: 0; background: #fff; }
    .top { position: relative; min-height: 180px; text-align: center; }
    .brand { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; }
    .brand img { width: 95px; height: 95px; object-fit: contain; }
    .brand strong { display: block; color: #1d316d; font-size: 20px; letter-spacing: .15px; }
    .refs { position: absolute; top: 10px; right: 0; width: 205px; text-align: left; }
    .refs div { display: flex; gap: 8px; align-items: end; margin-bottom: 9px; white-space: nowrap; }
    .blank { display: inline-block; flex: 1; min-width: 115px; border-bottom: 1px solid #333; height: 16px; }
    .title { text-align: center; margin: 0 0 23px; }
    .title h1 { font-size: 23px; margin: 0 0 5px; font-weight: 750; }
    .title h2 { font-size: 16px; margin: 0; font-weight: 600; }
    .meta { margin: 0 0 18px; line-height: 1.8; }
    .meta strong { margin-right: 6px; }
    table { width: 100%; border-collapse: collapse; table-layout: auto; }
    th, td { border: 1px solid #9a9a9a; padding: 8px 7px; text-align: left; vertical-align: middle; }
    th { background: #f2f3f5; font-weight: 700; }
    .number { white-space: nowrap; }
    .total-label { text-align: right; font-weight: 700; }
    .total-value { font-weight: 700; white-space: nowrap; }
    .sign { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 22px; margin-top: 26px; }
    .sign section { padding: 0 6px; min-width: 0; }
    .sign section + section { border-left: 1px solid #d4d4d4; padding-left: 22px; }
    .sign h3 { font-size: 13px; border-bottom: 1px solid #777; padding: 0 0 9px; margin: 0 0 15px; }
    .sign p { margin: 12px 0; }
    @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } .sign, tr { break-inside: avoid; } }
  </style></head><body>
    <header class="top"><div class="brand"><img id="aig-logo" src="${esc(logoUrl)}" alt="AIG official logo"/><strong>ADAMA INVESTMENT GROUP (AIG)</strong></div><div class="refs"><div>Ref. No. <span class="blank"></span></div><div>Date <span class="blank"></span></div></div></header>
    <div class="title"><h1>PURCHASE REQUISITION FORM</h1><h2>(Purchase Request / Material Requisition)</h2></div>
    <div class="meta"><div><strong>Requesting Department:</strong>${esc(noteValue("Requesting Department") || "AIG Cafe and Restaurant")}</div><div><strong>Purpose / Reason for Purchase:</strong>${esc(noteValue("Purpose / Reason for Purchase"))}</div></div>
    <table><thead><tr><th>No.</th><th>Item Description</th><th>Specification / Model</th><th>Unit of Measure</th><th>Quantity</th><th>Estimated Unit Price (ETB)</th><th>Total Price (ETB)</th><th>Remarks</th></tr></thead><tbody>${lines}<tr><td colspan="6" class="total-label">Grand Total</td><td colspan="2" class="total-value">${esc(formatMoney(po.total ?? 0))} ETB</td></tr></tbody></table>
    <div class="sign"><section><h3>A. Requested By</h3><p>Name: ${name((po as any).creator)}</p><p>Signature: __________________</p><p>Date: __________________</p></section>
    <section><h3>B. Reviewed / Verified By</h3><p>Name: ${name(po.finance_verifier)}</p><p>Signature: __________________</p><p>Date: __________________</p></section>
    <section><h3>C. Approved By</h3><p>Name: ${name((po as any).approver)}</p><p>Signature: __________________</p><p>Date: __________________</p></section></div>
    <script>window.onload=()=>{const logo=document.getElementById('aig-logo');if(logo && !logo.complete){logo.onload=()=>window.print();logo.onerror=()=>window.print();}else{window.print();}};<\/script></body></html>`);
  w.document.close();
}

export function PurchaseFinanceVerificationPage() {
  const [search,setSearch]=useState(""); const [printing,setPrinting]=useState<number|null>(null); const [selected,setSelected]=useState<PurchaseOrderRow|null>(null); const [note,setNote]=useState("Budget availability checked and sufficient for this purchase."); const qc=useQueryClient();
  const query=useQuery({queryKey:["procurement","finance-verification",search],queryFn:()=>procurementService.purchaseOrders({search,per_page:100},"finance"),retry:false});
  const refresh=()=>{qc.invalidateQueries({queryKey:["procurement","finance-verification"]});qc.invalidateQueries({queryKey:["procurement","purchase-orders"]});};
  const verify=useMutation({mutationFn:()=>procurementService.verifyPurchaseBudget(selected!.id,note),onSuccess:()=>{toast.success("Budget verified; request sent to Manager");setSelected(null);refresh();},onError:(e:any)=>toast.error(e?.message??"Budget verification failed")});
  const reject=useMutation({mutationFn:()=>procurementService.rejectPurchaseBudget(selected!.id,note),onSuccess:()=>{toast.success("Purchase request rejected by Finance");setSelected(null);refresh();},onError:(e:any)=>toast.error(e?.message??"Budget rejection failed")});
  const printRequisition = async (po: PurchaseOrderRow) => {
    const printWindow = window.open("", "_blank", "width=1050,height=850");
    if (!printWindow) { toast.error("Allow pop-ups to print requisitions"); return; }
    setPrinting(po.id);
    try {
      const detail = await procurementService.purchaseOrder(po.id, "finance");
      printApprovedRequisition(detail, printWindow);
    } catch (error: any) {
      printWindow.close();
      toast.error(error?.message ?? "Unable to load approved requisition");
    } finally { setPrinting(null); }
  };
  const rows=(query.data?.data??[]).filter(po=>["submitted","finance_verified","finance_rejected","approved","partially_received","completed"].includes(po.status));
  return <div className="space-y-6"><Card><CardHeader><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><CardTitle className="flex items-center gap-2"><WalletCards className="h-5 w-5"/>Purchase Budget Confirmation</CardTitle><CardDescription>Review submitted purchase requisitions directly, verify the budget, and forward verified requests to Manager.</CardDescription></div><div className="relative md:w-80"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"/><Input className="pl-9" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search PO or supplier..."/></div></div></CardHeader><CardContent>{query.isLoading?<p className="text-sm text-muted-foreground">Loading...</p>:rows.length?<Table><TableHeader><TableRow><TableHead>PO</TableHead><TableHead>Supplier</TableHead><TableHead>Items</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader><TableBody>{rows.map(po=><TableRow key={po.id}><TableCell className="font-medium">{po.po_number??`PO-${po.id}`}</TableCell><TableCell>{po.supplier?.name??"Not selected (requisition)"}</TableCell><TableCell>{po.items?.length??0}</TableCell><TableCell>{formatMoney(po.total??0)} ETB</TableCell><TableCell><Badge variant={po.status.includes("reject")?"destructive":"secondary"}>{po.status.replaceAll("_"," ")}</Badge></TableCell><TableCell className="text-right">{po.status==="submitted"?<Button size="sm" onClick={()=>{setSelected(po);setNote("Budget availability checked and sufficient for this purchase.")}}>Review budget</Button>:["approved","partially_received","completed"].includes(po.status)?<Button size="sm" variant="outline" disabled={printing===po.id} onClick={()=>void printRequisition(po)}><Printer className="mr-2 h-4 w-4"/>Print Requisition</Button>:<span className="text-sm text-muted-foreground">Processed</span>}</TableCell></TableRow>)}</TableBody></Table>:<div className="rounded-xl border border-dashed p-8 text-center">No purchase requests available for Finance.</div>}</CardContent></Card>
  <Dialog open={!!selected} onOpenChange={o=>!o&&setSelected(null)}><DialogContent className="max-w-4xl"><DialogHeader><DialogTitle>Finance purchase budget confirmation</DialogTitle><DialogDescription>Review the complete purchase detail and confirm whether sufficient budget is available.</DialogDescription></DialogHeader>{selected&&<div className="space-y-4"><div className="grid gap-3 md:grid-cols-3"><div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Purchase Order</div><div className="font-semibold">{selected.po_number??`PO-${selected.id}`}</div></div><div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Supplier</div><div className="font-semibold">{selected.supplier?.name??"—"}</div></div><div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Requested Total</div><div className="font-semibold">{formatMoney(selected.total??0)} ETB</div></div></div><div className="max-h-72 overflow-auto rounded-lg border"><Table><TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Qty</TableHead><TableHead>Unit Cost</TableHead><TableHead>Total</TableHead></TableRow></TableHeader><TableBody>{(selected.items??[]).map(i=>{const inv=i.inventory_item??i.inventoryItem; const unit=inv?.base_unit??i.unit??"pcs";return <TableRow key={i.id}><TableCell>{inv?.name??`Item #${i.inventory_item_id}`}</TableCell><TableCell>{formatBaseQuantity(i.quantity,unit)}</TableCell><TableCell>{formatMoney(i.unit_cost)} ETB</TableCell><TableCell>{formatMoney(i.line_total??Number(i.quantity)*Number(i.unit_cost))} ETB</TableCell></TableRow>})}</TableBody></Table></div><div><Label>Finance note / rejection reason</Label><Textarea className="mt-2" value={note} onChange={e=>setNote(e.target.value)}/></div></div>}<DialogFooter><Button variant="outline" onClick={()=>setSelected(null)}>Cancel</Button><Button variant="destructive" disabled={!note.trim()||reject.isPending||verify.isPending} onClick={()=>reject.mutate()}><XCircle className="mr-2 h-4 w-4"/>Budget not sufficient</Button><Button disabled={verify.isPending||reject.isPending} onClick={()=>verify.mutate()}><CheckCircle2 className="mr-2 h-4 w-4"/>Verify budget sufficient</Button></DialogFooter></DialogContent></Dialog></div>;
}
