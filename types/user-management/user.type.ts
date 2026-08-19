export type UserStatus = "active" | "disabled";

export type PaginationMeta = {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
};

export type ApiEnvelope<T> = {
  success?: boolean;
  message?: string;
  data: T;
};

export type PaginatedResponse<T> = {
  success?: boolean;
  message?: string;
  data: T[];
  meta: PaginationMeta;
};

export type UserItem = {
  id: number | string;
  name: string;
  email: string;
  phone?: string | null;
  status?: UserStatus;
  role?: string | null;
  department_id?: number | string | null;
  department?: {
    id: number | string;
    name: string;
    code?: string | null;
    is_active?: boolean;
  } | null;
  roles?: Array<string | { id?: number | string; name: string }>;
  profile_image_url?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type UserListParams = {
  search?: string;
  status?: UserStatus | "all";
  page?: number;
  per_page?: number;
};

export type CreateUserPayload = {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: string;
  department_id: number | string;
};

export type UpdateUserPayload = {
  name: string;
  email: string;
  phone: string;
  role: string;
  department_id: number | string;
};

export type ResetUserPasswordPayload = {
  new_password: string;
};

export type AssignUserRolePayload = {
  role: string;
};

export type RoleItem = {
  id: number | string;
  name: string;
  guard_name?: string;
  created_at?: string;
  updated_at?: string;
};

export type RoleListParams = {
  search?: string;
  page?: number;
  per_page?: number;
};

export type RolePayload = {
  name: string;
};

export type PermissionItem = {
  id: number | string;
  name: string;
  guard_name?: string;
  created_at?: string;
  updated_at?: string;
};

export type PermissionListParams = {
  search?: string;
  all?: boolean;
  page?: number;
  per_page?: number;
};

export type PermissionPayload = {
  name: string;
};

export type AssignRolePermissionsPayload = {
  permissions: string[];
};

export type RolePermissionResult = {
  role_id: number | string;
  assigned_count: number;
  permissions: string[];
};
