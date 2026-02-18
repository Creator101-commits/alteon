/**
 * Lazy-loaded components for better performance and smaller initial bundle
 * Uses React.lazy with dynamic imports for code splitting
 */

import { lazy, ComponentType, LazyExoticComponent } from 'react';

// Helper for named exports
const lazyNamed = <T extends ComponentType<any>>(
  factory: () => Promise<{ [key: string]: T }>,
  name: string
): LazyExoticComponent<T> => lazy(() => factory().then(m => ({ default: m[name] as T })));

// ============================================
// PAGE COMPONENTS - Lazy loaded routes
// ============================================
export const LazyDashboard = lazy(() => import('@/pages/dashboard'));
export const LazyCalendar = lazy(() => import('@/pages/calendar'));
export const LazyAssignments = lazy(() => import('@/pages/assignments'));
export const LazyClasses = lazy(() => import('@/pages/classes'));
export const LazyFiles = lazy(() => import('@/pages/files'));
export const LazyLearn = lazy(() => import('@/pages/learn'));
export const LazyAiChat = lazy(() => import('@/pages/ai-chat'));
export const LazyAnalytics = lazy(() => import('@/pages/analytics'));
export const LazyHabits = lazy(() => import('@/pages/habits'));
export const LazyTodos = lazy(() => import('@/pages/todos'));
export const LazyToDoList = lazy(() => import('@/components/tools/ToDoList').then(m => ({ default: m.ToDoList })));
export const LazySettings = lazy(() => import('@/pages/settings'));
export const LazyHACGrades = lazy(() => import('@/pages/hac-grades'));
export const LazyGPACalculator = lazy(() => import('@/pages/gpa-calculator'));
export const LazyCourseGrades = lazy(() => import('@/pages/course-grades'));

// ============================================
// HEAVY UI COMPONENTS - Large bundle impact
// ============================================

// Charts (Recharts ~400KB)
export const LazyAnalyticsCharts = lazy(() => import('@/components/charts/AnalyticsCharts').then(m => ({ default: m.AnalyticsCharts })));

// Note Editor (Tiptap ~300KB)
export const LazyNoteEditor = lazy(() => import('@/components/NoteEditor'));

// Flashcards and Deck Management
export const LazyFlashcards = lazy(() => import('@/components/tools/Flashcards'));
export const LazyDeckManager = lazy(() => import('@/components/tools/DeckManager'));

// Study Tools
export const LazyPomodoroTimer = lazy(() => import('@/components/tools/PomodoroTimer').then(m => ({ default: m.PomodoroTimer })));
export const LazyMoodTracker = lazy(() => import('@/components/tools/MoodTracker').then(m => ({ default: m.MoodTracker })));
export const LazyDailyJournal = lazy(() => import('@/components/tools/DailyJournal').then(m => ({ default: m.DailyJournal })));
export const LazyAiSummaryHistory = lazy(() => import('@/components/tools/AiSummaryHistory').then(m => ({ default: m.AiSummaryHistory })));

// ============================================
// SETTINGS COMPONENTS
// ============================================
export const LazyGoogleSyncSettings = lazy(() => import('@/components/GoogleSyncSettings').then(m => ({ default: m.GoogleSyncSettings })));
export const LazyColorCustomizationSettings = lazy(() => import('@/components/ColorCustomizationSettings').then(m => ({ default: m.ColorCustomizationSettings })));
export const LazyPrivacyControls = lazy(() => import('@/components/PrivacyControls').then(m => ({ default: m.PrivacyControls })));

// ============================================
// HEAVY VISUALIZATION LIBRARIES
// Mermaid (~1.5MB), PDF.js (~500KB)
// Only imported when actually needed
// ============================================

// Mermaid diagrams - only on AI chat when rendering diagrams
export const LazyMermaidRenderer = lazy(() => 
  import('mermaid').then(mermaid => {
    // Initialize mermaid with secure defaults
    mermaid.default.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'neutral',
    });
    // Return a simple component wrapper
    return {
      default: ({ chart, id }: { chart: string; id: string }) => {
        const render = async () => {
          try {
            const { svg } = await mermaid.default.render(id, chart);
            return svg;
          } catch {
            return '<p>Failed to render diagram</p>';
          }
        };
        return null; // Placeholder - actual implementation in component
      }
    };
  })
);

// ============================================
// DATE PICKER (heavy calendar component)
// ============================================
export const LazyDateTimePicker = lazy(() => 
  import('@/components/ui/date-time-picker').then(m => ({ default: m.DateTimePicker }))
);
