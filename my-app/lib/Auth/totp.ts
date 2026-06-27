// lib/auth/totp.ts
// otplib v13 API — uses generateSync / verifySync / generateURI / generateSecret
// No `authenticator` export exists in v13; that was v12 only.

import { generateSecret, generateSync, verifySync, generateURI } from "otplib";
import QRCode from "qrcode";
import { encrypt, decrypt } from "@/lib/utils/encryption";

const APP_NAME = "Mama Rachel EHDI";

// ---------------------------------------------------------------------------
// Secret lifecycle
// ---------------------------------------------------------------------------

/** Generate a new base32 secret — call during 2FA setup, before confirming */
export function generateTotpSecret(): string {
  return generateSecret();
}

/** otpauth:// URI scanned by Google Authenticator / Authy */
export function buildOtpauthUri(email: string, secret: string): string {
  return generateURI({ type: "totp", label: email, secret, issuer: APP_NAME });
}

/** PNG data URL for rendering as <img src={...} /> in the setup UI */
export async function generateQrCodeDataUrl(otpauthUri: string): Promise<string> {
  return QRCode.toDataURL(otpauthUri);
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

/**
 * Verify a 6-digit TOTP code against a plaintext secret.
 * verifySync checks current window ±1 step (30 s) by default.
 */
export function verifyTotpCode(code: string, plaintextSecret: string): boolean {
  try {
    const result = verifySync({ token: code, secret: plaintextSecret, type: "totp" });
    return result.valid;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Encrypted storage helpers
// ---------------------------------------------------------------------------

export const encryptTotpSecret = encrypt;
export const decryptTotpSecret = decrypt;