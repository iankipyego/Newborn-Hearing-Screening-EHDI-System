// app/api/v1/users/[...route]/route.ts
// Handles user management endpoints.
//   GET  /api/v1/users?role=SCREENER — screener dropdown
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

  await prisma.user.update({
    where: { id: targetId },
    data:  { active: false, deactivated_at: new Date(), deactivated_by_id: adminUser.id },
  });

  await deleteAllRefreshTokens(targetId);

  let body: unknown;
  try { body = await request.json(); } catch { body = {}; }
  const parsed = DeactivateBodySchema.safeParse(body);
  if (parsed.success && parsed.data?.current_access_jti && parsed.data?.current_access_expires_at) {
    await blocklistJti(
      parsed.data.current_access_jti,
      new Date(parsed.data.current_access_expires_at)
    ).catch(() => {});
  }

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
// GET /api/v1/users?role=SCREENER — screener list for dropdown
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest, { params }: { params: Params }): Promise<NextResponse> {
  let user;
  try { user = await requireAuth(request, [UserRole.ADMIN]); }
  catch (err) { return authErrResponse(err); }

  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role");

  if (role) {
    const users = await prisma.user.findMany({
      where: {
        role: role as UserRole,
        active: true,
      },
      select: {
        id: true,
        name: true,
        role: true,
      },
      orderBy: { name: "asc" },
    });
    return json({ users });
  }

  return json({ message: "Users listing — implement here", requestedBy: user.id });
}

// ---------------------------------------------------------------------------
// PATCH dispatcher
// ---------------------------------------------------------------------------
export async function PATCH(request: NextRequest, { params }: { params: Params }): Promise<NextResponse> {
  const [id, action] = params.route;

  if (id && action === "deactivate") return handleDeactivate(request, id);

  return json({ error: "Not found" }, 404);
}