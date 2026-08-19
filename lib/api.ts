import axios, { AxiosError, AxiosHeaders, InternalAxiosRequestConfig } from "axios";

const rawApiUrl =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "https://api.aigcafe.com/api";

const API_BASE_URL = rawApiUrl.replace(/\/+$/, "").endsWith("/api")
  ? rawApiUrl.replace(/\/+$/, "")
  : `${rawApiUrl.replace(/\/+$/, "")}/api`;

const TOKEN_KEY = "token";

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

function isBrowser() {
  return typeof window !== "undefined";
}

function setCookie(name: string, value: string, maxAgeSeconds = 60 * 60 * 24 * 7) {
  if (!isBrowser()) return;
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax`;
}

export function getToken() {
  return isBrowser() ? localStorage.getItem(TOKEN_KEY) : null;
}

export function saveAccessToken(token: string) {
  if (!isBrowser()) return;

  localStorage.setItem(TOKEN_KEY, token);
  setCookie(TOKEN_KEY, token);
}

export function clearSession() {
  if (!isBrowser()) return;

  localStorage.removeItem("token");
  localStorage.removeItem("user");
  localStorage.removeItem("roles");
  localStorage.removeItem("permissions");

  document.cookie = "token=; Path=/; Max-Age=0; SameSite=Lax";
  document.cookie = "roles=; Path=/; Max-Age=0; SameSite=Lax";
  document.cookie = "permissions=; Path=/; Max-Age=0; SameSite=Lax";
  document.cookie = "user=; Path=/; Max-Age=0; SameSite=Lax";
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

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken() {
  if (!isBrowser()) return null;

  if (!refreshPromise) {
    refreshPromise = refreshClient
      .post("/auth/refresh")
      .then((response) => {
        const token = response.data?.data?.token ?? response.data?.token ?? response.data?.access_token;

        if (!token) return null;

        saveAccessToken(token);

        return token as string;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getToken();

  const headers =
    config.headers instanceof AxiosHeaders
      ? config.headers
      : new AxiosHeaders(config.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  config.headers = headers;
  return config;
});

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
      !url.includes("/auth/refresh")
    ) {
      originalRequest._retry = true;

      const newToken = await refreshAccessToken();

      if (newToken) {
        const headers =
          originalRequest.headers instanceof AxiosHeaders
            ? originalRequest.headers
            : new AxiosHeaders(originalRequest.headers);

        headers.set("Authorization", `Bearer ${newToken}`);
        originalRequest.headers = headers;

        return api(originalRequest);
      }
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
