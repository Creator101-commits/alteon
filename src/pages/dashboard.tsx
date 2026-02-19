import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { useCalendar } from '@/contexts/CalendarContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SimpleTodoList } from '@/components/SimpleTodoList';
import { 
  CalendarWidget,
  AssignmentsWidget,
  PomodoroWidget,
  AnalyticsWidget,
  NotesWidget,
  FlashcardsWidget
} from '@/components/DashboardWidgets';
import { 
  Clock, 
  Calendar, 
  BookOpen, 
  Star, 
  Plus, 
  CheckCircle2, 
  Circle, 
  Clock3,
  Pin,
  Database,
  Target,
  TrendingUp,
  FileText,
  Calculator,
  Brain,
  Zap,
  ArrowRight,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Settings,
  Grid3X3,
  Loader2
} from 'lucide-react';

// Clean dashboard - no mock data needed

// Calendar Component
function CalendarComponent() {
  const { events } = useCalendar();
  const [currentDate, setCurrentDate] = useState(new Date());

  // Get calendar events for the current month
  const getEventsForMonth = () => {
    if (!events) return [];
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    
    return events.filter(event => {
      const eventDate = new Date(event.startTime);
      return eventDate.getMonth() === currentMonth && eventDate.getFullYear() === currentYear;
    });
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    
    return days;
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const getEventsForDay = (day: number) => {
    const monthEvents = getEventsForMonth();
    const targetDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    
    return monthEvents.filter(event => {
      const eventDate = new Date(event.startTime);
      return eventDate.getDate() === day;
    });
  };

  const days = getDaysInMonth(currentDate);
  const today = new Date();
  const isCurrentMonth = currentDate.getMonth() === today.getMonth() && 
                        currentDate.getFullYear() === today.getFullYear();

  return (
    <Card 
      className="bg-card border-border cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => window.location.href = '/calendar'}
    >
      <CardHeader className="pb-3 bg-card">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h3>
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigateMonth('prev')}
              className="h-7 w-7 p-0 hover:bg-muted/50"
            >
              <ChevronLeft className="w-3 h-3" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigateMonth('next')}
              className="h-7 w-7 p-0 hover:bg-muted/50"
            >
              <ChevronRight className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="bg-card">
        {/* Calendar Grid */}
        <div className="space-y-1">
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1">
            {dayNames.map(day => (
              <div key={day} className="text-center text-xs text-muted-foreground py-2">
                {day}
              </div>
            ))}
          </div>
          
          {/* Calendar days */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, index) => {
              if (day === null) {
                return <div key={`empty-${index}`} className="h-8" />;
              }
              
              const dayEvents = getEventsForDay(day);
              const isToday = isCurrentMonth && day === today.getDate();
              
              return (
                <div
                  key={`day-${day}`}
                  className={`h-8 flex items-center justify-center rounded cursor-pointer transition-colors ${
                    isToday 
                      ? 'bg-foreground text-background font-semibold' 
                      : 'bg-card text-foreground hover:bg-muted/50'
                  }`}
                >
                  <span className="text-sm">{day}</span>
                  {dayEvents.length > 0 && (
                    <div className="absolute bottom-0.5 w-1 h-1 rounded-full bg-foreground" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Widget type definition
interface DashboardWidget {
  id: string;
  type: 'calendar' | 'assignments' | 'habits' | 'notes' | 'pomodoro' | 'analytics' | 'flashcards';
  title: string;
  size: 'small' | 'medium' | 'large';
  position: { x: number; y: number };
  isVisible: boolean;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update time every minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const renderWidget = (widget: DashboardWidget) => {
    switch (widget.type) {
      case 'calendar':
        return <CalendarWidget widget={widget} />;
      case 'assignments':
        return <AssignmentsWidget widget={widget} />;
      case 'pomodoro':
        return <PomodoroWidget widget={widget} />;
      case 'analytics':
        return <AnalyticsWidget widget={widget} />;
      case 'notes':
        return <NotesWidget widget={widget} />;
      case 'flashcards':
        return <FlashcardsWidget widget={widget} />;
      default:
        return null;
    }
  };

  // Get dynamic greeting based on time
  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 py-8">
        
        {/* Simple Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-medium text-foreground mb-2">
            {getGreeting()}{user?.displayName ? `, ${user.displayName}` : ''}
          </h1>
          <p className="text-sm text-muted-foreground">
            Here's what you have today
          </p>
        </div>

        {/* Simple Widget Grid */}
        <div className="space-y-6">
          {/* Top Row - Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {renderWidget({ id: 'assignments', type: 'assignments', title: 'Assignments', size: 'small', position: { x: 0, y: 0 }, isVisible: true })}
            {renderWidget({ id: 'notes', type: 'notes', title: 'Notes', size: 'small', position: { x: 1, y: 0 }, isVisible: true })}
          </div>

          {/* Calendar */}
          <CalendarComponent />

          {/* Quick Tasks */}
          <SimpleTodoList />
        </div>
      </div>
    </div>
  );
}