import api, { unwrap } from "@/lib/api";
import type { ApiEnvelope, CreatePaymentPayload, Payment, PaymentFilters, PaymentListResponse } from "@/types/payment-management/payment.type";

function clean(filters: PaymentFilters = {}) {
  const params: Record<string, unknown> = { ...filters };
  if (!params.search) delete params.search;
  if (!params.method || params.method === "all") delete params.method;
  if (!params.status || params.status === "all") delete params.status;
  if (!params.bill_id) delete params.bill_id;
  if (!params.finance_status || params.finance_status === "all") delete params.finance_status;
  if (!params.date_from) delete params.date_from;
  if (!params.date_to) delete params.date_to;
  return params;
}

function paymentBase(scope: "cashier" | "admin" = "admin") {
  return scope === "cashier" ? "/cashier/payments" : "/payments";
}

function billPaymentBase(scope: "cashier" | "admin" = "admin", billId: number | string) {
  return scope === "cashier" ? `/cashier/bills/${billId}/payments` : `/bills/${billId}/payments`;
}

export const paymentService = {
  list: async (filters: PaymentFilters = {}, scope: "cashier" | "admin" = "admin") => {
    const res = await api.get(paymentBase(scope), { params: clean(filters) });
    return unwrap<PaymentListResponse>(res);
  },

  show: async (id: number | string, scope: "cashier" | "admin" = "admin") => {
    const res = await api.get(`${paymentBase(scope)}/${id}`);
    return unwrap<ApiEnvelope<Payment>>(res);
  },

  history: async (billId: number | string, scope: "cashier" | "admin" = "admin") => {
    const res = await api.get(billPaymentBase(scope, billId));
    return unwrap<PaymentListResponse>(res);
  },

  create: async (billId: number | string, payload: CreatePaymentPayload, scope: "cashier" | "admin" = "admin") => {
    const res = await api.post(billPaymentBase(scope, billId), payload);
    return unwrap<ApiEnvelope<{ payment: Payment; bill: unknown }>>(res);
  },

  approve: async (id: number | string) => {
    const res = await api.post(`/payments/${id}/approve`);
    return unwrap<ApiEnvelope<{ payment: Payment; bill: unknown }>>(res);
  },

  returnPayment: async (id: number | string) => {
    const res = await api.post(`/payments/${id}/return`);
    return unwrap<ApiEnvelope<Payment>>(res);
  },

  fail: async (id: number | string) => {
    const res = await api.post(`/payments/${id}/fail`);
    return unwrap<ApiEnvelope<Payment>>(res);
  },

  refund: async (id: number | string) => {
    const res = await api.post(`/payments/${id}/refund-requests`);
    return unwrap<ApiEnvelope<Payment>>(res);
  },

  financeList: async (filters: PaymentFilters = {}) => {
    const res = await api.get("/finance/payments", { params: clean(filters) });
    return unwrap<PaymentListResponse>(res);
  },

  markFinanceReceived: async (id: number | string, receipt: File, note?: string) => {
    const form = new FormData();
    form.append("receipt", receipt);
    if (note?.trim()) form.append("note", note.trim());
    const res = await api.post(`/finance/payments/${id}/receive`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return unwrap<ApiEnvelope<Payment>>(res);
  },

  approveFinancePayments: async (payload: {
    selection_mode: "selected" | "filtered";
    payment_ids?: Array<number | string>;
    filters?: PaymentFilters;
    receipt: File;
    note?: string;
  }) => {
    const form = new FormData();
    form.append("selection_mode", payload.selection_mode);
    payload.payment_ids?.forEach((id) => form.append("payment_ids[]", String(id)));
    const filters = clean(payload.filters ?? {});
    Object.entries(filters).forEach(([key, value]) => {
      if (["search", "method", "date_from", "date_to"].includes(key)) form.append(key, String(value));
    });
    form.append("receipt", payload.receipt);
    if (payload.note?.trim()) form.append("note", payload.note.trim());
    const res = await api.post("/finance/payments/approve-bulk", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return unwrap<ApiEnvelope<{ approved_count: number; payment_ids: Array<number | string> }>>(res);
  },
};
