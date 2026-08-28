import api, { unwrap } from "@/lib/api";
import type {
  ApiEnvelope,
  AssignWaiterPayload,
  AssignWaitersPayload,
  BulkAssignTablesPayload,
  DiningTable,
  PaginatedResponse,
  TableHistoryRow,
  TableListParams,
  TablePayload,
  TableSummary,
  TransferOrdersPayload,
  TransferWaitersPayload,
  UpdateTableStatusPayload,
} from "@/types/table-management";
import type { UserItem } from "@/types/user-management/user.type";

function cleanParams(params: Record<string, unknown> = {}) {
  const output: Record<string, unknown> = {};
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "" || value === "all") return;
    if (key === "active" && params.is_active === undefined) {
      output.is_active = value;
      return;
    }
    output[key] = value;
  });
  return output;
}

function extractRows<T>(body: unknown): T[] {
  const root = body as Record<string, unknown> | null;
  const data = root && typeof root === "object" ? root.data : undefined;
  if (Array.isArray(body)) return body as T[];
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && Array.isArray((data as { data?: unknown }).data)) {
    return (data as { data: T[] }).data;
  }
  return [];
}

function extractMeta(body: unknown, rowsLength: number) {
  const root = body as Record<string, unknown> | null;
  const data = root && typeof root === "object" ? root.data : undefined;
  const source = data && typeof data === "object" && !Array.isArray(data)
    ? data as Record<string, unknown>
    : root && typeof root === "object" ? root : {};
  const meta = root?.meta && typeof root.meta === "object" ? root.meta as Record<string, unknown> : source;
  return {
    current_page: Number(meta.current_page ?? 1),
    per_page: Number(meta.per_page ?? rowsLength ?? 10),
    total: Number(meta.total ?? rowsLength ?? 0),
    last_page: Number(meta.last_page ?? 1),
  };
}

function paginated<T>(body: unknown): PaginatedResponse<T> {
  const root = body as { success?: boolean; message?: string; summary?: TableSummary };
  const rows = extractRows<T>(body);
  return {
    success: root?.success,
    message: root?.message,
    data: rows,
    meta: extractMeta(body, rows.length),
    summary: root?.summary,
  };
}

function rolePrefix(roleScope: "admin" | "manager" | "waiter" | "cashier" = "manager") {
  if (roleScope === "manager") return "/manager";
  if (roleScope === "waiter") return "/waiter";
  if (roleScope === "cashier") return "/cashier";
  return "/admin";
}

export const tableService = {
  async list(params: TableListParams = {}, roleScope: "admin" | "manager" | "waiter" | "cashier" = "manager") {
    const url = roleScope === "cashier" ? "/cashier/orders/tables" : `${rolePrefix(roleScope)}/tables`;
    const response = await api.get(url, { params: cleanParams(params) });
    return paginated<DiningTable>(response.data);
  },

  async publicList(params: TableListParams = {}) {
    const response = await api.get("/public/tables", { params: cleanParams(params) });
    return paginated<DiningTable>(response.data);
  },

  async show(id: number | string) {
    const response = await api.get(`/manager/tables/${id}`);
    return unwrap<ApiEnvelope<DiningTable>>(response).data;
  },

  async create(payload: TablePayload) {
    const response = await api.post("/manager/tables", payload);
    return unwrap<ApiEnvelope<DiningTable>>(response);
  },

  async update(id: number | string, payload: TablePayload) {
    const response = await api.put(`/manager/tables/${id}`, payload);
    return unwrap<ApiEnvelope<DiningTable>>(response);
  },

  async assignWaiter(id: number | string, payload: AssignWaiterPayload) {
    return tableService.assignWaiters(id, { waiter_ids: [payload.waiter_id] });
  },

  async assignWaiters(id: number | string, payload: AssignWaitersPayload) {
    const response = await api.post(`/manager/tables/${id}/assign`, payload);
    return unwrap<ApiEnvelope<DiningTable>>(response);
  },

  async bulkAssignTablesToWaiter(payload: BulkAssignTablesPayload) {
    const assignRequests = payload.table_ids.map((tableId) =>
      tableService.assignWaiters(tableId, { waiter_ids: [payload.waiter_id] })
    );

    const removeRequests = (payload.remove_table_ids ?? []).map((tableId) =>
      tableService.unassignWaiters(tableId, { waiter_ids: [payload.waiter_id] })
    );

    const results = await Promise.all([...assignRequests, ...removeRequests]);
    return {
      success: true,
      message: `Updated waiter tables. Assigned: ${payload.table_ids.length}, removed: ${payload.remove_table_ids?.length ?? 0}`,
      data: results,
    };
  },

  async unassignWaiters(id: number | string, payload?: AssignWaitersPayload) {
    const hasSpecificWaiters = Boolean(payload?.waiter_ids?.length);
    const response = await api.delete(`/manager/tables/${id}/assign`, hasSpecificWaiters ? { data: payload } : undefined);
    return unwrap<ApiEnvelope<DiningTable>>(response);
  },

  async transferWaiters(id: number | string, payload: TransferWaitersPayload) {
    const response = await api.post(`/manager/tables/${id}/transfer`, payload);
    return unwrap<ApiEnvelope<DiningTable>>(response);
  },

  async transferOrders(id: number | string, payload: TransferOrdersPayload) {
    const response = await api.post(`/manager/tables/${id}/transfer-orders`, payload);
    return unwrap<ApiEnvelope<DiningTable>>(response);
  },

  async updateStatus(id: number | string, payload: UpdateTableStatusPayload) {
    const response = await api.patch(`/manager/tables/${id}/status`, payload);
    return unwrap<ApiEnvelope<DiningTable>>(response);
  },

  async toggle(id: number | string) {
    const response = await api.patch(`/manager/tables/${id}/toggle`);
    return unwrap<ApiEnvelope<DiningTable>>(response);
  },

  async delete(id: number | string) {
    const response = await api.delete(`/manager/tables/${id}`);
    return unwrap<ApiEnvelope<null>>(response);
  },

  async summary(roleScope: "admin" | "manager" = "manager") {
    const response = await api.get(`${rolePrefix(roleScope)}/tables-summary`);
    const body = response.data;
    return (body?.data ?? body?.summary ?? body ?? {}) as TableSummary;
  },

  async sections(roleScope: "admin" | "manager" = "manager") {
    const response = await api.get(`${rolePrefix(roleScope)}/tables-sections`);
    const body = response.data;
    if (Array.isArray(body?.data)) return body.data as string[];
    if (Array.isArray(body?.sections)) return body.sections as string[];
    return [];
  },

  async history(id: number | string) {
    const response = await api.get(`/manager/tables/${id}/history`);
    return extractRows<TableHistoryRow>(response.data);
  },

  async waiters(search?: string) {
    try {
      const response = await api.get("/manager/users/waiters-lite", { params: cleanParams({ search }) });
      const rows = extractRows<UserItem>(response.data);
      if (rows.length) return rows;
    } catch {
      // Fallback for backends without a waiters-lite endpoint.
    }

    const response = await api.get("/admin/users", { params: cleanParams({ search, per_page: 100 }) });
    const rows = extractRows<UserItem>(response.data);
    return rows.filter((user) => {
      const values = [
        user.role,
        ...(Array.isArray(user.roles) ? user.roles.map((role) => typeof role === "string" ? role : role.name) : []),
      ]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase().replace(/[ _-]/g, ""));

      return values.some((value) => value === "waiter" || value.includes("waiter"));
    });
  },
};

export default tableService;
