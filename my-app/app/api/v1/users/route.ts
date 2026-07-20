// app/api/v1/users/route.ts
// Handles GET /api/v1/users?role=SCREENER — list users by role
// Coexists with [..route]/route.ts which handles /users/:id/* dynamic segments

import { NextResponse } from "next/server";
import { requireAuth, authErrResponse } from "@/lib/auth/requireAuth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";

export async function GET(request: Request) {
  try {
    await requireAuth(request, ["DATA_CLERK", "SCREENER", "SUPERVISOR", "ADMIN"]);
  } catch (err) {
    return authErrResponse(err);
  }

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
    return NextResponse.json({ users });
  }

  return NextResponse.json({ message: "Specify ?role= parameter" }, { status: 400 });
}