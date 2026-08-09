export type CashierDashboardSummary = {
  orders: number;
  gross_order_value: number;
  payments_collected: number;
  paid_transactions: number;
  cash_collected: number;
  credit_orders: number;
  pending_bills: number;
  pending_amount: number;
};

export type CashierPaymentMethod = {
  method: string;
  transactions: number;
  amount: number;
};

export type CashierRecentOrder = {
  id: number | string;
  order_number: string;
  order_type: string;
  table?: string | null;
  waiter?: string | null;
  status: string;
  payment_type?: string | null;
  payment_status?: string | null;
  total: number;
  ordered_at?: string | null;
  bill_id?: number | string | null;
  bill_status?: string | null;
  balance: number;
};

export type CashierShiftSummary = {
  payments_count?: number;
  cash_payments?: number | string;
  card_payments?: number | string;
  mobile_payments?: number | string;
  transfer_payments?: number | string;
  total_payments?: number | string;
  expected_cash?: number | string;
};

export type CashierCurrentShift = {
  id: number | string;
  status: "open" | "closed";
  opening_cash: number | string;
  opened_at?: string | null;
  expected_cash?: number | string | null;
  summary?: CashierShiftSummary;
};

export type CashierDashboardData = {
  business_date: string;
  user: {
    id: number | string;
    name: string;
  };
  current_shift: CashierCurrentShift | null;
  summary: CashierDashboardSummary;
  order_statuses: Record<string, number>;
  payment_methods: CashierPaymentMethod[];
  recent_orders: CashierRecentOrder[];
};

export type CashierDashboardResponse = {
  success: boolean;
  message: string;
  role: "cashier";
  data: CashierDashboardData;
  meta: null;
};
