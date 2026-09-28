"use client";

import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import api, { unwrap } from "@/lib/api";

type Num = number | null;
type Report = {
  report_date:string;
  executive:{sales:number;sales_change:Num;sales_ly:number;covers:number;covers_change:Num;covers_ly:number;average_check:number;average_check_change:Num;average_check_ly:number;food_cost_pct:Num;beverage_cost_pct:Num;prime_cost_pct:Num};
  daily_flash:Record<string,Num>;
  sales_performance:Array<{date:string;label:string;sales:number;sales_ly:number;covers:number}>;
  food_beverage_cost:Record<string,Num>;
  prime_cost:Record<string,Num>;
  inventory:Record<string,Num>;
  procurement:Record<string,Num>;
  credit_ar:Record<string,Num>;
  pnl:Record<string,Num>;
  cash_position:Record<string,Num>;
  exceptions:Array<{area:string;issue:string;impact:Num;action:string}>;
};

const money=(v:Num)=>v==null?"—":`ETB ${new Intl.NumberFormat("en-US",{maximumFractionDigits:0}).format(v)}`;
const num=(v:Num)=>v==null?"—":new Intl.NumberFormat("en-US",{maximumFractionDigits:0}).format(v);
const pct=(v:Num)=>v==null?"—":`${v.toFixed(1)}%`;
const change=(v:Num)=>v==null?"—":`${v>=0?"▲":"▼"} ${Math.abs(v).toFixed(1)}%`;
const tone=(v:Num)=>v==null?"text-muted-foreground":"text-primary";

function Section({title,children,className=""}:{title:string;children:ReactNode;className?:string}){
 return <section className={`overflow-hidden rounded-md border border-border bg-background text-foreground shadow-sm ${className}`}><div className="border-b border-border bg-background px-3 py-2 text-[13px] font-extrabold tracking-wide text-foreground">{title}</div><div className="p-3">{children}</div></section>
}
function Row({label,value,bold=false}:{label:string;value:React.ReactNode;bold?:boolean}){return <div className={`flex items-center justify-between gap-3 border-b border-primary/15 py-1.5 text-[11px] last:border-0 ${bold?"font-bold":""}`}><span className="text-muted-foreground">{label}</span><span className="text-right text-foreground">{value}</span></div>}
function Donut({value,label}:{value:Num;label:string}){const safe=Math.max(0,Math.min(100,value??0));return <div className="relative mx-auto h-28 w-28 rounded-full" style={{background:`conic-gradient(var(--primary) ${safe*3.6}deg,var(--primary) 0)`}}><div className="absolute inset-[13px] flex flex-col items-center justify-center rounded-full bg-background"><b className="text-xl text-foreground">{value==null?"—":pct(value)}</b><span className="text-[9px] text-muted-foreground">{label}</span></div></div>}

export default function ManagerDashboard(){
 const q=useQuery({queryKey:["manager-management-report-v2"],queryFn:async()=>unwrap<{data:Report}>(await api.get("/manager/dashboard")).data,refetchInterval:60000});
 const d=q.data;
 if(q.isLoading)return <div className="p-8 text-sm">Loading management report…</div>;
 if(q.isError||!d)return <div className="p-8 text-sm text-destructive">Unable to load the manager management report.</div>;
 const e=d.executive, f=d.daily_flash, p=d.pnl, c=d.cash_position;
 return <div className="min-h-screen bg-background p-2 text-foreground md:p-3">
  <div className="grid grid-cols-1 gap-2 xl:grid-cols-12">
   <Section title="EXECUTIVE DASHBOARD" className="xl:col-span-3"><div className="grid grid-cols-3 divide-x text-center"><Kpi label="SALES" value={money(e.sales)} delta={e.sales_change} sub={`vs LY ${money(e.sales_ly)}`}/><Kpi label="COVERS" value={num(e.covers)} delta={e.covers_change} sub={`vs LY ${num(e.covers_ly)}`}/><Kpi label="AVERAGE CHECK" value={money(e.average_check)} delta={e.average_check_change} sub={`vs LY ${money(e.average_check_ly)}`}/></div><div className="my-4 border-t"/><div className="grid grid-cols-3 divide-x text-center"><Mini label="FOOD COST %" value={pct(e.food_cost_pct)}/><Mini label="BEVERAGE COST %" value={pct(e.beverage_cost_pct)}/><Mini label="PRIME COST %" value={pct(e.prime_cost_pct)}/></div></Section>
   <Section title="DAILY FLASH REPORT" className="xl:col-span-3"><Row label="Date" value={d.report_date}/><Row label="Total Covers" value={num(f.covers)}/><Row label="Total Sales" value={money(f.sales)}/><Row label="Average Check" value={money(f.average_check)}/><Row label="Food Cost %" value={pct(f.food_cost_pct)}/><Row label="Beverage Cost %" value={pct(f.beverage_cost_pct)}/><Row label="Prime Cost %" value={pct(f.prime_cost_pct)}/><Row label="Discounts/Voids/Refunds" value={money(f.discounts_voids_refunds)}/><Row label="Cash Variance" value={money(f.cash_variance)}/></Section>
   <Section title="SALES PERFORMANCE" className="xl:col-span-3"><div className="h-44"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={d.sales_performance}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="label" tick={{fontSize:9}}/><YAxis tick={{fontSize:9}} width={42}/><Tooltip formatter={(v:any)=>money(Number(v))}/><Area type="monotone" dataKey="sales" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.12} name="Sales"/><Line type="monotone" dataKey="sales_ly" stroke="var(--primary)" strokeDasharray="5 4" name="Sales LY"/></ComposedChart></ResponsiveContainer></div><div className="mt-2 grid grid-cols-3 bg-primary/10 px-2 py-1 text-[10px] font-bold"><span>Period</span><span className="text-right">Sales</span><span className="text-right">Covers</span></div>{d.sales_performance.slice(-3).map(x=><div key={x.date} className="grid grid-cols-3 border-b px-2 py-1 text-[10px]"><span>{x.label}</span><span className="text-right">{money(x.sales)}</span><span className="text-right">{x.covers}</span></div>)}</Section>
   <Section title="FOOD & BEVERAGE COST" className="xl:col-span-3"><div className="grid grid-cols-2 gap-3"><Donut value={d.food_beverage_cost.food_cost_pct} label="Food Cost"/><Donut value={d.food_beverage_cost.beverage_cost_pct} label="Beverage Cost"/></div><div className="mt-2"><Row label="Food Cost" value={money(d.food_beverage_cost.food_cost)}/><Row label="Beverage Cost" value={money(d.food_beverage_cost.beverage_cost)}/><Row label="Net Sales" value={money(f.net_sales)}/></div></Section>

   <Section title="PRIME COST" className="xl:col-span-3"><div className="grid grid-cols-[110px_1fr] items-center gap-3"><Donut value={d.prime_cost.prime_cost_pct} label="Prime Cost"/><div><Row label="Food Cost" value={money(d.prime_cost.food_cost)}/><Row label="Beverage Cost" value={money(d.prime_cost.beverage_cost)}/><Row label="Labor Cost" value={money(d.prime_cost.labor_cost)}/><Row label="Other" value={money(d.prime_cost.other_cost)}/></div></div></Section>
   <Section title="INVENTORY VARIANCE" className="xl:col-span-3"><TableHead cols={["Measure","Value"]}/><Row label="Stock Value" value={money(d.inventory.stock_value)}/><Row label="Today's Consumption" value={money(d.inventory.today_consumption)}/><Row label="Low Stock Items" value={num(d.inventory.low_stock)}/><Row label="Out of Stock" value={num(d.inventory.out_of_stock)}/><Row label="Book vs Actual Variance" value={money(d.inventory.book_vs_actual_variance)} bold/></Section>
   <Section title="PROCUREMENT SUMMARY" className="xl:col-span-3"><Row label="Total Purchases" value={money(d.procurement.total_purchases)}/><Row label="Number of POs" value={num(d.procurement.number_of_pos)}/><Row label="Pending Approval" value={num(d.procurement.pending_approval)}/><Row label="Open PO" value={num(d.procurement.open_po)}/><Row label="Awaiting Delivery" value={num(d.procurement.awaiting_delivery)}/><Row label="Price Variance" value={pct(d.procurement.price_variance_pct)}/></Section>
   <Section title="CREDIT / AR SUMMARY" className="xl:col-span-3"><Row label="Total AR" value={money(d.credit_ar.total_ar)} bold/><Row label="Current (0–30)" value={money(d.credit_ar.current)}/><Row label="31–60 Days" value={money(d.credit_ar.days_31_60)}/><Row label="61–90 Days" value={money(d.credit_ar.days_61_90)}/><Row label="> 90 Days" value={money(d.credit_ar.over_90)}/></Section>

   <Section title="P&L SUMMARY (F&B)" className="xl:col-span-4"><div className="grid grid-cols-2 bg-primary/10 px-2 py-1 text-[10px] font-bold"><span>Line</span><span className="text-right">Actual</span></div><Row label="Total Revenue" value={money(p.total_revenue)}/><Row label="Refunds" value={money(p.refunds)}/><Row label="Net Revenue" value={money(p.net_revenue)} bold/><Row label="Cost of Sales" value={money(p.cost_of_sales)}/><Row label="Gross Profit" value={money(p.gross_profit)} bold/><Row label="Operating Expenses" value={money(p.operating_expenses)}/><Row label="Net Profit" value={money(p.net_profit)} bold/></Section>
   <Section title="CASH POSITION" className="xl:col-span-3"><Row label="Opening Cash" value={money(c.opening_cash)}/><Row label="Cash Received" value={money(c.cash_received)}/><Row label="Cash Paid Out" value={money(c.cash_paid_out)}/><Row label="Closing Cash" value={money(c.closing_cash)} bold/><Row label="Expected (POS)" value={money(c.expected_pos)}/><Row label="Variance" value={<span className={tone(c.variance)}>{money(c.variance)}</span>} bold/></Section>
   <Section title="EXCEPTIONS (ACTION REQUIRED)" className="border-primary/20 xl:col-span-5"><div className="grid grid-cols-[.7fr_2fr_.8fr_1.6fr] bg-primary/10 px-2 py-1 text-[10px] font-bold"><span>Area</span><span>Issue</span><span>Impact</span><span>Action</span></div>{d.exceptions.length?d.exceptions.map((x,i)=><div key={i} className="grid grid-cols-[.7fr_2fr_.8fr_1.6fr] border-b px-2 py-1.5 text-[10px]"><b>{x.area}</b><span>{x.issue}</span><span className={tone(x.impact)}>{money(x.impact)}</span><span>{x.action}</span></div>):<div className="py-8 text-center text-xs text-muted-foreground">No current exceptions requiring manager action.</div>}</Section>
  </div>
 </div>
}
function Kpi({label,value,delta,sub}:{label:string;value:string;delta:Num;sub:string}){return <div className="px-2"><div className="text-[9px] font-bold text-muted-foreground">{label}</div><div className="my-1 text-lg font-black">{value}</div><div className={`text-[10px] font-bold ${tone(delta)}`}>{change(delta)}</div><div className="mt-1 text-[9px] text-muted-foreground">{sub}</div></div>}
function Mini({label,value}:{label:string;value:string}){return <div className="px-2"><div className="text-[9px] font-bold text-muted-foreground">{label}</div><div className="mt-2 text-lg font-black">{value}</div></div>}
function TableHead({cols}:{cols:string[]}){return <div className="grid grid-cols-2 bg-primary/10 px-2 py-1 text-[10px] font-bold">{cols.map((c,i)=><span key={c} className={i?"text-right":""}>{c}</span>)}</div>}
