/**
 * Optimized dock navigation with smooth animations and better UX
 * Now with mobile-responsive touch targets (44px minimum)
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAppState } from '@/contexts/AppStateContext';
import { useHAC } from '@/contexts/HACContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useMobileDetection } from '@/lib/mobileDetection';
import {
  Home,
  BookOpen,
  GraduationCap,
  FolderOpen,
  Brain,
  BarChart3,
  Target,
  User,
  Settings,
  ChevronUp,
  MessageSquare,
  Wrench,
  CheckCircle,
  ListTodo,
  Trello,
  School,
} from 'lucide-react';

interface DockItem {
  id: string;
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  requiresHAC?: boolean; // Only show if HAC is connected
}

const baseDockItems: DockItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    path: '/dashboard',
    icon: Home,
  },
  {
    id: 'assignments',
    label: 'Assignments',
    path: '/assignments',
    icon: BookOpen,
  },
  {
    id: 'classes',
    label: 'Classes',
    path: '/classes',
    icon: GraduationCap,
  },
  {
    id: 'files',
    label: 'Files',
    path: '/files',
    icon: FolderOpen,
  },
  {
    id: 'habits',
    label: 'Habits',
    path: '/habits',
    icon: CheckCircle,
  },
  {
    id: 'todo-list',
    label: 'To-Do Board',
    path: '/todo-list',
    icon: ListTodo,
  },
  {
    id: 'hac-grades',
    label: 'HAC Grades',
    path: '/hac-grades',
    icon: School,
    requiresHAC: true,
  },
  {
    id: 'ai-chat',
    label: 'AI Chat',
    path: '/ai-chat',
    icon: MessageSquare,
  },
  {
    id: 'learn',
    label: 'Learn',
    path: '/learn',
    icon: Wrench,
  },
];

interface OptimizedDockProps {
  className?: string;
}

export function OptimizedDock({ className }: OptimizedDockProps) {
  const [location, setLocation] = useLocation();
  const [isExpanded, setIsExpanded] = useState(false);
  const { state } = useAppState();
  const { preferences } = state;
  const { isMobile, isTouch, screenSize } = useMobileDetection();
  
  // HAC context for conditional dock item
  const { isConnected: isHACConnected } = useHAC();

  // Filter dock items based on HAC connection status
  const dockItems = useMemo(() => {
    return baseDockItems.filter(item => {
      if (item.requiresHAC && !isHACConnected) {
        return false;
      }
      return true;
    });
  }, [isHACConnected]);

  // Calculate touch target size based on device
  const touchTargetSize = isMobile ? 44 : isTouch ? 40 : 36; // iOS HIG minimum 44px
  const iconSize = isMobile ? 24 : 20;


  // Auto-hide dock when scrolling
  useEffect(() => {
    let lastScrollY = window.scrollY;
    let ticking = false;

    const updateDockVisibility = () => {
      const currentScrollY = window.scrollY;
      const isScrollingDown = currentScrollY > lastScrollY;
      
      if (isScrollingDown && currentScrollY > 100) {
        setIsExpanded(false);
      } else if (!isScrollingDown || currentScrollY < 100) {
        setIsExpanded(true);
      }
      
      lastScrollY = currentScrollY;
      ticking = false;
    };

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(updateDockVisibility);
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNavigation = useCallback((path: string) => {
    setLocation(path);
    setIsExpanded(false);
  }, [setLocation]);

  const dockVariants = {
    expanded: {
      y: 0,
      scale: 1.05,
      transition: {
        type: 'spring',
        stiffness: 300,
        damping: 25,
      },
    },
    collapsed: {
      y: 20,
      scale: 1,
      transition: {
        type: 'spring',
        stiffness: 300,
        damping: 25,
      },
    },
  };

  const itemVariants = {
    idle: {
      scale: 1,
      y: 0,
    },
    active: {
      scale: 1.1,
      y: -4,
      transition: {
        type: 'spring',
        stiffness: 400,
        damping: 25,
      },
    },
  };

  const tooltipVariants = {
    hidden: {
      opacity: 0,
      y: 10,
      scale: 0.8,
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: 'spring',
        stiffness: 300,
        damping: 25,
      },
    },
  };

  if (!preferences.animations) {
    // Static version for users who prefer reduced motion
    return (
      <div className={cn('fixed bottom-6 left-0 right-0 z-50 flex justify-center', className)}>
        <div className={cn(
          'flex items-center justify-center bg-background border border-border rounded-2xl shadow-lg',
          isMobile ? 'space-x-1 px-2 py-2' : 'space-x-2 px-4 py-3'
        )}>
          {dockItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path;
            
            return (
              <button
                key={item.id}
                onClick={() => handleNavigation(item.path)}
                className={cn(
                  'relative rounded-xl transition-colors flex items-center justify-center',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
                style={{
                  minWidth: `${touchTargetSize}px`,
                  minHeight: `${touchTargetSize}px`,
                  padding: isMobile ? '10px' : '12px',
                }}
                title={item.label}
                aria-label={item.label}
              >
                <Icon className={cn(isMobile ? 'h-6 w-6' : 'h-5 w-5')} />
                {item.badge && (
                  <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 p-0 text-xs">
                    {item.badge}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      variants={dockVariants}
      animate={isExpanded ? 'expanded' : 'collapsed'}
      className={cn('fixed bottom-6 left-0 right-0 z-50 flex justify-center', className)}
    >
      {/* Main dock */}
      <motion.div
        className={cn(
          'flex items-center justify-center bg-background border border-border rounded-2xl shadow-lg',
          isMobile ? 'space-x-0.5 px-2 py-2' : 'space-x-1 px-4 py-3'
        )}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      >
        {/* Expand/Collapse button */}
        <motion.button
          onClick={() => setIsExpanded(!isExpanded)}
          className="rounded-lg transition-colors flex items-center justify-center"
          style={{
            minWidth: `${touchTargetSize}px`,
            minHeight: `${touchTargetSize}px`,
            padding: isMobile ? '8px' : '10px',
          }}
          whileTap={{ scale: 0.95 }}
          aria-label={isExpanded ? 'Collapse dock' : 'Expand dock'}
        >
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <ChevronUp className={cn(isMobile ? 'h-5 w-5' : 'h-4 w-4', 'text-muted-foreground')} />
          </motion.div>
        </motion.button>

        {/* Dock items */}
        {dockItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = location === item.path;

          return (
            <motion.div
              key={item.id}
              variants={itemVariants}
              initial="idle"
              animate={isActive ? 'active' : 'idle'}
              className="relative"
            >
              <button
                onClick={() => handleNavigation(item.path)}
                className={cn(
                  'relative rounded-xl transition-all duration-200 flex items-center justify-center',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
                style={{
                  minWidth: `${touchTargetSize}px`,
                  minHeight: `${touchTargetSize}px`,
                  padding: isMobile ? '10px' : '12px',
                }}
                aria-label={item.label}
                title={item.label}
              >
                <Icon className={cn(isMobile ? 'h-6 w-6' : 'h-5 w-5')} />
                
                {/* Badge */}
                {item.badge && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  >
                    <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 p-0 text-xs">
                      {item.badge}
                    </Badge>
                  </motion.div>
                )}

                {/* Active indicator */}
                {isActive && (
                  <motion.div
                    layoutId="dockActiveIndicator"
                    className="absolute inset-0 bg-primary/20 rounded-xl"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}
              </button>

              {/* Tooltip removed - hover effects disabled */}
            </motion.div>
          );
        })}

      </motion.div>

    </motion.div>
  );
}
