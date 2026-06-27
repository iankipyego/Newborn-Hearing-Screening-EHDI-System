// lib/auth/redis.ts
// Redis operations for the auth layer (§52.2, §25.1).
//
// Key namespaces:
//   blocklist:<jti>           TTL = token remaining lifetime
//   refresh:<userId>:<jti>    TTL = 30 days, value = sha256(token)

import Redis from "ioredis";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// Singleton client
// ---------------------------------------------------------------------------

let _redis: Redis | null = null;

export function getRedis(): Redis {
  if (!_redis) {
    const url = process.env.REDIS_URL;
    if (!url) throw new Error("Missing env var: REDIS_URL");
    _redis = new Redis(url, { maxRetriesPerRequest: 3, lazyConnect: true });
    _redis.on("error", (err) => console.error("[Redis]", err.message));
  }
  return _redis;
}

// ---------------------------------------------------------------------------
// Blocklist
// ---------------------------------------------------------------------------

export async function blocklistJti(jti: string, expiresAt: Date): Promise<void> {
  const ttl = Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  await getRedis().set(`blocklist:${jti}`, "1", "EX", ttl);
}

export async function isJtiBlocked(jti: string): Promise<boolean> {
  return (await getRedis().get(`blocklist:${jti}`)) !== null;
}

// ---------------------------------------------------------------------------
// Refresh token store
// ---------------------------------------------------------------------------

const REFRESH_TTL = 30 * 24 * 60 * 60; // 30 days in seconds

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export async function storeRefreshToken(
  userId: string,
  jti: string,
  token: string
): Promise<void> {
  await getRedis().set(`refresh:${userId}:${jti}`, sha256(token), "EX", REFRESH_TTL);
}

export async function validateRefreshToken(
  userId: string,
  jti: string,
  token: string
): Promise<boolean> {
  const stored = await getRedis().get(`refresh:${userId}:${jti}`);
  return stored !== null && stored === sha256(token);
}

export async function deleteRefreshToken(userId: string, jti: string): Promise<void> {
  await getRedis().del(`refresh:${userId}:${jti}`);
}

/** Delete every refresh token for a user — used on account deactivation (§25.1) */
export async function deleteAllRefreshTokens(userId: string): Promise<void> {
  const redis = getRedis();
  let cursor = "0";
  do {
    const [next, keys] = await redis.scan(cursor, "MATCH", `refresh:${userId}:*`, "COUNT", 100);
    cursor = next;
    if (keys.length) await redis.del(...keys);
  } while (cursor !== "0");
}
