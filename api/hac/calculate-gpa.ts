import { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import * as hacScraper from '../../lib/hac/scraper.js';

const hacGpaCalculationSchema = z.object({
  selectedCourses: z.array(z.object({
    course: z.string(),
    grade: z.number(),
    level: z.enum(['Regular', 'PreAP', 'AP', 'Dual', 'Honors']),
  })),
  excludedCourses: z.array(z.string()).optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
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
    
    const data = hacGpaCalculationSchema.parse(req.body);
    
    // Extract course IDs from selectedCourses array
    const courseIds = data.selectedCourses.map(c => c.course);
    
    const gpaData = await hacScraper.calculateCumulativeGpa(
      sessionId,
      courseIds,
      data.excludedCourses || []
    );
    
    if (!gpaData) {
      return res.status(500).json({ 
        error: 'Failed to calculate GPA' 
      });
    }
    
    res.json(gpaData);
  } catch (error: any) {
    console.error('HAC GPA calculation error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid request format',
        details: error.errors 
      });
    }
    res.status(500).json({ 
      error: error.message || 'Failed to calculate GPA' 
    });
  }
}
