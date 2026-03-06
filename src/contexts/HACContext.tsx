/**
 * HAC (Home Access Center) Context
 * Manages HAC authentication state, grades caching, and cycle prefetching.
 * 
 * Improvements:
 * - Auto-retry on 401 (re-login with cached credentials, then retry original request)
 * - Background prefetching of all available cycles after initial load
 * - Cycle metadata (availableCycles, currentCycle) from the server
 * - Enhanced assignment data (earnedPoints, totalPoints, weight, percentage)
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { getApiUrl } from '@/lib/apiClient';
import { encryptLocalData, decryptLocalData } from '@/lib/tokenEncryption';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface HACCredentials {
  username: string;
  password: string;
  districtBaseUrl?: string;
}

interface HACCycleOption {
  text: string;
  value: string;
}

interface HACAssignment {
  dateDue: string;
  dateAssigned: string;
  name: string;
  category: string;
  score: string;
  earnedPoints: number | null;
  totalPoints: number | null;
  weight: number | null;
  percentage: number | null;
}

interface HACCourse {
  courseId: string;
  name: string;
  grade: string;
  numericGrade: number | null;
  gpa: number | null;
  assignments: HACAssignment[];
}

interface HACGradesData {
  grades: HACCourse[];
  overallAverage: number;
  highlightedCourse: HACCourse | null;
  availableCycles: HACCycleOption[];
  currentCycle: string | null;
}

interface HACReportCard {
  cycles: {
    cycleName: string;
    courses: { course: string; courseCode: string; grade: number; gpa: number }[];
    averageGpa: number;
  }[];
  overallGpa: number;
}

interface HACContextType {
  // State
  isConnected: boolean;
  isLoading: boolean;
  sessionId: string | null;
  error: string | null;
  gradesData: HACGradesData | null;
  reportCard: HACReportCard | null;
  cycleGradesCache: Map<string, HACGradesData>;
  availableCycles: HACCycleOption[];
  isPrefetching: boolean;
  
  // Actions
  connect: (credentials: HACCredentials) => Promise<boolean>;
  disconnect: () => void;
  refreshGrades: () => Promise<void>;
  fetchReportCard: () => Promise<void>;
  fetchGradesForCycle: (cycleValue: string) => Promise<HACGradesData | null>;
  
  // Cached credentials (for display only - password is masked)
  cachedUsername: string | null;
}

const HACContext = createContext<HACContextType | undefined>(undefined);

export const useHAC = () => {
  const context = useContext(HACContext);
  if (context === undefined) {
    throw new Error('useHAC must be used within a HACProvider');
  }
  return context;
};

// Storage keys
const getStorageKey = (userId: string, key: string) => `hac_${userId}_${key}`;

/** Delay between prefetch batches to avoid hammering the server */
const PREFETCH_BATCH_DELAY_MS = 300;
/** Number of cycles to prefetch in parallel per batch */
const PREFETCH_BATCH_SIZE = 2;

/**
 * Safely parse a JSON response. Returns the parsed data or throws a clear error.
 * Prevents cryptic "Unexpected end of JSON input" when the response is empty or HTML.
 */
async function safeJsonParse<T = any>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text || text.trim() === '') {
    throw new Error('Empty response from server. Make sure the API server is running (use `vercel dev` for local development).');
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    // Likely got HTML back (Vite SPA fallback) instead of JSON
    if (text.includes('<!DOCTYPE') || text.includes('<html')) {
      throw new Error('API server not available. Run `vercel dev` instead of `npm run dev` for local development with API routes.');
    }
    throw new Error(`Invalid JSON response from server: ${text.substring(0, 100)}...`);
  }
}

interface HACProviderProps {
  children: ReactNode;
}

export const HACProvider = ({ children }: HACProviderProps) => {
  const { user } = useAuth();
  
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gradesData, setGradesData] = useState<HACGradesData | null>(null);
  const [reportCard, setReportCard] = useState<HACReportCard | null>(null);
  const [cachedUsername, setCachedUsername] = useState<string | null>(null);
  const [cycleGradesCache, setCycleGradesCache] = useState<Map<string, HACGradesData>>(new Map());
  const [availableCycles, setAvailableCycles] = useState<HACCycleOption[]>([]);
  const [isPrefetching, setIsPrefetching] = useState(false);
  
  // Ref to track if prefetching is already in progress (avoid duplicates)
  const prefetchingRef = useRef(false);
  // Ref to store credentials for auto-retry
  const credentialsRef = useRef<HACCredentials | null>(null);

  // ─── Auth-aware fetch wrapper ───────────────────────────────────────────────
  
  /**
   * Fetch with automatic 401 retry: if we get a 401, re-login with cached
   * credentials and retry the original request once.
   */
  const fetchWithAuth = useCallback(async (
    url: string,
    sid: string,
    options: RequestInit = {}
  ): Promise<Response> => {
    const headers = {
      ...((options.headers as Record<string, string>) || {}),
      'X-HAC-Session': sid,
    };
    
    const response = await fetch(url, { ...options, headers });
    
    if (response.status === 401 && credentialsRef.current) {
      console.log('[HACContext] 401 received, attempting re-login...');
      
      // Try re-login
      const loginResponse = await fetch(getApiUrl('/api/hac/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentialsRef.current),
      });
      
      if (loginResponse.ok) {
        const loginData = await safeJsonParse(loginResponse);
        if (loginData.success && loginData.sessionId) {
          // Update session
          setSessionId(loginData.sessionId);
          
          // Retry original request with new session
          const retryHeaders = {
            ...((options.headers as Record<string, string>) || {}),
            'X-HAC-Session': loginData.sessionId,
          };
          return fetch(url, { ...options, headers: retryHeaders });
        }
      }
      
      // Re-login failed — mark disconnected
      setIsConnected(false);
      setSessionId(null);
      setError('Session expired. Please reconnect.');
    }
    
    return response;
  }, []);

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  // Load cached credentials on mount
  useEffect(() => {
    if (!user?.uid) {
      setIsConnected(false);
      setSessionId(null);
      setCachedUsername(null);
      setGradesData(null);
      setReportCard(null);
      setAvailableCycles([]);
      setCycleGradesCache(new Map());
      credentialsRef.current = null;
      return;
    }

    const loadCachedCredentials = async () => {
      try {
        const cachedCreds = localStorage.getItem(getStorageKey(user.uid, 'credentials'));
        if (cachedCreds) {
          // Decrypt credentials from localStorage
          const decrypted = await decryptLocalData(cachedCreds, user.uid);
          const parsed = JSON.parse(decrypted);
          setCachedUsername(parsed.username);
          credentialsRef.current = parsed;
          autoLogin(parsed);
        }
      } catch (err) {
        console.warn('Failed to load cached HAC credentials:', err);
      }
    };
    loadCachedCredentials();
  }, [user?.uid]);

  // ─── Auto-login ─────────────────────────────────────────────────────────────

  const autoLogin = async (credentials: HACCredentials) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(getApiUrl('/api/hac/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });
      
      const data = await safeJsonParse(response);
      
      if (response.ok && data.success) {
        setSessionId(data.sessionId);
        setIsConnected(true);
        setCachedUsername(credentials.username);
        credentialsRef.current = credentials;
        
        // Fetch grades (blocking), then background tasks
        await fetchGradesInternal(data.sessionId);
        
        // Fire-and-forget: report card + prefetch
        startBackgroundTasks(data.sessionId);
      } else {
        if (user?.uid) {
          localStorage.removeItem(getStorageKey(user.uid, 'credentials'));
        }
        setIsConnected(false);
        setCachedUsername(null);
        credentialsRef.current = null;
      }
    } catch (err) {
      console.warn('HAC auto-login failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Connect / Disconnect ──────────────────────────────────────────────────

  const connect = useCallback(async (credentials: HACCredentials): Promise<boolean> => {
    if (!user?.uid) {
      setError('You must be logged in to connect HAC');
      return false;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(getApiUrl('/api/hac/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });
      
      const data = await safeJsonParse(response);
      
      if (!response.ok || !data.success) {
        setError(data.error || 'Failed to connect to HAC');
        return false;
      }
      
      setSessionId(data.sessionId);
      setIsConnected(true);
      setCachedUsername(credentials.username);
      credentialsRef.current = credentials;
      
      // Cache credentials (encrypted)
      encryptLocalData(JSON.stringify(credentials), user.uid).then(encrypted => {
        localStorage.setItem(
          getStorageKey(user.uid, 'credentials'),
          encrypted
        );
      });
      
      // Fetch grades (blocking)
      await fetchGradesInternal(data.sessionId);
      
      // Background: report card + prefetch
      startBackgroundTasks(data.sessionId);
      
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user?.uid]);

  const disconnect = useCallback(() => {
    if (sessionId) {
      fetch(getApiUrl('/api/hac/login'), {
        method: 'DELETE',
        headers: { 'X-HAC-Session': sessionId },
      }).catch(() => {});
    }
    
    setSessionId(null);
    setIsConnected(false);
    setGradesData(null);
    setReportCard(null);
    setError(null);
    setAvailableCycles([]);
    setCycleGradesCache(new Map());
    setIsPrefetching(false);
    prefetchingRef.current = false;
    credentialsRef.current = null;
    
    if (user?.uid) {
      localStorage.removeItem(getStorageKey(user.uid, 'credentials'));
    }
    setCachedUsername(null);
  }, [sessionId, user?.uid]);

  // ─── Internal Grade Fetching ────────────────────────────────────────────────

  const fetchGradesInternal = async (sid: string, cycleValue?: string) => {
    try {
      const url = cycleValue 
        ? getApiUrl(`/api/hac/grades?cycle=${encodeURIComponent(cycleValue)}`)
        : getApiUrl('/api/hac/grades');
      
      const response = await fetchWithAuth(url, sid);
      
      if (!response.ok) {
        if (response.status === 401) {
          setIsConnected(false);
          setSessionId(null);
          setError('Session expired. Please reconnect.');
        }
        return null;
      }
      
      const data: HACGradesData = await safeJsonParse<HACGradesData>(response);
      
      // Update main grades data if this is the default/current cycle
      if (!cycleValue) {
        setGradesData(data);
        
        // Store available cycles from the response
        if (data.availableCycles?.length) {
          setAvailableCycles(data.availableCycles);
        }
        
        // Cache the current cycle
        if (data.currentCycle) {
          setCycleGradesCache(prev => {
            const newCache = new Map(prev);
            newCache.set(data.currentCycle!, data);
            return newCache;
          });
        }
      }
      
      return data;
    } catch (err) {
      console.error('Failed to fetch grades:', err);
      return null;
    }
  };

  // ─── Background Tasks ──────────────────────────────────────────────────────

  /**
   * Start background tasks after initial grade load:
   * 1. Fetch report card
   * 2. Prefetch other cycles for instant switching
   */
  const startBackgroundTasks = (sid: string) => {
    // Report card (fire-and-forget)
    fetchReportCardInternal(sid).catch(() => {});
    
    // Start prefetching other cycles after a short delay
    setTimeout(() => {
      startPrefetching(sid);
    }, 500);
  };

  /**
   * Prefetch all available cycles in batches.
   * Fetches PREFETCH_BATCH_SIZE cycles in parallel, then waits before the next batch.
   */
  const startPrefetching = async (sid: string) => {
    if (prefetchingRef.current) return; // Already prefetching
    prefetchingRef.current = true;
    setIsPrefetching(true);
    
    try {
      // Wait for availableCycles to be populated
      // We read from the latest state via a small trick
      const currentGrades = await fetchGradesInternal(sid);
      const cycles = currentGrades?.availableCycles || [];
      const currentCycle = currentGrades?.currentCycle;
      
      if (cycles.length <= 1) {
        console.log('[HACContext] Only 1 cycle available, skipping prefetch');
        return;
      }
      
      // Filter out the current cycle (already loaded)
      const cyclesToPrefetch = cycles.filter(c => c.value !== currentCycle);
      
      console.log(`[HACContext] Prefetching ${cyclesToPrefetch.length} cycles...`);
      
      // Process in batches
      for (let i = 0; i < cyclesToPrefetch.length; i += PREFETCH_BATCH_SIZE) {
        const batch = cyclesToPrefetch.slice(i, i + PREFETCH_BATCH_SIZE);
        
        const results = await Promise.allSettled(
          batch.map(async (cycle) => {
            const url = getApiUrl(`/api/hac/grades?cycle=${encodeURIComponent(cycle.value)}`);
            const response = await fetchWithAuth(url, sid);
            
            if (response.ok) {
              const data: HACGradesData = await safeJsonParse<HACGradesData>(response);
              
              setCycleGradesCache(prev => {
                const newCache = new Map(prev);
                newCache.set(cycle.value, data);
                return newCache;
              });
              
              return data;
            }
            return null;
          })
        );
        
        const succeeded = results.filter(r => r.status === 'fulfilled' && r.value).length;
        console.log(`[HACContext] Prefetch batch ${Math.floor(i / PREFETCH_BATCH_SIZE) + 1}: ${succeeded}/${batch.length} succeeded`);
        
        // Delay between batches
        if (i + PREFETCH_BATCH_SIZE < cyclesToPrefetch.length) {
          await new Promise(resolve => setTimeout(resolve, PREFETCH_BATCH_DELAY_MS));
        }
      }
    } catch (err) {
      console.warn('[HACContext] Prefetch error:', err);
    } finally {
      prefetchingRef.current = false;
      setIsPrefetching(false);
    }
  };

  // ─── Public Actions ─────────────────────────────────────────────────────────

  const refreshGrades = useCallback(async () => {
    if (!sessionId) {
      setError('Not connected to HAC');
      return;
    }
    
    setIsLoading(true);
    try {
      // Clear cache and re-fetch
      setCycleGradesCache(new Map());
      await fetchGradesInternal(sessionId);
      
      // Re-prefetch in background
      startBackgroundTasks(sessionId);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  const fetchReportCardInternal = async (sid: string) => {
    try {
      const response = await fetchWithAuth(getApiUrl('/api/hac/report-card'), sid);
      
      if (!response.ok) {
        if (response.status === 401) {
          setIsConnected(false);
          setSessionId(null);
          setError('Session expired. Please reconnect.');
        }
        return;
      }
      
      const data = await safeJsonParse(response);
      setReportCard(data);
    } catch (err) {
      console.error('Failed to fetch report card:', err);
    }
  };

  const fetchReportCard = useCallback(async () => {
    if (!sessionId) {
      setError('Not connected to HAC');
      return;
    }
    
    setIsLoading(true);
    try {
      await fetchReportCardInternal(sessionId);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  const fetchGradesForCycle = useCallback(async (cycleValue: string): Promise<HACGradesData | null> => {
    if (!sessionId) {
      setError('Not connected to HAC');
      return null;
    }
    
    // Check cache first (instant if prefetched)
    const cached = cycleGradesCache.get(cycleValue);
    if (cached) {
      return cached;
    }
    
    try {
      const data = await fetchGradesInternal(sessionId, cycleValue);
      
      if (data) {
        // Cache the result
        setCycleGradesCache(prev => {
          const newCache = new Map(prev);
          newCache.set(cycleValue, data);
          return newCache;
        });
      }
      
      return data;
    } catch (err) {
      console.error('Failed to fetch grades for cycle:', err);
      return null;
    }
  }, [sessionId, cycleGradesCache]);

  // ─── Context Value ─────────────────────────────────────────────────────────

  const value: HACContextType = {
    isConnected,
    isLoading,
    sessionId,
    error,
    gradesData,
    reportCard,
    cycleGradesCache,
    availableCycles,
    isPrefetching,
    connect,
    disconnect,
    refreshGrades,
    fetchReportCard,
    fetchGradesForCycle,
    cachedUsername,
  };

  return (
    <HACContext.Provider value={value}>
      {children}
    </HACContext.Provider>
  );
};
