/**
 * Stateless encrypted session token for HAC.
 *
 * Vercel serverless functions do NOT share in-memory state, so we can't rely
 * on a `Map<sessionId, session>`.  Instead we encrypt the full session payload
 * (cookies + credentials + expiry) into a compact token using AES-256-GCM.
 * The client stores the token and sends it back with every request.
 *
 * The encryption key is derived from a secret stored in env (HAC_SESSION_SECRET)
 * or a hard-coded fallback (fine for dev, NOT for production).
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

/** Shape of the data baked into the token */
export interface SessionPayload {
  /** HAC cookies string */
  cookies: string;
  /** Username */
  username: string;
  /** Password */
  password: string;
  /** District base URL */
  baseUrl: string;
  /** When this token expires (epoch ms) */
  expiresAt: number;
}

// ── Key derivation ──────────────────────────────────────────────────────────────

const SECRET = process.env.HAC_SESSION_SECRET || 'alteon-hac-dev-secret-do-not-use-in-prod';
const SALT = 'alteon-hac-salt';
const KEY = scryptSync(SECRET, SALT, 32); // 256-bit key

// ── Public API ──────────────────────────────────────────────────────────────────

/**
 * Encrypt a session payload into a Base64-URL token.
 */
export function encryptSession(payload: SessionPayload): string {
  const iv = randomBytes(12); // 96-bit IV for GCM
  const cipher = createCipheriv('aes-256-gcm', KEY, iv);

  const json = JSON.stringify(payload);
  const encrypted = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag(); // 16 bytes

  // Layout: iv (12) + tag (16) + ciphertext
  const combined = Buffer.concat([iv, tag, encrypted]);
  return combined.toString('base64url');
}

/**
 * Decrypt a token back into a SessionPayload.
 * Returns `null` if the token is invalid or tampered with.
 */
export function decryptSession(token: string): SessionPayload | null {
  try {
    const buf = Buffer.from(token, 'base64url');
    if (buf.length < 28) return null; // 12 iv + 16 tag minimum

    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const ciphertext = buf.subarray(28);

    const decipher = createDecipheriv('aes-256-gcm', KEY, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8')) as SessionPayload;
  } catch {
    return null;
  }
}
