"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronRight } from "lucide-react";

type Sale = { report_date: string; sale_type: "cash" | "credit"; category: string; item_name: string; quantity: number; amount: number };
type CreditSale = { report_date:string; order_id:number; order_number:string; credit_account_id:number|null; credit_account:string; credit_agreement_id:number|null; authorized_person:string; item_name:string; quantity:number; amount:number };
type CreditFilters = {accounts:{id:number;name:string}[];agreements:{id:number;credit_account_id:number;meal_type:string;status:string}[];persons:{credit_account_id:number;credit_agreement_id:number|null;name:string}[]};
type Consumption = { report_date: string; item_name: string; unit: string; quantity: number; amount: number };
type Daily = { date: string; cash: number; credit: number; revenue: number; expenses: number | null; result: number | null };
type Report = { success: boolean; data: { sales: Sale[]; consumption: Consumption[]; daily: Daily[]; finance_details_available: boolean; credit_sales:CreditSale[]; credit_filters:CreditFilters } };
type Tab = "cash" | "credit" | "consumption" | "summary";
const amount = (v: number | null | undefined) => v == null ? "—" : Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const tabLabels: Record<Tab,string> = {cash:"Cash Sales",credit:"Credit Sales",consumption:"Consumption",summary:"Consolidated Report"};

export function FbFinanceReportsPage() {
  const [tab,setTab] = useState<Tab>("cash");
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [account,setAccount] = useState("");
  const [agreement,setAgreement] = useState("");
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
    queryKey:["fb-finance-reports",from,to,account,agreement,person],
    queryFn:async()=> (await api.get("/reports/fb-finance",{params:{date_from:from,date_to:to,...(account?{credit_account_id:account}:{}),...(agreement?{credit_agreement_id:agreement}:{}),...(person?{authorized_person:person}:{})}})).data,
    enabled:valid,
  });
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
    const groups = new Map<string,{name:string;people:Map<string,CreditSale[]>}>();
    for(const row of creditSales){
      const key=String(row.credit_account_id);
      if(!groups.has(key)) groups.set(key,{name:row.credit_account,people:new Map()});
      const people=groups.get(key)!.people;
      if(!people.has(row.authorized_person)) people.set(row.authorized_person,[]);
      people.get(row.authorized_person)!.push(row);
    }
    return [...groups.entries()];
  },[creditSales]);
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
  const exportHeaders = tab === "credit" ? ["Credit Account","Agreement","Authorized Person","Order","Date","Item","Quantity","Total (ETB)"] : headers;
  const exportRows:(string|number)[][] = tab === "credit" ? creditSales.map(r=>[r.credit_account,r.credit_agreement_id ?? "",r.authorized_person,r.order_number,r.report_date,r.item_name,r.quantity,amount(r.amount)]) : rows;
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
        <Button variant="outline" disabled={!data || report.isFetching} onClick={csv}>Export CSV (Excel)</Button>
        <Button variant="outline" disabled={!data || report.isFetching} onClick={()=>window.print()}>Print / PDF</Button>
      </div>
      {tab === "credit" && <div className="grid gap-3 md:grid-cols-3 print:hidden">
        <label className="text-sm">Credit account<select aria-label="Credit account" className="block w-full rounded-md border bg-background p-2" value={account} onChange={e=>{setAccount(e.target.value);setAgreement("");setPerson("");}}><option value="">All accounts</option>{(data?.credit_filters?.accounts??[]).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
        <label className="text-sm">Agreement<select aria-label="Agreement" className="block w-full rounded-md border bg-background p-2" value={agreement} onChange={e=>{setAgreement(e.target.value);setPerson("");}}><option value="">All agreements</option>{(data?.credit_filters?.agreements??[]).filter(a=>!account||String(a.credit_account_id)===account).map(a=><option key={a.id} value={a.id}>#{a.id} — {a.meal_type}</option>)}</select></label>
        <label className="text-sm">Authorized person<select aria-label="Authorized person" className="block w-full rounded-md border bg-background p-2" value={person} onChange={e=>setPerson(e.target.value)}><option value="">All persons</option>{[...new Set((data?.credit_filters?.persons??[]).filter(p=>(!account||String(p.credit_account_id)===account)&&(!agreement||String(p.credit_agreement_id)===agreement)).map(p=>p.name).filter(Boolean))].map(name=><option key={name} value={name}>{name}</option>)}</select></label>
      </div>}
      <div className="hidden print:block text-center"><h2 className="font-bold text-lg">ADAMA INVESTMENT GROUP (AIG)</h2><h3 className="font-semibold">{tabLabels[tab]}</h3><p>{from} — {to}</p></div>
      {!valid && <p className="text-destructive">Choose a valid date range.</p>}
      {report.isLoading && <p>Loading report...</p>}
      {report.isError && <p className="text-destructive">Unable to load report. Check your account permissions and backend deployment.</p>}
      {data && tab === "credit" && <><div className="overflow-x-auto"><Table><TableHeader><TableRow>{["Credit Account / Authorized Person / Order","Quantity","Total (ETB)"].map(h=><TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>
        {creditGroups.map(([id,group])=>{const all=[...group.people.values()].flat();const open=expandedCredit.includes(`a${id}`);return <TableRow key={`account-${id}`} className="font-semibold"><TableCell><button onClick={()=>setExpandedCredit(v=>open?v.filter(x=>x!==`a${id}`):[...v,`a${id}`])} className="inline-flex items-center gap-2">{open?<ChevronDown className="h-4 w-4"/>:<ChevronRight className="h-4 w-4"/>}{group.name}</button></TableCell><TableCell>{all.reduce((n,r)=>n+Number(r.quantity),0)}</TableCell><TableCell>{amount(all.reduce((n,r)=>n+Number(r.amount),0))}</TableCell></TableRow>})}
        {creditGroups.flatMap(([id,group])=>expandedCredit.includes(`a${id}`)?[...group.people.entries()].flatMap(([name,items])=>{const key=`p${id}:${name}`,open=expandedCredit.includes(key);return [<TableRow key={key} className="font-medium"><TableCell className="pl-8"><button className="inline-flex items-center gap-2" onClick={()=>setExpandedCredit(v=>open?v.filter(x=>x!==key):[...v,key])}>{open?<ChevronDown className="h-4 w-4"/>:<ChevronRight className="h-4 w-4"/>}{name}</button></TableCell><TableCell>{items.reduce((n,r)=>n+Number(r.quantity),0)}</TableCell><TableCell>{amount(items.reduce((n,r)=>n+Number(r.amount),0))}</TableCell></TableRow>,...(open?items.map((r,i)=><TableRow key={`${key}-${r.order_id}-${i}`}><TableCell className="pl-14">{r.order_number} · {r.report_date} · {r.item_name}</TableCell><TableCell>{r.quantity}</TableCell><TableCell>{amount(r.amount)}</TableCell></TableRow>):[])];}):[])}
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
