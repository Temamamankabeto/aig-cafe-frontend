export type ApiEnvelope<T> = {
  success?: boolean;
  message?: string;
  data: T;
  meta?: PaginationMeta;
};

export type PaginationMeta = {
  current_page?: number;
  last_page?: number;
  per_page?: number;
  total?: number;
};

export type PaymentMethod = "cash" | "card" | "mobile" | "transfer";
export type PaymentStatus = "submitted" | "paid" | "failed" | "refunded" | "returned";

export type Payment = {
  id: number | string;
  bill_id: number | string;
  method: PaymentMethod;
  amount: number | string;
  reference?: string | null;
  status: PaymentStatus;
  paid_at?: string | null;
  created_at?: string;
  order_id?: number | string | null;
  order?: {
    id: number | string;
    order_number?: string | null;
    customer_name?: string | null;
  } | null;
  finance_status?: "pending" | "approved" | "received";
  finance_receipt_url?: string | null;
  finance_received_at?: string | null;
  finance_note?: string | null;
  finance_receiver?: { id: number | string; name?: string | null } | null;
  bill?: {
    id: number | string;
    bill_number?: string | null;
    total?: number | string;
    paid_amount?: number | string;
    balance?: number | string;
    status?: string;
    order?: {
      id: number | string;
      order_number?: string | null;
      customer_name?: string | null;
    } | null;
  } | null;
  receiver?: {
    id: number | string;
    name?: string | null;
  } | null;
};

export type PaymentFilters = {
  search?: string;
  method?: PaymentMethod | "all";
  status?: PaymentStatus | "all";
  bill_id?: number | string;
  page?: number;
  per_page?: number;
  date_from?: string;
  date_to?: string;
  finance_status?: "pending" | "approved" | "received" | "all";
};

export type CreatePaymentPayload = {
  method: PaymentMethod;
  amount: number;
  reference?: string | null;
  cash_shift_id?: number | string | null;
};

export type PaymentListResponse = {
  data: Payment[];
  meta?: PaginationMeta & {
    summary?: { total_amount?: number; pending_count?: number; pending_amount?: number; approved_amount?: number };
  };
};
