import api, { unwrap } from "@/lib/api";
import type {
  ApiEnvelope,
  AssignUserRolePayload,
  CreateUserPayload,
  PaginatedResponse,
  PermissionItem,
  PermissionListParams,
  ResetUserPasswordPayload,
  RoleItem,
  RoleListParams,
  UpdateUserPayload,
  UserItem,
  UserListParams,
} from "@/types/user-management/user.type";

function cleanParams<T extends Record<string, unknown>>(params: T = {} as T) {
  const output: Record<string, unknown> = {};
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "" || value === "all") return;
    output[key] = value;
  });
  return output;
}

function paginated<T>(body: any): PaginatedResponse<T> {
  const data = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
  const meta = body?.meta ?? {};
  return {
    success: body?.success,
    message: body?.message,
    data,
    meta: {
      current_page: Number(meta.current_page ?? 1),
      per_page: Number(meta.per_page ?? data.length ?? 10),
      total: Number(meta.total ?? data.length ?? 0),
      last_page: Number(meta.last_page ?? 1),
    },
  };
}

export const userService = {
  async list(params: UserListParams = {}) {
    const response = await api.get("/admin/users", { params: cleanParams(params) });
    return paginated<UserItem>(response.data);
  },

  async show(id: number | string) {
    const response = await api.get(`/admin/users/${id}`);
    return unwrap<ApiEnvelope<UserItem>>(response).data;
  },

  async create(payload: CreateUserPayload) {
    const response = await api.post("/admin/users", payload);
    return unwrap<ApiEnvelope<UserItem>>(response);
  },

  async update(id: number | string, payload: UpdateUserPayload) {
    const response = await api.put(`/admin/users/${id}`, payload);
    return unwrap<ApiEnvelope<UserItem>>(response);
  },

  async remove(id: number | string) {
    const response = await api.delete(`/admin/users/${id}`);
    return unwrap<ApiEnvelope<null>>(response);
  },

  async toggle(id: number | string) {
    const response = await api.patch(`/admin/users/${id}/toggle`);
    return unwrap<ApiEnvelope<UserItem>>(response);
  },

  async resetPassword(id: number | string, payload: ResetUserPasswordPayload) {
    const response = await api.post(`/admin/users/${id}/reset-password`, payload);
    return unwrap<ApiEnvelope<{ id: number | string }>>(response);
  },

  async assignRole(id: number | string, payload: AssignUserRolePayload) {
    const response = await api.post(`/admin/users/${id}/roles`, payload);
    return unwrap<ApiEnvelope<UserItem>>(response);
  },

  async issueQrCard(id: number | string) {
    const response = await api.post(`/admin/users/${id}/qr-card`);
    return unwrap<ApiEnvelope<{ user_id: number | string; name: string; qr_token: string; issued_at?: string }>>(response).data;
  },

  async revokeQrCard(id: number | string) {
    const response = await api.delete(`/admin/users/${id}/qr-card`);
    return unwrap<ApiEnvelope<{ id: number | string }>>(response);
  },

  async balanceAccount(id: number | string) {
    const response = await api.get(`/admin/users/${id}/balance-account`);
    return unwrap<ApiEnvelope<{ user_id: number | string; balance: number; is_active: boolean }>>(response).data;
  },

  async adjustBalanceAccount(id: number | string, amount: number, note?: string) {
    const response = await api.post(`/admin/users/${id}/balance-account/adjust`, { amount, note });
    return unwrap<ApiEnvelope<{ user_id: number | string; balance: number; is_active: boolean }>>(response).data;
  },

  async rolesLite() {
    const response = await api.get("/admin/users/roles-lite");
    const body = response.data;
    return Array.isArray(body?.data) ? (body.data as RoleItem[]) : [];
  },

  async waitersLite(search?: string) {
    const response = await api.get("/admin/users/waiters-lite", { params: cleanParams({ search }) });
    const body = response.data;
    return Array.isArray(body?.data) ? (body.data as UserItem[]) : [];
  },

  // Compatibility aliases for older starter pages.
  async roles(params: RoleListParams = {}) {
    const response = await api.get("/admin/roles", { params: cleanParams(params) });
    const body = response.data;
    if (Array.isArray(body?.data)) return body.data as RoleItem[];
    return [];
  },

  async permissions(params: PermissionListParams = { all: true }) {
    const response = await api.get("/admin/permissions", { params: cleanParams(params) });
    const body = response.data;
    if (Array.isArray(body?.data)) return body.data as PermissionItem[];
    return [];
  },
};

export default userService;
