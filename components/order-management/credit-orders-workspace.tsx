"use client";

import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { orderService } from "@/services/order-management/order.service";
import { authService } from "@/services/auth/auth.service";
import { CreditOrdersPage } from "@/components/order-management/order-pages";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function money(value: unknown) {
  return Number(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function isCashierRole() {
  const user = authService.getStoredUser();
  const roles = [...authService.getStoredRoles(), user?.role, ...(user?.roles ?? [])]
    .filter(Boolean)
    .map((role) => String(role).trim().toLowerCase().replace(/[_-]+/g, " "));

  return roles.includes("cashier");
}

function PendingAuthorizedOrders() {
  const queryClient = useQueryClient();
  const pendingQuery = useQuery({
    queryKey: ["pending-authorized-credit-orders"],
    queryFn: () => orderService.pendingAuthorizedCreditOrders({ per_page: 100 }),
  });

  const pending = pendingQuery.data?.data ?? [];

  async function confirm(id: string | number) {
    try {
      await orderService.confirmAuthorizedCreditOrder(id);
      toast.success("Authorized-person order confirmed as credit order");
      await queryClient.invalidateQueries({ queryKey: ["pending-authorized-credit-orders"] });
      await queryClient.invalidateQueries({ queryKey: ["credit-orders"] });
      await queryClient.invalidateQueries({ queryKey: ["cashier-dashboard"] });
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? error?.message ?? "Failed to confirm credit order");
    }
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Pending authorized-person orders</CardTitle>
          <CardDescription>
            Customer orders submitted through an active credit agreement. Confirm them before they enter the official credit-order workflow.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => pendingQuery.refetch()} disabled={pendingQuery.isFetching}>
          <RefreshCw className={`mr-2 h-4 w-4 ${pendingQuery.isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Authorized person</TableHead>
              <TableHead>Credit account</TableHead>
              <TableHead>Meal type</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pending.map((order: any) => (
              <TableRow key={order.id}>
                <TableCell className="font-medium">{order.order_number ?? `#${order.id}`}</TableCell>
                <TableCell>
                  <div>{order.credit_account_user?.full_name ?? order.customer_name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{order.credit_account_user?.phone ?? order.customer_phone ?? ""}</div>
                </TableCell>
                <TableCell>{order.credit_account?.name ?? "—"}</TableCell>
                <TableCell>{order.meal_type ?? order.credit_agreement?.meal_type ?? "—"}</TableCell>
                <TableCell>{money(order.total)} ETB</TableCell>
                <TableCell><Badge variant="secondary">{order.credit_status ?? order.status ?? "pending"}</Badge></TableCell>
                <TableCell className="text-right">
                  <Button size="sm" onClick={() => confirm(order.id)}>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Confirm credit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!pending.length && !pendingQuery.isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No pending authorized-person orders.
                </TableCell>
              </TableRow>
            )}
            {pendingQuery.isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  Loading pending authorized-person orders...
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function CreditOrdersWorkspace() {
  const cashier = useMemo(() => isCashierRole(), []);

  if (cashier) {
    return <PendingAuthorizedOrders />;
  }

  return <CreditOrdersPage />;
}
