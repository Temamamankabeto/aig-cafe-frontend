"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { MoreHorizontal, Plus, Printer, Search, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import api, { unwrap } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { printOrderBill as printOrderBillDocument } from "@/components/order-management/order-print-utils";
import { OrderTicketPreviewDialog } from "@/components/order-management/order-ticket-preview-dialog";
import { useMenuItemsQuery } from "@/hooks/queries/menu-management";
import { useTablesQuery } from "@/hooks/queries/table-management";
import {
  useCreditAccountsQuery,
  useCreditOrdersQuery,
  useOrderQuery,
  useOrdersQuery,
  usePrepTicketsQuery,
  useWaitersLiteQuery,
} from "@/hooks/queries/order-management";
import {
  useApproveCreditOrderMutation,
  useApproveCreditSettlementMutation,
  useApproveVoidOrderMutation,
  useConfirmOrderMutation,
  useCreateCreditAccountMutation,
  useUpdateCreditAccountMutation,
  useToggleCreditAccountMutation,
  useCreateOrderMutation,
  useRequestCancelOrderMutation,
  useServeOrderMutation,
  useSettleCreditOrderMutation,
  usePrepTicketActionMutation,
  useAddOrderItemMutation,
  useUpdateOrderItemMutation,
  useRemoveOrderItemMutation,
  usePrintOrderBillMutation,
  useReceiveOrderPaymentMutation,
  useRecordBillPaymentMutation,
  useConvertBillToCreditMutation,
} from "@/hooks/mutations/order-management";
import type {
  CreditAccount,
  CreditOrder,
  Order,
  OrderItemPayload,
} from "@/types/order-management";

type Scope = "admin" | "manager" | "food-controller" | "waiter" | "cashier";
type Period = "today" | "this_week" | "this_month" | "this_year" | "custom";

function money(v: unknown) {
  return Number(v ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function activeAgreements(account?: CreditAccount | null): any[] {
  const value = account as any;
  if (Array.isArray(value?.active_agreements)) return value.active_agreements;
  if (Array.isArray(value?.activeAgreements)) return value.activeAgreements;
  if (Array.isArray(value?.agreements)) {
    const today = new Date().toISOString().slice(0, 10);
    return value.agreements.filter((agreement: any) => String(agreement.status ?? "active") === "active" && String(agreement.start_date ?? "").slice(0, 10) <= today && String(agreement.end_date ?? "").slice(0, 10) >= today);
  }
  return [];
}

function date(v?: string) {
  return v ? new Date(v).toLocaleString() : "—";
}

function isInsideCustomDateRange(
  value: unknown,
  filters: { period?: Period; date_from?: string; date_to?: string },
) {
  if (filters.period !== "custom") return true;
  if (!filters.date_from && !filters.date_to) return true;
  if (!value) return false;

  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return false;

  const day = parsed.toISOString().slice(0, 10);
  if (filters.date_from && day < filters.date_from) return false;
  if (filters.date_to && day > filters.date_to) return false;
  return true;
}

function imageUrlFromMenu(item: any) {
  const raw =
    item?.image_url ||
    item?.image_path ||
    item?.image ||
    item?.photo_url ||
    item?.photo ||
    item?.menu_item?.image_url ||
    item?.menu_item?.image_path ||
    item?.menuItem?.image_url ||
    item?.menuItem?.image_path ||
    "";
  if (!raw) return "";
  if (String(raw).startsWith("http")) return String(raw);
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL || "")
    .replace(/\/api\/?$/, "")
    .replace(/\/$/, "");
  const cleaned = String(raw).replace(/^\//, "");
  return base ? `${base}/${cleaned}` : `/${cleaned}`;
}

function statusVariant(
  status?: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (
    [
      "completed",
      "served",
      "ready",
      "credit_approved",
      "fully_settled",
      "paid",
    ].includes(status ?? "")
  )
    return "default";
  if (
    ["cancelled", "blocked", "overdue", "void", "failed"].includes(status ?? "")
  )
    return "destructive";
  if (
    [
      "pending",
      "confirmed",
      "credit_pending",
      "partially_settled",
      "partial",
      "issued",
    ].includes(status ?? "")
  )
    return "secondary";
  return "outline";
}

function StatusBadge({ status }: { status?: string | null }) {
  return (
    <Badge variant={statusVariant(status ?? undefined)} className="capitalize">
      {(status ?? "unknown").replace(/_/g, " ")}
    </Badge>
  );
}

function lineItemsCount(order: Order) {
  return order.items?.length ?? order.order_items?.length ?? 0;
}

function normalizeOrderResponse(data: unknown): Order | undefined {
  const value = data as any;
  return value?.data?.order ?? value?.data ?? value?.order ?? value;
}

function normalizeOrderItems(order?: Order) {
  const value = order as any;
  return (
    value?.items ??
    value?.order_items ??
    value?.data?.items ??
    value?.data?.order_items ??
    []
  );
}

function canConfirmOrder(status?: string | null) {
  return ["submitted", "pending"].includes(String(status ?? "").toLowerCase());
}

function canServeOrder(status?: string | null) {
  return ["ready"].includes(String(status ?? "").toLowerCase());
}

function canRequestCancelOrder(status?: string | null) {
  return ["submitted", "pending", "confirmed", "in_progress", "ready"].includes(
    String(status ?? "").toLowerCase(),
  );
}

export function OrdersPage({
  scope = "admin",
  title = "Orders",
  createHref = "/dashboard/order-management/orders/create",
}: {
  scope?: Scope;
  title?: string;
  createHref?: string;
}) {
  const [filters, setFilters] = useState({
    page: 1,
    per_page: 10,
    search: "",
    status: "all",
    order_type: "all",
    payment_status: "all",
    payment_type: "all",
    period: "today" as Period,
    date_from: "",
    date_to: "",
  });

  const query = useOrdersQuery(
    filters,
    scope,
  );
  const rows = query.data?.data ?? [];
  const meta = query.data?.meta;
  const report = (meta as any)?.report;
  const filteredRows = useMemo(
    () => rows.filter((order: Order) => isInsideCustomDateRange((order as any).created_at ?? (order as any).createdAt, filters)),
    [rows, filters.period, filters.date_from, filters.date_to],
  );

  const confirm = useConfirmOrderMutation();
  const serve = useServeOrderMutation();
  const cancel = useRequestCancelOrderMutation();
  const isVoidApprover = ["admin", "manager", "food-controller"].includes(scope);
  const approvalScope = isVoidApprover ? scope as "admin" | "manager" | "food-controller" : "admin";
  const approveVoid = useApproveVoidOrderMutation(approvalScope);
  const [voidOrder, setVoidOrder] = useState<Order | null>(null);
  const [approvalReason, setApprovalReason] = useState("");

  const totals = useMemo(
    () => ({
      total: report?.total_orders ?? filteredRows.length,
      totalCost:
        report?.total_cost ??
        filteredRows.reduce(
          (sum, order) => sum + Number(order.total ?? order.total_amount ?? 0),
          0,
        ),
      confirmed: filteredRows.filter((o) => o.status === "confirmed").length,
      ready: filteredRows.filter((o) => o.status === "ready").length,
    }),
    [filteredRows, report],
  );

  const updateFilter = (patch: Partial<typeof filters>) =>
    setFilters((current) => ({ ...current, ...patch, page: 1 }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground">
            Create, track, confirm, serve, and cancel restaurant orders.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/order-management/orders/sold-items">See ordered items</Link>
          </Button>
          {!isVoidApprover && (
            <Button asChild>
              <Link href={createHref}>
                <Plus className="mr-2 h-4 w-4" />
                New order
              </Link>
            </Button>
          )}
        </div>
      </div>

      {scope !== "cashier" && scope !== "admin" && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="rounded-2xl">
            <CardHeader className="pb-2">
              <CardDescription>Total orders</CardDescription>
              <CardTitle>{totals.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="rounded-2xl">
            <CardHeader className="pb-2">
              <CardDescription>Confirmed</CardDescription>
              <CardTitle>{totals.confirmed}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="rounded-2xl">
            <CardHeader className="pb-2">
              <CardDescription>Ready</CardDescription>
              <CardTitle>{totals.ready}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="rounded-2xl">
            <CardHeader className="pb-2">
              <CardDescription>Total cost</CardDescription>
              <CardTitle>{money(totals.totalCost)}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      <Card className="rounded-2xl">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle>Order list and report</CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9 md:w-72"
                placeholder="Search order/customer"
                value={filters.search}
                onChange={(e) => updateFilter({ search: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
            <Select
              value={filters.period}
              onValueChange={(period: Period) =>
                updateFilter({
                  period,
                  ...(period === "custom" ? {} : { date_from: "", date_to: "" }),
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="this_week">This week</SelectItem>
                <SelectItem value="this_month">This month</SelectItem>
                <SelectItem value="this_year">This year</SelectItem>
                <SelectItem value="custom">Custom interval</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.status}
              onValueChange={(status) => updateFilter({ status })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Order status" />
              </SelectTrigger>
              <SelectContent>
                {[
                  "all",
                  "confirmed",
                  "in_progress",
                  "ready",
                  "served",
                  "completed",
                  "cancel_requested",
                  "cancelled",
                ].map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.order_type}
              onValueChange={(order_type) => updateFilter({ order_type })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Order type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="dine_in">Dine in</SelectItem>
                <SelectItem value="takeaway">Takeaway</SelectItem>
                <SelectItem value="delivery">Delivery</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.payment_status}
              onValueChange={(payment_status) =>
                updateFilter({ payment_status })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Payment status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All payment status</SelectItem>
                <SelectItem value="issued">Unpaid / issued</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="credit">Credit pending</SelectItem>
                <SelectItem value="void">Void</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.payment_type}
              onValueChange={(payment_type) =>
                updateFilter({ payment_type })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Payment filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All payment types</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="credit">Credit</SelectItem>
              </SelectContent>
            </Select>

            {filters.period === "custom" && (
              <>
                <Input
                  type="date"
                  value={filters.date_from}
                  onChange={(e) => updateFilter({ date_from: e.target.value })}
                />
                <Input
                  type="date"
                  value={filters.date_to}
                  onChange={(e) => updateFilter({ date_to: e.target.value })}
                />
              </>
            )}
          </div>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order number</TableHead>
                  <TableHead>Order type</TableHead>
                  <TableHead>Table</TableHead>
                  <TableHead>Waiter name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment status</TableHead>
                  <TableHead>Cost per order</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.isLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="h-24 text-center text-muted-foreground"
                    >
                      Loading orders...
                    </TableCell>
                  </TableRow>
                ) : filteredRows.length ? (
                  filteredRows.map((order: Order) => {
                    const detailHref = scope === "cashier"
                      ? `/dashboard/order-management/pos/orders/${order.id}`
                      : `/dashboard/order-management/orders/${order.id}`;
                    const waiterName =
                      (order as any).waiter?.name ??
                      (order as any).waiter_name ??
                      (order as any).assigned_waiter?.name ??
                      (order as any).created_by?.name ??
                      (order as any).creator?.name ??
                      "—";

                    return (
                      <TableRow key={order.id}>
                        <TableCell>
                          <Link href={detailHref} className="font-medium hover:underline">
                            {order.order_number ?? `#${order.id}`}
                          </Link>
                          <div className="text-xs text-muted-foreground">
                            {lineItemsCount(order)} items
                          </div>
                        </TableCell>
                        <TableCell className="capitalize">
                          {String((order as any).order_type ?? "—").replace(/_/g, " ")}
                        </TableCell>
                        <TableCell>
                          {order.table?.table_number ?? order.table?.name ?? "No table"}
                        </TableCell>
                        <TableCell>{waiterName}</TableCell>
                        <TableCell>
                          <StatusBadge status={order.status} />
                          {order.status === "cancel_requested" && (
                            <p className="mt-1 max-w-56 text-xs text-muted-foreground">
                              {order.cancel_request_reason || "No cancellation reason provided"}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={(order as any).payment_status ?? order.bill?.status ?? "unpaid"} />
                        </TableCell>
                        <TableCell className="font-medium">
                          {money(order.total ?? order.total_amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label="Open order actions">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={detailHref}>Detail</Link>
                              </DropdownMenuItem>
                              {isVoidApprover && order.status === "cancel_requested" && (
                                <DropdownMenuItem
                                  onSelect={() => {
                                    setVoidOrder(order);
                                    setApprovalReason(order.cancel_request_reason ?? "");
                                  }}
                                >
                                  Approve void
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No orders found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {meta?.current_page ?? 1} of {meta?.last_page ?? 1}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={(meta?.current_page ?? 1) <= 1}
                onClick={() =>
                  setFilters({
                    ...filters,
                    page: Math.max(1, filters.page - 1),
                  })
                }
              >
                Previous
              </Button>
              <Button
                variant="outline"
                disabled={(meta?.current_page ?? 1) >= (meta?.last_page ?? 1)}
                onClick={() =>
                  setFilters({ ...filters, page: filters.page + 1 })
                }
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(voidOrder)} onOpenChange={(open) => !open && setVoidOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve order void</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border bg-muted/40 p-4 text-sm">
              <p className="font-medium">{voidOrder?.order_number ?? `Order #${voidOrder?.id ?? ""}`}</p>
              <p className="mt-1 text-muted-foreground">
                Requested reason: {voidOrder?.cancel_request_reason || "No reason provided"}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="void-approval-reason">Approval reason</Label>
              <Textarea
                id="void-approval-reason"
                value={approvalReason}
                onChange={(event) => setApprovalReason(event.target.value)}
                placeholder="Enter the reason for approving this void"
                maxLength={1000}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setVoidOrder(null)} disabled={approveVoid.isPending}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={!voidOrder || !approvalReason.trim() || approveVoid.isPending}
                onClick={() => {
                  if (!voidOrder) return;
                  approveVoid.mutate(
                    { id: voidOrder.id, reason: approvalReason.trim() },
                    {
                      onSuccess: () => {
                        toast.success("Order void approved successfully");
                        setVoidOrder(null);
                        setApprovalReason("");
                      },
                      onError: (error) => {
                        toast.error(error instanceof Error ? error.message : "Failed to approve order void");
                      },
                    },
                  );
                }}
              >
                {approveVoid.isPending ? "Approving..." : "Approve void"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function SoldItemsReportPage({ scope = "waiter" }: { scope?: Scope }) {
  const [filters, setFilters] = useState({
    page: 1,
    per_page: 10,
    payment_type: "all",
    waiter_id: "all",
    period: "today" as Period,
    date_from: "",
    date_to: "",
  });
  const waitersQuery = useWaitersLiteQuery("", scope !== "waiter");
  const waiters = waitersQuery.data ?? [];

  const query = useOrdersQuery(
    {
      page: filters.page,
      per_page: filters.per_page,
      payment_type: filters.payment_type === "all" ? undefined : filters.payment_type,
      waiter_id: filters.waiter_id === "all" ? undefined : filters.waiter_id,
      period: filters.period,
      date_from: filters.period === "custom" ? filters.date_from || undefined : undefined,
      date_to: filters.period === "custom" ? filters.date_to || undefined : undefined,
    },
    scope === "cashier" ? "cashier" : scope === "waiter" ? "waiter" : "admin",
  );
  const orders = query.data?.data ?? [];
  const serverMeta = query.data?.meta;

  const getOrderPaymentMethod = (order: Order) => {
    const raw = String(
      (order as any).payment_type ??
        (order as any).payment_method ??
        (order as any).paymentMethod ??
        "cash",
    ).toLowerCase();
    return raw === "credit" ? "credit" : "cash";
  };

  const getOrderItemsTotal = (order: Order) => {
    const items = normalizeOrderItems(order);
    const itemTotal = items.reduce((sum: number, item: any) => {
      const menu = item.menu_item ?? item.menuItem ?? item.menu ?? {};
      const qty = Number(item.quantity ?? 0);
      const unit = Number(item.unit_price ?? item.price ?? menu.price ?? 0);
      return sum + Number(item.total_price ?? item.line_total ?? qty * unit);
    }, 0);

    if (items.length > 0 || itemTotal > 0) return itemTotal;

    return Number(
      (order as any).subtotal ??
        (order as any).sub_total ??
        (order as any).items_total ??
        0,
    );
  };

  const getOrderVat = (order: Order) =>
    Number(
      (order as any).vat_amount ??
        (order as any).tax_amount ??
        (order as any).vat_total ??
        (order as any).vat ??
        (order as any).tax ??
        0,
    );

  const getOrderServiceCharge = (order: Order) =>
    Number(
      (order as any).service_charge_amount ??
        (order as any).service_charge_total ??
        (order as any).service_fee ??
        (order as any).service_charge ??
        0,
    );

  const getOrderGrandTotal = (order: Order) => {
    const itemsTotal = getOrderItemsTotal(order);
    return Number(
      (order as any).grand_total ??
        (order as any).total_amount ??
        (order as any).payable_amount ??
        (order as any).net_total ??
        (order as any).total ??
        itemsTotal + getOrderVat(order) + getOrderServiceCharge(order),
    );
  };

  const buildOrderReport = (order: Order) => {
    const paymentMethod = getOrderPaymentMethod(order);
    const orderNumber = String(order.order_number ?? `#${order.id}`);
    const createdAt = (order as any).created_at ?? (order as any).createdAt;
    const normalizedItems = normalizeOrderItems(order);
    const isBeefBasedCredit =
      paymentMethod === "credit" &&
      String((order as any).credit_order_mode ?? "").toLowerCase() ===
        "beef_based";

    const itemRows = normalizedItems.length
      ? normalizedItems.map((item: any, index: number) => {
          const menu = item.menu_item ?? item.menuItem ?? item.menu ?? {};
          const rawCategory =
            menu?.category?.name ??
            menu?.menu_category?.name ??
            menu?.menuCategory?.name ??
            menu?.category_name ??
            item?.category?.name ??
            item?.menu_category?.name ??
            item?.menuCategory?.name ??
            item?.category_name ??
            menu?.type ??
            item?.type ??
            item?.menu_type ??
            (paymentMethod === "credit" ? "Credit order" : "Uncategorized");
          const category = String(rawCategory).replace(/_/g, " ");
          const itemName =
            menu.name ??
            item.name ??
            item.menu_item_name ??
            item.menu_item_id ??
            "Menu item";
          const qty = Number(item.quantity ?? 0);
          const unit = Number(item.unit_price ?? item.price ?? menu.price ?? 0);
          const total = Number(item.total_price ?? item.line_total ?? qty * unit);

          return {
            key: `${order.id}-${item.id ?? item.menu_item_id ?? menu.id ?? `${itemName}-${index}`}`,
            orderId: order.id,
            orderNumber,
            category: String(category),
            itemName: String(itemName),
            qty,
            unit,
            total,
            paymentMethod,
            createdAt,
          };
        })
      : isBeefBasedCredit
        ? (() => {
            const qty = Math.max(
              1,
              Number(
                (order as any).number_of_person ??
                  (order as any).persons ??
                  (order as any).quantity ??
                  1,
              ),
            );
            const total = getOrderItemsTotal(order);
            const mealType = String(
              (order as any).meal_type ??
                (order as any).credit_meal_type ??
                "Beef based credit",
            ).replace(/_/g, " ");

            return [
              {
                key: `${order.id}-beef-based-credit`,
                orderId: order.id,
                orderNumber,
                category: "Credit beef based",
                itemName: mealType,
                qty,
                unit: qty > 0 ? total / qty : total,
                total,
                paymentMethod,
                createdAt,
              },
            ];
          })()
        : [];

    const itemsTotal = getOrderItemsTotal(order);
    const serviceCharge = getOrderServiceCharge(order);
    const vat = getOrderVat(order);
    const grandTotal = getOrderGrandTotal(order);

    const waiterName = String(
      (order as any).waiter?.name ??
        (order as any).waiter_name ??
        (order as any).waiterName ??
        (order as any).creator?.name ??
        "—",
    );

    return {
      id: order.id,
      orderNumber,
      waiterName,
      createdAt,
      paymentMethod,
      items: itemRows,
      itemsTotal,
      serviceCharge,
      vat,
      grandTotal,
    };
  };

  const filteredOrders = useMemo(() => {
    return orders.filter((order: Order) => {
      const paymentMethod = getOrderPaymentMethod(order);
      const creditMode = String((order as any).credit_order_mode ?? "").toLowerCase();

      return normalizeOrderItems(order).length > 0 ||
        (paymentMethod === "credit" && creditMode === "beef_based");
    });
  }, [orders]);

  const orderReports = useMemo(
    () => filteredOrders.map((order: Order) => buildOrderReport(order)),
    [filteredOrders],
  );

  const aggregatedItems = useMemo(() => {
    const grouped = new Map<
      string,
      {
        key: string;
        category: string;
        itemName: string;
        qty: number;
        total: number;
        unit: number;
        waiterNames: Set<string>;
        paymentMethods: Set<string>;
      }
    >();

    orderReports.forEach((order) => {
      order.items.forEach((item) => {
        const category = String(item.category || "Uncategorized").trim();
        const itemName = String(item.itemName || "Menu item").trim();
        const key = `${category.toLowerCase()}::${itemName.toLowerCase()}`;

        const existing = grouped.get(key) ?? {
          key,
          category,
          itemName,
          qty: 0,
          total: 0,
          unit: 0,
          waiterNames: new Set<string>(),
          paymentMethods: new Set<string>(),
        };

        existing.qty += Number(item.qty ?? 0);
        existing.total += Number(item.total ?? 0);
        if (order.waiterName && order.waiterName !== "—") {
          existing.waiterNames.add(order.waiterName);
        }
        if (item.paymentMethod) {
          existing.paymentMethods.add(item.paymentMethod);
        }

        grouped.set(key, existing);
      });
    });

    return Array.from(grouped.values())
      .map((item) => ({
        ...item,
        unit: item.qty > 0 ? item.total / item.qty : 0,
        waiterName:
          item.waiterNames.size === 1
            ? Array.from(item.waiterNames)[0]
            : item.waiterNames.size > 1
              ? "Multiple"
              : "—",
        paymentMethod:
          item.paymentMethods.size === 1
            ? Array.from(item.paymentMethods)[0]
            : item.paymentMethods.size > 1
              ? "Mixed"
              : "—",
      }))
      .sort(
        (a, b) =>
          a.category.localeCompare(b.category) ||
          a.itemName.localeCompare(b.itemName),
      );
  }, [orderReports]);

  const totals = useMemo(() => {
    return orderReports.reduce(
      (summary, order) => {
        if (order.paymentMethod === "credit") summary.credit += order.grandTotal;
        else summary.cash += order.grandTotal;
        summary.totalPrice += order.itemsTotal;
        summary.serviceCharge += order.serviceCharge;
        summary.vat += order.vat;
        summary.grandTotal += order.grandTotal;
        return summary;
      },
      {
        cash: 0,
        credit: 0,
        totalPrice: 0,
        serviceCharge: 0,
        vat: 0,
        grandTotal: 0,
      },
    );
  }, [orderReports]);

  const currentPage = serverMeta?.current_page ?? filters.page;
  const lastPage = Math.max(serverMeta?.last_page ?? 1, 1);
  const totalOrders = serverMeta?.total ?? orderReports.length;
  const paginatedOrders = orderReports;

  const updateFilter = (patch: Partial<typeof filters>) =>
    setFilters((current) => ({ ...current, ...patch, page: 1 }));

  const printFilteredReport = () => {
    const escapeHtml = (value: unknown) =>
      String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    const rows = aggregatedItems
      .map(
        (item) => `
          <tr>
            <td>${escapeHtml(item.waiterName)}</td>
            <td>${escapeHtml(item.category)}</td>
            <td>${escapeHtml(item.itemName)}</td>
            <td class="number">${escapeHtml(item.qty)}</td>
            <td class="number">${escapeHtml(money(item.unit))}</td>
            <td class="number">${escapeHtml(money(item.total))}</td>
            <td>${escapeHtml(item.paymentMethod)}</td>
          </tr>`,
      )
      .join("");

    const periodLabel =
      filters.period === "custom"
        ? `${filters.date_from || "Beginning"} to ${filters.date_to || "Today"}`
        : filters.period.replace(/_/g, " ");
    const waiterLabel =
      filters.waiter_id === "all"
        ? "All waiters"
        : waiters.find((waiter) => String(waiter.id) === filters.waiter_id)?.name ??
          `Waiter #${filters.waiter_id}`;

    const printWindow = window.open("", "_blank", "width=1200,height=800");
    if (!printWindow) return;

    printWindow.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Filtered Sold Items Report</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; color: #111827; margin: 0; font-size: 11px; }
    h1 { margin: 0 0 4px; font-size: 20px; text-align: center; }
    .subtitle { text-align: center; margin-bottom: 14px; color: #4b5563; text-transform: capitalize; }
    .summary { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
    .summary td { border: 1px solid #d1d5db; padding: 7px 9px; }
    .summary .label { font-weight: 700; background: #f3f4f6; }
    table.report { width: 100%; border-collapse: collapse; }
    .report th, .report td { border: 1px solid #9ca3af; padding: 6px 7px; vertical-align: top; }
    .report th { background: #e5e7eb; text-align: left; font-weight: 700; }
    .number { text-align: right; white-space: nowrap; }
    .footer { margin-top: 10px; color: #6b7280; font-size: 10px; }
  </style>
</head>
<body>
  <h1>Sold Items / Sales Report</h1>
  <div class="subtitle">Period: ${escapeHtml(periodLabel)} &nbsp; | &nbsp; Payment: ${escapeHtml(filters.payment_type)} &nbsp; | &nbsp; Waiter: ${escapeHtml(waiterLabel)}</div>
  <table class="summary">
    <tr>
      <td class="label">Cash Sales</td><td class="number">${escapeHtml(money(totals.cash))}</td>
      <td class="label">Credit Sales</td><td class="number">${escapeHtml(money(totals.credit))}</td>
      <td class="label">Total Price</td><td class="number">${escapeHtml(money(totals.totalPrice))}</td>
    </tr>
    <tr>
      <td class="label">Service Charge</td><td class="number">${escapeHtml(money(totals.serviceCharge))}</td>
      <td class="label">VAT</td><td class="number">${escapeHtml(money(totals.vat))}</td>
      <td class="label">Grand / Net Total</td><td class="number">${escapeHtml(money(totals.grandTotal))}</td>
    </tr>
  </table>
  <table class="report">
    <thead>
      <tr>
        <th>Waiter name</th>
        <th>Category</th>
        <th>Items</th>
        <th>Quantity</th>
        <th>Average unit price</th>
        <th>Total price</th>
        <th>Payment method</th>
      </tr>
    </thead>
    <tbody>${rows || '<tr><td colspan="7" style="text-align:center;padding:20px">No sold items found.</td></tr>'}</tbody>
  </table>
  <div class="footer">Printed ${escapeHtml(new Date().toLocaleString())} · ${aggregatedItems.length} grouped sold items</div>
  <script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); };<\/script>
</body>
</html>`);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Sold items / sales report</CardTitle>
              <CardDescription>
                Filter sold order items by period, payment method, and waiter.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={printFilteredReport}
              disabled={query.isLoading || orderReports.length === 0}
            >
              <Printer className="mr-2 h-4 w-4" />
              Print attachment
            </Button>
          </div>

          <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
            <Select
              value={filters.period}
              onValueChange={(period: Period) =>
                updateFilter({
                  period,
                  ...(period === "custom" ? {} : { date_from: "", date_to: "" }),
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="this_week">This week</SelectItem>
                <SelectItem value="this_month">This month</SelectItem>
                <SelectItem value="this_year">This year</SelectItem>
                <SelectItem value="custom">Custom interval</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.payment_type}
              onValueChange={(payment_type) => updateFilter({ payment_type })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Payment method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All payment methods</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="credit">Credit</SelectItem>
              </SelectContent>
            </Select>

            {scope !== "waiter" && (
              <Select
                value={filters.waiter_id}
                onValueChange={(waiter_id) => updateFilter({ waiter_id })}
                disabled={waitersQuery.isLoading}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      waitersQuery.isLoading ? "Loading waiters..." : "All waiters"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All waiters</SelectItem>
                  {waiters.map((waiter) => (
                    <SelectItem key={waiter.id} value={String(waiter.id)}>
                      {waiter.name ?? waiter.email ?? `Waiter #${waiter.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select
              value={String(filters.per_page)}
              onValueChange={(per_page) =>
                updateFilter({ per_page: Number(per_page) })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Rows per page" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 orders</SelectItem>
                <SelectItem value="25">25 orders</SelectItem>
                <SelectItem value="50">50 orders</SelectItem>
              </SelectContent>
            </Select>

            {filters.period === "custom" && (
              <>
                <Input
                  type="date"
                  value={filters.date_from}
                  onChange={(e) => updateFilter({ date_from: e.target.value })}
                />
                <Input
                  type="date"
                  value={filters.date_to}
                  onChange={(e) => updateFilter({ date_to: e.target.value })}
                />
              </>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Waiter name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Average unit price</TableHead>
                  <TableHead>Total price</TableHead>
                  <TableHead>Payment method</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      Loading sold items...
                    </TableCell>
                  </TableRow>
                ) : aggregatedItems.length ? (
                  aggregatedItems.map((item, index) => {
                    const previousCategory =
                      index > 0 ? aggregatedItems[index - 1]?.category : null;
                    const startsCategory = previousCategory !== item.category;

                    return (
                      <TableRow
                        key={item.key}
                        className={startsCategory ? "border-t-2" : undefined}
                      >
                        <TableCell className="align-top">{item.waiterName}</TableCell>
                        <TableCell className="align-top font-semibold capitalize">
                          {startsCategory ? item.category : ""}
                        </TableCell>
                        <TableCell className="align-top font-medium">{item.itemName}</TableCell>
                        <TableCell className="align-top font-semibold">{item.qty}</TableCell>
                        <TableCell className="align-top">{money(item.unit)}</TableCell>
                        <TableCell className="align-top font-semibold">{money(item.total)}</TableCell>
                        <TableCell className="align-top capitalize">{item.paymentMethod}</TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      No sold items found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              <TableFooter>
                <TableRow className="hover:bg-muted/50">
                  <TableCell colSpan={5} className="text-right font-bold">
                    Total Price
                  </TableCell>
                  <TableCell className="font-bold">
                    {money(totals.totalPrice)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {currentPage} of {lastPage} · {totalOrders} orders
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={currentPage <= 1}
                onClick={() =>
                  setFilters((current) => ({
                    ...current,
                    page: Math.max(1, current.page - 1),
                  }))
                }
              >
                Previous
              </Button>
              <Button
                variant="outline"
                disabled={currentPage >= lastPage}
                onClick={() =>
                  setFilters((current) => ({
                    ...current,
                    page: Math.min(lastPage, current.page + 1),
                  }))
                }
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>


    </div>
  );
}
export function CreateOrderPage({
  scope = "waiter",
  title = "Create order",
}: {
  scope?: "waiter" | "cashier";
  title?: string;
}) {
  const initialPayload = {
    table_id: "",
    waiter_id: "",
    order_type: scope === "cashier" ? "takeaway" : "dine_in",
    payment_type: "cash",
    credit_account_id: "",
    credit_notes: "",
    notes: "",
  };
  const [payload, setPayload] = useState(initialPayload);
  const [items, setItems] = useState<OrderItemPayload[]>([]);
  const [menuSearch, setMenuSearch] = useState("");

  const menuQuery = useMenuItemsQuery(
    {
      per_page: 200,
      available: 1,
      is_available: 1,
      active: 1,
      is_active: 1,
      search: menuSearch,
    },
    scope === "cashier" ? "cashier" : "waiter",
  );
  const tablesQuery = useTablesQuery(
    { per_page: 100, status: "available", is_active: 1 },
    scope === "cashier" ? "cashier" : "waiter",
  );
  const waitersQuery = useWaitersLiteQuery();
  const creditAccountsQuery = useCreditAccountsQuery({ per_page: 100, status: "active" });
  const create = useCreateOrderMutation(scope, () => {
    setItems([]);
    setPayload(initialPayload);
  });

  const menuItems = menuQuery.data?.data ?? [];
  const tables = tablesQuery.data?.data ?? [];
  const waiters = waitersQuery.data ?? [];
  const creditAccounts = creditAccountsQuery.data?.data ?? [];
  const isCredit = scope === "cashier" && payload.payment_type === "credit";
  const selectedCreditAccount = creditAccounts.find((account) => String(account.id) === String(payload.credit_account_id));
  const selectedActiveAgreements = activeAgreements(selectedCreditAccount);
  const selectedAgreement = selectedActiveAgreements[0];
  const hasActiveAgreement = !isCredit || Boolean(selectedAgreement);
  const needsTable = payload.order_type === "dine_in";

  const total = items.reduce((sum, item) => {
    const menu = menuItems.find(
      (m) => String(m.id) === String(item.menu_item_id),
    );
    return sum + Number(menu?.price ?? 0) * item.quantity;
  }, 0);

  const canSubmit =
    items.length > 0 &&
    (!needsTable || Boolean(payload.table_id)) &&
    (scope !== "cashier" || Boolean(payload.waiter_id)) &&
    (!isCredit || (Boolean(payload.credit_account_id) && hasActiveAgreement));

  function menuImage(item: any) {
    const raw =
      item.image_url ||
      item.image_path ||
      item.image ||
      item.photo_url ||
      item.photo ||
      "";
    if (!raw) return "";
    if (String(raw).startsWith("http")) return String(raw);
    const base = (process.env.NEXT_PUBLIC_API_BASE_URL || "")
      .replace(/\/api\/?$/, "")
      .replace(/\/$/, "");
    const cleaned = String(raw).replace(/^\//, "");
    return base ? `${base}/${cleaned}` : `/${cleaned}`;
  }

  function addItem(id: string | number) {
    const exists = items.find((i) => String(i.menu_item_id) === String(id));
    setItems(
      exists
        ? items.map((i) =>
            String(i.menu_item_id) === String(id)
              ? { ...i, quantity: i.quantity + 1 }
              : i,
          )
        : [...items, { menu_item_id: id, quantity: 1 }],
    );
  }

  function updateQty(id: string | number, quantity: number) {
    setItems(
      items.map((item) =>
        String(item.menu_item_id) === String(id)
          ? { ...item, quantity: Math.max(1, quantity || 1) }
          : item,
      ),
    );
  }

  function removeItem(id: string | number) {
    setItems(items.filter((item) => String(item.menu_item_id) !== String(id)));
  }

  function submit() {
    create.mutate({
      order_type: payload.order_type as "dine_in" | "takeaway",
      table_id: needsTable ? payload.table_id : null,
      waiter_id: scope === "cashier" ? payload.waiter_id : undefined,
      payment_type: isCredit ? "credit" : "cash",
      credit_account_id: isCredit ? payload.credit_account_id : undefined,
      credit_notes: isCredit ? payload.credit_notes || payload.notes || undefined : undefined,
      notes: payload.notes,
      items,
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">
          {scope === "cashier"
            ? "Cashier can create dine-in or takeaway orders, select the responsible waiter, and create credit orders only when the account has an active agreement."
            : "Waiter orders support dine-in and takeaway only. Payment is recorded later by the cashier."}
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Order information</CardTitle>
              <CardDescription>
                {scope === "cashier"
                  ? "Select waiter and credit account only when this order is sold on credit."
                  : "No customer name, phone, or payment type is required during order creation."}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Order type</Label>
                <Select
                  value={payload.order_type}
                  onValueChange={(order_type) =>
                    setPayload({
                      ...payload,
                      order_type,
                      table_id:
                        order_type === "dine_in" ? payload.table_id : "",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dine_in">Dine in</SelectItem>
                    <SelectItem value="takeaway">Takeaway</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {scope === "cashier" && (
                <div className="grid gap-2">
                  <Label>Responsible waiter</Label>
                  <Select value={payload.waiter_id || undefined} onValueChange={(waiter_id) => setPayload({ ...payload, waiter_id })}>
                    <SelectTrigger><SelectValue placeholder={waitersQuery.isLoading ? "Loading waiters..." : "Choose waiter"} /></SelectTrigger>
                    <SelectContent>
                      {waiters.length ? waiters.map((waiter) => (
                        <SelectItem key={waiter.id} value={String(waiter.id)}>{waiter.name ?? waiter.email ?? `Waiter ${waiter.id}`}</SelectItem>
                      )) : <SelectItem value="no-waiters" disabled>No waiter users found</SelectItem>}
                    </SelectContent>
                  </Select>
                  {waitersQuery.isError && <p className="text-xs text-destructive">Could not load waiters. Check /cashier/waiters-lite permission.</p>}
                </div>
              )}

              {needsTable && (
                <div className="grid gap-2">
                  <Label>Table</Label>
                  <Select
                    value={payload.table_id || undefined}
                    onValueChange={(table_id) =>
                      setPayload({ ...payload, table_id })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          tablesQuery.isLoading
                            ? "Loading tables..."
                            : needsTable
                              ? "Choose table"
                              : "Not required"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {tables.length ? (
                        tables.map((table) => (
                          <SelectItem key={table.id} value={String(table.id)}>
                            {table.table_number ??
                              table.name ??
                              `Table ${table.id}`}
                            {table.capacity ? ` • ${table.capacity} seats` : ""}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no-tables" disabled>
                          No available tables found
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {tablesQuery.isError && (
                    <p className="text-xs text-destructive">
                      Could not load tables. Check waiter table permission.
                    </p>
                  )}
                </div>
              )}

              {scope === "cashier" && (
                <>
                  <div className="grid gap-2">
                    <Label>Payment type</Label>
                    <Select value={payload.payment_type} onValueChange={(payment_type) => setPayload({ ...payload, payment_type, credit_account_id: payment_type === "credit" ? payload.credit_account_id : "" })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="credit">Credit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {isCredit && (
                    <div className="grid gap-2">
                      <Label>Credit account</Label>
                      <Select value={payload.credit_account_id || undefined} onValueChange={(credit_account_id) => setPayload({ ...payload, credit_account_id })}>
                        <SelectTrigger><SelectValue placeholder={creditAccountsQuery.isLoading ? "Loading credit accounts..." : "Choose credit account"} /></SelectTrigger>
                        <SelectContent>
                          {creditAccounts.length ? creditAccounts.map((account) => {
                            const activeAgreementCount = activeAgreements(account).length;
                            return (
                              <SelectItem key={account.id} value={String(account.id)}>
                                {account.name} • {account.account_type === "single" ? "Single" : "Bulky"} • {activeAgreementCount ? `${activeAgreementCount} active agreement` : "No active agreement"}
                              </SelectItem>
                            );
                          }) : <SelectItem value="no-credit-accounts" disabled>No active credit accounts found</SelectItem>}
                        </SelectContent>
                      </Select>
                      {selectedCreditAccount && (
                        <div className="rounded-lg border bg-muted/40 p-3 text-xs">
                          <div className="flex justify-between"><span>Active agreement</span><strong>{selectedAgreement?.meal_type ?? "Not available"}</strong></div>
                          <div className="flex justify-between"><span>Agreement date</span><strong>{selectedAgreement ? `${String(selectedAgreement.start_date).slice(0, 10)} → ${String(selectedAgreement.end_date).slice(0, 10)}` : "—"}</strong></div>
                          <div className="flex justify-between"><span>Current cart total</span><strong>{money(total)}</strong></div>
                        </div>
                      )}
                      {isCredit && selectedCreditAccount && !selectedAgreement && (
                        <p className="text-xs text-destructive">Credit order is not allowed because this account has no active agreement.</p>
                      )}
                      {creditAccountsQuery.isError && <p className="text-xs text-destructive">Could not load credit accounts. Check credit.accounts.read permission.</p>}
                    </div>
                  )}

                </>
              )}

              <div className="grid gap-2 md:col-span-2">
                <Label>Notes</Label>
                <Textarea
                  value={payload.notes}
                  onChange={(e) =>
                    setPayload({ ...payload, notes: e.target.value })
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Menu items</CardTitle>
              <CardDescription>
                All available food and drink items are displayed as cards with
                images.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search food or drink"
                  value={menuSearch}
                  onChange={(e) => setMenuSearch(e.target.value)}
                />
              </div>
              {menuQuery.isError && (
                <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                  Could not load menu items. Check waiter/cashier menu
                  permissions.
                </p>
              )}
              {menuQuery.isLoading ? (
                <p className="rounded-xl border p-6 text-center text-sm text-muted-foreground">
                  Loading menu items...
                </p>
              ) : menuItems.length ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {menuItems.map((m) => {
                    const selected = items.find(
                      (item) => String(item.menu_item_id) === String(m.id),
                    );
                    const image = menuImage(m);
                    return (
                      <Card key={m.id} className="overflow-hidden rounded-2xl">
                        <div className="aspect-[4/3] bg-muted">
                          {image ? (
                            <img
                              src={image}
                              alt={m.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                              No image
                            </div>
                          )}
                        </div>
                        <CardContent className="space-y-3 p-4">
                          <div>
                            <div className="line-clamp-1 font-semibold">
                              {m.name}
                            </div>
                            <div className="mt-1 flex items-center justify-between gap-2 text-sm text-muted-foreground">
                              <span className="capitalize">
                                {m.type ?? "menu"}
                              </span>
                              <span className="font-medium text-foreground">
                                {money(m.price)}
                              </span>
                            </div>
                            {m.description && (
                              <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                                {m.description}
                              </p>
                            )}
                          </div>
                          <Button
                            type="button"
                            className="w-full"
                            variant={selected ? "secondary" : "default"}
                            onClick={() => addItem(m.id)}
                          >
                            <ShoppingCart className="mr-2 h-4 w-4" />
                            {selected
                              ? `Add more (${selected.quantity})`
                              : "Add to cart"}
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No menu items found.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit rounded-2xl xl:sticky xl:top-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Cart
            </CardTitle>
            <CardDescription>
              {items.length} selected item{items.length === 1 ? "" : "s"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.length ? (
              <div className="space-y-3">
                {items.map((item) => {
                  const menu = menuItems.find(
                    (m) => String(m.id) === String(item.menu_item_id),
                  );
                  const lineTotal = Number(menu?.price ?? 0) * item.quantity;
                  return (
                    <div
                      key={String(item.menu_item_id)}
                      className="rounded-xl border p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-medium">
                            {menu?.name ?? item.menu_item_id}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {money(menu?.price)} × {item.quantity} ={" "}
                            {money(lineTotal)}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(item.menu_item_id)}
                        >
                          Remove
                        </Button>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() =>
                            updateQty(item.menu_item_id, item.quantity - 1)
                          }
                        >
                          -
                        </Button>
                        <Input
                          className="w-20 text-center"
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) =>
                            updateQty(item.menu_item_id, Number(e.target.value))
                          }
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() =>
                            updateQty(item.menu_item_id, item.quantity + 1)
                          }
                        >
                          +
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
                No items in cart yet.
              </p>
            )}

            <div className="rounded-xl bg-muted p-4">
              <div className="flex justify-between">
                <span>Total</span>
                <strong>{money(total)}</strong>
              </div>
            </div>
            {needsTable && !payload.table_id && (
              <p className="text-xs text-muted-foreground">
                Select a table before creating a dine-in order.
              </p>
            )}
            {scope === "cashier" && !payload.waiter_id && (
              <p className="text-xs text-muted-foreground">Select the responsible waiter before creating the order.</p>
            )}
            {isCredit && !payload.credit_account_id && (
              <p className="text-xs text-muted-foreground">Select a credit account before creating a credit order.</p>
            )}
            {isCredit && selectedCreditAccount && !selectedAgreement && (
              <p className="text-xs text-destructive">Credit order is not allowed because this account has no active agreement.</p>
            )}
            <Button
              className="w-full"
              disabled={!canSubmit || create.isPending}
              onClick={submit}
            >
              {create.isPending ? "Creating..." : "Submit order"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function OrderDetailPage({
  id,
  scope = "waiter",
}: {
  id: string;
  scope?: Scope;
}) {
  const query = useOrderQuery(id, scope);
  const confirm = useConfirmOrderMutation();
  const serve = useServeOrderMutation();
  const addItemMutation = useAddOrderItemMutation();
  const updateItemMutation = useUpdateOrderItemMutation();
  const removeItemMutation = useRemoveOrderItemMutation();
  const receivePaymentMutation = useReceiveOrderPaymentMutation();
  const requestVoidMutation = useRequestCancelOrderMutation();

  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [itemSearch, setItemSearch] = useState("");
  const [itemPayload, setItemPayload] = useState({
    menu_item_id: "",
    quantity: 1,
    notes: "",
  });
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [ticketPreviewOpen, setTicketPreviewOpen] = useState(false);
  const [requestVoidOpen, setRequestVoidOpen] = useState(false);
  const [requestVoidReason, setRequestVoidReason] = useState("");
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [paymentPayload, setPaymentPayload] = useState({
    customer_name: "Guest",
    customer_tin: "",
    payment_method: "cash",
    paid_amount: "",
  });

  const order = normalizeOrderResponse(query.data);
  const items = normalizeOrderItems(order);
  const status = order?.status;
  const bill = (order as any)?.bill ?? (order as any)?.billing ?? null;
  const paymentStatus = (order as any)?.payment_status ?? bill?.status ?? "unpaid";
  const isCreditOrder = String((order as any)?.payment_type ?? "cash").toLowerCase() === "credit";
  const payments = [...((order as any)?.payments ?? []), ...(bill?.payments ?? [])];
  const refundablePayment = payments.find((payment: any) => ["paid", "refunded"].includes(String(payment?.status).toLowerCase()));
  const reservedRefund = (refundablePayment?.refund_requests ?? []).filter((refund: any) => ["requested", "approved", "processed"].includes(refund.status)).reduce((sum: number, refund: any) => sum + Number(refund.amount ?? 0), 0);
  const refundableAmount = Math.max(0, Number(refundablePayment?.amount ?? 0) - reservedRefund);
  const orderType = String(order?.order_type ?? "—").replace(/_/g, " ");
  const orderTotal =
    order?.total ??
    order?.total_amount ??
    bill?.total ??
    bill?.total_amount ??
    items.reduce(
      (sum: number, item: any) =>
        sum +
        Number(
          item.total_price ??
            item.line_total ??
            Number(item.unit_price ?? item.price ?? 0) * Number(item.quantity ?? 0),
        ),
      0,
    );

  const paymentLocked = Boolean(
    (order as any)?.paid_at ||
      ["paid", "void", "refunded"].includes(String(paymentStatus).toLowerCase()),
  );
  const isCashierScope = scope === "cashier" || scope === "admin";
  const isWaiterScope = scope === "waiter";
  const normalizedOrderStatus = String(status ?? "").toLowerCase();
  const mustConfirmBeforePrintOrPayment = normalizedOrderStatus === "submitted";
  const canManageOrderItems = !paymentLocked && (isCashierScope || (isWaiterScope && normalizedOrderStatus === "submitted"));
  const canCashierPrintTicket = isCashierScope && !paymentLocked && !mustConfirmBeforePrintOrPayment;
  const canReceiveOrderPayment = isCashierScope && !isCreditOrder && !paymentLocked && !mustConfirmBeforePrintOrPayment;
  const canCashierConfirmOrder = isCashierScope && canConfirmOrder(status);
  const canCashierServeOrder = isCashierScope && canServeOrder(status);
  const canRequestVoid = isWaiterScope && !paymentLocked && canRequestCancelOrder(status);
  const canRequestRefund = scope === "cashier" && !isCreditOrder && Boolean(refundablePayment) && refundableAmount > 0;
  const requestRefundMutation = useMutation({
    mutationFn: async () => unwrap(await api.post("/cashier/refunds", { payment_id: refundablePayment.id, amount: Number(refundAmount), reason: refundReason.trim() })),
    onSuccess: () => { toast.success("Refund request submitted to Finance"); setRefundOpen(false); setRefundAmount(""); setRefundReason(""); query.refetch(); },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Refund request failed"),
  });

  const menuQuery = useMenuItemsQuery(
    {
      per_page: 200,
      available: 1,
      is_available: 1,
      active: 1,
      is_active: 1,
      search: itemSearch,
    },
    scope === "cashier" ? "cashier" : "waiter",
  );
  const menuItems = menuQuery.data?.data ?? [];

  function itemTitle(item: any) {
    return (
      item.menu_item?.name ??
      item.menuItem?.name ??
      item.name ??
      item.menu_item_name ??
      item.menu_item_id ??
      "Menu item"
    );
  }

  function openAddItemDialog() {
    if (!canManageOrderItems) return;
    setEditingItem(null);
    setItemPayload({ menu_item_id: "", quantity: 1, notes: "" });
    setItemDialogOpen(true);
  }

  function openEditItemDialog(item: any) {
    if (!canManageOrderItems) return;
    setEditingItem(item);
    setItemPayload({
      menu_item_id: String(item.menu_item_id ?? item.menu_item?.id ?? item.menuItem?.id ?? ""),
      quantity: Number(item.quantity ?? 1),
      notes: item.notes ?? item.note ?? "",
    });
    setItemDialogOpen(true);
  }

  function submitItemForm() {
    if (!order?.id || !canManageOrderItems) return;

    if (editingItem) {
      const itemId = editingItem.id ?? editingItem.order_item_id;
      if (!itemId) return;
      updateItemMutation.mutate(
        {
          orderId: order.id,
          itemId,
          payload: {
            quantity: Math.max(1, Number(itemPayload.quantity || 1)),
            notes: itemPayload.notes || null,
          },
        },
        {
          onSuccess: () => {
            setItemDialogOpen(false);
            query.refetch();
          },
        },
      );
      return;
    }

    if (!itemPayload.menu_item_id) return;
    addItemMutation.mutate(
      {
        orderId: order.id,
        payload: {
          menu_item_id: itemPayload.menu_item_id,
          quantity: Math.max(1, Number(itemPayload.quantity || 1)),
          notes: itemPayload.notes || null,
        },
      },
      {
        onSuccess: () => {
          setItemDialogOpen(false);
          query.refetch();
        },
      },
    );
  }

  function removeItem(item: any) {
    if (!order?.id || !canManageOrderItems) return;
    const itemId = item.id ?? item.order_item_id;
    if (!itemId) return;
    if (!window.confirm("Remove this order item?")) return;
    removeItemMutation.mutate(
      { orderId: order.id, itemId },
      { onSuccess: () => query.refetch() },
    );
  }

  function handleReceivePayment() {
    if (!order?.id || !canReceiveOrderPayment) return;
    receivePaymentMutation.mutate(
      {
        orderId: order.id,
        payload: {
          customer_name: paymentPayload.customer_name || "Guest",
          customer_tin: paymentPayload.customer_tin || null,
          payment_method: paymentPayload.payment_method,
          paid_amount: paymentPayload.paid_amount ? Number(paymentPayload.paid_amount) : undefined,
        },
      },
      {
        onSuccess: (response: any) => {
          const paidOrder = normalizeOrderResponse(response) ?? order;
          printOrderBillDocument(paidOrder as any);
          setPaymentDialogOpen(false);
          query.refetch();
        },
      },
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Order {order?.order_number ?? id}
          </h1>
          <p className="text-muted-foreground">
            {isWaiterScope
              ? "Submitted orders are confirmed and paid by the cashier. Waiter can update items only before confirmation."
              : isCreditOrder
                ? "Credit payment is recorded by Finance and becomes effective after Manager approval."
                : "Print order ticket and receive cash payment directly from the order. No separate bill record is required."}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href={isWaiterScope ? "/dashboard/order-management/orders" : "/dashboard/order-management/pos/orders"}>
            {isWaiterScope ? "Back to my orders" : "Back to POS orders"}
          </Link>
        </Button>
      </div>

      {query.isLoading && (
        <Card className="rounded-2xl">
          <CardContent className="p-6 text-sm text-muted-foreground">
            Loading order details...
          </CardContent>
        </Card>
      )}

      {query.isError && (
        <Card className="rounded-2xl border-destructive/30">
          <CardContent className="p-6 text-sm text-destructive">
            Could not load this order. Check the order detail endpoint and permission.
          </CardContent>
        </Card>
      )}

      {!query.isLoading && order && (
        <>
          <Card className="rounded-2xl">
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle>Items</CardTitle>
                  <CardDescription>
                    {paymentLocked
                      ? "Payment is finalized. Items are read-only and no actions are available."
                      : "Add, edit, or remove items before payment is finalized."}
                  </CardDescription>
                </div>

                {(canManageOrderItems || canCashierPrintTicket || canReceiveOrderPayment || canCashierConfirmOrder || canCashierServeOrder || canRequestVoid || canRequestRefund) && (
                  <div className="flex flex-wrap gap-2">
                    {canCashierPrintTicket && (
                      <Button size="sm" variant="outline" onClick={() => setTicketPreviewOpen(true)}>
                        Print order ticket
                      </Button>
                    )}
                    {canReceiveOrderPayment && (
                      <Button size="sm" onClick={() => setPaymentDialogOpen(true)}>
                        Receive payment
                      </Button>
                    )}
                    {canManageOrderItems && (
                      <Button size="sm" variant="outline" onClick={openAddItemDialog}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add more item
                      </Button>
                    )}
                    {canCashierConfirmOrder && (
                      <Button size="sm" variant="outline" disabled={confirm.isPending} onClick={() => confirm.mutate(order.id)}>
                        Confirm
                      </Button>
                    )}
                    {canCashierServeOrder && (
                      <Button size="sm" variant="outline" disabled={serve.isPending} onClick={() => serve.mutate(order.id)}>
                        Mark served
                      </Button>
                    )}
                    {canRequestVoid && (
                      <Button size="sm" variant="destructive" onClick={() => setRequestVoidOpen(true)}>
                        Request Void
                      </Button>
                    )}
                    {canRequestRefund && <Button size="sm" variant="destructive" onClick={() => { setRefundAmount(String(refundableAmount)); setRefundOpen(true); }}>Request refund</Button>}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <Label>Order status</Label>
                  <div className="mt-1"><StatusBadge status={status} /></div>
                </div>
                <div>
                  <Label>Order type</Label>
                  <p className="mt-1 capitalize">{orderType}</p>
                </div>
                <div>
                  <Label>Payment status</Label>
                  <div className="mt-1"><StatusBadge status={paymentStatus} /></div>
                </div>
                <div>
                  <Label>Total</Label>
                  <p className="mt-1 font-semibold">{money(orderTotal)}</p>
                </div>
              </div>

              {isCashierScope && isCreditOrder && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                  This is a credit order. The cashier cannot receive its payment. Finance records the payment, then a Manager approves it.
                </div>
              )}

              <div className="overflow-x-auto rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Order type</TableHead>
                      <TableHead>Payment status</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Unit price</TableHead>
                      <TableHead>Item status</TableHead>
                      <TableHead>Total</TableHead>
                      {canManageOrderItems && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.length ? (
                      items.map((item: any) => {
                        const total =
                          item.total_price ??
                          item.line_total ??
                          Number(item.unit_price ?? item.price ?? 0) * Number(item.quantity ?? 0);

                        return (
                          <TableRow key={item.id ?? `${item.menu_item_id}-${item.name}`}>
                            <TableCell>
                              <div className="font-medium">{itemTitle(item)}</div>
                              {(item.notes || item.note) && (
                                <div className="mt-1 text-xs text-muted-foreground">{item.notes ?? item.note}</div>
                              )}
                            </TableCell>
                            <TableCell className="capitalize">{orderType}</TableCell>
                            <TableCell><StatusBadge status={paymentStatus} /></TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell>{money(item.unit_price ?? item.price)}</TableCell>
                            <TableCell><StatusBadge status={item.item_status ?? item.status} /></TableCell>
                            <TableCell className="font-medium">{money(total)}</TableCell>
                            {canManageOrderItems && (
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button size="sm" variant="outline" onClick={() => openEditItemDialog(item)}>
                                    Edit
                                  </Button>
                                  <Button size="sm" variant="destructive" onClick={() => removeItem(item)}>
                                    Remove
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={canManageOrderItems ? 8 : 7} className="h-24 text-center text-muted-foreground">
                          No items found for this order.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <OrderTicketPreviewDialog
            open={ticketPreviewOpen}
            order={order as any}
            onOpenChange={setTicketPreviewOpen}
          />

          <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingItem ? "Edit order item" : "Add more item"}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4">
                {!editingItem && (
                  <div className="grid gap-2">
                    <Label>Search menu</Label>
                    <Input value={itemSearch} onChange={(event) => setItemSearch(event.target.value)} placeholder="Search food or drink" />
                  </div>
                )}
                <div className="grid gap-2">
                  <Label>Menu item</Label>
                  <Select
                    disabled={Boolean(editingItem)}
                    value={itemPayload.menu_item_id || undefined}
                    onValueChange={(menu_item_id) => setItemPayload({ ...itemPayload, menu_item_id })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={menuQuery.isLoading ? "Loading menu..." : "Choose menu item"} />
                    </SelectTrigger>
                    <SelectContent>
                      {menuItems.length ? (
                        menuItems.map((menu) => (
                          <SelectItem key={menu.id} value={String(menu.id)}>
                            {menu.name} - {money(menu.price)}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no-menu-items" disabled>No menu items found</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    min={1}
                    value={itemPayload.quantity}
                    onChange={(event) => setItemPayload({ ...itemPayload, quantity: Number(event.target.value) })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Notes</Label>
                  <Textarea value={itemPayload.notes} onChange={(event) => setItemPayload({ ...itemPayload, notes: event.target.value })} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setItemDialogOpen(false)}>Cancel</Button>
                  <Button
                    disabled={
                      !canManageOrderItems ||
                      (!editingItem && !itemPayload.menu_item_id) ||
                      itemPayload.quantity <= 0 ||
                      addItemMutation.isPending ||
                      updateItemMutation.isPending
                    }
                    onClick={submitItemForm}
                  >
                    {editingItem ? "Update item" : "Add item"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Receive payment by order</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Customer name</Label>
                  <Input value={paymentPayload.customer_name} onChange={(event) => setPaymentPayload({ ...paymentPayload, customer_name: event.target.value })} placeholder="Guest" />
                </div>
                <div className="grid gap-2">
                  <Label>TIN number optional</Label>
                  <Input value={paymentPayload.customer_tin} onChange={(event) => setPaymentPayload({ ...paymentPayload, customer_tin: event.target.value })} placeholder="Optional customer TIN" />
                </div>
                <div className="grid gap-2">
                  <Label>Payment method</Label>
                  <Select value={paymentPayload.payment_method} onValueChange={(payment_method) => setPaymentPayload({ ...paymentPayload, payment_method })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="mobile">Mobile Money</SelectItem>
                      <SelectItem value="transfer">Bank</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {String(order?.payment_type ?? "cash") !== "credit" && (
                  <div className="grid gap-2">
                    <Label>Paid amount</Label>
                    <Input
                      type="number"
                      min={Number(orderTotal) || 0}
                      value={paymentPayload.paid_amount}
                      onChange={(event) => setPaymentPayload({ ...paymentPayload, paid_amount: event.target.value })}
                      placeholder={String(orderTotal ?? 0)}
                    />
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
                  <Button disabled={receivePaymentMutation.isPending || !canReceiveOrderPayment} onClick={handleReceivePayment}>
                    {receivePaymentMutation.isPending ? "Processing..." : "Receive payment"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
            <DialogContent>
              <DialogHeader><DialogTitle>Request payment refund</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="rounded-xl border bg-muted/40 p-4 text-sm">Available refundable amount: <strong>{money(refundableAmount)}</strong></div>
                <div className="space-y-2"><Label>Refund amount *</Label><Input type="number" min="0.01" max={refundableAmount} step="0.01" value={refundAmount} onChange={event=>setRefundAmount(event.target.value)}/></div>
                <div className="space-y-2"><Label>Reason *</Label><Textarea value={refundReason} onChange={event=>setRefundReason(event.target.value)} placeholder="Explain why this payment must be refunded" maxLength={1000}/></div>
                <div className="flex justify-end gap-2"><Button variant="outline" onClick={()=>setRefundOpen(false)}>Cancel</Button><Button variant="destructive" disabled={requestRefundMutation.isPending || !refundReason.trim() || Number(refundAmount)<=0 || Number(refundAmount)>refundableAmount} onClick={()=>requestRefundMutation.mutate()}>{requestRefundMutation.isPending?"Submitting...":"Submit refund request"}</Button></div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={requestVoidOpen} onOpenChange={setRequestVoidOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Request order void</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="rounded-xl border bg-muted/40 p-4 text-sm">
                  <p className="font-medium">Order {order.order_number ?? order.id}</p>
                  <p className="mt-1 text-muted-foreground">
                    This request will be sent to F&amp;B Controller, Manager, or General Admin for approval.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="request-void-reason">Reason <span className="text-destructive">*</span></Label>
                  <Textarea
                    id="request-void-reason"
                    value={requestVoidReason}
                    onChange={(event) => setRequestVoidReason(event.target.value)}
                    placeholder="Example: Customer changed their mind, incorrect item, duplicate order, or item unavailable"
                    maxLength={1000}
                    required
                  />
                  <div className="flex flex-wrap gap-2">
                    {["Customer changed their mind", "Incorrect item", "Duplicate order", "Item unavailable"].map((reason) => (
                      <Button key={reason} type="button" size="sm" variant="outline" onClick={() => setRequestVoidReason(reason)}>
                        {reason}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setRequestVoidOpen(false)} disabled={requestVoidMutation.isPending}>
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={!requestVoidReason.trim() || requestVoidMutation.isPending}
                    onClick={() => {
                      requestVoidMutation.mutate(
                        { id: order.id, reason: requestVoidReason.trim() },
                        {
                          onSuccess: () => {
                            toast.success("Void request submitted for approval");
                            setRequestVoidOpen(false);
                            setRequestVoidReason("");
                            query.refetch();
                          },
                          onError: (error) => {
                            toast.error(error instanceof Error ? error.message : "Failed to submit void request");
                          },
                        },
                      );
                    }}
                  >
                    {requestVoidMutation.isPending ? "Submitting..." : "Submit Void Request"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}

export function CreditAccountsPage() {
  type CreditForm = {
    name: string;
    account_type: string;
    credit_limit: number;
    is_credit_enabled: boolean;
    requires_approval: boolean;
    settlement_cycle: string;
    status: string;
  };

  const emptyPayload: CreditForm = {
    name: "",
    account_type: "customer",
    credit_limit: 0,
    is_credit_enabled: true,
    requires_approval: false,
    settlement_cycle: "monthly",
    status: "active",
  };

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [payload, setPayload] = useState<CreditForm>(emptyPayload);
  const [filters, setFilters] = useState({ page: 1, per_page: 10, search: "", account_type: "all", status: "all" });

  const query = useCreditAccountsQuery(filters);
  const createAccount = useCreateCreditAccountMutation(closeForm);
  const updateAccount = useUpdateCreditAccountMutation(closeForm);
  const toggleAccount = useToggleCreditAccountMutation();
  const accounts = query.data?.data ?? [];
  const meta = query.data?.meta;

  const summary = useMemo(() => {
    const limit = accounts.reduce((sum, account) => sum + Number(account.credit_limit ?? 0), 0);
    const balance = accounts.reduce((sum, account) => sum + Number(account.current_balance ?? 0), 0);
    const active = accounts.filter((account) => String(account.status ?? "active") === "active" && Boolean(Number(account.is_credit_enabled ?? 1))).length;
    const blocked = accounts.filter((account) => String(account.status ?? "") === "blocked" || !Boolean(Number(account.is_credit_enabled ?? 1))).length;
    return { limit, balance, active, blocked };
  }, [accounts]);

  function closeForm() {
    setOpen(false);
    setEditingId(null);
    setPayload(emptyPayload);
  }

  function openCreate() {
    setEditingId(null);
    setPayload(emptyPayload);
    setOpen(true);
  }

  function openEdit(account: any) {
    setEditingId(account.id);
    setPayload({
      name: account.name ?? "",
      account_type: account.account_type ?? "customer",
      credit_limit: Number(account.credit_limit ?? 0),
      is_credit_enabled: Boolean(Number(account.is_credit_enabled ?? 1)),
      requires_approval: Boolean(Number(account.requires_approval ?? 0)),
      settlement_cycle: account.settlement_cycle ?? "monthly",
      status: account.status ?? "active",
    });
    setOpen(true);
  }

  function submitAccount() {
    const body = { ...payload, credit_limit: Number(payload.credit_limit ?? 0) };
    if (editingId) updateAccount.mutate({ id: editingId, payload: body });
    else createAccount.mutate(body);
  }

  function updateFilter(patch: Partial<typeof filters>) {
    setFilters((current) => ({ ...current, ...patch, page: 1 }));
  }

  const saving = createAccount.isPending || updateAccount.isPending;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Credit Accounts</h1>
          <p className="text-muted-foreground">Create and manage customer, staff, student, and organization credit accounts used during cashier credit settlement.</p>
        </div>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />New credit account</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="rounded-2xl"><CardHeader className="pb-2"><CardDescription>Active accounts</CardDescription><CardTitle>{summary.active}</CardTitle></CardHeader></Card>
        <Card className="rounded-2xl"><CardHeader className="pb-2"><CardDescription>Blocked / disabled</CardDescription><CardTitle>{summary.blocked}</CardTitle></CardHeader></Card>
        <Card className="rounded-2xl"><CardHeader className="pb-2"><CardDescription>Total credit limit</CardDescription><CardTitle>{money(summary.limit)}</CardTitle></CardHeader></Card>
        <Card className="rounded-2xl"><CardHeader className="pb-2"><CardDescription>Outstanding balance</CardDescription><CardTitle>{money(summary.balance)}</CardTitle></CardHeader></Card>
      </div>

      <Card className="rounded-2xl">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle>Credit account list</CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9 md:w-72" placeholder="Search account name" value={filters.search} onChange={(event) => updateFilter({ search: event.target.value })} />
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            <Select value={filters.account_type} onValueChange={(account_type) => updateFilter({ account_type })}>
              <SelectTrigger><SelectValue placeholder="Account type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="customer">Customer</SelectItem>
                <SelectItem value="organization">Organization</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
                <SelectItem value="student">Student</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.status} onValueChange={(status) => updateFilter({ status })}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => setFilters({ page: 1, per_page: 10, search: "", account_type: "all", status: "all" })}>Reset filters</Button>
          </div>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Limit</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Available</TableHead>
                  <TableHead>Cycle</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.isLoading ? (
                  <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground">Loading credit accounts...</TableCell></TableRow>
                ) : accounts.length ? (
                  accounts.map((account) => {
                    const limit = Number(account.credit_limit ?? 0);
                    const balance = Number(account.current_balance ?? 0);
                    const enabled = Boolean(Number(account.is_credit_enabled ?? 1));
                    return (
                      <TableRow key={account.id}>
                        <TableCell><div className="font-medium">{account.name}</div><div className="text-xs text-muted-foreground">Created {date(account.created_at)}</div></TableCell>
                        <TableCell className="capitalize">{account.account_type ?? "customer"}</TableCell>
                        <TableCell>{money(limit)}</TableCell>
                        <TableCell>{money(balance)}</TableCell>
                        <TableCell>{money(Math.max(0, limit - balance))}</TableCell>
                        <TableCell className="capitalize">{String(account.settlement_cycle ?? "monthly").replace(/_/g, " ")}</TableCell>
                        <TableCell><div className="flex flex-col gap-1"><StatusBadge status={account.status ?? (enabled ? "active" : "blocked")} /><span className="text-xs text-muted-foreground">{enabled ? "Credit enabled" : "Credit disabled"}</span></div></TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEdit(account)}>Edit</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toggleAccount.mutate(account.id)}>{enabled ? "Disable credit" : "Enable credit"}</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground">No credit accounts found. Create one to allow credit settlement.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Page {meta?.current_page ?? 1} of {meta?.last_page ?? 1}</p>
            <div className="flex gap-2">
              <Button variant="outline" disabled={(meta?.current_page ?? 1) <= 1} onClick={() => setFilters({ ...filters, page: Math.max(1, filters.page - 1) })}>Previous</Button>
              <Button variant="outline" disabled={(meta?.current_page ?? 1) >= (meta?.last_page ?? 1)} onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? setOpen(true) : closeForm())}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editingId ? "Edit credit account" : "Create credit account"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2 md:col-span-2"><Label>Account name</Label><Input value={payload.name} onChange={(event) => setPayload({ ...payload, name: event.target.value })} placeholder="Example: ICT Department, Staff Meal Account" /></div>
            <div className="grid gap-2"><Label>Account type</Label><Select value={payload.account_type} onValueChange={(account_type) => setPayload({ ...payload, account_type })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="bulky">Bulky</SelectItem><SelectItem value="single">Single</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>Agreement value</Label><Input type="number" min={0} value={payload.credit_limit} onChange={(event) => setPayload({ ...payload, credit_limit: Number(event.target.value) })} /></div>
            <div className="grid gap-2"><Label>Representative phone</Label><Select value={payload.settlement_cycle} onValueChange={(settlement_cycle) => setPayload({ ...payload, settlement_cycle })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="monthly">Monthly</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>Status</Label><Select value={payload.status} onValueChange={(status) => setPayload({ ...payload, status })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="blocked">Blocked</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>Credit enabled</Label><Select value={payload.is_credit_enabled ? "yes" : "no"} onValueChange={(value) => setPayload({ ...payload, is_credit_enabled: value === "yes" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="yes">Yes</SelectItem><SelectItem value="no">No</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>Credit enabled</Label><Select value={payload.requires_approval ? "yes" : "no"} onValueChange={(value) => setPayload({ ...payload, requires_approval: value === "yes" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="no">No</SelectItem><SelectItem value="yes">Yes</SelectItem></SelectContent></Select></div>
            <div className="md:col-span-2 flex justify-end gap-2 pt-2"><Button variant="outline" onClick={closeForm}>Cancel</Button><Button disabled={!payload.name || saving} onClick={submitAccount}>{saving ? "Saving..." : editingId ? "Update account" : "Save account"}</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function CreditOrdersPage() {
  const [settle, setSettle] = useState<CreditOrder | null>(null);
  const [amount, setAmount] = useState(0);
  const [filters, setFilters] = useState({
    per_page: 20,
    credit_account_id: "all",
    status: "all",
    search: "",
  });

  const accountsQuery = useCreditAccountsQuery({ per_page: 200, status: "active" });
  const query = useCreditOrdersQuery(filters);
  const approve = useApproveCreditOrderMutation();
  const settlement = useSettleCreditOrderMutation(() => setSettle(null));
  const approveSettlement = useApproveCreditSettlementMutation();
  const [role, setRole] = useState<"finance" | "manager" | "admin" | "other">("other");
  const rows = query.data?.data ?? [];

  useEffect(() => {
    try {
      const storedRoles = JSON.parse(localStorage.getItem("roles") || "[]");
      const user = JSON.parse(localStorage.getItem("user") || "null");
      const names = [...storedRoles, user?.role, ...(user?.roles ?? [])]
        .map((value: any) => String(typeof value === "object" ? value?.name ?? "" : value ?? "").trim().toLowerCase());
      if (names.includes("general admin")) setRole("admin");
      else if (names.some((name: string) => ["cafeteria manager", "manager"].includes(name))) setRole("manager");
      else if (names.some((name: string) => ["finance", "finance manager"].includes(name))) setRole("finance");
    } catch {
      setRole("other");
    }
  }, []);

  function updateFilter(patch: Partial<typeof filters>) {
    setFilters((current) => ({ ...current, ...patch }));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Credit Orders</h1>
          <p className="text-muted-foreground">
            Finance records credit payments. A Manager reviews and approves them before balances are updated.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/credit-accounts">Credit accounts</Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/order-management/pos/orders/create">
              <Plus className="mr-2 h-4 w-4" />
              New cashier order
            </Link>
          </Button>
        </div>
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter the credit order list by credit account, status, or reference.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="grid gap-2">
            <Label>Credit account</Label>
            <Select
              value={filters.credit_account_id}
              onValueChange={(credit_account_id) => updateFilter({ credit_account_id })}
            >
              <SelectTrigger>
                <SelectValue placeholder={accountsQuery.isLoading ? "Loading accounts..." : "All credit accounts"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All credit accounts</SelectItem>
                {(accountsQuery.data?.data ?? []).map((account) => {
                  return (
                    <SelectItem key={account.id} value={String(account.id)}>
                      {account.name}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Status</Label>
            <Select value={filters.status} onValueChange={(status) => updateFilter({ status })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="credit_pending">Pending approval</SelectItem>
                <SelectItem value="credit_approved">Approved</SelectItem>
                <SelectItem value="partially_settled">Partially settled</SelectItem>
                <SelectItem value="fully_settled">Fully settled</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Search</Label>
            <Input
              value={filters.search}
              onChange={(e) => updateFilter({ search: e.target.value })}
              placeholder="Search reference or account"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Remaining</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.isLoading ? (
                <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground">Loading credit orders...</TableCell></TableRow>
              ) : rows.length ? (
                rows.map((c) => {
                  const account = c.credit_account ?? c.account;
                  const status = String(c.status ?? "").toLowerCase();
                  const canApprove = ["pending", "credit_pending"].includes(status);
                  const canSettle = !["fully_settled", "cancelled", "rejected"].includes(status) && Number(c.remaining_amount ?? 0) > 0;
                  const pendingSettlements = (c.settlements ?? []).filter((item) => item.status === "pending_approval");

                  return (
                    <TableRow key={c.id}>
                      <TableCell>{c.credit_reference ?? c.order?.order_number ?? c.id}</TableCell>
                      <TableCell>{account?.name ?? "—"}</TableCell>
                      <TableCell><StatusBadge status={c.status} /></TableCell>
                      <TableCell>{money(c.total_amount)}</TableCell>
                      <TableCell>{money(c.paid_amount)}</TableCell>
                      <TableCell>{money(c.remaining_amount)}</TableCell>
                      <TableCell>{date(c.created_at)}</TableCell>
                      <TableCell className="text-right">
                        {canApprove && ["manager", "admin"].includes(role) && (
                          <Button size="sm" variant="outline" disabled={approve.isPending} onClick={() => approve.mutate(c.id)}>
                            Approve
                          </Button>
                        )}
                        {canSettle && ["finance", "admin"].includes(role) && (
                          <Button
                            className="ml-2"
                            size="sm"
                            onClick={() => {
                              setSettle(c);
                              setAmount(Number(c.remaining_amount ?? 0));
                            }}
                          >
                            Record payment
                          </Button>
                        )}
                        {["manager", "admin"].includes(role) && pendingSettlements.map((item) => (
                          <Button
                            key={item.id}
                            className="ml-2"
                            size="sm"
                            disabled={approveSettlement.isPending}
                            onClick={() => approveSettlement.mutate({ settlementId: item.id })}
                          >
                            Approve {money(item.amount)}
                          </Button>
                        ))}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground">No credit orders found for the selected filters. Cashier creates credit orders directly from POS order creation.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!settle} onOpenChange={(o) => !o && setSettle(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record credit payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Amount</Label>
              <Input
                type="number"
                min={0}
                max={Number(settle?.remaining_amount ?? 0)}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </div>
            <Button
              disabled={!settle || amount <= 0 || settlement.isPending}
              onClick={() =>
                settle &&
                settlement.mutate({
                  id: settle.id,
                  payload: { amount, payment_method: "cash" },
                })
              }
            >
              Send for Manager approval
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function PrepTicketsPage({ kind = "kitchen" }: { kind?: "kitchen" | "bar" }) {
  const [filters, setFilters] = useState({ status: "all", scope: "today", per_page: 30 });
  const query = usePrepTicketsQuery(kind, filters);
  const action = usePrepTicketActionMutation();
  const rows = query.data?.data ?? [];
  const title = kind === "kitchen" ? "Kitchen Tickets" : "Bar Tickets";

  function ticketName(ticket: any) {
    return ticket.menu_item?.name ?? ticket.order_item?.menu_item?.name ?? ticket.order_item?.name ?? ticket.item_name ?? "Ticket item";
  }

  function canAccept(status?: string) { return ["pending", "confirmed"].includes(String(status ?? "").toLowerCase()); }
  function canReady(status?: string) { return ["preparing"].includes(String(status ?? "").toLowerCase()); }
  function canServed(status?: string) { return ["ready"].includes(String(status ?? "").toLowerCase()); }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground">Accept confirmed tickets, mark preparation ready, and close served items.</p>
        </div>
        <div className="flex gap-2">
          <Select value={filters.scope} onValueChange={(scope) => setFilters({ ...filters, scope })}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="today">Today</SelectItem><SelectItem value="all_open">All open</SelectItem></SelectContent>
          </Select>
          <Select value={filters.status} onValueChange={(status) => setFilters({ ...filters, status })}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>{["all", "confirmed", "preparing", "ready", "served", "rejected", "delayed"].map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          ["Total", rows.length],
          ["Confirmed", rows.filter((r: any) => r.status === "confirmed" || r.status === "pending").length],
          ["Preparing", rows.filter((r: any) => r.status === "preparing").length],
          ["Ready", rows.filter((r: any) => r.status === "ready").length],
        ].map(([label, value]) => <Card key={String(label)} className="rounded-2xl"><CardHeader className="pb-2"><CardDescription>{label}</CardDescription><CardTitle>{value}</CardTitle></CardHeader></Card>)}
      </div>

      <Card className="rounded-2xl">
        <CardContent className="pt-6">
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader><TableRow><TableHead>Ticket</TableHead><TableHead>Order</TableHead><TableHead>Item</TableHead><TableHead>Waiter/Table</TableHead><TableHead>Status</TableHead><TableHead>Created</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {query.isLoading ? <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Loading tickets...</TableCell></TableRow> : rows.length ? rows.map((ticket: any) => {
                  const status = String(ticket.status ?? "confirmed").toLowerCase();
                  return <TableRow key={ticket.id}>
                    <TableCell className="font-medium">{ticket.ticket_number ?? `#${ticket.id}`}</TableCell>
                    <TableCell>{ticket.order?.order_number ?? ticket.order_id ?? "—"}</TableCell>
                    <TableCell>{ticketName(ticket)}<div className="text-xs text-muted-foreground">Qty: {ticket.order_item?.quantity ?? ticket.quantity ?? 1}</div></TableCell>
                    <TableCell>{ticket.waiter?.name ?? ticket.order?.waiter?.name ?? "—"}<div className="text-xs text-muted-foreground">{ticket.table?.table_number ?? ticket.order?.table?.table_number ?? "No table"}</div></TableCell>
                    <TableCell><StatusBadge status={status} /></TableCell>
                    <TableCell>{date(ticket.created_at)}</TableCell>
                    <TableCell className="text-right"><div className="flex justify-end gap-2">
                      {canAccept(status) && <Button size="sm" onClick={() => action.mutate({ kind, id: ticket.id, action: "accept" })}>Accept</Button>}
                      {canReady(status) && <Button size="sm" onClick={() => action.mutate({ kind, id: ticket.id, action: "ready" })}>Ready</Button>}
                      {canServed(status) && <Button size="sm" variant="outline" onClick={() => action.mutate({ kind, id: ticket.id, action: "served" })}>Served</Button>}
                      {!canAccept(status) && !canReady(status) && !canServed(status) && <Button size="sm" variant="ghost" disabled>No action</Button>}
                    </div></TableCell>
                  </TableRow>;
                }) : <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No tickets found.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function useOrderScopeForRole(): Scope {
  const [scope, setScope] = useState<Scope>("admin");
  useEffect(() => {
    try {
      const roles = JSON.parse(localStorage.getItem("roles") || "[]").map((role: string | { name?: string }) =>
        String(typeof role === "object" ? role?.name ?? "" : role).trim().toLowerCase(),
      );
      const user = JSON.parse(localStorage.getItem("user") || "null");
      const normalizedRoles = [...roles, String(user?.role ?? "").trim().toLowerCase()];
      if (normalizedRoles.some((role) => ["f&b controller", "food controller", "fb-controller"].includes(role))) {
        setScope("food-controller");
      } else if (normalizedRoles.some((role) => ["cafeteria manager", "manager"].includes(role))) {
        setScope("manager");
      } else if (normalizedRoles.includes("waiter")) {
        setScope("waiter");
      } else if (normalizedRoles.includes("cashier")) {
        setScope("cashier");
      } else {
        setScope("admin");
      }
    } catch {
      setScope("admin");
    }
  }, []);
  return scope;
}

export function RoleAwareOrdersPage() {
  const scope = useOrderScopeForRole();
  const title = scope === "cashier"
    ? "POS Orders"
    : scope === "waiter"
      ? "My Orders"
      : "Order Void Approvals";
  return <OrdersPage scope={scope} title={title} createHref={scope === "cashier" ? "/dashboard/order-management/pos/orders/create" : "/dashboard/order-management/orders/create"} />;
}

export function RoleAwareCreateOrderPage() {
  const scope = useOrderScopeForRole();
  return <CreateOrderPage scope={scope === "cashier" ? "cashier" : "waiter"} title={scope === "cashier" ? "Create POS Order" : "Create Order"} />;
}

export function RoleAwareOrderDetailPage({ id }: { id: string }) {
  const scope = useOrderScopeForRole();
  return <OrderDetailPage id={id} scope={scope} />;
}
