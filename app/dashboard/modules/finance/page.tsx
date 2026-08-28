"use client";

import { FinanceManagementPage } from "@/components/finance-management/finance-management-page";
import { GeneralAdminFinanceReportsPage } from "@/components/finance-management/general-admin-finance-reports-page";
import { authService } from "@/services/auth/auth.service";
import { normalizeRole } from "@/config/dashboard.config";

export default function FinancePage() {
  const roles = authService.getStoredRoles();
  const user = authService.getStoredUser();
  const isGeneralAdmin = roles.some((role) => normalizeRole(role) === "general-admin") || normalizeRole(user?.role ?? "") === "general-admin";

  return isGeneralAdmin ? <GeneralAdminFinanceReportsPage /> : <FinanceManagementPage scope="admin" />;
}
