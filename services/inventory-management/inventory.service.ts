import api, { unwrap } from "@/lib/api";
import type {
  ApiEnvelope,
  InventoryBatch,
  InventoryItem,
  InventoryItemPayload,
  InventoryListParams,
  MenuItemOption,
  InventoryTransaction,
  LowStockRow,
  PaginatedResponse,
  Recipe,
  RecipeIntegrityRow,
  RecipePayload,
  StockAdjustmentPayload,
  DepartmentStockoutPayload,
  Department,
  DepartmentPayload,
  DepartmentUser,
  ReturnToStorePayload,
  StockBalanceRow,
  StockCard,
  StockValuationRow,
  TransferPayload,
  WastePayload,
} from "@/types/inventory-management";

function cleanParams<T extends object>(params: T): Partial<T> {
  const output: Partial<T> = {};

  Object.entries(params).forEach(([key, value]) => {
    if (
      value === undefined ||
      value === null ||
      value === "" ||
      value === "all"
    ) {
      return;
    }

    (output as Record<string, unknown>)[key] = value;
  });

  return output;
}
function extractRows<T>(body: unknown): T[] {
  const source = body as { data?: unknown };
  const data = source?.data;

  if (Array.isArray(body)) return body as T[];
  if (Array.isArray(data)) return data as T[];

  if (
    data &&
    typeof data === "object" &&
    Array.isArray((data as { data?: unknown }).data)
  ) {
    return (data as { data: T[] }).data;
  }

  if (
    body &&
    typeof body === "object" &&
    Array.isArray((body as { data?: unknown }).data)
  ) {
    return (body as { data: T[] }).data;
  }

  return [];
}

function extractListFromKeys<T>(body: unknown, keys: string[]): T[] {
  const root = body as Record<string, unknown> | null;
  const data = root && typeof root === "object" ? root.data : undefined;

  for (const candidate of [data, body]) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate))
      continue;
    const record = candidate as Record<string, unknown>;
    for (const key of keys) {
      if (Array.isArray(record[key])) return record[key] as T[];
    }
  }

  return extractRows<T>(body);
}

function extractMeta(body: unknown, rowsLength: number) {
  const source = body as { data?: unknown; meta?: Record<string, unknown> };
  const paginator =
    source?.data &&
    typeof source.data === "object" &&
    !Array.isArray(source.data)
      ? (source.data as Record<string, unknown>)
      : body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};

  const meta = source?.meta ?? paginator ?? {};

  return {
    current_page: Number(meta.current_page ?? 1),
    per_page: Number(meta.per_page ?? rowsLength ?? 10),
    total: Number(meta.total ?? rowsLength ?? 0),
    last_page: Number(meta.last_page ?? 1),
  };
}

function paginated<T>(body: unknown): PaginatedResponse<T> {
  const source = body as { success?: boolean; message?: string };
  const rows = extractRows<T>(body);

  return {
    success: source?.success,
    message: source?.message,
    data: rows,
    meta: extractMeta(body, rows.length),
  };
}

function extractStockValuation(body: unknown): {
  rows: StockValuationRow[];
  total_value: number;
} {
  const root = body as Record<string, unknown> | null;
  const data = root && typeof root === "object" ? root.data : undefined;
  const source =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};

  const rows = Array.isArray(source.items)
    ? (source.items as StockValuationRow[])
    : extractRows<StockValuationRow>(body);

  return {
    rows,
    total_value: Number(
      source.total_value ??
        rows.reduce(
          (sum, row) => sum + Number(row.stock_value ?? row.value ?? 0),
          0,
        ),
    ),
  };
}

function extractRecipeIntegrity(body: unknown): {
  rows: RecipeIntegrityRow[];
  summary: Record<string, number>;
} {
  const root = body as Record<string, unknown> | null;
  const data = root && typeof root === "object" ? root.data : undefined;
  const source =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};

  const rows = Array.isArray(source.recipes)
    ? (source.recipes as RecipeIntegrityRow[])
    : extractRows<RecipeIntegrityRow>(body);

  const summary =
    source.summary && typeof source.summary === "object"
      ? (source.summary as Record<string, number>)
      : {};

  return { rows, summary };
}

export type InventoryRoleScope =
  | "admin"
  | "manager"
  | "finance"
  | "food-controller"
  | "stock-keeper"
  | "purchaser";

function rolePrefix(roleScope: InventoryRoleScope = "admin") {
  if (roleScope === "manager") return "/manager";
  if (roleScope === "finance") return "/finance";
  if (roleScope === "food-controller") return "/food-controller";
  if (roleScope === "stock-keeper") return "/stock-keeper";
  if (roleScope === "purchaser") return "/purchaser";
  return "/admin";
}

export const inventoryService = {
  async items(
    params: InventoryListParams = {},
    roleScope: InventoryRoleScope = "admin",
  ) {
    const response = await api.get(`${rolePrefix(roleScope)}/inventory/items`, {
      params: cleanParams(params),
    });
    return paginated<InventoryItem>(response.data);
  },

  async trashedItems(
    params: InventoryListParams = {},
    roleScope: InventoryRoleScope = "food-controller",
  ) {
    const response = await api.get(
      `${rolePrefix(roleScope)}/inventory/items/trashed`,
      { params: cleanParams(params) },
    );
    return paginated<InventoryItem>(response.data);
  },

  async item(id: number | string, roleScope: InventoryRoleScope = "admin") {
    const response = await api.get(
      `${rolePrefix(roleScope)}/inventory/items/${id}`,
    );
    return unwrap<ApiEnvelope<InventoryItem>>(response).data;
  },

  async createItem(
    payload: InventoryItemPayload,
    roleScope: InventoryRoleScope = "admin",
  ) {
    const response = await api.post(
      `${rolePrefix(roleScope)}/inventory/items`,
      payload,
    );
    return unwrap<ApiEnvelope<InventoryItem>>(response);
  },

  async updateItem(
    id: number | string,
    payload: Partial<InventoryItemPayload>,
    roleScope: InventoryRoleScope = "admin",
  ) {
    const response = await api.put(
      `${rolePrefix(roleScope)}/inventory/items/${id}`,
      payload,
    );
    return unwrap<ApiEnvelope<InventoryItem>>(response);
  },

  async deleteItem(
    id: number | string,
    roleScope: InventoryRoleScope = "admin",
  ) {
    const response = await api.delete(
      `${rolePrefix(roleScope)}/inventory/items/${id}`,
    );
    return unwrap<ApiEnvelope<null>>(response);
  },

  async restoreItem(
    id: number | string,
    roleScope: InventoryRoleScope = "food-controller",
  ) {
    const response = await api.post(
      `${rolePrefix(roleScope)}/inventory/items/${id}/restore`,
    );
    return unwrap<ApiEnvelope<InventoryItem>>(response);
  },

  async forceDeleteItem(
    id: number | string,
    roleScope: InventoryRoleScope = "food-controller",
  ) {
    const response = await api.delete(
      `${rolePrefix(roleScope)}/inventory/items/${id}/force`,
    );
    return unwrap<ApiEnvelope<null>>(response);
  },

  async transactions(
    params: InventoryListParams & {
      type?: string;
      inventory_item_id?: number | string;
    } = {},
    roleScope: InventoryRoleScope = "admin",
  ) {
    const response = await api.get(
      `${rolePrefix(roleScope)}/inventory/transactions`,
      { params: cleanParams(params) },
    );
    return paginated<InventoryTransaction>(response.data);
  },

  async adjustItem(
    id: number | string,
    payload: StockAdjustmentPayload,
    roleScope: InventoryRoleScope = "admin",
  ) {
    const response = await api.post(
      `${rolePrefix(roleScope)}/inventory/items/${id}/adjust`,
      {
        ...payload,
        reason: payload.reason ?? payload.note ?? "Manual stock adjustment",
      },
    );
    return unwrap<ApiEnvelope<InventoryTransaction>>(response);
  },

  async wasteItem(
    id: number | string,
    payload: WastePayload,
    roleScope: InventoryRoleScope = "admin",
  ) {
    const response = await api.post(
      `${rolePrefix(roleScope)}/inventory/items/${id}/waste`,
      {
        ...payload,
        reason: payload.reason ?? payload.note ?? "Waste / damage recorded",
      },
    );
    return unwrap<ApiEnvelope<InventoryTransaction>>(response);
  },

  async stockOutItem(
    id: number | string,
    payload: DepartmentStockoutPayload,
    roleScope: InventoryRoleScope = "stock-keeper",
  ) {
    const response = await api.post(
      `${rolePrefix(roleScope)}/inventory/items/${id}/stockout`,
      payload,
    );
    return unwrap<ApiEnvelope<InventoryTransaction>>(response);
  },

  async departments(
    params: { search?: string; is_active?: boolean; per_page?: number } = {},
    roleScope: InventoryRoleScope = "stock-keeper",
  ) {
    const response = await api.get(`${rolePrefix(roleScope)}/departments`, { params: cleanParams(params) });
    return paginated<Department>(response.data);
  },

  async departmentUsers(departmentId: number | string) {
    const response = await api.get(`/stock-keeper/departments/${departmentId}/users`);
    return extractRows<DepartmentUser>(response.data);
  },

  async myDepartmentIssues(params: { per_page?: number } = {}) {
    const response = await api.get("/inventory-custody/issues", { params: cleanParams(params) });
    return paginated<InventoryTransaction>(response.data);
  },

  async acknowledgeDepartmentIssue(issueId: number | string) {
    const response = await api.post(`/inventory-custody/issues/${issueId}/acknowledge`);
    return unwrap<ApiEnvelope<InventoryTransaction>>(response);
  },

  async recordDepartmentUse(issueId: number | string, payload: { quantity: number; note?: string }) {
    const response = await api.post(`/inventory-custody/issues/${issueId}/use`, payload);
    return unwrap<ApiEnvelope<InventoryTransaction>>(response);
  },

  async requestDepartmentReturn(issueId: number | string, payload: { quantity: number; reason: string }) {
    const response = await api.post(`/inventory-custody/issues/${issueId}/request-return`, payload);
    return unwrap<ApiEnvelope<InventoryTransaction>>(response);
  },

  async requestableStockItems() {
    const response = await api.get("/inventory-custody/request-items");
    return extractRows<InventoryItem>(response.data);
  },

  async myStockoutRequests() {
    const response = await api.get("/inventory-custody/stockout-requests", { params: { per_page: 100 } });
    return paginated<any>(response.data);
  },

  async createStockoutRequest(payload: { inventory_item_id: number | string; quantity: number; reason: string }) {
    const response = await api.post("/inventory-custody/stockout-requests", payload);
    return unwrap<ApiEnvelope<any>>(response);
  },

  async stockoutRequestQueue(scope: "food-controller" | "stock-keeper", status = "all") {
    const response = await api.get(`/${scope}/stockout-requests`, { params: { status: status === "all" ? undefined : status, per_page: 100 } });
    return paginated<any>(response.data);
  },

  async validateStockoutRequest(id: number | string, note?: string) {
    const response = await api.post(`/food-controller/stockout-requests/${id}/validate`, { validation_note: note || undefined });
    return unwrap<ApiEnvelope<any>>(response);
  },

  async rejectStockoutRequest(id: number | string, validation_note: string) {
    const response = await api.post(`/food-controller/stockout-requests/${id}/reject`, { validation_note });
    return unwrap<ApiEnvelope<any>>(response);
  },

  async issueStockoutRequest(id: number | string) {
    const response = await api.post(`/stock-keeper/stockout-requests/${id}/issue`);
    return unwrap<ApiEnvelope<any>>(response);
  },

  async departmentConsumptionReport(scope: "department" | "food-controller", filters: { date_from?: string; date_to?: string; inventory_item_id?: string | number; approval_status?: string } = {}) {
    const endpoint = scope === "department" ? "/inventory-custody/consumption-report" : "/food-controller/consumption-report";
    const response = await api.get(endpoint, { params: { ...cleanParams(filters), per_page: 100 } });
    return paginated<any>(response.data);
  },

  async approveConsumptions(payload: { selection_mode: "selected" | "filtered"; consumption_ids?: Array<number | string>; date_from?: string; date_to?: string; inventory_item_id?: string | number }) {
    const response = await api.post("/food-controller/consumption-report/approve", payload);
    return unwrap<ApiEnvelope<{ approval_batch: string; approved_count: number; total_cost: number }>>(response);
  },

  async createDepartment(
    payload: DepartmentPayload,
    roleScope: InventoryRoleScope = "stock-keeper",
  ) {
    const response = await api.post(`${rolePrefix(roleScope)}/departments`, payload);
    return unwrap<ApiEnvelope<Department>>(response);
  },

  async updateDepartment(
    id: number | string,
    payload: Partial<DepartmentPayload>,
    roleScope: InventoryRoleScope = "stock-keeper",
  ) {
    const response = await api.put(`${rolePrefix(roleScope)}/departments/${id}`, payload);
    return unwrap<ApiEnvelope<Department>>(response);
  },

  async deleteDepartment(
    id: number | string,
    roleScope: InventoryRoleScope = "stock-keeper",
  ) {
    const response = await api.delete(`${rolePrefix(roleScope)}/departments/${id}`);
    return unwrap<ApiEnvelope<null>>(response);
  },

  async stockBalances(
    params: InventoryListParams = {},
    roleScope: InventoryRoleScope = "stock-keeper",
  ) {
    const response = await api.get(`${rolePrefix(roleScope)}/inventory/stock-balances`, { params: cleanParams(params) });
    return paginated<StockBalanceRow>(response.data);
  },

  async returnableIssues(
    params: InventoryListParams = {},
    roleScope: InventoryRoleScope = "stock-keeper",
  ) {
    const response = await api.get(`${rolePrefix(roleScope)}/inventory/returnable-issues`, { params: cleanParams(params) });
    return paginated<InventoryTransaction>(response.data);
  },

  async returnToStore(
    issueId: number | string,
    payload: ReturnToStorePayload,
    roleScope: InventoryRoleScope = "stock-keeper",
  ) {
    const response = await api.post(`${rolePrefix(roleScope)}/inventory/issues/${issueId}/return`, payload);
    return unwrap<ApiEnvelope<{ item: InventoryItem; transaction: InventoryTransaction; remaining_returnable_quantity: number }>>(response);
  },

  async stockCard(
    itemId: number | string,
    params: { from?: string; to?: string } = {},
    roleScope: InventoryRoleScope = "stock-keeper",
  ) {
    const response = await api.get(`${rolePrefix(roleScope)}/inventory/items/${itemId}/stock-card`, { params: cleanParams(params) });
    return unwrap<ApiEnvelope<StockCard>>(response).data;
  },

  async transferItem(
    id: number | string,
    payload: TransferPayload,
    roleScope: InventoryRoleScope = "admin",
  ) {
    const response = await api.post(
      `${rolePrefix(roleScope)}/inventory/items/${id}/transfer`,
      payload,
    );
    return unwrap<ApiEnvelope<InventoryTransaction>>(response);
  },

  async batches(
    params: InventoryListParams & { inventory_item_id?: number | string } = {},
    roleScope: InventoryRoleScope = "admin",
  ) {
    const response = await api.get(
      `${rolePrefix(roleScope)}/inventory/batches`,
      { params: cleanParams(params) },
    );
    return paginated<InventoryBatch>(response.data);
  },

  async menuItems(
    params: InventoryListParams & {
      type?: string;
      is_active?: boolean;
      is_available?: boolean;
    } = {},
    roleScope: InventoryRoleScope = "admin",
  ) {
    const response = await api.get(`${rolePrefix(roleScope)}/menu/items`, {
      params: cleanParams(params),
    });
    return paginated<MenuItemOption>(response.data);
  },

  async recipes(
    params: InventoryListParams = {},
    roleScope: InventoryRoleScope = "admin",
  ) {
    const response = await api.get(`${rolePrefix(roleScope)}/recipes`, {
      params: cleanParams(params),
    });
    return paginated<Recipe>(response.data);
  },

  async createRecipe(
    payload: RecipePayload,
    roleScope: InventoryRoleScope = "admin",
  ) {
    const response = await api.post(
      `${rolePrefix(roleScope)}/recipes`,
      payload,
    );
    return unwrap<ApiEnvelope<Recipe>>(response);
  },

  async updateRecipe(
    id: number | string,
    payload: RecipePayload,
    roleScope: InventoryRoleScope = "admin",
  ) {
    const response = await api.put(
      `${rolePrefix(roleScope)}/recipes/${id}`,
      payload,
    );
    return unwrap<ApiEnvelope<Recipe>>(response);
  },

  async deleteRecipe(
    id: number | string,
    roleScope: InventoryRoleScope = "admin",
  ) {
    const response = await api.delete(`${rolePrefix(roleScope)}/recipes/${id}`);
    return unwrap<ApiEnvelope<null>>(response);
  },

  async lowStock(roleScope: InventoryRoleScope = "food-controller") {
    // Store Keeper must read low-stock rows from the same inventory source used
    // by the Inventory Items page. This prevents report/item query drift and
    // includes every item where current_stock <= minimum_quantity.
    if (roleScope === "stock-keeper") {
      const response = await api.get(
        `${rolePrefix(roleScope)}/inventory/items`,
        { params: { status: "low_stock", per_page: 200 } },
      );
      return extractRows<LowStockRow>(response.data);
    }

    const response = await api.get(
      `${rolePrefix(roleScope)}/reports/low-stock`,
    );
    return extractListFromKeys<LowStockRow>(response.data, [
      "items",
      "low_stock",
      "rows",
    ]);
  },

  async reorderSuggestions(roleScope: InventoryRoleScope = "food-controller") {
    const response = await api.get(
      `${rolePrefix(roleScope)}/reports/reorder-suggestions`,
    );
    return extractListFromKeys<any>(response.data, [
      "items",
      "suggestions",
      "rows",
      "data",
    ]);
  },

  async expiredItems(roleScope: InventoryRoleScope = "food-controller") {
    const response = await api.get(
      `${rolePrefix(roleScope)}/reports/expired-items`,
    );
    return extractListFromKeys<any>(response.data, [
      "items",
      "expired_items",
      "batches",
      "rows",
      "data",
    ]);
  },

  async receivingHistory(
    params: InventoryListParams & {
      supplier_id?: number | string;
      purchase_order_id?: number | string;
    } = {},
    roleScope: InventoryRoleScope = "food-controller",
  ) {
    const response = await api.get(
      `${rolePrefix(roleScope)}/reports/receiving-history`,
      { params: cleanParams(params) },
    );
    return paginated<any>(response.data);
  },

  async stockValuation(roleScope: InventoryRoleScope = "food-controller") {
    const response = await api.get(
      `${rolePrefix(roleScope)}/reports/stock-valuation`,
    );
    return extractStockValuation(response.data);
  },

  async recipeIntegrity(roleScope: InventoryRoleScope = "food-controller") {
    const response = await api.get(
      `${rolePrefix(roleScope)}/reports/recipe-integrity`,
    );
    return extractRecipeIntegrity(response.data);
  },

  async stockStatusSummary(roleScope: InventoryRoleScope = "food-controller") {
    const response = await api.get(
      `${rolePrefix(roleScope)}/reports/stock-status-summary`,
    );
    return response.data?.data ?? response.data ?? {};
  },
};

export default inventoryService;
