import { VercelRequest, VercelResponse } from '@vercel/node';
import * as hacScraper from '../../../lib/hac/scraper.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sessionId = req.headers['x-hac-session'] as string;
    const { courseId } = req.query;
    const courseIndex = parseInt(courseId as string, 10);
    
    if (!sessionId) {
      return res.status(401).json({ 
        error: 'HAC session required. Please log in first.' 
      });
    }
    
    if (isNaN(courseIndex)) {
      return res.status(400).json({ error: 'Invalid course ID' });
    }
    
    const isValid = await hacScraper.validateSession(sessionId);
    if (!isValid) {
      return res.status(401).json({ 
        error: 'Session expired or invalid. Please log in again.' 
      });
    }
    
    const assignments = await hacScraper.fetchAssignmentsForCourse(sessionId, courseIndex);
    
    if (!assignments) {
      return res.status(500).json({ 
        error: 'Failed to fetch assignments from HAC' 
      });
    }
    
    res.json({ assignments });
  } catch (error: any) {
    console.error('HAC assignments error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to fetch assignments' 
    });
  }
}
