import { VercelRequest, VercelResponse } from '@vercel/node';
import { createRemoteJWKSet, jwtVerify, SignJWT } from 'jose';

const FIREBASE_PROJECT_ID = 'studypal-47e1d';
const GOOGLE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/oauth2/v3/certs'),
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { firebaseToken } = req.body;
  if (!firebaseToken || typeof firebaseToken !== 'string') {
    return res.status(400).json({ error: 'Missing firebaseToken in request body' });
  }

  const supabaseJwtSecret = process.env.SUPABASE_JWT_SECRET;
  if (!supabaseJwtSecret) {
    return res.status(500).json({ error: 'SUPABASE_JWT_SECRET not configured' });
  }

  try {
    // Verify the Firebase ID token using Google's public JWKS
    const { payload } = await jwtVerify(firebaseToken, GOOGLE_JWKS, {
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
    console.error('Token exchange failed:', err.message);

    if (err.code === 'ERR_JWT_EXPIRED') {
      return res.status(401).json({ error: 'Firebase token expired' });
    }
    if (err.code?.startsWith('ERR_JWT') || err.code?.startsWith('ERR_JWS')) {
      return res.status(401).json({ error: 'Invalid Firebase token' });
    }

    return res.status(500).json({ error: 'Token exchange failed' });
  }
}
