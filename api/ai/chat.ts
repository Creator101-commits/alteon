import { VercelRequest, VercelResponse } from '@vercel/node';

// ─── Per-user in-memory rate limiter ────────────────────────────────────────
// 20 requests per 60-second sliding window per user.
// Note: Vercel functions are stateless between cold starts, so this limits
// burst traffic within a single warm instance. Pair with Vercel's built-in
// IP-level rate limiting for multi-instance protection.
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;
const requestLog = new Map<string, number[]>();

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const timestamps = (requestLog.get(userId) ?? []).filter(t => t > windowStart);
  if (timestamps.length >= RATE_LIMIT_MAX) return true;
  timestamps.push(now);
  requestLog.set(userId, timestamps);
  return false;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Groq API key not configured on server.' });
  }

  // Validate user is authenticated
  const userId = req.headers['x-user-id'] as string;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  // Rate limit: 20 requests per 60 s per user
  if (isRateLimited(userId)) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({
      error: 'Too many requests. You can send up to 20 messages per minute.',
    });
  }

  try {
    const { messages, model, maxTokens, temperature } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array is required.' });
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model || 'llama-3.1-8b-instant',
        messages,
        max_tokens: maxTokens || 1000,
        temperature: temperature ?? 0.7,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));

      if (response.status === 401) {
        return res.status(502).json({ error: 'Invalid Groq API key on server.' });
      } else if (response.status === 429) {
        return res.status(429).json({ error: 'Rate limit exceeded. Please wait a moment and try again.' });
      } else {
        return res.status(response.status).json({
          error: (errorData as any).error?.message || `Groq API error (${response.status})`,
        });
      }
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('Groq proxy error:', error);
    return res.status(500).json({ error: 'Failed to reach AI service.' });
  }
}
