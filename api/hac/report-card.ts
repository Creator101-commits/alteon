import { VercelRequest, VercelResponse } from '@vercel/node';
import * as hacScraper from '../../lib/hac/scraper.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sessionId = req.headers['x-hac-session'] as string;
    
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
    
    const reportCard = await hacScraper.fetchReportCard(sessionId);
    
    if (!reportCard) {
      return res.status(500).json({ 
        error: 'Failed to fetch report card from HAC' 
      });
    }
    
    res.json(reportCard);
  } catch (error: any) {
    console.error('HAC report card error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to fetch report card' 
    });
  }
}
