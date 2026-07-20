// proxy.ts  (project root)
//
// Guards all pages in the (app) route group.
// Reads the access_token from a cookie (set by the 2FA page after login).
// API routes are NOT guarded here — they use requireAuth() inside each handler.

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

function accessSecret(): Uint8Array {
  return new TextEncoder().encode(process.env.JWT_ACCESS_SECRET ?? "");
}

// Pages that require authentication
const APP_PREFIXES = [
  "/dashboard",
  "/children",
  "/screenings",
  "/referrals",
  "/diagnostics",
  "/operational-logs",
  "/quality",
  "/exports",
  "/corrections",
  "/profile",
  "/admin",
];

// Auth pages that authenticated users should be bounced away from
const AUTH_PAGES = ["/login"];

function isAppRoute(pathname: string): boolean {
  return APP_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function isAuthPage(pathname: string): boolean {
  return AUTH_PAGES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Read token from cookie (set by 2FA page) or Authorization header (SSR fetches)
  const token =
    request.cookies.get("access_token")?.value ??
    request.headers.get("authorization")?.replace("Bearer ", "");

  let authenticated = false;
  if (token) {
    try {
      await jwtVerify(token, accessSecret());
      authenticated = true;
    } catch {
      authenticated = false;
    }
  }

  // Unauthenticated → redirect to login, preserve intended destination
  if (isAppRoute(pathname) && !authenticated) {
    const url = new URL("/login", request.url);
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  // Authenticated user on a login/auth page → send to dashboard
  if (isAuthPage(pathname) && authenticated) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public/).*)"],
};