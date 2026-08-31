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
  department_id?: number | string | null;
  email_verified?: boolean;
};

type LoginResponse = {
  user?: AuthUser;
  roles?: string[];
  permissions?: string[];
  data?: LoginResponse;
  message?: string;
};

export type RegistrationResponse = {
  success?: boolean;
  message?: string;
  data?: {
    email?: string;
    verification_required?: boolean;
    verification_email_sent?: boolean;
  };
};

type MeResponse = {
  success?: boolean;
  data?: AuthUser;
  user?: AuthUser;
  roles?: string[];
  permissions?: string[];
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

let sessionUser: AuthUser | null = null;
let sessionRoles: string[] = [];
let sessionPermissions: string[] = [];

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

function purgeLegacyClientAuthStorage() {
  if (typeof window === "undefined") return;
  clearSession();
}

function cacheSession(response: {
  user?: AuthUser | null;
  roles?: string[];
  permissions?: string[];
}) {
  const user = response.user ?? null;
  const roles = canonicalRoles(
    response.roles ??
      user?.roles ??
      (user?.role ? [user.role] : []),
  );
  const permissions = response.permissions ?? user?.permissions ?? [];

  sessionUser = user;
  sessionRoles = roles;
  sessionPermissions = [...new Set(permissions.map(String))];
}

export const authService = {
  async login(credentials: { login: string; password: string } | { email: string; password: string }) {
    const response = await api.post("/auth/login", credentials);
    return normalizeLoginResponse(unwrap<LoginResponse>(response));
  },

  async registerCustomer(payload: CustomerRegisterPayload) {
    const response = await api.post("/auth/register", payload);
    return unwrap<RegistrationResponse>(response);
  },

  async resendVerification(email: string) {
    const response = await api.post("/auth/email/verification-notification", { email });
    return unwrap<{ success: boolean; message: string }>(response);
  },

  async forgotPassword(email: string) {
    const response = await api.post("/auth/forgot-password", { email });
    return unwrap<{ success: boolean; message: string }>(response);
  },

  async resetPassword(payload: {
    token: string;
    email: string;
    password: string;
    password_confirmation: string;
  }) {
    const response = await api.post("/auth/reset-password", payload);
    return unwrap<{ success: boolean; message: string }>(response);
  },

  async me() {
    const response = await api.get("/auth/me");
    const body = unwrap<MeResponse>(response);
    const user = body.data ?? body.user ?? null;

    if (!user) {
      throw new Error("Authenticated user data is missing.");
    }

    const normalized: MeResponse = {
      ...body,
      user,
      data: user,
      roles: body.roles ?? user.roles ?? (user.role ? [user.role] : []),
      permissions: body.permissions ?? user.permissions ?? [],
    };

    cacheSession({
      user: normalized.user,
      roles: normalized.roles,
      permissions: normalized.permissions,
    });
    return user;
  },

  async hydrateSession() {
    purgeLegacyClientAuthStorage();
    const response = await api.get("/auth/me");
    const body = unwrap<MeResponse>(response);
    const user = body.data ?? body.user ?? null;

    if (!user) {
      throw new Error("Authenticated user data is missing.");
    }

    cacheSession({
      user,
      roles: body.roles ?? user.roles ?? (user.role ? [user.role] : []),
      permissions: body.permissions ?? user.permissions ?? [],
    });

    return user;
  },

  async logout() {
    try {
      await api.post("/auth/logout");
    } finally {
      sessionUser = null;
      sessionRoles = [];
      sessionPermissions = [];
      purgeLegacyClientAuthStorage();
    }
  },

  saveSession(response: LoginResponse) {
    const normalized = normalizeLoginResponse(response);
    cacheSession({
      user: normalized.user ?? null,
      roles: normalized.roles,
      permissions: normalized.permissions,
    });
    purgeLegacyClientAuthStorage();
  },

  getStoredUser(): AuthUser | null {
    return sessionUser;
  },

  getStoredRoles(): string[] {
    return [...sessionRoles];
  },

  getStoredPermissions(): string[] {
    return [...sessionPermissions];
  },
};
