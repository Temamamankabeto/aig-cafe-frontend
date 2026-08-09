import api, { clearSession, unwrap } from "@/lib/api";
import type { CustomerRegisterPayload } from "@/lib/auth/auth.schema";

export type AuthUser = {
  id?: number | string;
  name?: string;
  email?: string;
  phone?: string;
  address?: string | null;
  role?: string;
  roles?: string[];
  permissions?: string[];
};

type LoginResponse = {
  token?: string;
  access_token?: string;
  user?: AuthUser;
  roles?: string[];
  permissions?: string[];
  data?: LoginResponse;
};

const CANONICAL_ROLES = [
  "General Admin",
  "Manager",
  "F&B Controller",
  "Finance",
  "Purchaser",
  "Store Keeper",
  "Cashier",
  "Kitchen Staff",
  "Barman",
  "Waiter",
  "Customer",
] as const;

const ROLE_ALIASES: Record<string, (typeof CANONICAL_ROLES)[number]> = {
  admin: "General Admin",
  "general administrator": "General Admin",
  "cafeteria manager": "Manager",
  "finance manager": "Finance",
  "f and b controller": "F&B Controller",
  "food controller": "F&B Controller",
};

function normalizeRoleValue(value: string) {
  return value.trim().toLowerCase().replace(/&/g, "and").replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

export function canonicalRoleName(value?: string | null): string | null {
  if (!value) return null;
  const normalized = normalizeRoleValue(value);
  const canonical = CANONICAL_ROLES.find((role) => normalizeRoleValue(role) === normalized);
  return canonical ?? ROLE_ALIASES[normalized] ?? null;
}

function canonicalRoles(roles: string[]) {
  return [...new Set(roles.map((role) => canonicalRoleName(role)).filter((role): role is string => Boolean(role)))];
}

function normalizeLoginResponse(response: unknown): LoginResponse {
  const value = response as { data?: LoginResponse } | LoginResponse;
  return "data" in value && value.data ? value.data : (value as LoginResponse);
}

function setCookie(name: string, value: unknown, maxAgeSeconds = 60 * 60 * 24 * 7) {
  if (typeof document === "undefined") return;
  const encoded = encodeURIComponent(typeof value === "string" ? value : JSON.stringify(value));
  document.cookie = `${name}=${encoded}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax`;
}

function deleteCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
}

function clearAuthCookies() {
  deleteCookie("token");
  deleteCookie("roles");
  deleteCookie("permissions");
  deleteCookie("user");
}

export const authService = {
  async login(credentials: { login: string; password: string } | { email: string; password: string }) {
    const response = await api.post("/auth/login", credentials);
    return normalizeLoginResponse(unwrap<LoginResponse>(response));
  },

  async registerCustomer(payload: CustomerRegisterPayload) {
    const response = await api.post("/auth/register", payload);
    return normalizeLoginResponse(unwrap<LoginResponse>(response));
  },

  async me() {
    const response = await api.get("/auth/me");
    return unwrap<AuthUser>(response);
  },

  async logout() {
    try {
      await api.post("/auth/logout");
    } finally {
      clearSession();
      clearAuthCookies();
    }
  },

  saveSession(response: LoginResponse) {
    if (typeof window === "undefined") return;
    const token = response.token ?? response.access_token ?? response.data?.token ?? response.data?.access_token;
    const user = response.user ?? response.data?.user ?? null;
    const roles = canonicalRoles(response.roles ?? response.data?.roles ?? user?.roles ?? (user?.role ? [user.role] : []));
    const permissions = response.permissions ?? response.data?.permissions ?? user?.permissions ?? [];

    if (token) {
      localStorage.setItem("token", token);
      setCookie("token", token);
    }
    if (user) {
      localStorage.setItem("user", JSON.stringify(user));
      setCookie("user", user);
    }

    localStorage.setItem("roles", JSON.stringify(roles));
    localStorage.setItem("permissions", JSON.stringify(permissions));
    setCookie("roles", roles);
    setCookie("permissions", permissions);
  },

  getStoredUser(): AuthUser | null {
    if (typeof window === "undefined") return null;
    try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; }
  },

  getStoredRoles(): string[] {
    if (typeof window === "undefined") return [];
    try {
      const roles = JSON.parse(localStorage.getItem("roles") || "[]");
      return Array.isArray(roles) ? canonicalRoles(roles.map(String)) : [];
    } catch {
      return [];
    }
  },

  getStoredPermissions(): string[] {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem("permissions") || "[]"); } catch { return []; }
  },
};
