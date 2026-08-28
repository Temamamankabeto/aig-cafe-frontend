export type CashierDashboardSummary = {
  today_sales: number;
  paid_orders: number;
  open_bills: number;
  open_bills_amount: number;
  cash_sales: number;
  cash_share: number;
  non_cash_sales: number;
  non_cash_share: number;
  discounts: number;
  discount_orders: number;
  refunds: number;
  refund_count: number;
  expected_cash: number;
};

export type CashierPaymentMethod = {
  method: string;
  transactions: number;
  amount: number;
  share: number;
};

export type CashierOpenBill = {
  id: number;
  order_id: number;
  order_number: string;
  table?: string | null;
  waiter?: string | null;
  items: number;
  amount: number;
  age_minutes: number;
  order_type: string;
  bill_status: string;
};

export type CashierRecentPayment = {
  id: number;
  receipt: string;
  order: string;
  method: string;
  amount: number;
  time?: string | null;
  status: string;
};

export type CashierCurrentShift = {
  id: number;
  session_number: string;
  status: "open" | "closed";
  opening_cash: number;
  opened_at?: string | null;
  cash_sales: number;
  cash_refunds: number;
  expected_cash: number;
};

export type CashierDashboardData = {
  business_date: string;
  user: { id: number | string; name: string };
  current_shift: CashierCurrentShift | null;
  summary: CashierDashboardSummary;
  open_bills: CashierOpenBill[];
  recent_payments: CashierRecentPayment[];
  payment_methods: CashierPaymentMethod[];
  requires_attention: Array<{ label: string; count: number }>;
  shift_summary: {
    orders_paid: number;
    gross_sales: number;
    discount_orders: number;
    discounts: number;
    refund_count: number;
    refunds: number;
    net_collected: number;
  };
};

export type CashierDashboardResponse = {
  success: boolean;
  message: string;
  role: "cashier";
  data: CashierDashboardData;
  meta?: { generated_at?: string } | null;
};
