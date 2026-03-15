import { VercelRequest, VercelResponse } from '@vercel/node';
import { importX509, jwtVerify, SignJWT, decodeProtectedHeader } from 'jose';

const FIREBASE_PROJECT_ID = 'studypal-47e1d';
const GOOGLE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

// Cache the fetched certificates with a TTL
let certCache: { certs: Record<string, string>; fetchedAt: number } | null = null;
const CERT_CACHE_TTL_MS = 3600_000; // 1 hour

async function getFirebaseCerts(): Promise<Record<string, string>> {
  if (certCache && Date.now() - certCache.fetchedAt < CERT_CACHE_TTL_MS) {
    return certCache.certs;
  }
  const res = await fetch(GOOGLE_CERTS_URL);
  if (!res.ok) throw new Error(`Failed to fetch Google certs: ${res.status}`);
  const certs = await res.json() as Record<string, string>;
  certCache = { certs, fetchedAt: Date.now() };
  return certs;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { firebaseToken } = req.body;
  if (!firebaseToken || typeof firebaseToken !== 'string') {
    return res.status(400).json({ error: 'Missing firebaseToken in request body' });
  }

  const supabaseJwtSecret =
    process.env.SUPABASE_JWT_SECRET ||
    process.env.SUPABASE_JWT_SIGNING_SECRET ||
    process.env.JWT_SECRET;
  if (!supabaseJwtSecret) {
    return res.status(500).json({
      error:
        'SUPABASE_JWT_SECRET not configured (or SUPABASE_JWT_SIGNING_SECRET / JWT_SECRET)',
    });
  }

  try {
    // Decode the token header to get the kid
    const header = decodeProtectedHeader(firebaseToken);
    if (!header.kid) {
      return res.status(401).json({ error: 'Token missing kid header' });
    }

    // Fetch Google's X.509 certificates and find the one matching the kid
    const certs = await getFirebaseCerts();
    const cert = certs[header.kid];
    if (!cert) {
      // Force refresh certs in case they rotated
      certCache = null;
      const freshCerts = await getFirebaseCerts();
      const freshCert = freshCerts[header.kid];
      if (!freshCert) {
        return res.status(401).json({ error: 'Unknown signing key' });
      }
      var publicKey = await importX509(freshCert, 'RS256');
    } else {
      var publicKey = await importX509(cert, 'RS256');
    }

    // Verify the Firebase ID token
    const { payload } = await jwtVerify(firebaseToken, publicKey, {
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
      audience: FIREBASE_PROJECT_ID,
    });

    const firebaseUid = payload.sub;
    if (!firebaseUid) {
      return res.status(401).json({ error: 'Invalid token: missing sub claim' });
    }

    // Sign a Supabase-compatible JWT with sub = Firebase UID
    const secret = new TextEncoder().encode(supabaseJwtSecret);
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = 3600; // 1 hour

    const supabaseToken = await new SignJWT({
      sub: firebaseUid,
      role: 'authenticated',
      aud: 'authenticated',
      iss: 'supabase',
      iat: now,
      exp: now + expiresIn,
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .sign(secret);

    return res.status(200).json({
      token: supabaseToken,
      expiresAt: (now + expiresIn) * 1000, // ms for the client
    });
  } catch (err: any) {
    console.error('Token exchange failed:', err.message, err.code, err.stack);

    if (err.code === 'ERR_JWT_EXPIRED') {
      return res.status(401).json({ error: 'Firebase token expired' });
    }
    if (err.code?.startsWith('ERR_JWT') || err.code?.startsWith('ERR_JWS')) {
      return res.status(401).json({ error: 'Invalid Firebase token' });
    }

    return res.status(500).json({ error: 'Token exchange failed', detail: err.message });
  }
}
