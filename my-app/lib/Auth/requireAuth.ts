// lib/auth/requireAuth.ts
// Used inside API route handlers (not the root middleware.ts).
// The root middleware.ts handles page-level redirects for the (app) route group.
// This function handles API-level 401/403 responses.
//
// Step 3 §52.2:
//   → Extract Bearer token
//   → Verify JWT signature + expiry
//   → Check Redis blocklist for token JTI
//   → Check users.active = true
//   → Return typed user or throw AuthError

import { type NextRequest, NextResponse } from "next/server";
import { verifyAccessToken, type AccessTokenPayload } from "@/lib/auth/jwt";
import { isJtiBlocked } from "@/lib/auth/redis";
import { prisma } from "@/lib/prisma";
import { type UserRole } from "@prisma/client";

export interface AuthUser {
  id:      string;
  role:    UserRole;
  site_id: string;
  name:    string;
  email:   string;
}

export class AuthError extends Error {
  constructor(public readonly status: 401 | 403, message: string) {
    super(message);
  }
}

/**
 * Verify the Bearer token and return the authenticated user.
 * Optionally pass `allowedRoles` to enforce RBAC — throws 403 if not permitted.
 *
 * @throws AuthError — catch in the route handler and return `authErrResponse(err)`
 */
export async function requireAuth(
  request: NextRequest,
  allowedRoles?: UserRole[]
): Promise<AuthUser> {
  // 1. Extract Bearer token
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) {
    throw new AuthError(401, "Missing or malformed Authorization header");
  }
  const token = header.slice(7);

  // 2. Verify signature + expiry
  let payload: AccessTokenPayload;
  try {
    payload = await verifyAccessToken(token);
  } catch {
    throw new AuthError(401, "Invalid or expired token");
  }

  // 3. Blocklist check (logout + deactivation — §25.1)
  if (await isJtiBlocked(payload.jti!)) {
    throw new AuthError(401, "Session invalidated");
  }

  // 4. Active user check
  const user = await prisma.user.findUnique({
    where:  { id: payload.sub! },
    select: { id: true, role: true, site_id: true, name: true, email: true, active: true },
  });
  if (!user || !user.active) {
    throw new AuthError(401, "Account deactivated or not found");
  }

  // 5. Role check
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    throw new AuthError(403, "Insufficient permissions");
  }

  return user;
}

/** Convert an AuthError (or unknown error) into a NextResponse */
export function authErrResponse(err: unknown): NextResponse {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error("[requireAuth]", err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
