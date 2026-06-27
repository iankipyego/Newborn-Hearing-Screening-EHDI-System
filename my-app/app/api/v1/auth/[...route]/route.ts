// app/api/v1/auth/[...route]/route.ts

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import {
  signTempToken, signAccessToken, signRefreshToken,
  verifyTempToken, verifyRefreshToken, verifyAccessToken,
} from "@/lib/auth/jwt";
import {
  blocklistJti, isJtiBlocked, storeRefreshToken,
  validateRefreshToken, deleteRefreshToken,
} from "@/lib/auth/redis";
import {
  generateTotpSecret, buildOtpauthUri, generateQrCodeDataUrl,
  verifyTotpCode, encryptTotpSecret, decryptTotpSecret,
} from "@/lib/auth/totp";
import { sendLoginCode, verifyLoginCode } from "@/lib/auth/twoFactorDelivery";
import { recordFailedLogin, recordSuccessfulLogin, getLockoutMessage } from "@/lib/auth/lockout";

function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const LoginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

const ChallengeSchema = z.object({
  temp_token: z.string().min(1),
  code:       z.string().length(6).regex(/^\d{6}$/),
});

const SetupConfirmSchema = z.object({
  secret: z.string().min(16),
  code:   z.string().length(6).regex(/^\d{6}$/),
});

const RefreshSchema  = z.object({ refresh_token: z.string().min(1) });
const LogoutSchema   = z.object({ refresh_token: z.string().min(1) });

// ---------------------------------------------------------------------------
// POST /api/v1/auth/login
// ---------------------------------------------------------------------------

async function handleLogin(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try { body = await request.json(); }
  catch { return json({ error: "Invalid JSON" }, 400); }

  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) return json({ error: "Invalid request", details: parsed.error.flatten() }, 400);

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({
    where:  { email },
    select: { id: true, password_hash: true, active: true, locked_until: true, totp_enabled: true, phone: true, email: true },
  });

  const hashToCompare = user?.password_hash ?? "$2b$12$invalidhashfortimingequalization0000000000000000000000";
  const passwordValid = await bcrypt.compare(password, hashToCompare);

  if (!user || !passwordValid) {
    if (user) await recordFailedLogin(user.id);
    return json({ error: "Invalid email or password" }, 401);
  }
  if (!user.active) return json({ error: "Account deactivated" }, 401);

  const lockMsg = getLockoutMessage(user.locked_until);
  if (lockMsg) return json({ error: lockMsg }, 429);

  const { token: temp_token } = await signTempToken(user.id);

  const contact  = user.phone ?? user.email;
  const delivery = await sendLoginCode(user.id, contact);

  const response: Record<string, unknown> = {
    temp_token,
    requires_2fa:  true,
    totp_enabled:  user.totp_enabled,
    delivery_info: delivery.info,
  };

  if (delivery.testCode) {
    response.test_code = delivery.testCode;
    response._dev_note = "Set TWO_FACTOR_DELIVERY=sms in .env before going live";
  }

  return json(response);
}

// ---------------------------------------------------------------------------
// GET /api/v1/auth/2fa/setup
// ---------------------------------------------------------------------------

async function handleTotpSetupGet(request: NextRequest): Promise<NextResponse> {
  const temp_token = request.headers.get("x-temp-token");
  if (!temp_token) return json({ error: "x-temp-token header required" }, 401);

  let payload;
  try { payload = await verifyTempToken(temp_token); }
  catch { return json({ error: "Invalid or expired temp_token" }, 401); }

  try {
    if (await isJtiBlocked(payload.jti!)) return json({ error: "Session invalidated" }, 401);
  } catch { /* Redis down — continue */ }

  const user = await prisma.user.findUnique({
    where:  { id: payload.sub! },
    select: { email: true, totp_enabled: true },
  });
  if (!user)             return json({ error: "User not found" }, 404);
  if (user.totp_enabled) return json({ error: "2FA already configured" }, 409);

  const secret        = generateTotpSecret();
  const otpauthUri    = buildOtpauthUri(user.email, secret);
  const qrCodeDataUrl = await generateQrCodeDataUrl(otpauthUri);

  return json({ secret, qrCodeDataUrl });
}

// ---------------------------------------------------------------------------
// POST /api/v1/auth/2fa/setup
// ---------------------------------------------------------------------------

async function handleTotpSetupPost(request: NextRequest): Promise<NextResponse> {
  const temp_token = request.headers.get("x-temp-token");
  if (!temp_token) return json({ error: "x-temp-token header required" }, 401);

  let payload;
  try { payload = await verifyTempToken(temp_token); }
  catch { return json({ error: "Invalid or expired temp_token" }, 401); }

  try {
    if (await isJtiBlocked(payload.jti!)) return json({ error: "Session invalidated" }, 401);
  } catch { /* Redis down — continue */ }

  let body: unknown;
  try { body = await request.json(); }
  catch { return json({ error: "Invalid JSON" }, 400); }

  const parsed = SetupConfirmSchema.safeParse(body);
  if (!parsed.success) return json({ error: "Invalid request", details: parsed.error.flatten() }, 400);

  const { secret, code } = parsed.data;
  if (!verifyTotpCode(code, secret)) return json({ error: "Invalid TOTP code" }, 401);

  await prisma.user.update({
    where: { id: payload.sub! },
    data:  { totp_secret: encryptTotpSecret(secret), totp_enabled: true },
  });

  return json({ message: "2FA setup complete. Please log in again." });
}

// ---------------------------------------------------------------------------
// POST /api/v1/auth/2fa/challenge
// ---------------------------------------------------------------------------

async function handleTotpChallenge(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try { body = await request.json(); }
  catch { return json({ error: "Invalid JSON" }, 400); }

  const parsed = ChallengeSchema.safeParse(body);
  if (!parsed.success) return json({ error: "Invalid request", details: parsed.error.flatten() }, 400);

  const { temp_token, code } = parsed.data;

  let tempPayload;
  try { tempPayload = await verifyTempToken(temp_token); }
  catch { return json({ error: "Invalid or expired temp_token" }, 401); }

  // Blocklist check — soft-fail if Redis is down
  try {
    if (await isJtiBlocked(tempPayload.jti!)) return json({ error: "temp_token already used" }, 401);
  } catch { /* Redis down — skip blocklist check */ }

  const user = await prisma.user.findUnique({
    where:  { id: tempPayload.sub! },
    select: { id: true, name: true, email: true, role: true, site_id: true, active: true, totp_enabled: true, totp_secret: true },
  });

  if (!user)        return json({ error: "Account not found" }, 401);
  if (!user.active) return json({ error: "Account deactivated" }, 401);

  // 1. Try delivery code first (test / SMS / WhatsApp / email)
  const deliveryResult = await verifyLoginCode(user.id, code);

  if (!deliveryResult.valid) {
    // 2. Fall back to TOTP authenticator app
    if (user.totp_enabled && user.totp_secret) {
      let plaintextSecret: string;
      try { plaintextSecret = decryptTotpSecret(user.totp_secret); }
      catch { return json({ error: "Internal error verifying 2FA" }, 500); }

      if (!verifyTotpCode(code, plaintextSecret)) {
        return json({ error: "Invalid code" }, 401);
      }
    } else {
      // No delivery code and no TOTP configured
      const reason = deliveryResult.reason === "expired"
        ? "Code expired. Please log in again."
        : "Invalid code";
      return json({ error: reason }, 401);
    }
  }

  // Blocklist the temp token (single-use) — soft-fail if Redis down
  try {
    await blocklistJti(tempPayload.jti!, new Date(tempPayload.exp! * 1000));
  } catch { /* Redis down */ }

  // Issue tokens
  const { token: access_token } = await signAccessToken(user.id, user.role, user.site_id);
  const { token: refresh_token, jti: refreshJti } = await signRefreshToken(user.id);

  try {
    await storeRefreshToken(user.id, refreshJti, refresh_token);
  } catch { /* Redis down — refresh rotation won't work until Redis is up */ }

  await recordSuccessfulLogin(user.id);

  return json({
    access_token,
    refresh_token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, site_id: user.site_id },
  });
}

// ---------------------------------------------------------------------------
// POST /api/v1/auth/refresh
// ---------------------------------------------------------------------------

async function handleRefresh(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try { body = await request.json(); }
  catch { return json({ error: "Invalid JSON" }, 400); }

  const parsed = RefreshSchema.safeParse(body);
  if (!parsed.success) return json({ error: "refresh_token required" }, 400);

  const { refresh_token } = parsed.data;

  let payload;
  try { payload = await verifyRefreshToken(refresh_token); }
  catch { return json({ error: "Invalid or expired refresh_token" }, 401); }

  const { sub: userId, jti } = payload;

  if (await isJtiBlocked(jti!))                                   return json({ error: "Refresh token invalidated" }, 401);
  if (!await validateRefreshToken(userId!, jti!, refresh_token))  return json({ error: "Refresh token not recognised" }, 401);

  const user = await prisma.user.findUnique({
    where:  { id: userId! },
    select: { id: true, role: true, site_id: true, active: true },
  });
  if (!user || !user.active) return json({ error: "Account deactivated" }, 401);

  await deleteRefreshToken(userId!, jti!);

  const { token: new_access_token } = await signAccessToken(user.id, user.role, user.site_id);
  const { token: new_refresh_token, jti: newJti } = await signRefreshToken(user.id);
  await storeRefreshToken(userId!, newJti, new_refresh_token);

  return json({ access_token: new_access_token, refresh_token: new_refresh_token });
}

// ---------------------------------------------------------------------------
// POST /api/v1/auth/logout
// ---------------------------------------------------------------------------

async function handleLogout(request: NextRequest): Promise<NextResponse> {
  const header = request.headers.get("authorization") ?? "";
  const token  = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (token) {
    try {
      const p = await verifyAccessToken(token);
      await blocklistJti(p.jti!, new Date(p.exp! * 1000));
    } catch { /* expired or Redis down */ }
  }

  let body: unknown;
  try { body = await request.json(); } catch { body = {}; }
  const parsed = LogoutSchema.safeParse(body);
  if (parsed.success) {
    try {
      const p = await verifyRefreshToken(parsed.data.refresh_token);
      await deleteRefreshToken(p.sub!, p.jti!);
    } catch { /* expired */ }
  }

  const response = new NextResponse(null, { status: 204 });
  response.cookies.set("access_token", "", { maxAge: 0, path: "/" });
  return response;
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

type Params = Promise<{ route: string[] }>;

export async function GET(request: NextRequest, { params }: { params: Params }): Promise<NextResponse> {
  const { route } = await params;
  const [r0, r1]  = route;
  if (r0 === "2fa" && r1 === "setup") return handleTotpSetupGet(request);
  return json({ error: "Not found" }, 404);
}

export async function POST(request: NextRequest, { params }: { params: Params }): Promise<NextResponse> {
  const { route } = await params;
  const [r0, r1]  = route;
  if (r0 === "login")                     return handleLogin(request);
  if (r0 === "2fa" && r1 === "challenge") return handleTotpChallenge(request);
  if (r0 === "2fa" && r1 === "setup")     return handleTotpSetupPost(request);
  if (r0 === "refresh")                   return handleRefresh(request);
  if (r0 === "logout")                    return handleLogout(request);
  return json({ error: "Not found" }, 404);
}