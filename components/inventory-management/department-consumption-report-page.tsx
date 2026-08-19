"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import inventoryService from "@/services/inventory-management/inventory.service";
import { formatBaseQuantity } from "@/lib/inventory-management";
import type { InventoryItem } from "@/types/inventory-management";

export function DepartmentConsumptionReportPage({ scope }: { scope: "department" | "food-controller" }) {
  const client=useQueryClient();
  const [from,setFrom]=useState(""), [to,setTo]=useState(""), [itemId,setItemId]=useState("all"), [approvalStatus,setApprovalStatus]=useState(scope==="food-controller"?"pending":"all"), [selected,setSelected]=useState<Array<number|string>>([]);
  const items = useQuery<InventoryItem[]>({
    queryKey: ["consumption-report", "items", scope],
    queryFn: async () => {
      if (scope === "department") {
        return inventoryService.requestableStockItems();
      }

      const response = await inventoryService.items({ per_page: 200 }, "food-controller");
      return response.data;
    },
  });
  const filters={date_from:from||undefined,date_to:to||undefined,inventory_item_id:itemId==="all"?undefined:itemId,approval_status:approvalStatus==="all"?undefined:approvalStatus};
  const report=useQuery({queryKey:["consumption-report",scope,from,to,itemId,approvalStatus],queryFn:()=>inventoryService.departmentConsumptionReport(scope,filters)});
  const rows=report.data?.data??[];
  const totals=useMemo(()=>Object.entries(rows.reduce((acc:Record<string,number>,row:any)=>{const unit=row.inventory_item?.base_unit??row.inventoryItem?.base_unit??"pcs";acc[unit]=(acc[unit]??0)+Number(row.quantity??0);return acc;},{})).map(([unit,quantity])=>`${Number(quantity).toLocaleString(undefined,{maximumFractionDigits:3})} ${unit}`).join(" · "),[rows]);
  const itemRows = items.data ?? [];
  const pendingRows=rows.filter((row:any)=>row.approval_status==="pending"), allVisibleSelected=pendingRows.length>0&&pendingRows.every((row:any)=>selected.includes(row.id));
  const selectedTotal=rows.filter((row:any)=>selected.includes(row.id)).reduce((sum:number,row:any)=>sum+Number(row.total_cost??0),0);
  const approve=useMutation({mutationFn:(mode:"selected"|"filtered")=>inventoryService.approveConsumptions({selection_mode:mode,consumption_ids:mode==="selected"?selected:undefined,date_from:filters.date_from,date_to:filters.date_to,inventory_item_id:filters.inventory_item_id}),onSuccess:(response:any)=>{toast.success(`${response.data?.approved_count??0} consumption row(s) approved — ${Number(response.data?.total_cost??0).toFixed(2)} ETB`);setSelected([]);client.invalidateQueries({queryKey:["consumption-report"]});},onError:(error)=>toast.error(error instanceof Error?error.message:"Approval failed")});
  return <div className="space-y-5"><div><h1 className="text-2xl font-bold">Consumption Report</h1><p className="text-sm text-muted-foreground">{scope==="department"?"Consumption recorded for your department.":"Consumption recorded across all departments."}</p></div>
  <section className="rounded-xl border bg-card p-4"><div className={`grid gap-4 ${scope==="food-controller"?"md:grid-cols-5":"md:grid-cols-4"}`}><div className="space-y-2"><Label>From date</Label><Input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></div><div className="space-y-2"><Label>To date</Label><Input type="date" min={from||undefined} value={to} onChange={e=>setTo(e.target.value)}/></div><div className="space-y-2"><Label>Inventory item</Label><Select value={itemId} onValueChange={setItemId}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All items</SelectItem>{itemRows.map((item:any)=><SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent></Select></div>{scope==="food-controller"&&<div className="space-y-2"><Label>Approval status</Label><Select value={approvalStatus} onValueChange={value=>{setApprovalStatus(value);setSelected([])}}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="approved">Approved</SelectItem></SelectContent></Select></div>}<div className="flex items-end"><Button variant="outline" className="w-full" onClick={()=>report.refetch()}>Refresh report</Button></div></div></section>
  {scope==="food-controller"&&<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3"><div className="text-sm"><strong>{selected.length}</strong> selected · <strong>{selectedTotal.toFixed(2)} ETB</strong></div><div className="flex gap-2"><Button disabled={!selected.length||approve.isPending} onClick={()=>approve.mutate("selected")}>Approve selected</Button><Button variant="outline" disabled={!pendingRows.length||approve.isPending} onClick={()=>approve.mutate("filtered")}>Approve all filtered</Button></div></div>}
  <div className="overflow-x-auto rounded-xl border bg-card"><Table><TableHeader><TableRow>{scope==="food-controller"&&<TableHead><Checkbox checked={allVisibleSelected} onCheckedChange={checked=>setSelected(checked?pendingRows.map((row:any)=>row.id):[])}/></TableHead>}<TableHead>Date</TableHead>{scope==="food-controller"&&<TableHead>Department</TableHead>}<TableHead>Item</TableHead><TableHead>Quantity</TableHead><TableHead>Unit cost</TableHead><TableHead>Total cost</TableHead><TableHead>Approval</TableHead><TableHead>Recorded by</TableHead><TableHead>Note</TableHead></TableRow></TableHeader><TableBody>{report.isLoading?<TableRow><TableCell colSpan={scope==="food-controller"?10:8} className="py-10 text-center">Loading report...</TableCell></TableRow>:rows.length?rows.map((row:any)=><TableRow key={row.id}>{scope==="food-controller"&&<TableCell><Checkbox disabled={row.approval_status!=="pending"} checked={selected.includes(row.id)} onCheckedChange={checked=>setSelected(current=>checked?(current.includes(row.id)?current:[...current,row.id]):current.filter(id=>id!==row.id))}/></TableCell>}<TableCell>{row.consumed_at?new Date(row.consumed_at).toLocaleString():"—"}</TableCell>{scope==="food-controller"&&<TableCell>{row.department?.name??"—"}</TableCell>}<TableCell>{row.inventory_item?.name??row.inventoryItem?.name??"—"}</TableCell><TableCell>{formatBaseQuantity(row.quantity,row.inventory_item?.base_unit??row.inventoryItem?.base_unit??"pcs")}</TableCell><TableCell>{Number(row.unit_cost??0).toFixed(2)} ETB</TableCell><TableCell className="font-medium">{Number(row.total_cost??0).toFixed(2)} ETB</TableCell><TableCell><Badge variant={row.approval_status==="approved"?"default":"secondary"}>{row.approval_status??"pending"}</Badge></TableCell><TableCell>{row.recorder?.name??"—"}</TableCell><TableCell>{row.note??"—"}</TableCell></TableRow>):<TableRow><TableCell colSpan={scope==="food-controller"?10:8} className="py-10 text-center text-muted-foreground">No consumption records found for the selected filters.</TableCell></TableRow>}</TableBody>{rows.length>0&&<TableFooter><TableRow><TableCell colSpan={scope==="food-controller"?4:3} className="font-semibold">Filtered quantity</TableCell><TableCell className="font-semibold">{totals}</TableCell><TableCell/><TableCell className="font-semibold">{rows.reduce((sum:number,row:any)=>sum+Number(row.total_cost??0),0).toFixed(2)} ETB</TableCell><TableCell colSpan={3}/></TableRow></TableFooter>}</Table></div></div>;
}
