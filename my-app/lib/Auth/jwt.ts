// lib/auth/jwt.ts
// Signs and verifies the three token types defined in §52.2:
//   temp_token    — 5 min,  issued after password passes, before TOTP
//   access_token  — 15 min, full API access
//   refresh_token — 30 days, rotation-based, hash stored in Redis
//
// Uses `jose` (Web Crypto API) — compatible with Next.js Edge Runtime.

import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { v4 as uuidv4 } from "uuid";

// ---------------------------------------------------------------------------
// Secrets
// ---------------------------------------------------------------------------

function secret(envVar: string): Uint8Array {
  const val = process.env[envVar];
  if (!val) throw new Error(`Missing env var: ${envVar}`);
  return new TextEncoder().encode(val);
}

// Temp tokens share the access secret — they never leave the login flow
const ACCESS_SECRET  = () => secret("JWT_ACCESS_SECRET");
const REFRESH_SECRET = () => secret("JWT_REFRESH_SECRET");
const TEMP_SECRET    = () => secret("JWT_ACCESS_SECRET");

// ---------------------------------------------------------------------------
// Payload types
// ---------------------------------------------------------------------------

export interface TempTokenPayload extends JWTPayload {
  sub:  string;
  jti:  string;
  type: "temp";
}

export interface AccessTokenPayload extends JWTPayload {
  sub:     string;
  jti:     string;
  role:    string;
  site_id: string;
  type:    "access";
}

export interface RefreshTokenPayload extends JWTPayload {
  sub:  string;
  jti:  string;
  type: "refresh";
}

// ---------------------------------------------------------------------------
// Sign
// ---------------------------------------------------------------------------

export async function signTempToken(
  userId: string
): Promise<{ token: string; jti: string }> {
  const jti = uuidv4();
  const token = await new SignJWT({ type: "temp" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(TEMP_SECRET());
  return { token, jti };
}

export async function signAccessToken(
  userId: string,
  role: string,
  siteId: string
): Promise<{ token: string; jti: string; expiresAt: Date }> {
  const jti      = uuidv4();
  const expiresIn = process.env.JWT_ACCESS_EXPIRY ?? "15m";
  const token = await new SignJWT({ type: "access", role, site_id: siteId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(ACCESS_SECRET());
  return { token, jti, expiresAt: new Date(Date.now() + parseDurationMs(expiresIn)) };
}

export async function signRefreshToken(
  userId: string
): Promise<{ token: string; jti: string }> {
  const jti      = uuidv4();
  const expiresIn = process.env.JWT_REFRESH_EXPIRY ?? "30d";
  const token = await new SignJWT({ type: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(REFRESH_SECRET());
  return { token, jti };
}

// ---------------------------------------------------------------------------
// Verify
// ---------------------------------------------------------------------------

export async function verifyTempToken(token: string): Promise<TempTokenPayload> {
  const { payload } = await jwtVerify(token, TEMP_SECRET());
  if (payload.type !== "temp") throw new Error("Not a temp token");
  return payload as TempTokenPayload;
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, ACCESS_SECRET());
  if (payload.type !== "access") throw new Error("Not an access token");
  return payload as AccessTokenPayload;
}

export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
  const { payload } = await jwtVerify(token, REFRESH_SECRET());
  if (payload.type !== "refresh") throw new Error("Not a refresh token");
  return payload as RefreshTokenPayload;
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

export function parseDurationMs(duration: string): number {
  const num = parseInt(duration);
  if (duration.endsWith("m")) return num * 60 * 1_000;
  if (duration.endsWith("h")) return num * 60 * 60 * 1_000;
  if (duration.endsWith("d")) return num * 24 * 60 * 60 * 1_000;
  return 15 * 60 * 1_000;
}
