"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronRight } from "lucide-react";

type Sale = { report_date: string; sale_type: "cash" | "credit"; category: string; item_name: string; quantity: number; amount: number };
type CreditSale = { report_date:string; order_id:number; order_number:string; credit_account_id:number|null; credit_account:string; credit_agreement_id:number|null; authorized_person:string; meal_category:string; meal_type:string; item_name:string; quantity:number; amount:number };
type CreditFilters = {accounts:{id:number;name:string}[];persons:{credit_account_id:number;name:string}[]};
type Consumption = { report_date: string; item_name: string; unit: string; quantity: number; amount: number };
type Daily = { date: string; cash: number; credit: number; revenue: number; expenses: number | null; result: number | null };
type Report = { success: boolean; data: { sales: Sale[]; consumption: Consumption[]; daily: Daily[]; finance_details_available: boolean; credit_sales:CreditSale[]; credit_filters:CreditFilters } };
type Tab = "cash" | "credit" | "consumption" | "summary";
const amount = (v: number | null | undefined) => v == null ? "—" : Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const tabLabels: Record<Tab,string> = {cash:"Cash Sales",credit:"Credit Sales",consumption:"Consumption",summary:"Consolidated Report"};

export function FbFinanceReportsPage() {
  const queryClient = useQueryClient();
  const [approvalRemarks,setApprovalRemarks] = useState("");
  const [approvalBusy,setApprovalBusy] = useState(false);
  const [approvalError,setApprovalError] = useState("");
  const [confirmAction,setConfirmAction] = useState<"validate"|"approve"|"return"|null>(null);
  const [tab,setTab] = useState<Tab>("cash");
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [account,setAccount] = useState("");
  const [person,setPerson] = useState("");
  const [expandedCredit,setExpandedCredit] = useState<string[]>([]);
  const [period,setPeriod] = useState("today");
  const [from,setFrom] = useState(iso(new Date()));
  const [to,setTo] = useState(iso(new Date()));
  const changePeriod = (next: string) => {
    setPeriod(next);
    if (next === "custom") return;
    const end = new Date(), start = new Date(end);
    if (next === "week") start.setDate(end.getDate()-6);
    if (next === "month") start.setDate(1);
    setFrom(iso(start));setTo(iso(end));
  };
  const valid = !!from && !!to && from <= to;
  const report = useQuery<Report>({
    queryKey:["fb-finance-reports",from,to,account,person],
    queryFn:async()=> (await api.get("/reports/fb-finance",{params:{date_from:from,date_to:to,...(account?{credit_account_id:account}:{}),...(person?{authorized_person:person}:{})}})).data,
    enabled:valid,
  });
  const approvalType = tab === "summary" ? null : tab;
  const approvalParams = { report_type: approvalType, date_from: from, date_to: to, ...(approvalType === "credit" && account ? {credit_account_id:account} : {}), ...(approvalType === "credit" && person ? {authorized_person:person} : {}) };
  const approval = useQuery<{success:boolean;data:{approval:{id:number;status:string;remarks:string|null;validated_at:string|null;approved_at:string|null}|null;snapshot_current:boolean;can_validate:boolean;can_approve:boolean}} >({
    queryKey:["fb-approval",approvalType,from,to,account,person],
    queryFn:async()=> (await api.get("/reports/fb-finance/approval",{params:approvalParams})).data,
    enabled:valid && approvalType !== null,
  });
  const approvalData = approval.data?.data;
  const submitApproval = async (action:"validate"|"approve"|"return") => {
    if (!approvalType || approvalBusy) return;
    setApprovalBusy(true);setApprovalError("");
    try {
      await api.post("/reports/fb-finance/approval",{...approvalParams,action,remarks:approvalRemarks});
      setApprovalRemarks("");
      setConfirmAction(null);
      await queryClient.invalidateQueries({queryKey:["fb-approval"]});
    } catch (err:any) {
      setApprovalError(err?.response?.data?.message || "Unable to update report approval.");
    } finally {setApprovalBusy(false);}
  };
  const data = report.data?.data;
  const sales = useMemo(()=> (data?.sales??[]).filter(row=>row.sale_type===tab),[data,tab]);
  const categorySales = useMemo(() => {
    const grouped = new Map<string, { category: string; quantity: number; amount: number; items: Sale[] }>();
    for (const sale of sales) {
      const category = sale.category || "Uncategorized";
      const existing = grouped.get(category) ?? { category, quantity: 0, amount: 0, items: [] };
      existing.quantity += Number(sale.quantity || 0);
      existing.amount += Number(sale.amount || 0);
      existing.items.push(sale);
      grouped.set(category, existing);
    }
    return Array.from(grouped.values()).sort((a, b) => a.category.localeCompare(b.category));
  }, [sales]);
  const creditSales = data?.credit_sales ?? [];
  const creditGroups = useMemo(() => {
    type MealGroup = { name: string; rows: CreditSale[]; people: Map<string, CreditSale[]> };
    type CategoryGroup = { name: string; meals: Map<string, MealGroup> };
    const accounts = new Map<string, {name: string; categories: Map<string, CategoryGroup>} >();
    for (const row of creditSales) {
      const accountKey = String(row.credit_account_id ?? "unassigned");
      if (!accounts.has(accountKey)) accounts.set(accountKey, {name: row.credit_account, categories: new Map()});
      const categories = accounts.get(accountKey)!.categories;
      const slug = (row.meal_category || "uncategorized").toLowerCase();
      const categoryName = slug === "order_based" ? "Order-Based (À La Carte)" : slug === "buffet" ? "Buffet" : slug === "refreshment" ? "Refreshment" : "Uncategorized";
      if (!categories.has(slug)) categories.set(slug, {name: categoryName, meals: new Map()});
      const meals = categories.get(slug)!.meals;
      const mealName = row.meal_type || (slug === "order_based" ? "Order-Based (À La Carte)" : "Uncategorized");
      if (!meals.has(mealName)) meals.set(mealName, {name: mealName, rows: [], people: new Map()});
      const meal = meals.get(mealName)!;
      meal.rows.push(row);
      if (slug === "order_based") {
        const name = row.authorized_person || "Unassigned";
        if (!meal.people.has(name)) meal.people.set(name, []);
        meal.people.get(name)!.push(row);
      }
    }
    return [...accounts.entries()];
  }, [creditSales]);
  const sumRows = (rows: CreditSale[]) => ({quantity: rows.reduce((n,r)=>n+Number(r.quantity || 0),0), total: rows.reduce((n,r)=>n+Number(r.amount || 0),0)});
  const toggleCredit = (key:string) => setExpandedCredit(current => current.includes(key) ? current.filter(x=>x!==key) : [...current,key]);
  const creditDetailRows = (rows: CreditSale[], key:string) => rows.map((r,i)=><TableRow key={`${key}-${r.order_id}-${i}`} className="print:table-row"><TableCell className="pl-12 text-sm">{r.order_number} · {r.report_date} · {r.item_name}</TableCell><TableCell>{r.quantity}</TableCell><TableCell>{amount(r.amount)}</TableCell></TableRow>);
  const isSalesTab = tab === "cash" || tab === "credit";
  const toggleCategory = (category: string) => setExpandedCategories(current =>
    current.includes(category) ? current.filter(value => value !== category) : [...current, category]
  );
  const consumption = data?.consumption??[];
  const daily = data?.daily??[];
  const headers = tab==="cash"||tab==="credit"
    ? ["Date","Category / Item","Quantity","Total (ETB)"]
    : tab==="consumption" ? ["Date","Ingredient","Unit","Quantity","Cost (ETB)"]
    : ["Date","Cash Sales","Credit Sales","Total Revenue","Expenses","Result"];
  const rows: (string|number)[][] = tab==="cash"||tab==="credit"
    ? categorySales.flatMap(group => [
        ["", group.category, group.quantity, amount(group.amount)],
        ...group.items.map(item => [item.report_date, item.item_name, item.quantity, amount(item.amount)]),
      ])
    : tab==="consumption"
    ? consumption.map(r=>[r.report_date,r.item_name,r.unit,r.quantity,amount(r.amount)])
    : daily.map(r=>[r.date,amount(r.cash),amount(r.credit),amount(r.revenue),amount(r.expenses),amount(r.result)]);
  const total = tab==="credit" ? creditSales.reduce((a,r)=>a+Number(r.amount),0) : tab==="cash" ? sales.reduce((a,r)=>a+Number(r.amount),0)
    : tab==="consumption" ? consumption.reduce((a,r)=>a+Number(r.amount),0)
    : daily.reduce((a,r)=>a+Number(r.revenue),0);
  const exportHeaders = tab === "credit" ? ["Credit Account","Meal Category","Meal Type","Authorized Person (Order-Based)","Order","Date","Item","Persons / Qty","Total (ETB)"] : headers;
  const exportRows:(string|number)[][] = tab === "credit" ? creditSales.map(r=>[r.credit_account,r.meal_category,r.meal_type,r.meal_category === "order_based" ? r.authorized_person : "",r.order_number,r.report_date,r.item_name,r.quantity,amount(r.amount)]) : rows;
  const reportQuantity = tab === "credit" ? creditSales.reduce((n,r)=>n+Number(r.quantity||0),0) : tab === "cash" ? sales.reduce((n,r)=>n+Number(r.quantity||0),0) : tab === "consumption" ? consumption.reduce((n,r)=>n+Number(r.quantity||0),0) : 0;
  const previewRows = tab === "cash" ? categorySales.map(r=>({name:r.category,qty:r.quantity,value:r.amount})) : tab === "credit" ? creditGroups.map(([,g])=>{const r=[...g.categories.values()].flatMap(c=>[...c.meals.values()].flatMap(m=>m.rows));return {name:g.name,qty:sumRows(r).quantity,value:sumRows(r).total};}) : tab === "consumption" ? consumption.map(r=>({name:r.item_name,qty:Number(r.quantity||0),value:Number(r.amount||0)})) : [];
  const csv = () => {
    const esc=(v:string|number)=>`"${String(v).replace(/"/g,'""')}"`;
    const content=[exportHeaders,...exportRows].map(row=>row.map(esc).join(",")).join("\r\n");
    const url=URL.createObjectURL(new Blob(["\ufeff"+content],{type:"text/csv;charset=utf-8"}));
    const a=document.createElement("a");a.href=url;a.download=`aig-${tab}-${from}-${to}.csv`;a.click();URL.revokeObjectURL(url);
  };
  return <div className="space-y-5 p-4 md:p-7">
    <div><h1 className="text-2xl font-bold">F&B and Finance Reports</h1><p className="text-sm text-muted-foreground">Cash Sales, Credit Sales, Consumption and Consolidated Report</p></div>
    <div className="rounded-xl border bg-card p-4 space-y-4">
      <Tabs value={tab} onValueChange={v=>setTab(v as Tab)}>
        <TabsList className="h-auto flex flex-wrap justify-start">
          {(Object.keys(tabLabels) as Tab[]).map(key=><TabsTrigger key={key} value={key}>{tabLabels[key]}</TabsTrigger>)}
        </TabsList>
      </Tabs>
      <div className="flex flex-wrap items-end gap-3 print:hidden">
        <label className="text-sm">Period<select className="ml-2 rounded-md border bg-background p-2" value={period} onChange={e=>changePeriod(e.target.value)}><option value="today">Today</option><option value="week">Last 7 days</option><option value="month">This month</option><option value="custom">Custom</option></select></label>
        <label className="text-sm">From<Input type="date" value={from} onChange={e=>{setPeriod("custom");setFrom(e.target.value)}} /></label>
        <label className="text-sm">To<Input type="date" value={to} onChange={e=>{setPeriod("custom");setTo(e.target.value)}} /></label>
        {tab !== "credit" && <Button variant="outline" disabled={!data || report.isFetching} onClick={csv}>Export CSV (Excel)</Button>}
        {tab !== "credit" && <Button variant="outline" disabled={!data || report.isFetching} onClick={()=>window.print()}>Print / PDF</Button>}
      </div>
      {tab === "credit" && <div className="grid gap-3 md:grid-cols-2 print:hidden">
        <label className="text-sm">Credit account<select aria-label="Credit account" className="block w-full rounded-md border bg-background p-2" value={account} onChange={e=>{setAccount(e.target.value);setPerson("");}}><option value="">All accounts</option>{(data?.credit_filters?.accounts??[]).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
        <label className="text-sm">Authorized person<select aria-label="Authorized person" className="block w-full rounded-md border bg-background p-2" value={person} onChange={e=>setPerson(e.target.value)}><option value="">All persons</option>{[...new Set((data?.credit_filters?.persons??[]).filter(p=>(!account||String(p.credit_account_id)===account)).map(p=>p.name).filter(Boolean))].map(name=><option key={name} value={name}>{name}</option>)}</select></label>
      </div>}
      {approvalType && <div className="rounded-lg border p-3 space-y-3 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-medium">{tabLabels[approvalType]} approval: <span className="capitalize">{approvalData?.approval?.status ?? "Draft"}</span></div>
          {approvalData?.approval && !approvalData.snapshot_current && <span className="text-sm text-destructive">Report data changed after validation. Revalidation required.</span>}
        </div>
        {approvalData?.approval?.remarks && <p className="text-sm text-muted-foreground">Remarks: {approvalData.approval.remarks}</p>}
        <div className="flex flex-wrap gap-2 items-center">
          <Input className="max-w-sm" placeholder="Remarks (required when returning)" value={approvalRemarks} onChange={e=>setApprovalRemarks(e.target.value)}/>
          {approvalData?.can_validate && !["validated","approved"].includes(approvalData?.approval?.status ?? "") && <Button disabled={approvalBusy || !data || report.isFetching} onClick={()=>{setApprovalError("");setConfirmAction("validate")}}>Validate & Submit to Manager</Button>}
          {approvalData?.can_approve && approvalData?.approval?.status === "validated" && <Button disabled={approvalBusy || !approvalData.snapshot_current} onClick={()=>{setApprovalError("");setConfirmAction("approve")}}>Approve Report</Button>}
          {approvalData?.approval?.status === "validated" && !approvalData.can_approve && approvalData.snapshot_current && <span className="text-sm text-muted-foreground">Awaiting Manager Approval</span>}
          {(approvalData?.can_validate || approvalData?.can_approve) && approvalData?.approval?.status === "validated" && <Button variant="outline" disabled={approvalBusy || !approvalRemarks.trim()} onClick={()=>{setApprovalError("");setConfirmAction("return")}}>Return for Correction</Button>}
        </div>
        {approvalError && <p className="text-sm text-destructive">{approvalError}</p>}
      </div>}
      {confirmAction && approvalType && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 print:hidden" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!approvalBusy)setConfirmAction(null)}}>
        <div role="dialog" aria-modal="true" aria-labelledby="fb-approval-dialog-title" className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-xl border bg-background p-5 shadow-xl space-y-4">
          <div className="flex items-start justify-between gap-3"><div><h2 id="fb-approval-dialog-title" className="text-lg font-semibold">{confirmAction === "validate" ? "Validate & Submit to Manager" : confirmAction === "approve" ? "Approve Report" : "Return for Correction"}</h2><p className="text-sm text-muted-foreground">{tabLabels[approvalType]} · {from} to {to}</p></div><Button type="button" variant="ghost" disabled={approvalBusy} onClick={()=>setConfirmAction(null)}>Close</Button></div>
          <div className="grid grid-cols-2 gap-3 rounded-lg border p-3 text-sm"><div><span className="text-muted-foreground">Report type</span><p className="font-medium">{tabLabels[approvalType]}</p></div><div><span className="text-muted-foreground">Total quantity</span><p className="font-medium">{reportQuantity}</p></div><div className="col-span-2"><span className="text-muted-foreground">Report total</span><p className="text-xl font-bold">{amount(total)} ETB</p></div></div>
          <div className="max-h-48 overflow-y-auto rounded-lg border"><Table><TableHeader><TableRow><TableHead>Category / Item</TableHead><TableHead className="text-right">Quantity</TableHead><TableHead className="text-right">Total (ETB)</TableHead></TableRow></TableHeader><TableBody>{previewRows.map((r,i)=><TableRow key={`${r.name}-${i}`}><TableCell>{r.name}</TableCell><TableCell className="text-right">{r.qty}</TableCell><TableCell className="text-right">{amount(r.value)}</TableCell></TableRow>)}<TableRow className="font-semibold"><TableCell>Total</TableCell><TableCell className="text-right">{reportQuantity}</TableCell><TableCell className="text-right">{amount(total)}</TableCell></TableRow></TableBody></Table></div>
          {confirmAction === "approve" && approvalData?.approval?.remarks && <div className="rounded-lg border p-3 text-sm"><span className="text-muted-foreground">F&B validation remarks</span><p>{approvalData.approval.remarks}</p>{approvalData.approval.validated_at && <p className="text-muted-foreground">Validated: {approvalData.approval.validated_at}</p>}</div>}
          <label className="block text-sm font-medium">Remarks {confirmAction === "return" ? "(required)" : "(optional)"}<Input className="mt-2" value={approvalRemarks} onChange={e=>setApprovalRemarks(e.target.value)} placeholder="Enter remarks" /></label>
          {approvalError && <p role="alert" className="text-sm text-destructive">{approvalError}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={approvalBusy} onClick={()=>setConfirmAction(null)}>Cancel</Button><Button type="button" disabled={approvalBusy || !data || report.isFetching || (confirmAction === "return" && !approvalRemarks.trim())} onClick={()=>submitApproval(confirmAction)}>{approvalBusy ? "Processing..." : confirmAction === "validate" ? "Confirm & Submit to Manager" : confirmAction === "approve" ? "Confirm Approval" : "Return for Correction"}</Button></div>
        </div>
      </div>}
      <div className="hidden print:block text-center"><h2 className="font-bold text-lg">ADAMA INVESTMENT GROUP (AIG)</h2><h3 className="font-semibold">{tabLabels[tab]}</h3><p>{from} — {to}</p></div>
      {!valid && <p className="text-destructive">Choose a valid date range.</p>}
      {report.isLoading && <p>Loading report...</p>}
      {report.isError && <p className="text-destructive">Unable to load report. Check your account permissions and backend deployment.</p>}
      {data && tab === "credit" && <><div className="overflow-x-auto"><Table><TableHeader><TableRow>{["Credit Account / Meal Category / Meal Type / Order", "Persons / Qty", "Total (ETB)"].map(h=><TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>
        {creditGroups.map(([accountId, accountGroup]) => {
          const accountRows = [...accountGroup.categories.values()].flatMap(c=>[...c.meals.values()].flatMap(m=>m.rows));
          const accountKey = `a:${accountId}`;
          const accountOpen = expandedCredit.includes(accountKey);
          const accountTotals = sumRows(accountRows);
          return <>
            <TableRow key={accountKey} className="font-semibold bg-muted/40"><TableCell><button type="button" className="inline-flex items-center gap-2 text-left" onClick={()=>toggleCredit(accountKey)}>{accountOpen?<ChevronDown className="h-4 w-4"/>:<ChevronRight className="h-4 w-4"/>}{accountGroup.name}</button></TableCell><TableCell>{accountTotals.quantity}</TableCell><TableCell>{amount(accountTotals.total)}</TableCell></TableRow>
            {(accountOpen) && [...accountGroup.categories.entries()].map(([slug,category])=>{
              const categoryKey = `${accountKey}:c:${slug}`;
              const categoryOpen = expandedCredit.includes(categoryKey);
              const categoryRows = [...category.meals.values()].flatMap(m=>m.rows);
              const categoryTotals = sumRows(categoryRows);
              return <>
                <TableRow key={categoryKey} className="font-semibold"><TableCell className="pl-7"><button type="button" className="inline-flex items-center gap-2 text-left" onClick={()=>toggleCredit(categoryKey)}>{categoryOpen?<ChevronDown className="h-4 w-4"/>:<ChevronRight className="h-4 w-4"/>}{category.name}</button></TableCell><TableCell>{categoryTotals.quantity}</TableCell><TableCell>{amount(categoryTotals.total)}</TableCell></TableRow>
                {categoryOpen && [...category.meals.entries()].map(([mealName,meal])=>{
                  const mealKey = `${categoryKey}:m:${mealName}`;
                  const mealOpen = expandedCredit.includes(mealKey);
                  const mealTotals = sumRows(meal.rows);
                  return <>
                    <TableRow key={mealKey} className="font-medium"><TableCell className="pl-10"><button type="button" className="inline-flex items-center gap-2 text-left" onClick={()=>toggleCredit(mealKey)}>{mealOpen?<ChevronDown className="h-4 w-4"/>:<ChevronRight className="h-4 w-4"/>}{meal.name}</button></TableCell><TableCell>{mealTotals.quantity}</TableCell><TableCell>{amount(mealTotals.total)}</TableCell></TableRow>
                    {mealOpen && (slug === "order_based" ? [...meal.people.entries()].map(([name,personRows])=>{
                      const personKey = `${mealKey}:p:${name}`;
                      const personOpen = expandedCredit.includes(personKey);
                      const personTotals = sumRows(personRows);
                      return <>
                        <TableRow key={personKey}><TableCell className="pl-12"><button type="button" className="inline-flex items-center gap-2 text-left" onClick={()=>toggleCredit(personKey)}>{personOpen?<ChevronDown className="h-4 w-4"/>:<ChevronRight className="h-4 w-4"/>}{name}</button></TableCell><TableCell>{personTotals.quantity}</TableCell><TableCell>{amount(personTotals.total)}</TableCell></TableRow>
                        {personOpen && creditDetailRows(personRows,personKey)}
                      </>;
                    }) : creditDetailRows(meal.rows,mealKey))}
                  </>;
                })}
              </>;
            })}
          </>;
        })}
        {!creditSales.length&&<TableRow><TableCell colSpan={3} className="text-center">No credit sales found for the selected filters.</TableCell></TableRow>}
      </TableBody></Table></div><p className="text-right font-semibold">Total Credit Sales: {amount(total)} ETB</p></>}
      {data && tab !== "credit" && <><div className="overflow-x-auto"><Table><TableHeader><TableRow>{headers.map(h=><TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>
        {isSalesTab ? categorySales.map(group => <>{/* Category totals always reflect the complete date-filtered result. */}
          <TableRow key={`${tab}-${group.category}-category`} className="font-semibold">
            <TableCell>—</TableCell>
            <TableCell><button type="button" className="inline-flex items-center gap-2 text-left print:hidden" aria-expanded={expandedCategories.includes(group.category)} onClick={() => toggleCategory(group.category)}>
              {expandedCategories.includes(group.category) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}{group.category}
            </button><span className="hidden print:inline">{group.category}</span></TableCell>
            <TableCell>{group.quantity}</TableCell><TableCell>{amount(group.amount)}</TableCell>
          </TableRow>
          {group.items.map((item, index) => <TableRow key={`${tab}-${group.category}-${index}`} className={expandedCategories.includes(group.category) ? "" : "hidden print:table-row"}>
            <TableCell>{item.report_date}</TableCell><TableCell className="pl-8">{item.item_name}</TableCell>
            <TableCell>{item.quantity}</TableCell><TableCell>{amount(item.amount)}</TableCell>
          </TableRow>)}
        </>) : rows.map((row,i)=><TableRow key={i}>{row.map((value,j)=><TableCell key={j}>{value}</TableCell>)}</TableRow>)}
        {(isSalesTab ? !categorySales.length : !rows.length) && <TableRow><TableCell colSpan={headers.length} className="text-center">No records for the selected period.</TableCell></TableRow>}
      </TableBody></Table></div>
      <p className="text-right font-semibold">Total {tab==="consumption"?"Consumption Cost":tab==="summary"?"Revenue":"Sales"}: {amount(total)} ETB</p>
      {tab==="summary" && !data.finance_details_available && <p className="text-sm text-muted-foreground">Expense and result figures are restricted to Finance. Revenue remains visible to F&B Controller.</p>}
      {tab==="summary" && data.finance_details_available && <p className="text-sm text-muted-foreground">Result = sales revenue minus recorded finance expenses. This is not a full profit-and-loss statement. Consumption cost is reported separately.</p>}
      </>}
    </div>
  </div>;
}
