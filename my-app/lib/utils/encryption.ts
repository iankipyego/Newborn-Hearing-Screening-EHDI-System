// lib/utils/encryption.ts
// AES-256-GCM column-level encryption for direct identifiers (§12.4, §23).
//
// Fields encrypted at rest:
//   patients.mother_name, .mother_phone, .guardian_phone_alt,
//   .whatsapp_number, .email
//   users.totp_secret
//
// Storage format (single string stored in DB):
//   "<iv_hex>:<authTag_hex>:<ciphertext_hex>"
//
// The ENCRYPTION_KEY env var must be a 64-character hex string (32 bytes).

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex) throw new Error("Missing env var: ENCRYPTION_KEY");
  const buf = Buffer.from(hex, "hex");
  if (buf.length !== 32)
    throw new Error("ENCRYPTION_KEY must be exactly 32 bytes (64 hex chars)");
  return buf;
}

/**
 * Encrypt a plaintext string for storage in the database.
 * Returns a single colon-delimited string: iv:authTag:ciphertext (all hex).
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag(); // 128-bit authentication tag
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypt a value retrieved from the database.
 * Throws if the ciphertext has been tampered with (GCM auth tag mismatch).
 */
export function decrypt(stored: string): string {
  const key = getKey();
  const parts = stored.split(":");
  if (parts.length !== 3)
    throw new Error("Invalid encrypted value format — expected iv:authTag:ciphertext");
  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted).toString("utf8") + decipher.final("utf8");
}

/**
 * Encrypt only if value is non-null — pass-through for nullable fields.
 */
export function encryptNullable(value: string | null | undefined): string | null {
  if (value == null) return null;
  return encrypt(value);
}

/**
 * Decrypt only if value is non-null — pass-through for nullable fields.
 */
export function decryptNullable(value: string | null | undefined): string | null {
  if (value == null) return null;
  return decrypt(value);
}
