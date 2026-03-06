import { auth } from './firebase';

let cachedToken: string | null = null;
let cachedExpiresAt = 0;

// Exchange a Firebase ID token for a Supabase JWT via our server endpoint.
async function exchangeToken(firebaseIdToken: string): Promise<{ token: string; expiresAt: number }> {
  const res = await fetch('/api/auth/supabase-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ firebaseToken: firebaseIdToken }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Token exchange failed (${res.status})`);
  }

  return res.json();
}

/**
 * Returns a valid Supabase JWT.
 * - Returns the cached token if it's still valid (with 60 s buffer).
 * - Otherwise gets a fresh Firebase ID token and exchanges it.
 * - Returns null when no Firebase user is signed in.
 */
export async function getSupabaseToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) {
    cachedToken = null;
    cachedExpiresAt = 0;
    return null;
  }

  // Return cached token if still valid (60 s buffer before expiry)
  if (cachedToken && Date.now() < cachedExpiresAt - 60_000) {
    return cachedToken;
  }

  const firebaseIdToken = await user.getIdToken(true);
  const { token, expiresAt } = await exchangeToken(firebaseIdToken);

  cachedToken = token;
  cachedExpiresAt = expiresAt;
  return token;
}

/** Clear the cached Supabase token (call on logout). */
export function clearSupabaseToken(): void {
  cachedToken = null;
  cachedExpiresAt = 0;
}
