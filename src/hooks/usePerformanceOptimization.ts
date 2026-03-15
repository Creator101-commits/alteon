import { useState, useCallback, useEffect, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';

interface PerformanceMetrics {
  loadTime: number;
  renderTime: number;
  memoryUsage: number;
  cacheHitRate: number;
  apiResponseTime: number;
}

interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number; // time to live in milliseconds
}

interface LazyLoadConfig {
  threshold: number;
  rootMargin: string;
  preloadOffset: number;
}

export const usePerformanceOptimization = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    loadTime: 0,
    renderTime: 0,
    memoryUsage: 0,
    cacheHitRate: 0,
    apiResponseTime: 0,
  });
  const [isMonitoring, setIsMonitoring] = useState(false);
  const { toast } = useToast();

  // Memory cache for API responses and computed data
  const cache = useMemo(() => new Map<string, CacheItem<any>>(), []);

  // Performance monitoring
  const startMonitoring = useCallback(() => {
    setIsMonitoring(true);
    
    // Monitor performance metrics
    const startTime = performance.now();
    
    // Track memory usage
    const updateMemoryMetrics = () => {
      if ('memory' in performance) {
        const memInfo = (performance as any).memory;
        setMetrics(prev => ({
          ...prev,
          memoryUsage: memInfo.usedJSHeapSize / 1024 / 1024, // Convert to MB
        }));
      }
    };

    // Track load time using Performance API
    const updateLoadMetrics = () => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navigation) {
        setMetrics(prev => ({
          ...prev,
          loadTime: navigation.loadEventEnd - navigation.loadEventStart,
        }));
      }
    };

    // Update metrics periodically
    const metricsInterval = setInterval(() => {
      updateMemoryMetrics();
      updateLoadMetrics();
    }, 5000);

    return () => {
      clearInterval(metricsInterval);
      setIsMonitoring(false);
    };
  }, []);

  // Smart caching system
  const setCache = useCallback(<T>(key: string, data: T, ttl: number = 300000) => { // Default 5 minutes TTL
    cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }, [cache]);

  const getCache = useCallback(<T>(key: string): T | null => {
    const item = cache.get(key);
    if (!item) return null;

    const now = Date.now();
    if (now - item.timestamp > item.ttl) {
      cache.delete(key);
      return null;
    }

    // Update cache hit rate
    setMetrics(prev => ({
      ...prev,
      cacheHitRate: (prev.cacheHitRate * 0.9) + (0.1 * 1), // Moving average
    }));

    return item.data as T;
  }, [cache]);

  const clearCache = useCallback((pattern?: string) => {
    if (!pattern) {
      cache.clear();
      return;
    }

    const keysToDelete = Array.from(cache.keys()).filter(key => 
      key.includes(pattern)
    );
    keysToDelete.forEach(key => cache.delete(key));
  }, [cache]);

  // Optimized API wrapper with caching and retry logic
  const optimizedFetch = useCallback(async <T>(
    url: string,
    options: RequestInit = {},
    cacheKey?: string,
    ttl?: number
  ): Promise<T> => {
    const startTime = performance.now();

    // Check cache first
    if (cacheKey) {
      const cached = getCache<T>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      // Add retry logic
      let retries = 3;
      let response: Response;

      while (retries > 0) {
        try {
          response = await fetch(url, {
            ...options,
            headers: {
              'Content-Type': 'application/json',
              ...options.headers,
            },
          });

          if (response.ok) break;
          
          if (response.status >= 500 && retries > 1) {
            // Server error, retry after delay
            await new Promise(resolve => setTimeout(resolve, 1000 * (4 - retries)));
            retries--;
            continue;
          }
          
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        } catch (error) {
          retries--;
          if (retries === 0) throw error;
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      const data = await response!.json();
      
      // Update API response time metric
      const endTime = performance.now();
      setMetrics(prev => ({
        ...prev,
        apiResponseTime: (prev.apiResponseTime * 0.9) + (0.1 * (endTime - startTime)), // Moving average
      }));

      // Cache the result
      if (cacheKey) {
        setCache(cacheKey, data, ttl);
      }

      return data;
    } catch (error) {
      // Update cache miss rate
      setMetrics(prev => ({
        ...prev,
        cacheHitRate: (prev.cacheHitRate * 0.9) + (0.1 * 0), // Moving average
      }));
      
      throw error;
    }
  }, [getCache, setCache]);

  // Image optimization and lazy loading
  const optimizeImageUrl = useCallback((url: string, width?: number, height?: number): string => {
    if (!url) return url;

    // If it's a data URL or already optimized, return as is
    if (url.startsWith('data:') || url.includes('w_') || url.includes('h_')) {
      return url;
    }

    // Add optimization parameters for common CDNs
    const urlObj = new URL(url);
    
    // Cloudinary optimization
    if (urlObj.hostname.includes('cloudinary.com')) {
      const pathParts = urlObj.pathname.split('/');
      const uploadIndex = pathParts.indexOf('upload');
      if (uploadIndex !== -1) {
        const transforms = [];
        if (width) transforms.push(`w_${width}`);
        if (height) transforms.push(`h_${height}`);
        transforms.push('q_auto', 'f_auto');
        
        pathParts.splice(uploadIndex + 1, 0, transforms.join(','));
        urlObj.pathname = pathParts.join('/');
      }
    }

    return urlObj.toString();
  }, []);

  // Lazy loading hook for components
  const useLazyLoad = useCallback((config: LazyLoadConfig = {
    threshold: 0.1,
    rootMargin: '50px',
    preloadOffset: 200,
  }) => {
    const [isIntersecting, setIsIntersecting] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);

    const ref = useCallback((node: HTMLElement | null) => {
      if (node) {
        const observer = new IntersectionObserver(
          ([entry]) => {
            if (entry.isIntersecting && !hasLoaded) {
              setIsIntersecting(true);
              setHasLoaded(true);
              observer.unobserve(node);
            }
          },
          {
            threshold: config.threshold,
            rootMargin: config.rootMargin,
          }
        );
        observer.observe(node);

        return () => observer.unobserve(node);
      }
    }, [hasLoaded, config]);

    return { ref, isIntersecting, hasLoaded };
  }, []);

  // Bundle size optimization - dynamic imports
  const lazyImport = useCallback(<T extends Record<string, any>>(
    importFn: () => Promise<T>
  ) => {
    return async (): Promise<T> => {
      const cacheKey = `lazy_import_${importFn.toString()}`;
      const cached = getCache<T>(cacheKey);
      
      if (cached) {
        return cached;
      }

      const module = await importFn();
      setCache(cacheKey, module, 600000); // Cache for 10 minutes
      return module;
    };
  }, [getCache, setCache]);

  // Database query optimization
  const optimizeQuery = useCallback((query: string, params: any[] = []): string => {
    // Add query optimization techniques
    let optimizedQuery = query;

    // Remove unnecessary whitespace
    optimizedQuery = optimizedQuery.replace(/\s+/g, ' ').trim();

    // Add indices suggestions for common patterns
    const indexSuggestions: string[] = [];
    
    if (query.includes('WHERE') && query.includes('ORDER BY')) {
      indexSuggestions.push('Consider adding composite index on WHERE and ORDER BY columns');
    }
    
    if (query.includes('JOIN')) {
      indexSuggestions.push('Ensure JOIN columns have indices');
    }

    if (indexSuggestions.length > 0) {
      console.log('Query optimization suggestions:', indexSuggestions);
    }

    return optimizedQuery;
  }, []);

  // Component render optimization
  const useOptimizedRender = useCallback(<T extends Record<string, any>>(
    deps: T,
    threshold: number = 16 // Target 60fps (16ms per frame)
  ) => {
    const [isOptimized, setIsOptimized] = useState(true);
    const [renderCount, setRenderCount] = useState(0);

    useEffect(() => {
      const startTime = performance.now();
      
      setRenderCount(prev => prev + 1);
      
      requestAnimationFrame(() => {
        const endTime = performance.now();
        const renderTime = endTime - startTime;
        
        setMetrics(prev => ({
          ...prev,
          renderTime: (prev.renderTime * 0.9) + (0.1 * renderTime),
        }));

        if (renderTime > threshold) {
          setIsOptimized(false);
          if (renderCount > 5) { // Only warn after multiple slow renders
            console.warn(`Slow render detected: ${renderTime.toFixed(2)}ms`);
          }
        } else {
          setIsOptimized(true);
        }
      });
    }, Object.values(deps));

    return { isOptimized, renderCount, renderTime: metrics.renderTime };
  }, [metrics.renderTime]);

  // Debounced operations for user input
  const useDebounce = useCallback(<T>(value: T, delay: number): T => {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
      const handler = setTimeout(() => {
        setDebouncedValue(value);
      }, delay);

      return () => {
        clearTimeout(handler);
      };
    }, [value, delay]);

    return debouncedValue;
  }, []);

  // Service Worker registration for caching
  const registerServiceWorker = useCallback(async () => {
    if (!import.meta.env.PROD) {
      return;
    }

    if ('serviceWorker' in navigator) {
      try {
        const swHead = await fetch('/sw.js', { method: 'HEAD', cache: 'no-store' });
        if (!swHead.ok) {
          console.warn('Skipping service worker registration: /sw.js not found');
          return;
        }

        const registration = await navigator.serviceWorker.register('/sw.js');
        
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                toast({
                  title: 'App Updated',
                  description: 'A new version is available. Refresh to update.',
                });
              }
            });
          }
        });

        console.log('Service Worker registered successfully');
        return registration;
      } catch (error) {
        console.error('Service Worker registration failed:', error);
        throw error;
      }
    }
  }, [toast]);

  // Preload critical resources
  const preloadResource = useCallback((href: string, as: string = 'fetch') => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = href;
    link.as = as;
    
    if (as === 'fetch') {
      link.crossOrigin = 'anonymous';
    }
    
    document.head.appendChild(link);
  }, []);

  // Resource cleanup
  const cleanupResources = useCallback(() => {
    // Clear expired cache entries
    const now = Date.now();
    for (const [key, item] of cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        cache.delete(key);
      }
    }

    // Clear old performance entries
    if (performance.clearResourceTimings) {
      performance.clearResourceTimings();
    }

    // Suggest garbage collection (if available)
    if ('gc' in window && typeof (window as any).gc === 'function') {
      (window as any).gc();
    }
  }, [cache]);

  // Auto cleanup on interval
  useEffect(() => {
    const cleanupInterval = setInterval(cleanupResources, 300000); // Every 5 minutes
    return () => clearInterval(cleanupInterval);
  }, [cleanupResources]);

  // Performance reporting
  const generatePerformanceReport = useCallback(() => {
    const report = {
      metrics,
      cacheSize: cache.size,
      timestamp: new Date().toISOString(),
      recommendations: [],
    };

    const recommendations: string[] = [];

    if (metrics.loadTime > 3000) {
      recommendations.push('Consider code splitting to reduce initial bundle size');
    }
    
    if (metrics.renderTime > 16) {
      recommendations.push('Optimize component renders with React.memo or useMemo');
    }
    
    if (metrics.memoryUsage > 100) {
      recommendations.push('High memory usage detected. Consider implementing virtual scrolling');
    }
    
    if (metrics.cacheHitRate < 0.5) {
      recommendations.push('Low cache hit rate. Consider increasing cache TTL or improving cache keys');
    }
    
    if (metrics.apiResponseTime > 1000) {
      recommendations.push('API responses are slow. Consider implementing pagination or data prefetching');
    }

    (report as any).recommendations = recommendations;

    console.log('Performance Report:', report);
    return report;
  }, [metrics, cache.size]);

  // Virtual scrolling implementation
  const useVirtualScroll = useCallback(<T>(
    items: T[],
    itemHeight: number,
    containerHeight: number,
    overscan: number = 5
  ) => {
    const [scrollTop, setScrollTop] = useState(0);

    const visibleStart = Math.floor(scrollTop / itemHeight);
    const visibleEnd = Math.min(
      visibleStart + Math.ceil(containerHeight / itemHeight),
      items.length - 1
    );

    const paddingTop = visibleStart * itemHeight;
    const paddingBottom = (items.length - visibleEnd - 1) * itemHeight;

    const visibleItems = items.slice(
      Math.max(0, visibleStart - overscan),
      Math.min(items.length, visibleEnd + 1 + overscan)
    );

    return {
      visibleItems,
      paddingTop,
      paddingBottom,
      onScroll: (e: React.UIEvent<HTMLDivElement>) => {
        setScrollTop(e.currentTarget.scrollTop);
      },
    };
  }, []);

  // Image lazy loading with blur-up technique
  const useLazyImage = useCallback((src: string, blurDataUrl?: string) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [isInView, setIsInView] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const imgRef = useCallback((node: HTMLImageElement | null) => {
      if (node) {
        const observer = new IntersectionObserver(
          ([entry]) => {
            if (entry.isIntersecting) {
              setIsInView(true);
              observer.unobserve(node);
            }
          },
          { rootMargin: '50px' }
        );
        observer.observe(node);
      }
    }, []);

    useEffect(() => {
      if (isInView && src) {
        const img = new Image();
        img.onload = () => setIsLoaded(true);
        img.onerror = () => setError('Failed to load image');
        img.src = src;
      }
    }, [isInView, src]);

    return {
      imgRef,
      src: isLoaded ? src : blurDataUrl || '',
      isLoaded,
      error,
      style: {
        filter: isLoaded ? 'none' : 'blur(5px)',
        transition: 'filter 0.3s ease',
      },
    };
  }, []);

  // Code splitting helper
  const loadChunk = useCallback(async (chunkName: string) => {
    const cacheKey = `chunk_${chunkName}`;
    const cached = getCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      // Dynamic import with error handling
      const module = await import(/* @vite-ignore */ `@/components/${chunkName}`);
      setCache(cacheKey, module, 600000); // Cache for 10 minutes
      return module;
    } catch (error) {
      console.error(`Failed to load chunk: ${chunkName}`, error);
      throw error;
    }
  }, [getCache, setCache]);

  // Bundle analysis helper
  const analyzeBundleSize = useCallback(() => {
    const scripts = Array.from(document.scripts);
    const totalSize = scripts.reduce((acc, script) => {
      if (script.src && !script.src.includes('chrome-extension')) {
        // Estimate size based on content or fetch actual size
        return acc + (script.innerHTML.length || 50000); // Rough estimate
      }
      return acc;
    }, 0);

    const recommendation = totalSize > 1000000 
      ? 'Consider code splitting - bundle size is large'
      : 'Bundle size is optimal';

    return {
      totalSize: Math.round(totalSize / 1024), // KB
      scriptCount: scripts.length,
      recommendation,
    };
  }, []);

  // PWA optimization
  const optimizePWA = useCallback(async () => {
    try {
      // Register service worker
      await registerServiceWorker();

      // Preload critical resources
      preloadResource('/manifest.json', 'manifest');
      preloadResource('/sw.js', 'script');

      // Cache critical API endpoints
      const criticalEndpoints = [
        '/api/calendar/events',
      ];

      for (const endpoint of criticalEndpoints) {
        try {
          await optimizedFetch(endpoint, {}, `critical_${endpoint}`, 600000);
        } catch (error) {
          console.warn(`Failed to preload ${endpoint}:`, error);
        }
      }

      toast({
        title: 'PWA Optimized',
        description: 'App performance has been optimized for mobile and offline use.',
      });
    } catch (error) {
      console.error('PWA optimization failed:', error);
    }
  }, [registerServiceWorker, preloadResource, optimizedFetch, toast]);

  return {
    // Performance monitoring
    metrics,
    isMonitoring,
    startMonitoring,
    generatePerformanceReport,

    // Caching
    setCache,
    getCache,
    clearCache,
    optimizedFetch,

    // Lazy loading and virtualization
    useLazyLoad,
    useVirtualScroll,
    useLazyImage,

    // Optimization utilities
    optimizeImageUrl,
    loadChunk,
    analyzeBundleSize,
    optimizePWA,
    useDebounce,
    useOptimizedRender,
    cleanupResources,
  };
};
