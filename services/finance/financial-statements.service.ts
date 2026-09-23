import api from "@/lib/api";
const unwrap=<T,>(r:any):T=>r?.data?.data ?? r?.data ?? r;
export const financialStatementsService={
 dashboard:async(params:any)=>unwrap<any>(await api.get("/finance/accounting/reports/dashboard",{params})),
 trialBalance:async(params:any)=>unwrap<any>(await api.get("/finance/accounting/reports/trial-balance",{params})),
 profitLoss:async(params:any)=>unwrap<any>(await api.get("/finance/accounting/reports/profit-loss",{params})),
 balanceSheet:async(params:any)=>unwrap<any>(await api.get("/finance/accounting/reports/balance-sheet",{params})),
 cashFlow:async(params:any)=>unwrap<any>(await api.get("/finance/accounting/reports/cash-flow",{params})),
};
