"use client";

import { BarChart3, CreditCard, FileClock, Receipt, RotateCcw } from "lucide-react";
import { SecuredRoleDashboard } from "@/components/dashboards/secured-role-dashboard";

export default function FinanceDashboardPage() {
  return <SecuredRoleDashboard roleKey="finance" title="Finance Dashboard" description="Monitor collections, outstanding bills, refunds, credit settlements, and financial reporting." endpoint="/finance/dashboard" icon={BarChart3} actions={[
    { label: "Payments", description: "Review recorded payment transactions.", href: "/dashboard/modules/finance", icon: Receipt, permission: "payments.read" },
    { label: "Pending Refunds", description: "Review refund requests awaiting approval.", href: "/dashboard/modules/finance", icon: RotateCcw, permission: "payments.refund.approve" },
    { label: "Credit Accounts", description: "Manage credit accounts and settlements.", href: "/dashboard/order-management/credit-accounts", icon: CreditCard, permission: "credit.accounts.read" },
    { label: "Financial Reports", description: "Open financial and settlement reports.", href: "/dashboard/modules/reports/cash-sales", icon: FileClock, permission: "reports.financial.read" },
  ]} />;
}
