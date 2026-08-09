"use client";

import { useQuery } from "@tanstack/react-query";
import { cashierDashboardService } from "@/services/dashboard/cashier-dashboard.service";

export function useCashierDashboardQuery() {
  return useQuery({
    queryKey: ["dashboard", "cashier"],
    queryFn: () => cashierDashboardService.get(),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}
