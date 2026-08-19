// ================================
// Inventory Base Types
// ================================

export type BaseUnit =
  | "g"
  | "kg"
  | "ml"
  | "L"
  | "pcs";

export type InventoryTransactionType =
  | "in"
  | "out"
  | "adjust"
  | "transfer_in"
  | "transfer_out"
  | "waste";

// ================================
// API
// ================================

export interface ApiEnvelope<T> {
  success?: boolean;
  message?: string;
  data: T;
}

export interface PaginationMeta {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

export interface PaginatedResponse<T> {
  success?: boolean;
  message?: string;
  data: T[];
  meta: PaginationMeta;
}

// ================================
// Inventory
// ================================

export interface InventoryListParams {
  search?: string;
  status?: "active" | "inactive" | "all";
  low_stock?: boolean;
  per_page?: number;
  page?: number;
  type?: string;
  reference_type?: string;
  inventory_item_id?: number | string;
}

export interface MenuItemOption {
  id: number;
  name: string;
  type?: "food" | "drink" | string | null;
  price?: number | string | null;
  category?: {
    id: number;
    name: string;
  } | null;
  category_name?: string | null;
  is_active?: boolean;
  is_available?: boolean;
}

export interface InventoryItem {
  id: number;
  name: string;
  sku?: string | null;
  description?: string | null;

  base_unit: BaseUnit;
  unit?: BaseUnit;

  current_stock: number;

  minimum_quantity: number;
  reorder_level?: number | null;

  average_purchase_price?: number | null;

  is_active?: boolean;

  created_at?: string | null;
  updated_at?: string | null;
}

export interface InventoryItemPayload {
  name: string;

  sku?: string;
  description?: string;

  base_unit: BaseUnit;

  current_stock?: number;

  minimum_quantity: number;

  average_purchase_price?: number;

  is_active?: boolean;
}

// ================================
// Inventory Batch
// ================================

export interface InventoryBatch {
  id: number;

  inventory_item_id: number;

  batch_no?: string | null;

  purchase_price?: number | null;

  initial_qty: number;

  remaining_qty: number;

  expiry_date?: string | null;

  received_at?: string | null;

  status?:
    | "active"
    | "available"
    | "expired"
    | "empty"
    | "depleted"
    | string
    | null;

  inventory_item?: InventoryItem;

  inventoryItem?: InventoryItem;
}

// ================================
// Transactions
// ================================

export interface InventoryTransaction {
  id: number;

  inventory_item_id: number;

  type?: InventoryTransactionType;

  transaction_type?: InventoryTransactionType;

  quantity: number;

  unit_cost?: number | null;

  note?: string | null;

  reason?: string | null;

  reference_type?: string | null;

  reference_id?: number | string | null;

  created_at?: string | null;

  inventory_item?: InventoryItem;

  inventoryItem?: InventoryItem;

  created_by_user?: {
    id: number;
    name: string;
  } | null;

  creator?: { id: number; name: string } | null;
  department?: Department | null;
  responsible_user_id?: number | string | null;
  responsible_user?: DepartmentUser | null;
  custody_status?: "issued" | "received" | "partially_used" | "return_requested" | "closed" | null;
  received_at?: string | null;
  used_quantity?: number;
  return_requested_quantity?: number;
  available_quantity?: number;
  return_request_reason?: string | null;
  return_requested_at?: string | null;
  returned_quantity?: number;
  returnable_quantity?: number;
  before_quantity?: number;
  after_quantity?: number;
}

export interface StockBalanceRow {
  inventory_item_id: number;
  item: string;
  sku?: string | null;
  store: string;
  unit: BaseUnit;
  available_quantity: number;
  reserved_quantity: number;
  minimum_quantity: number;
  stock_status: string;
}

export interface StockCardLine {
  id: number;
  date: string;
  reference: string;
  type: string;
  note?: string | null;
  received: number;
  issued: number;
  returned: number;
  transferred: number;
  adjustment: number;
  waste: number;
  balance: number;
  recorded_by?: string | null;
}

export interface StockCard {
  item: { id: number; name: string; sku?: string | null; unit: BaseUnit };
  store: string;
  opening_balance: number;
  closing_balance: number;
  lines: StockCardLine[];
}

// ================================
// Payloads
// ================================

export interface StockAdjustmentPayload {
  quantity: number;
  reason?: string;
  note?: string;
  expiry_date?: string | null;
}

export interface WastePayload {
  quantity: number;
  reason?: string;
  note?: string;
}

export interface DepartmentStockoutPayload {
  quantity: number;
  department_id: number | string;
  responsible_user_id: number | string;
  reason: string;
}

export interface DepartmentUser {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  department_id: number;
}

export interface Department {
  id: number;
  name: string;
  code?: string | null;
  description?: string | null;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
}

export interface DepartmentPayload {
  name: string;
  code?: string | null;
  description?: string | null;
  is_active?: boolean;
}

export interface ReturnToStorePayload {
  quantity: number;
  reason: string;
}

export interface TransferPayload {
  to_item_id: number | string;
  quantity: number;
  reason: string;
}

export interface ReceiveStockPayload {
  items: Array<{
    inventory_item_id: number;
    quantity: number;
    unit_cost?: number;
    expiry_date?: string;
    batch_no?: string;
  }>;

  note?: string;
}

// ================================
// Recipe
// ================================

export interface RecipeIngredient {
  id?: number;

  inventory_item_id: number;

  quantity: number;

  base_unit?: BaseUnit;

  unit?: BaseUnit;

  inventory_item?: InventoryItem;

  inventoryItem?: InventoryItem;
}

export interface Recipe {
  id: number;

  menu_item_id: number;

  name?: string | null;

  yield_quantity?: number | null;

  items?: RecipeIngredient[];

  recipe_items?: RecipeIngredient[];

  menu_item?: {
    id: number;
    name: string;
  } | null;
}

export interface RecipePayload {
  menu_item_id: number;

  items: Array<{
    inventory_item_id: number;
    quantity: number;
  }>;
}

// ================================
// Reports
// ================================

export interface LowStockRow extends InventoryItem {
  shortage?: number;
}

export interface StockValuationRow extends InventoryItem {
  stock_value?: number;
  value?: number;
}

export interface RecipeIntegrityRow {
  id?: number;

  menu_item_id?: number;

  menu_item_name?: string;

  menu_item_type?: string;

  inventory_tracking_mode?: string | null;

  direct_inventory_item_id?: number | null;

  recipe_id?: number | null;

  ingredient_count?: number | string;

  missing_inventory_links?: number | string;

  name?: string;

  status?: string;

  issue?: string;

  missing_items?: string[];
}

// ================================
// Purchase Orders
// ================================

export type PurchaseOrderStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "received"
  | "rejected"
  | "cancelled";

export interface PurchaseOrderListParams {
  search?: string;
  status?: PurchaseOrderStatus | "all";
  page?: number;
  per_page?: number;
}

export type InventoryScope =
  | "admin"
  | "food-controller"
  | "stock-keeper"
  | "purchaser";
