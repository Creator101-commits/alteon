import { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import * as hacScraper from '../../lib/hac/scraper.js';

const hacLoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  districtBaseUrl: z.string().url().optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // DELETE = logout (merged from /api/hac/logout)
  if (req.method === 'DELETE') {
    try {
      const sessionId = req.headers['x-hac-session'] as string;
      if (sessionId) {
        hacScraper.destroySession(sessionId);
      }
      return res.json({ success: true, message: 'Logged out successfully' });
    } catch (error: any) {
      console.error('HAC logout error:', error);
      return res.status(500).json({ error: error.message || 'Failed to logout' });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const data = hacLoginSchema.parse(req.body);
    
    const { session, error } = await hacScraper.createSessionAndLogin(
      data.username,
      data.password,
      data.districtBaseUrl
    );
    
    if (error || !session) {
      return res.status(401).json({ 
        success: false,
        error: error || 'Login failed' 
      });
    }
    
    res.json({ 
      success: true,
      sessionId: session.sessionId,
      message: 'Login successful' 
    });
  } catch (error: any) {
    console.error('HAC login error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid credentials format',
        details: error.errors 
      });
    }
    res.status(500).json({ 
      success: false,
      error: error.message || 'Server error during login' 
    });
  }
}
