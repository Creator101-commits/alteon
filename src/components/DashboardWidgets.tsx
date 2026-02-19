import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardAnalytics } from "@/hooks/useDashboardData";
import { useLocation } from "wouter";
import {
  Calendar,
  CheckSquare,
  Target,
  StickyNote,
  Timer,
  BarChart3,
  Book,
  ArrowRight,
  Clock,
  TrendingUp,
  Brain,
  FileText,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Loader2,
} from "lucide-react";

// Widget Loading Spinner Component - centered spinner with pulsing background
const WidgetLoadingSpinner: React.FC<{ message?: string }> = ({ message = "Loading..." }) => {
  return (
    <div className="flex flex-col items-center justify-center py-8 space-y-3">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
        <Loader2 className="h-8 w-8 text-primary animate-spin relative z-10" />
      </div>
      <p className="text-xs text-muted-foreground animate-pulse">{message}</p>
    </div>
  );
};

// Widget Loading Skeleton Component
const WidgetSkeleton: React.FC<{ type?: 'stats' | 'list' | 'progress' | 'grid' }> = ({ type = 'stats' }) => {
  if (type === 'stats') {
    return (
      <div className="space-y-4">
        <div className="text-center space-y-2">
          <Skeleton className="h-8 w-16 mx-auto" />
          <Skeleton className="h-3 w-20 mx-auto" />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-8" />
          </div>
          <div className="flex justify-between items-center">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-8" />
          </div>
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
    );
  }

  if (type === 'list') {
    return (
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-6 w-16 rounded" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-muted/30">
            <Skeleton className="h-4 w-4 rounded-full mt-0.5 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'progress') {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-6 w-14 rounded" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <Skeleton className="h-3 w-3" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-3 w-12" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  if (type === 'grid') {
    return (
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-6 w-20 rounded" />
        </div>
        <div className="text-center space-y-1">
          <Skeleton className="h-7 w-12 mx-auto" />
          <Skeleton className="h-3 w-24 mx-auto" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-2 rounded-lg bg-muted/30 text-center space-y-1">
              <Skeleton className="h-4 w-8 mx-auto" />
              <Skeleton className="h-3 w-12 mx-auto" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
};

interface DashboardWidget {
  id: string;
  type: 'calendar' | 'assignments' | 'habits' | 'notes' | 'pomodoro' | 'analytics' | 'flashcards';
  title: string;
  size: 'small' | 'medium' | 'large';
  position: { x: number; y: number };
  config?: Record<string, any>;
  isVisible: boolean;
}

interface WidgetProps {
  widget: DashboardWidget;
  onRemove: (widgetId: string) => void;
  onResize: (widgetId: string, newSize: 'small' | 'medium' | 'large') => void;
  children: React.ReactNode;
  data?: any;
}

const getWidgetIcon = (type: string) => {
  switch (type) {
    case 'calendar': return Calendar;
    case 'assignments': return CheckSquare;
    case 'habits': return Target;
    case 'notes': return StickyNote;
    case 'pomodoro': return Timer;
    case 'analytics': return BarChart3;
    case 'flashcards': return Book;
    default: return BarChart3;
  }
};

export const DraggableWidget: React.FC<WidgetProps> = ({ 
  widget, 
  children, 
}) => {
  const getSizeClasses = (size: 'small' | 'medium' | 'large') => {
    switch (size) {
      case 'small':
        return 'col-span-1 row-span-1 min-h-[200px]';
      case 'medium':
        return 'col-span-2 row-span-2 min-h-[300px]';
      case 'large':
        return 'col-span-3 row-span-3 min-h-[400px]';
      default:
        return 'col-span-2 row-span-2 min-h-[300px]';
    }
  };

  return (
    <Card className={`${getSizeClasses(widget.size)} relative`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-foreground">
          {widget.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {children}
      </CardContent>
    </Card>
  );
};

// Pre-built widget components
export const CalendarWidget: React.FC<{ widget: DashboardWidget }> = ({ widget }) => {
  const { analytics, assignments, isLoading } = useDashboardAnalytics();
  const [, setLocation] = useLocation();
  
  if (isLoading) {
    return (
      <DraggableWidget widget={widget} onRemove={() => {}} onResize={() => {}}>
        <WidgetLoadingSpinner message="Loading calendar..." />
      </DraggableWidget>
    );
  }

  // Get upcoming assignments
  const upcomingAssignments = assignments
    .filter((a: any) => a.dueDate && new Date(a.dueDate) > new Date() && a.status !== 'completed')
    .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 3);

  return (
    <DraggableWidget widget={widget} onRemove={() => {}} onResize={() => {}}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Upcoming</span>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setLocation('/calendar')}
            className="h-6 px-2 text-xs"
          >
            View All
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
        
        {upcomingAssignments.length === 0 ? (
          <div className="text-center py-4">
            <Calendar className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No upcoming deadlines</p>
          </div>
        ) : (
          <div className="space-y-2">
            {upcomingAssignments.map((assignment: any) => (
              <div key={assignment.id} className="flex items-start gap-2 text-xs p-2 rounded-lg bg-muted/50">
                <Clock className="h-3 w-3 mt-0.5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground truncate">{assignment.title}</div>
                  <div className="text-muted-foreground">
                    {new Date(assignment.dueDate).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DraggableWidget>
  );
};

export const AssignmentsWidget: React.FC<{ widget: DashboardWidget }> = ({ widget }) => {
  const { analytics, isLoading } = useDashboardAnalytics();
  const [, setLocation] = useLocation();
  
  if (isLoading) {
    return (
      <DraggableWidget widget={widget} onRemove={() => {}} onResize={() => {}}>
        <WidgetLoadingSpinner message="Loading assignments..." />
      </DraggableWidget>
    );
  }

  return (
    <DraggableWidget widget={widget} onRemove={() => {}} onResize={() => {}}>
      <div className="space-y-4">
        <div className="text-center">
          <div className="text-2xl font-semibold text-foreground">{analytics.totalAssignments}</div>
          <div className="text-xs text-muted-foreground">Total</div>
        </div>
        
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Completed</span>
            <span className="text-foreground">{analytics.completedAssignments}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Pending</span>
            <span className="text-foreground">{analytics.pendingAssignments}</span>
          </div>
        </div>
        
        {analytics.totalAssignments > 0 && (
          <div className="pt-2">
            <div className="text-xs text-muted-foreground mb-1">
              {Math.round((analytics.completedAssignments / analytics.totalAssignments) * 100)}% complete
            </div>
            <Progress 
              value={(analytics.completedAssignments / analytics.totalAssignments) * 100} 
              className="h-1"
            />
          </div>
        )}
      </div>
    </DraggableWidget>
  );
};

export const HabitsWidget: React.FC<{ widget: DashboardWidget }> = ({ widget }) => {
  const { analytics, pomodoroSessions, assignments, isLoading } = useDashboardAnalytics();
  const [, setLocation] = useLocation();
  
  if (isLoading) {
    return (
      <DraggableWidget widget={widget} onRemove={() => {}} onResize={() => {}}>
        <WidgetLoadingSpinner message="Loading habits..." />
      </DraggableWidget>
    );
  }

  // Calculate today's study progress (goal: 2 hours = 120 minutes)
  const todayStudyMinutes = pomodoroSessions
    .filter((s: any) => {
      const sessionDate = new Date(s.createdAt);
      const today = new Date();
      return sessionDate.toDateString() === today.toDateString();
    })
    .reduce((total: number, session: any) => total + (session.duration || 0), 0);
  
  const studyGoal = 120; // 2 hours
  const studyProgress = Math.min((todayStudyMinutes / studyGoal) * 100, 100);

  // Calculate assignments completed today
  const today = new Date();
  const todayCompletions = assignments.filter((a: any) => {
    if (a.status !== 'completed' || !a.completedAt) return false;
    const completedDate = new Date(a.completedAt);
    return completedDate.toDateString() === today.toDateString();
  }).length;

  // Calculate total assignments due today
  const assignmentsDueToday = assignments.filter((a: any) => {
    if (!a.dueDate) return false;
    const dueDate = new Date(a.dueDate);
    return dueDate.toDateString() === today.toDateString();
  }).length;

  const assignmentProgress = assignmentsDueToday > 0 
    ? (todayCompletions / assignmentsDueToday) * 100 
    : 0;

  return (
    <DraggableWidget widget={widget} onRemove={() => {}} onResize={() => {}}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Today's Progress</span>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setLocation('/learn')}
            className="h-6 px-2 text-xs"
          >
            Track
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
        
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Study Time
              </span>
              <span className="text-muted-foreground">
                {Math.round(todayStudyMinutes)}m / {studyGoal}m
              </span>
            </div>
            <Progress value={studyProgress} className="h-2" />
          </div>
          
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-foreground flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Assignments Due
              </span>
              <span className="text-muted-foreground">
                {todayCompletions} / {assignmentsDueToday}
              </span>
            </div>
            <Progress value={assignmentProgress} className="h-2" />
          </div>
          
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-foreground flex items-center gap-1">
                <Timer className="h-3 w-3" />
                Study Sessions
              </span>
              <span className="text-muted-foreground">
                {analytics.todaySessions}
              </span>
            </div>
            <Progress value={Math.min(analytics.todaySessions * 25, 100)} className="h-2" />
          </div>
        </div>
      </div>
    </DraggableWidget>
  );
};

export const PomodoroWidget: React.FC<{ widget: DashboardWidget }> = ({ widget }) => {
  const { analytics, isLoading } = useDashboardAnalytics();
  
  if (isLoading) {
    return (
      <DraggableWidget widget={widget} onRemove={() => {}} onResize={() => {}}>
        <WidgetLoadingSpinner message="Loading sessions..." />
      </DraggableWidget>
    );
  }

  const totalStudyTimeHours = Math.round(analytics.totalStudyTime / 60 * 10) / 10;

  return (
    <DraggableWidget widget={widget} onRemove={() => {}} onResize={() => {}}>
      <div className="space-y-4">
        <div className="text-center">
          <div className="text-2xl font-semibold text-foreground">{analytics.todaySessions}</div>
          <div className="text-xs text-muted-foreground">Today's Sessions</div>
        </div>
        
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Study Time</span>
            <span className="text-foreground">{totalStudyTimeHours}h</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Sessions</span>
            <span className="text-foreground">{analytics.totalPomodoroSessions}</span>
          </div>
        </div>
      </div>
    </DraggableWidget>
  );
};

export const AnalyticsWidget: React.FC<{ widget: DashboardWidget }> = ({ widget }) => {
  const { analytics, isLoading } = useDashboardAnalytics();
  const [, setLocation] = useLocation();
  
  if (isLoading) {
    return (
      <DraggableWidget widget={widget} onRemove={() => {}} onResize={() => {}}>
        <WidgetLoadingSpinner message="Loading analytics..." />
      </DraggableWidget>
    );
  }

  const totalStudyTimeHours = Math.round(analytics.totalStudyTime / 60 * 10) / 10;

  return (
    <DraggableWidget widget={widget} onRemove={() => {}} onResize={() => {}}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Productivity</span>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setLocation('/analytics')}
            className="h-6 px-2 text-xs"
          >
            View Details
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
        
        <div className="space-y-3">
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">{analytics.productivityScore}</div>
            <div className="text-xs text-muted-foreground">Productivity Score</div>
          </div>
          
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="text-center p-2 rounded-lg bg-muted/50">
              <div className="font-medium text-foreground">{totalStudyTimeHours}h</div>
              <div className="text-muted-foreground">Study Time</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted/50">
              <div className="font-medium text-foreground">{analytics.totalNotes}</div>
              <div className="text-muted-foreground">Notes</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted/50">
              <div className="font-medium text-foreground">{analytics.completedAssignments}</div>
              <div className="text-muted-foreground">Completed</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted/50">
              <div className="font-medium text-foreground">{analytics.reviewedFlashcards}</div>
              <div className="text-muted-foreground">Reviewed</div>
            </div>
          </div>
        </div>
      </div>
    </DraggableWidget>
  );
};

export const NotesWidget: React.FC<{ widget: DashboardWidget }> = ({ widget }) => {
  const { analytics, notes, isLoading } = useDashboardAnalytics();
  const [, setLocation] = useLocation();
  
  if (isLoading) {
    return (
      <DraggableWidget widget={widget} onRemove={() => {}} onResize={() => {}}>
        <WidgetLoadingSpinner message="Loading notes..." />
      </DraggableWidget>
    );
  }

  // Get recent notes (last 3)
  const recentNotesList = [...notes]
    .sort((a: any, b: any) => {
      const dateA = new Date(a.updatedAt || a.updated_at || a.createdAt || a.created_at).getTime();
      const dateB = new Date(b.updatedAt || b.updated_at || b.createdAt || b.created_at).getTime();
      return dateB - dateA;
    })
    .slice(0, 3);

  // Helper to format note date safely
  const formatNoteDate = (note: any) => {
    const dateStr = note.updatedAt || note.updated_at || note.createdAt || note.created_at;
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <DraggableWidget widget={widget} onRemove={() => {}} onResize={() => {}}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-center flex-1">
            <div className="text-2xl font-semibold text-foreground">{analytics.totalNotes}</div>
            <div className="text-xs text-muted-foreground">Total Notes</div>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setLocation('/files')}
            className="h-6 px-2 text-xs"
          >
            View All
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
        
        {recentNotesList.length === 0 ? (
          <div className="text-center py-4">
            <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No notes yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground mb-1">Recent Notes</div>
            {recentNotesList.map((note: any) => (
              <div 
                key={note.id} 
                className="text-xs p-2 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                onClick={() => setLocation('/files')}
              >
                <div className="font-medium text-foreground truncate">{note.title || 'Untitled'}</div>
                <div className="text-muted-foreground">
                  {formatNoteDate(note)}
                  {note.category && ` • ${note.category}`}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DraggableWidget>
  );
};

export const FlashcardsWidget: React.FC<{ widget: DashboardWidget }> = ({ widget }) => {
  const { analytics, flashcards, isLoading } = useDashboardAnalytics();
  const [, setLocation] = useLocation();
  
  if (isLoading) {
    return (
      <DraggableWidget widget={widget} onRemove={() => {}} onResize={() => {}}>
        <WidgetLoadingSpinner message="Loading flashcards..." />
      </DraggableWidget>
    );
  }

  const reviewProgress = analytics.totalFlashcards > 0 
    ? Math.round((analytics.reviewedFlashcards / analytics.totalFlashcards) * 100)
    : 0;

  // Count cards due for review (cards reviewed more than 1 day ago or never reviewed)
  const dueForReview = flashcards.filter((card: any) => {
    if (!card.lastReviewed) return true;
    const lastReview = new Date(card.lastReviewed);
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    return lastReview < oneDayAgo;
  }).length;

  // Calculate accuracy if cards have been reviewed
  const cardsWithReviews = flashcards.filter((card: any) => 
    (card.correctCount || 0) + (card.incorrectCount || 0) > 0
  );
  
  const accuracy = cardsWithReviews.length > 0
    ? Math.round(
        cardsWithReviews.reduce((sum: number, card: any) => {
          const total = (card.correctCount || 0) + (card.incorrectCount || 0);
          return sum + ((card.correctCount || 0) / total);
        }, 0) / cardsWithReviews.length * 100
      )
    : 0;

  return (
    <DraggableWidget widget={widget} onRemove={() => {}} onResize={() => {}}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-center flex-1">
            <div className="text-2xl font-semibold text-foreground">{analytics.totalFlashcards}</div>
            <div className="text-xs text-muted-foreground">Total Cards</div>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setLocation('/learn')}
            className="h-6 px-2 text-xs"
          >
            Study
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
        
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="text-center p-2 rounded-lg bg-muted/50">
              <div className="font-medium text-foreground">{analytics.reviewedFlashcards}</div>
              <div className="text-muted-foreground">Reviewed</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted/50">
              <div className="font-medium text-foreground">{dueForReview}</div>
              <div className="text-muted-foreground">Due</div>
            </div>
          </div>
          
          {cardsWithReviews.length > 0 && (
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Accuracy</span>
                <span className="text-foreground">{accuracy}%</span>
              </div>
              <Progress value={accuracy} className="h-1" />
            </div>
          )}
        </div>
      </div>
    </DraggableWidget>
  );
};


