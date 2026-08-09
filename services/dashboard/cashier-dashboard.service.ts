import api from "@/lib/api";
import type { CashierDashboardResponse } from "@/types/dashboard/cashier-dashboard";

export const cashierDashboardService = {
  async get() {
    const response = await api.get<CashierDashboardResponse>(
      "/cashier/dashboard",
    );

    if (!response.data?.success || !response.data.data) {
      throw new Error(
        response.data?.message || "Could not load the cashier dashboard",
      );
    }

    return response.data.data;
  },
};
