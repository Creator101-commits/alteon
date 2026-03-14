import { auth } from './firebase';

let cachedToken: string | null = null;
let cachedExpiresAt = 0;
let lastFailureAt = 0;
let exchangeInFlight: Promise<string | null> | null = null;
const FAILURE_COOLDOWN_MS = 10_000; // Don't retry for 10 s after a failure

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
 * - After a failure, backs off for 10 s to avoid hammering the endpoint.
 */
export async function getSupabaseToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) {
    cachedToken = null;
    cachedExpiresAt = 0;
    exchangeInFlight = null;
    return null;
  }

  // Return cached token if still valid (60 s buffer before expiry)
  if (cachedToken && Date.now() < cachedExpiresAt - 60_000) {
    return cachedToken;
  }

  // Back off after a recent failure
  if (!exchangeInFlight && lastFailureAt && Date.now() - lastFailureAt < FAILURE_COOLDOWN_MS) {
    return cachedToken;
  }

  if (exchangeInFlight) {
    return exchangeInFlight;
  }

  exchangeInFlight = (async () => {
    try {
      const firebaseIdToken = await user.getIdToken(true);
      const { token, expiresAt } = await exchangeToken(firebaseIdToken);

      cachedToken = token;
      cachedExpiresAt = expiresAt;
      lastFailureAt = 0;
      return token;
    } catch (err) {
      console.error('Supabase token exchange failed:', err);
      lastFailureAt = Date.now();
      return cachedToken; // Return stale token (or null) rather than crashing
    } finally {
      exchangeInFlight = null;
    }
  })();

  return exchangeInFlight;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(null), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timeout);
        resolve(value);
      })
      .catch(() => {
        clearTimeout(timeout);
        resolve(null);
      });
  });
}

/**
 * Ensures the first authenticated requests wait briefly for token bootstrap.
 * Returns null when no user is signed in or token exchange fails/times out.
 */
export async function ensureSupabaseTokenReady(timeoutMs: number = 10_000): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) {
    return null;
  }

  if (cachedToken && Date.now() < cachedExpiresAt - 60_000) {
    return cachedToken;
  }

  // Start (or join) token exchange in one synchronous step.
  const tokenPromise = getSupabaseToken();

  return withTimeout(tokenPromise, timeoutMs);
}

/** Clear the cached Supabase token (call on logout). */
export function clearSupabaseToken(): void {
  cachedToken = null;
  cachedExpiresAt = 0;
  exchangeInFlight = null;
}
