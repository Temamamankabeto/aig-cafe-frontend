import type { NextConfig } from "next";

const backendBaseUrl = (
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, "") ||
  "https://api.aigcafe.com"
).replace(/\/+$/, "");

const isDevelopment = process.env.NODE_ENV !== "production";
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${backendBaseUrl}${isDevelopment ? " ws: wss:" : ""}`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const nextConfig: NextConfig = {
  output: "standalone",

  images: {
    unoptimized: true,
  },

  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "Content-Security-Policy", value: contentSecurityPolicy },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ...(isDevelopment ? [] : [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" }]),
      ],
    }];
  },

  async redirects() {
    return [
      {
        source: "/dashboard/orders",
        destination: "/dashboard/order-management/orders",
        permanent: false,
      },
      {
        source: "/dashboard/orders/create",
        destination: "/dashboard/order-management/orders/create",
        permanent: false,
      },
      {
        source: "/dashboard/orders/sold-items",
        destination: "/dashboard/order-management/orders/sold-items",
        permanent: false,
      },
      {
        source: "/dashboard/orders/:id",
        destination: "/dashboard/order-management/orders/:id",
        permanent: false,
      },
      {
        source: "/dashboard/pos/orders",
        destination: "/dashboard/order-management/pos/orders",
        permanent: false,
      },
      {
        source: "/dashboard/pos/orders/create",
        destination: "/dashboard/order-management/pos/orders/create",
        permanent: false,
      },
      {
        source: "/dashboard/credit-orders",
        destination: "/dashboard/order-management/credit-orders",
        permanent: false,
      },
      {
        source: "/dashboard/credit-accounts",
        destination: "/dashboard/order-management/credit-accounts",
        permanent: false,
      },
      {
        source: "/dashboard/credit-accounts/:id",
        destination: "/dashboard/order-management/credit-accounts/:id",
        permanent: false,
      },
      {
        source: "/dashboard/catering/packages",
        destination: "/dashboard/order-management/catering/packages",
        permanent: false,
      },
      {
        source: "/dashboard/catering/package-orders",
        destination: "/dashboard/order-management/catering/package-orders",
        permanent: false,
      },
      {
        source: "/dashboard/catering/package-orders/create",
        destination: "/dashboard/order-management/catering/package-orders/create",
        permanent: false,
      },
      {
        source: "/dashboard/catering/package-orders/:id",
        destination: "/dashboard/order-management/catering/package-orders/:id",
        permanent: false,
      },
    ];
  },

  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendBaseUrl}/api/:path*`,
      },
    ];
  },
};   

export default nextConfig;
