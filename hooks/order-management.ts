import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { orderService } from "@/services/order-management";
import type { OrderFilters } from "@/types/order-management";

type OrderScope = "waiter" | "cashier" | "public" | "admin" | "manager" | "food-controller";
type TicketKind = "kitchen" | "bar";

const invalidate = (qc: ReturnType<typeof useQueryClient>, key: readonly unknown[]) => {
  qc.invalidateQueries({ queryKey: key });
};

export function useWaitersLiteQuery(search = "", enabled = true) {
  return useQuery({
    queryKey: ["order-management", "waiters-lite", search],
    queryFn: () => orderService.waiters(search),
    enabled,
  });
}

export function useOrdersQuery(filters: OrderFilters = {}, scope: OrderScope = "admin") {
  return useQuery({ queryKey: queryKeys.orders.list(filters, scope), queryFn: () => orderService.orders(filters, scope) });
}

export function useOrderQuery(id?: string | number, scope: OrderScope = "admin") {
  return useQuery({ queryKey: queryKeys.orders.detail(id ?? "", scope), queryFn: () => orderService.order(id as string | number, scope), enabled: Boolean(id) });
}

export function useCreditAccountsQuery(filters: OrderFilters = {}) {
  return useQuery({ queryKey: queryKeys.credit.accounts(filters), queryFn: () => orderService.creditAccounts(filters) });
}

export function useCreditAgreementsQuery(accountId?: string | number) {
  return useQuery({ queryKey: ["credit", "agreements", accountId], queryFn: () => orderService.creditAgreements(accountId as string | number), enabled: Boolean(accountId) });
}

export function useCreditOrdersQuery(filters: OrderFilters = {}) {
  return useQuery({ queryKey: queryKeys.credit.orders(filters), queryFn: () => orderService.creditOrders(filters) });
}

export function usePrepTicketsQuery(kind: TicketKind = "kitchen", filters: OrderFilters = {}) {
  return useQuery({ queryKey: queryKeys.prepTickets.list(kind, filters), queryFn: () => orderService.prepTickets(kind, filters) });
}

export function usePackagesQuery(filters: OrderFilters = {}) {
  return useQuery({ queryKey: queryKeys.catering.packages(filters), queryFn: () => orderService.packages(filters) });
}

export function usePackageQuery(id?: string | number) {
  return useQuery({ queryKey: queryKeys.catering.package(id ?? ""), queryFn: () => orderService.package(id as string | number), enabled: Boolean(id) });
}

export function usePackageOrdersQuery(filters: OrderFilters = {}) {
  return useQuery({ queryKey: queryKeys.catering.orders(filters), queryFn: () => orderService.packageOrders(filters) });
}

export function usePackageOrderQuery(id?: string | number) {
  return useQuery({ queryKey: queryKeys.catering.order(id ?? ""), queryFn: () => orderService.packageOrder(id as string | number), enabled: Boolean(id) });
}

export function useCreateOrderMutation(scope: OrderScope = "waiter", onSuccess?: () => void) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (payload: any) => orderService.createOrder(payload, scope), onSuccess: () => { invalidate(qc, queryKeys.orders.root()); onSuccess?.(); } });
}

export function useConfirmOrderMutation() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string | number) => orderService.confirmOrder(id), onSuccess: () => invalidate(qc, queryKeys.orders.root()) });
}

export function useServeOrderMutation() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string | number) => orderService.serveOrder(id), onSuccess: () => invalidate(qc, queryKeys.orders.root()) });
}

export function useRequestCancelOrderMutation() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, reason }: { id: string | number; reason: string }) => orderService.requestCancel(id, reason), onSuccess: () => invalidate(qc, queryKeys.orders.root()) });
}

export function useApproveVoidOrderMutation(scope: "admin" | "manager" | "food-controller") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string | number; reason?: string }) =>
      orderService.approveVoid(id, reason, scope),
    onSuccess: () => invalidate(qc, queryKeys.orders.root()),
  });
}

export function useRecordBillPaymentMutation() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ billId, payload }: any) => orderService.recordBillPayment(billId, payload), onSuccess: () => invalidate(qc, queryKeys.billing.root()) });
}

export function useConvertBillToCreditMutation() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ billId, payload }: any) => orderService.convertBillToCredit(billId, payload), onSuccess: () => invalidate(qc, queryKeys.credit.root()) });
}


export function useAddOrderItemMutation() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ orderId, payload }: any) => orderService.addOrderItem(orderId, payload), onSuccess: () => invalidate(qc, queryKeys.orders.root()) });
}

export function useUpdateOrderItemMutation() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ orderId, itemId, payload }: any) => orderService.updateOrderItem(orderId, itemId, payload), onSuccess: () => invalidate(qc, queryKeys.orders.root()) });
}

export function useRemoveOrderItemMutation() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ orderId, itemId }: any) => orderService.removeOrderItem(orderId, itemId), onSuccess: () => invalidate(qc, queryKeys.orders.root()) });
}

export function useReceiveOrderPaymentMutation() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ orderId, payload }: any) => orderService.receiveOrderPayment(orderId, payload), onSuccess: () => { invalidate(qc, queryKeys.orders.root()); invalidate(qc, queryKeys.billing.root()); invalidate(qc, queryKeys.shifts.root()); } });
}

export function usePrintOrderBillMutation() {
  return useReceiveOrderPaymentMutation();
}

export function useApproveCreditOrderMutation() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string | number) => orderService.approveCreditOrder(id), onSuccess: () => invalidate(qc, queryKeys.credit.root()) });
}

export function useSettleCreditOrderMutation(onSuccess?: () => void) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: any) =>
      orderService.settleCreditOrder(id, payload),
    onSuccess: () => {
      invalidate(qc, queryKeys.credit.root());
      onSuccess?.();
    },
  });
}

export function useApproveCreditSettlementMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ settlementId, note }: { settlementId: string | number; note?: string }) =>
      orderService.approveCreditSettlement(settlementId, note),
    onSuccess: () => invalidate(qc, queryKeys.credit.root()),
  });
}

export function useCreateCreditAccountMutation(onSuccess?: () => void) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (payload: any) => orderService.createCreditAccount(payload), onSuccess: () => { invalidate(qc, queryKeys.credit.root()); onSuccess?.(); } });
}

export function useUpdateCreditAccountMutation(onSuccess?: () => void) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: any) =>
      orderService.updateCreditAccount(id, payload),
    onSuccess: () => {
      invalidate(qc, queryKeys.credit.root());
      onSuccess?.();
    },
  });
}
export function useToggleCreditAccountMutation() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string | number) => orderService.toggleCreditAccount(id), onSuccess: () => invalidate(qc, queryKeys.credit.root()) });
}

export function useCreateCreditAgreementMutation() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ accountId, payload }: any) => orderService.createCreditAgreement(accountId, payload), onSuccess: () => invalidate(qc, queryKeys.credit.root()) });
}

export function useUpdateCreditAgreementMutation() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ accountId, agreementId, payload }: any) => orderService.updateCreditAgreement(accountId, agreementId, payload), onSuccess: () => invalidate(qc, queryKeys.credit.root()) });
}

export function useDisableCreditAgreementMutation() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ accountId, agreementId }: any) => orderService.disableCreditAgreement(accountId, agreementId), onSuccess: () => invalidate(qc, queryKeys.credit.root()) });
}

export function usePrepTicketActionMutation() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ kind, id, action }: any) => orderService.prepTicketAction(kind, id, action), onSuccess: () => invalidate(qc, queryKeys.prepTickets.root()) });
}

export function useCreatePackageMutation(onSuccess?: () => void) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (payload: any) => orderService.createPackage(payload), onSuccess: () => { invalidate(qc, queryKeys.catering.root()); onSuccess?.(); } });
}

export function useDeletePackageMutation() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string | number) => orderService.deletePackage(id), onSuccess: () => invalidate(qc, queryKeys.catering.root()) });
}

export function useCreatePackageOrderMutation() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (payload: any) => orderService.createPackageOrder(payload), onSuccess: () => invalidate(qc, queryKeys.catering.root()) });
}

export function useSchedulePackageOrderMutation() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, payload }: any) => orderService.schedulePackageOrder(id, payload), onSuccess: () => invalidate(qc, queryKeys.catering.root()) });
}

export function usePackageOrderActionMutation() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, action }: any) => orderService.packageOrderAction(id, action), onSuccess: () => invalidate(qc, queryKeys.catering.root()) });
}
