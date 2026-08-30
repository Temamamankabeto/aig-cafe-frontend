import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

const rawApiUrl =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "https://api.aigcafe.com/api";

const API_BASE_URL = rawApiUrl.replace(/\/+$/, "").endsWith("/api")
  ? rawApiUrl.replace(/\/+$/, "")
  : `${rawApiUrl.replace(/\/+$/, "")}/api`;

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

function isBrowser() {
  return typeof window !== "undefined";
}

function deleteLegacyCookie(name: string) {
  if (!isBrowser()) return;
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function clearSession() {
  if (!isBrowser()) return;

  // Remove only legacy client-readable authentication data.
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  localStorage.removeItem("roles");
  localStorage.removeItem("permissions");
  localStorage.removeItem("auth_last_activity_at");

  deleteLegacyCookie("token");
  deleteLegacyCookie("roles");
  deleteLegacyCookie("permissions");
  deleteLegacyCookie("user");
}

export function expireServerSession() {
  if (!isBrowser()) return Promise.resolve();

  return fetch(`${API_BASE_URL}/auth/expire-session`, {
    method: "POST",
    credentials: "include",
    keepalive: true,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  }).then(() => undefined);
}

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: Number(process.env.NEXT_PUBLIC_API_TIMEOUT ?? 15000),
  withCredentials: true,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: Number(process.env.NEXT_PUBLIC_API_TIMEOUT ?? 15000),
  withCredentials: true,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken() {
  if (!isBrowser()) return false;

  if (!refreshPromise) {
    refreshPromise = refreshClient
      .post("/auth/refresh")
      .then(() => true)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<any>) => {
    const originalRequest = error.config as RetriableRequestConfig | undefined;
    const status = error.response?.status;
    const url = originalRequest?.url ?? "";

    if (
      status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !url.includes("/auth/login") &&
      !url.includes("/auth/register") &&
      !url.includes("/auth/refresh") &&
      !url.includes("/auth/forgot-password") &&
      !url.includes("/auth/reset-password")
    ) {
      originalRequest._retry = true;

      const refreshed = await refreshAccessToken();

      if (refreshed) {
        return api(originalRequest);
      }

      clearSession();
      if (isBrowser() && !window.location.pathname.includes("/login")) {
        window.location.href = "/login?reason=session-expired";
      }

      return Promise.reject(new Error("Your session has expired. Please sign in again."));
    }

    const data = error.response?.data;
    const message =
      data?.message ||
      (data?.errors ? Object.values(data.errors).flat().join(", ") : null) ||
      error.message ||
      "Request failed";

    if (status === 401) {
      clearSession();

      if (isBrowser() && !window.location.pathname.includes("/login")) {
        window.location.href = "/login";
      }
    }

    return Promise.reject(new Error(message));
  }
);

export function unwrap<T>(response: any): T {
  const body = response?.data;

  if (!body) {
    throw new Error("Invalid API response");
  }

  if (body.success === false) {
    throw new Error(body.message || "Request failed");
  }

  return body as T;
}

export default api;
