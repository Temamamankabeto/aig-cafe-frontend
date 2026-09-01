import api, { unwrap } from "@/lib/api";
import type {
  ApiEnvelope,
  MenuCategory,
  MenuCategoryParams,
  MenuCategoryPayload,
  MenuItem,
  MenuItemParams,
  MenuItemPayload,
  PaginatedResponse,
} from "@/types/menu-management";

function cleanParams<T extends object>(params: T) {
  const output: Record<string, unknown> = {};

  Object.entries(params as object).forEach(([key, value]) => {
    if (
      value !== undefined &&
      value !== null &&
      value !== "" &&
      value !== "all"
    ) {
      output[key] = value;
    }
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
const root = body as {
  success?: boolean;
  message?: string;
  data?: unknown;
  meta?: Record<string, unknown>;
} | null;
  const rows = extractRows<T>(body);
  return {
    success: root?.success,
    message: root?.message,
    data: rows,
    meta: extractMeta(body, rows.length),
  };
}

function toFormData(payload: MenuItemPayload) {
  const data = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    if (key === "image" && typeof File !== "undefined" && value instanceof File) data.append("image", value);
    else if (typeof value === "boolean") data.append(key, value ? "1" : "0");
    else data.append(key, String(value));
  });
  return data;
}

export type MenuRoleScope = "admin" | "food-controller" | "waiter" | "cashier" | "public";

function prefix(scope: MenuRoleScope = "admin") {
  if (scope === "food-controller") return "/food-controller/menu";
  if (scope === "waiter") return "/waiter/menu";
  if (scope === "cashier") return "/cashier/orders/menu";
  if (scope === "public") return "/public/menu";
  return "/admin/menu";
}

export const menuService = {
  async categories(params: MenuCategoryParams = {}, scope: MenuRoleScope = "admin") {
    const url = scope === "waiter" || scope === "cashier" || scope === "public" ? "/public/menu/categories" : `${prefix(scope)}/categories`;
    const response = await api.get(url, { params: cleanParams(params) });
    return paginated<MenuCategory>(response.data);
  },

  async items(params: MenuItemParams = {}, scope: MenuRoleScope = "admin") {
    const urls =
      scope === "waiter"
        ? ["/waiter/menu", "/public/menu"]
        : scope === "cashier"
          ? ["/cashier/orders/menu", "/public/menu"]
          : scope === "public"
            ? ["/public/menu"]
            : [`${prefix(scope)}/items`, "/public/menu"];

    let lastError: unknown = null;

    for (const url of urls) {
      try {
        const response = await api.get(url, { params: cleanParams(params) });
        const result = paginated<MenuItem>(response.data);
        if (result.data.length || url === urls[urls.length - 1]) return result;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError instanceof Error ? lastError : new Error("Could not load menu items");
  },

  async createCategory(payload: MenuCategoryPayload, scope: MenuRoleScope = "admin") {
    const response = await api.post(`${prefix(scope)}/categories`, payload);
    return unwrap<ApiEnvelope<MenuCategory>>(response);
  },

  async updateCategory(id: number | string, payload: MenuCategoryPayload, scope: MenuRoleScope = "admin") {
    const response = await api.put(`${prefix(scope)}/categories/${id}`, payload);
    return unwrap<ApiEnvelope<MenuCategory>>(response);
  },

  async toggleCategory(id: number | string, scope: MenuRoleScope = "admin") {
    const response = await api.patch(`${prefix(scope)}/categories/${id}/toggle`);
    return unwrap<ApiEnvelope<MenuCategory>>(response);
  },

  async deleteCategory(id: number | string, scope: MenuRoleScope = "admin") {
    const response = await api.delete(`${prefix(scope)}/categories/${id}`);
    return unwrap<ApiEnvelope<MenuCategory>>(response);
  },

  async createItem(payload: MenuItemPayload, scope: MenuRoleScope = "admin") {
    const hasImage = typeof File !== "undefined" && payload.image instanceof File;
    const response = hasImage
      ? await api.post(`${prefix(scope)}/items`, toFormData(payload), { headers: { "Content-Type": "multipart/form-data" } })
      : await api.post(`${prefix(scope)}/items`, payload);
    return unwrap<ApiEnvelope<MenuItem>>(response);
  },

  async updateItem(id: number | string, payload: MenuItemPayload, scope: MenuRoleScope = "admin") {
    const hasImage = typeof File !== "undefined" && payload.image instanceof File;
    const response = hasImage
      ? await api.post(`${prefix(scope)}/items/${id}?_method=PUT`, toFormData(payload), { headers: { "Content-Type": "multipart/form-data" } })
      : await api.put(`${prefix(scope)}/items/${id}`, payload);
    return unwrap<ApiEnvelope<MenuItem>>(response);
  },

  async toggleItem(id: number | string, scope: MenuRoleScope = "admin") {
    const response = await api.patch(`${prefix(scope)}/items/${id}/toggle`);
    return unwrap<ApiEnvelope<MenuItem>>(response);
  },

  async availability(id: number | string, isAvailable: boolean, scope: MenuRoleScope = "admin") {
    const response = await api.patch(`${prefix(scope)}/items/${id}/availability`, {
      is_available: isAvailable,
    });
    return unwrap<ApiEnvelope<MenuItem>>(response);
  },

  async spatial(id: number | string, scope: MenuRoleScope = "admin") {
    const response = await api.patch(`${prefix(scope)}/items/${id}/spatial`);
    return unwrap<ApiEnvelope<MenuItem>>(response);
  },

  async normal(id: number | string, scope: MenuRoleScope = "admin") {
    const response = await api.patch(`${prefix(scope)}/items/${id}/normal`);
    return unwrap<ApiEnvelope<MenuItem>>(response);
  },

  async deleteItem(id: number | string, scope: MenuRoleScope = "admin") {
    const response = await api.delete(`${prefix(scope)}/items/${id}`);
    return unwrap<ApiEnvelope<MenuItem>>(response);
  },
};

export default menuService;
