// lib/auth/twoFactorDelivery.ts
//
// Delivery adapter for login 2FA codes.
// TWO_FACTOR_DELIVERY env var controls the channel:
//   test      → code shown in API response (dev only)
//   sms       → Africa's Talking
//   whatsapp  → Meta WhatsApp Cloud API
//   email     → SMTP
//
// REDIS OPTIONAL IN DEV:
// If Redis is unavailable, the code store falls back to an in-memory Map.
// In production, Redis should always be running.

import crypto from "crypto";
import { getRedis } from "@/lib/auth/redis";

// ---------------------------------------------------------------------------
// Code store — Redis with in-memory fallback
// ---------------------------------------------------------------------------

const MEM_STORE = new Map<string, { code: string; expires: number }>();
const CODE_TTL_SECONDS = 5 * 60; // 5 minutes

async function storeCode(userId: string, code: string): Promise<void> {
  try {
    const redis = getRedis();
    await redis.set(`2fa_code:${userId}`, code, "EX", CODE_TTL_SECONDS);
  } catch {
    // Redis unavailable — fall back to memory (dev only)
    MEM_STORE.set(userId, { code, expires: Date.now() + CODE_TTL_SECONDS * 1000 });
  }
}

async function getStoredCode(userId: string): Promise<string | null> {
  try {
    const redis = getRedis();
    return await redis.get(`2fa_code:${userId}`);
  } catch {
    const entry = MEM_STORE.get(userId);
    if (!entry) return null;
    if (Date.now() > entry.expires) { MEM_STORE.delete(userId); return null; }
    return entry.code;
  }
}

async function deleteStoredCode(userId: string): Promise<void> {
  try {
    const redis = getRedis();
    await redis.del(`2fa_code:${userId}`);
  } catch {
    MEM_STORE.delete(userId);
  }
}

// ---------------------------------------------------------------------------
// Code generation
// ---------------------------------------------------------------------------

function generateCode(): string {
  return String(crypto.randomInt(100000, 999999));
}

// ---------------------------------------------------------------------------
// Delivery result
// ---------------------------------------------------------------------------

export interface DeliveryResult {
  sent: boolean;
  testCode?: string; // only in test mode
  info: string;
}

// ---------------------------------------------------------------------------
// Send
// ---------------------------------------------------------------------------

export async function sendLoginCode(
  userId: string,
  contact: string
): Promise<DeliveryResult> {
  const code = generateCode();
  await storeCode(userId, code);

  const mode = process.env.TWO_FACTOR_DELIVERY ?? "test";

  switch (mode) {
    case "test": {
      console.log(`[2FA TEST] Code for user ${userId}: ${code}`);
      return { sent: true, testCode: code, info: "Test mode — code shown in response" };
    }

    case "sms": {
      // TODO: npm install africastalking, then uncomment:
      // import AfricasTalking from "africastalking";
      // const at = AfricasTalking({ apiKey: process.env.AFRICA_TALKING_API_KEY!, username: process.env.AFRICA_TALKING_USERNAME! });
      // await at.SMS.send({ to: [contact], message: `Your Mama Rachel EHDI login code: ${code}. Valid 5 min.`, from: "MamaRachel" });
      console.warn("[2FA] SMS not wired — using test fallback");
      return { sent: true, testCode: code, info: "SMS not wired — test fallback" };
    }

    case "whatsapp": {
      // TODO: wire Meta WhatsApp Cloud API here
      console.warn("[2FA] WhatsApp not wired — using test fallback");
      return { sent: true, testCode: code, info: "WhatsApp not wired — test fallback" };
    }

    case "email": {
      // TODO: wire SMTP/nodemailer here
      console.warn("[2FA] Email not wired — using test fallback");
      return { sent: true, testCode: code, info: "Email not wired — test fallback" };
    }

    default:
      throw new Error(`Unknown TWO_FACTOR_DELIVERY mode: ${mode}`);
  }
}

// ---------------------------------------------------------------------------
// Verify
// ---------------------------------------------------------------------------

export interface VerifyResult {
  valid: boolean;
  reason?: "expired" | "invalid" | "not_found";
}

export async function verifyLoginCode(
  userId: string,
  submittedCode: string
): Promise<VerifyResult> {
  const stored = await getStoredCode(userId);

  if (!stored) return { valid: false, reason: "not_found" };
  if (stored !== submittedCode) return { valid: false, reason: "invalid" };

  // Single-use: delete on success
  await deleteStoredCode(userId);
  return { valid: true };
}