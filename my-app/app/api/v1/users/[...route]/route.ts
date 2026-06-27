// app/api/v1/users/[...route]/route.ts
// Handles user management endpoints.
// Currently implements:
//   PATCH /api/v1/users/:id/deactivate   — §25.1 instant token invalidation

import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, authErrResponse } from "@/lib/auth/requireAuth";
import { blocklistJti, deleteAllRefreshTokens } from "@/lib/auth/redis";
import { UserRole } from "@prisma/client";
import { z } from "zod";

type Params = { route: string[] };

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

// ---------------------------------------------------------------------------
// PATCH /api/v1/users/:id/deactivate  (§25.1)
// ---------------------------------------------------------------------------

const DeactivateBodySchema = z.object({
  // Optional: pass the target user's current access token JTI + expiry
  // for instant blocklisting. Without it, the active=false DB check still
  // catches the user within the next request.
  current_access_jti:        z.string().optional(),
  current_access_expires_at: z.string().datetime().optional(),
}).optional();

async function handleDeactivate(
  request: NextRequest,
  targetId: string
): Promise<NextResponse> {
  let adminUser;
  try {
    adminUser = await requireAuth(request, [UserRole.ADMIN]);
  } catch (err) {
    return authErrResponse(err);
  }

  if (targetId === adminUser.id) {
    return json({ error: "Cannot deactivate your own account" }, 400);
  }

  const target = await prisma.user.findUnique({
    where:  { id: targetId },
    select: { id: true, active: true },
  });
  if (!target)        return json({ error: "User not found" }, 404);
  if (!target.active) return json({ error: "Account already deactivated" }, 409);

  // 1. Mark deactivated in DB
  await prisma.user.update({
    where: { id: targetId },
    data:  { active: false, deactivated_at: new Date(), deactivated_by_id: adminUser.id },
  });

  // 2. Delete ALL refresh tokens from Redis (§25.1)
  await deleteAllRefreshTokens(targetId);

  // 3. Blocklist current access token JTI if caller provided it (§25.1)
  let body: unknown;
  try { body = await request.json(); } catch { body = {}; }
  const parsed = DeactivateBodySchema.safeParse(body);
  if (parsed.success && parsed.data?.current_access_jti && parsed.data?.current_access_expires_at) {
    await blocklistJti(
      parsed.data.current_access_jti,
      new Date(parsed.data.current_access_expires_at)
    ).catch(() => {});
  }

  // 4. Audit log
  await prisma.auditLog.create({
    data: {
      table_name:   "users",
      record_id:    targetId,
      action:       "UPDATE",
      changed_by:   adminUser.id,
      before_value: { active: true },
      after_value:  { active: false, deactivated_at: new Date().toISOString() },
    },
  });

  return json({ message: "Account deactivated and all sessions invalidated" });
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export async function PATCH(request: NextRequest, { params }: { params: Params }): Promise<NextResponse> {
  const [id, action] = params.route;

  if (id && action === "deactivate") return handleDeactivate(request, id);

  return json({ error: "Not found" }, 404);
}

export async function GET(request: NextRequest, { params }: { params: Params }): Promise<NextResponse> {
  // GET /api/v1/users  — list (Admin only)
  // GET /api/v1/users/:id — get one
  // Implement as needed; skeleton shown
  let user;
  try { user = await requireAuth(request, [UserRole.ADMIN]); }
  catch (err) { return authErrResponse(err); }

  return json({ message: "Users endpoint — implement listing here", requestedBy: user.id });
}