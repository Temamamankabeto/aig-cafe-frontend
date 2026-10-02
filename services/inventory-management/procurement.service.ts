import api from "@/lib/api";
import { authService } from "@/services/auth/auth.service";
import type { InventoryListParams } from "@/types/inventory-management";

export interface PurchaserDashboardRecentRequest {
  id: number;
  po_number?: string | null;
  supplier?: string | null;
  status: string;
  amount?: number;
  created_at?: string | null;
}
export interface PurchaserDashboardData {
  kpis: {
    total_requests: number;
    requests_this_week: number;
    pending_validation: number;
    validated: number;
    manager_approved: number;
    partially_received: number;
    completed: number;
    rejected: number;
    monthly_cost: number;
    low_stock_items: number;
  };

  status_distribution: Array<{
    label: string;
    status: string;
    value: number;
  }>;

  workflow: Array<{
    label: string;
    value: number;
  }>;

  trend: Array<any>;

  recent_requests: PurchaserDashboardRecentRequest[];

  alerts: {
    pending_validation: number;
    pending_manager_approval: number;
    approved_awaiting_receiving: number;
    low_stock_items: number;
    rejected_requests: number;
  };
}

export type ProcurementScope =
  | "auto"
  | "admin"
  | "manager"
  | "food-controller"
  | "finance"
  | "purchaser"
  | "stock-keeper";
export interface PurchaseOrderListParams {
  search?: string;
  status?: PurchaseOrderStatus | "all";
  supplier_id?: number | string;
  page?: number;
  per_page?: number;

}
export interface FoodControllerDashboardData {
  kpis: {
    pending_validation: number;
    validated_requests: number;
    validation_rejected: number;
    approved_requests: number;
    received_requests: number;
    pending_value: number;
    monthly_validated_value: number;
    monthly_approved_value: number;
    today_validated: number;
    week_rejected: number;
    low_stock_items: number;
    out_of_stock_items: number;
    recipe_integrity_issues: number;
    active_menu_items: number;
    total_suppliers: number;
    kitchen_pending: number;
    bar_pending: number;
  };
  status_distribution: Array<{ label: string; status: string; value: number }>;
  workflow: Array<{ label: string; value: number }>;
  trend: Array<{
    day: string;
    date: string;
    submitted: number;
    validated: number;
    rejected: number;
  }>;
  recent_validation_requests: Array<{
    id: number;
    po_number?: string | null;
    supplier: string;
    items_count: number;
    amount: number;
    status: string;
    created_at?: string | null;
    updated_at?: string | null;
  }>;
  low_stock_items: Array<{
    id: number;
    name: string;
    base_unit?: string | null;
    current_stock?: number | string | null;
    minimum_quantity?: number | string | null;
    average_purchase_price?: number | string | null;
  }>;
  recent_inventory_transactions: any[];
  recipe_integrity: {
    menu_items_without_recipe: number;
    recipes_without_ingredients: number;
    recipes_with_missing_inventory_links: number;
    direct_items_without_link: number;
  };
  alerts: {
    pending_validation: number;
    validation_rejected: number;
    low_stock_items: number;
    recipe_integrity_issues: number;
    kitchen_bar_pending: number;
  };
}

export interface SupplierRow {
  id: number;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  tax_id?: string | null;
  credit_days?: number | null;
  is_active?: boolean;
  purchase_orders_count?: number;
  purchase_orders_total?: number | string | null;
}

export interface SupplierPayload {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  tax_id?: string;
  credit_days?: number;
  notes?: string;
  is_active?: boolean;
}

export interface PurchaseOrderListParams {
  search?: string;
  status?: PurchaseOrderStatus | "all";
  supplier_id?: number | string;
  page?: number;
  per_page?: number;
}

export type PurchaseOrderStatus =
  | "draft"
  | "submitted"
  | "food_validated"
  | "finance_verified"
  | "finance_rejected"
  | "validation_rejected"
  | "approved"
  | "partially_received"
  | "completed"
  | "cancelled";

export interface PurchaseOrderItemRow {
  id: number;
  purchase_order_id: number;
  inventory_item_id: number;
  quantity: number | string;
  unit?: string | null;
  received_quantity?: number | string | null;
  unit_cost: number | string;
  line_total?: number | string | null;
  inventory_item?: {
    id: number;
    name: string;
    sku?: string | null;
    base_unit?: string | null;
    unit?: string | null;
  } | null;
  inventoryItem?: {
    id: number;
    name: string;
    sku?: string | null;
    base_unit?: string | null;
    unit?: string | null;
  } | null;
}

export interface PurchaseOrderRow {
  id: number;
  po_number?: string | null;
  supplier_id: number;
  status: PurchaseOrderStatus;
  total?: number | string | null;
  expected_date?: string | null;
  notes?: string | null;
  created_at?: string | null;
  submitted_at?: string | null;
  finance_verified_at?: string | null;
  finance_verification_note?: string | null;
  finance_verified_by?: number | null;
  finance_verifier?: { id: number; name?: string | null } | null;
  approved_at?: string | null;
  received_at?: string | null;
  supplier?: SupplierRow | null;
  items?: PurchaseOrderItemRow[];
  receivings?: Array<{ id: number; received_at?: string | null }>;
}

export interface PurchaseOrderPayload {
  supplier_id: number;
  expected_date?: string;
  notes?: string;
  status?: "draft" | "submitted";
  items: Array<{
    inventory_item_id: number;
    quantity: number;
    base_unit: string;
    unit_cost: number;
  }>;
}

export interface ReceiveOrderPayload {
  note?: string;
  items: Array<{
    purchase_order_item_id: number;
    quantity: number;
    unit?: string;
    expiry_date?: string;
    batch_no?: string;
    batch_note?: string;
  }>;
}

export interface PaginatedLike<T> {
  data: T[];
  meta: {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
  };
}

export function cleanParams<T extends object>(params: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) =>
        value !== undefined &&
        value !== null &&
        value !== ""
    ),
  ) as Partial<T>;
}

function normalizeRole(value?: string | null) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[\s-]+/g, "_");
}

function detectedScope(): Exclude<ProcurementScope, "auto"> {
  const roles = authService.getStoredRoles().map(normalizeRole);

  if (
    roles.some((role) =>
      ["general_admin", "admin", "administrator"].includes(role),
    )
  )
    return "admin";
  if (
    roles.some((role) =>
      ["manager", "restaurant_manager", "cafeteria_manager"].includes(role),
    )
  )
    return "manager";
  if (roles.some((role) => ["finance", "finance_manager"].includes(role))) return "finance";
  if (
    roles.includes("purchaser") ||
    roles.includes("purchase") ||
    roles.includes("procurement_officer")
  )
    return "purchaser";
  if (
    roles.includes("store_keeper") ||
    roles.includes("stock_keeper") ||
    roles.includes("warehouse")
  )
    return "stock-keeper";
  if (
    roles.includes("fandb_controller") ||
    roles.includes("food_controller") ||
    roles.includes("food_and_beverage_controller") ||
    roles.includes("f_and_b_controller")
  )
    return "food-controller";

  return "admin";
}

function resolveScope(
  scope: ProcurementScope = "auto",
): Exclude<ProcurementScope, "auto"> {
  return scope === "auto" ? detectedScope() : scope;
}

function rolePrefix(scope: ProcurementScope = "auto") {
  const resolved = resolveScope(scope);
  if (resolved === "manager") return "/manager";
  if (resolved === "food-controller") return "/food-controller";
  if (resolved === "finance") return "/finance";
  if (resolved === "purchaser") return "/purchaser";
  if (resolved === "stock-keeper") return "/stock-keeper";
  return "/admin";
}

function paginated<T>(body: any): PaginatedLike<T> {
  const root = body?.data ?? body;
  const page = root?.data && Array.isArray(root.data) ? root : null;
  if (page) {
    return {
      data: page.data as T[],
      meta: {
        current_page: Number(page.current_page ?? 1),
        per_page: Number(page.per_page ?? page.data.length ?? 0),
        total: Number(page.total ?? page.data.length ?? 0),
        last_page: Number(page.last_page ?? 1),
      },
    };
  }
  const rows = Array.isArray(root) ? root : [];
  return {
    data: rows as T[],
    meta: {
      current_page: 1,
      per_page: rows.length,
      total: rows.length,
      last_page: 1,
    },
  };
}

function unwrap<T>(body: any): T {
  return (body?.data ?? body) as T;
}

export const procurementService = {
  async foodControllerDashboard() {
    const response = await api.get("/food-controller/dashboard");
    return unwrap<FoodControllerDashboardData>(response.data);
  },

  async purchaserDashboard() {
    const response = await api.get("/purchaser/dashboard");
    return unwrap<PurchaserDashboardData>(response.data);
  },

  

  async suppliers(
    params: InventoryListParams = {},
    scope: ProcurementScope = "auto",
  ) {
    const response = await api.get(`${rolePrefix(scope)}/suppliers`, {
      params: cleanParams(params as Record<string, unknown>),
    });
    return paginated<SupplierRow>(response.data);
  },

  async createSupplier(
    payload: SupplierPayload,
    scope: ProcurementScope = "auto",
  ) {
    const response = await api.post(`${rolePrefix(scope)}/suppliers`, payload);
    return unwrap<SupplierRow>(response.data);
  },

  async purchaseOrders(
  params: PurchaseOrderListParams = {},
  scope: ProcurementScope = "auto",
) {
  const response = await api.get(
    `${rolePrefix(scope)}/purchase-orders`,
    {
      params: cleanParams(params as Record<string, unknown>),
    }
  );

  return paginated<PurchaseOrderRow>(response.data);
},


  async purchaseOrder(id: number | string, scope: ProcurementScope = "auto") {
    const response = await api.get(
      `${rolePrefix(scope)}/purchase-orders/${id}`,
    );
    return unwrap<PurchaseOrderRow>(response.data);
  },

  async pendingPurchaseValidation(params: InventoryListParams = {}) {
    const response = await api.get(
      `/food-controller/purchase-orders/pending-validation`,
      {
        params: cleanParams(params as Record<string, unknown>),
      },
    );
    return paginated<PurchaseOrderRow>(response.data);
  },

  async createPurchaseOrder(
    payload: PurchaseOrderPayload,
    scope: ProcurementScope = "auto",
  ) {
    const response = await api.post(
      `${rolePrefix(scope)}/purchase-orders`,
      payload,
    );
    return unwrap<PurchaseOrderRow>(response.data);
  },

  async submitPurchaseOrder(
    id: number | string,
    scope: ProcurementScope = "auto",
  ) {
    const response = await api.post(
      `${rolePrefix(scope)}/purchase-orders/${id}/submit`,
    );
    return unwrap<PurchaseOrderRow>(response.data);
  },

  async validatePurchaseOrder(
    id: number | string,
    note = "Food Controller confirmed validation",
    scope: ProcurementScope = "food-controller",
  ) {
    const response = await api.post(
      `${rolePrefix(scope)}/purchase-orders/${id}/validate`,
      { note },
    );
    return unwrap<PurchaseOrderRow>(response.data);
  },

  async rejectPurchaseValidation(
    id: number | string,
    reason: string,
    scope: ProcurementScope = "food-controller",
  ) {
    const response = await api.post(
      `${rolePrefix(scope)}/purchase-orders/${id}/reject-validation`,
      { reason },
    );
    return unwrap<PurchaseOrderRow>(response.data);
  },

  async pendingFinanceVerification(params: InventoryListParams = {}) {
    const response = await api.get(`/finance/purchase-orders/pending-verification`, { params: cleanParams(params as Record<string, unknown>) });
    return paginated<PurchaseOrderRow>(response.data);
  },

  async verifyPurchaseBudget(id: number | string, note: string) {
    const response = await api.post(`/finance/purchase-orders/${id}/verify-budget`, { note });
    return unwrap<PurchaseOrderRow>(response.data);
  },

  async rejectPurchaseBudget(id: number | string, reason: string) {
    const response = await api.post(`/finance/purchase-orders/${id}/reject-budget`, { reason });
    return unwrap<PurchaseOrderRow>(response.data);
  },

  async approvePurchaseOrder(
    id: number | string,
    scope: ProcurementScope = "manager",
  ) {
    const response = await api.post(
      `${rolePrefix(scope)}/purchase-orders/${id}/approve`,
    );
    return unwrap<PurchaseOrderRow>(response.data);
  },

  async cancelPurchaseOrder(
    id: number | string,
    reason: string,
    scope: ProcurementScope = "manager",
  ) {
    const response = await api.post(
      `${rolePrefix(scope)}/purchase-orders/${id}/cancel`,
      { reason },
    );
    return unwrap<PurchaseOrderRow>(response.data);
  },

  async stockReceivings(
    params: InventoryListParams & {
      purchase_order_id?: number | string;
      supplier_id?: number | string;
    } = {},
    scope: ProcurementScope = "auto",
  ) {
    const response = await api.get(`${rolePrefix(scope)}/stock-receivings`, {
      params: cleanParams(params as Record<string, unknown>),
    });
    return paginated<any>(response.data);
  },

  async receivePurchaseOrder(
    id: number | string,
    payload: ReceiveOrderPayload,
    scope: ProcurementScope = "auto",
  ) {
    const response = await api.post(
      `${rolePrefix(scope)}/purchase-orders/${id}/receive`,
      payload,
    );
    return unwrap<{ receiving: unknown; po: PurchaseOrderRow }>(response.data);
  },
  
  
};

