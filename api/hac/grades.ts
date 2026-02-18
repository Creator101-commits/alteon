import { VercelRequest, VercelResponse } from '@vercel/node';
import * as hacScraper from '../../lib/hac/scraper.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sessionId = req.headers['x-hac-session'] as string;
    // Accept cycle as string value (matching availableCycles[].value) or legacy numeric index
    const cycleParam = req.query.cycle as string | undefined;
    
    if (!sessionId) {
      return res.status(401).json({ 
        error: 'HAC session required. Please log in first.' 
      });
    }
    
    const isValid = await hacScraper.validateSession(sessionId);
    if (!isValid) {
      return res.status(401).json({ 
        error: 'Session expired or invalid. Please log in again.' 
      });
    }
    
    const gradesData = await hacScraper.fetchGrades(sessionId, cycleParam);
    
    if (!gradesData) {
      return res.status(500).json({ 
        error: 'Failed to fetch grades from HAC' 
      });
    }
    
    res.json(gradesData);
  } catch (error: any) {
    console.error('HAC grades error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to fetch grades' 
    });
  }
}
