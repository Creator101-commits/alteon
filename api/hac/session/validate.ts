import { VercelRequest, VercelResponse } from '@vercel/node';
import * as hacScraper from '../../../lib/hac/scraper.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sessionId = req.headers['x-hac-session'] as string;
    
    if (!sessionId) {
      return res.json({ valid: false });
    }
    
    const isValid = await hacScraper.validateSession(sessionId);
    res.json({ valid: isValid });
  } catch (error: any) {
    console.error('HAC session validation error:', error);
    res.json({ valid: false });
  }
}
