import { VercelRequest, VercelResponse } from '@vercel/node';
import * as hacScraper from '../../lib/hac/scraper.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sessionId = req.headers['x-hac-session'] as string;
    
    if (sessionId) {
      hacScraper.destroySession(sessionId);
    }
    
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error: any) {
    console.error('HAC logout error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to logout' 
    });
  }
}
