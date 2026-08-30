import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const forwardedProto = request.headers.get("x-forwarded-proto");

  if (process.env.NODE_ENV === "production" && forwardedProto === "http") {
    const secureUrl = request.nextUrl.clone();
    secureUrl.protocol = "https:";
    return NextResponse.redirect(secureUrl, 308);
  }

  // Authentication and authorization are enforced by the Laravel API.
  // DashboardLayoutShell verifies the HttpOnly cookie session with /auth/me
  // before rendering protected dashboard content.
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
