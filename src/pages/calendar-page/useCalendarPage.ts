/**
 * Custom hook encapsulating calendar page state, navigation, and event helpers.
 */
import { useState } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  getHours,
  getMinutes,
  differenceInMinutes,
} from 'date-fns';
import { useCalendar, CalendarEvent } from '@/contexts/CalendarContext';
import { useActivity } from '@/contexts/ActivityContext';
import { useSmartScheduling } from '@/hooks/useSmartScheduling';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Calendar as CalendarIcon } from 'lucide-react';

import {
  type ViewMode,
  type NewEventData,
  EMPTY_EVENT,
  HOUR_HEIGHT,
  START_HOUR,
  getColorForType,
} from './types';

export function useCalendarPage() {
  const { user } = useAuth();
  const { events, addEvent, getEventsForDate, isLoading: isCalendarLoading } = useCalendar();
  const { addActivity } = useActivity();
  const { generateOptimalSchedule, saveScheduleToCalendar } = useSmartScheduling();
  const { toast } = useToast();

  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [newEvent, setNewEvent] = useState<NewEventData>({ ...EMPTY_EVENT });

  // ── Event helpers ─────────────────────────────────────────────────────────

  const getAllEvents = (): CalendarEvent[] => events;

  const getAllEventsForDate = (date: Date): CalendarEvent[] => {
    return getAllEvents().filter((event) => {
      const eventDate = event.startTime;
      return eventDate && isSameDay(new Date(eventDate), date);
    });
  };

  const getEventsForDayInWeek = (day: Date) =>
    getAllEventsForDate(day).filter((event) => !event.isAllDay);

  const getAllDayEventsForDay = (day: Date) =>
    getAllEventsForDate(day).filter((event) => event.isAllDay);

  // ── Calendar grid helpers ─────────────────────────────────────────────────

  const getWeekDays = () => {
    const start = startOfWeek(currentDate, { weekStartsOn: 0 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  };

  const getCalendarDays = () => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  };

  const getEventStyle = (event: CalendarEvent) => {
    const startTime = new Date(event.startTime);
    const endTime = new Date(event.endTime);
    const startHour = getHours(startTime);
    const startMinute = getMinutes(startTime);
    const durationMinutes = differenceInMinutes(endTime, startTime);

    const topOffset =
      (startHour - START_HOUR) * HOUR_HEIGHT + (startMinute / 60) * HOUR_HEIGHT;
    const height = (durationMinutes / 60) * HOUR_HEIGHT;

    return {
      top: `${topOffset}px`,
      height: `${Math.max(height, 20)}px`,
    };
  };

  // ── Navigation ────────────────────────────────────────────────────────────

  const goToPrevious = () => {
    if (viewMode === 'month') setCurrentDate(subMonths(currentDate, 1));
    else if (viewMode === 'week') setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(subDays(currentDate, 1));
  };

  const goToNext = () => {
    if (viewMode === 'month') setCurrentDate(addMonths(currentDate, 1));
    else if (viewMode === 'week') setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, 1));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  const getHeaderTitle = () => {
    if (viewMode === 'month') return format(currentDate, 'MMMM yyyy');
    if (viewMode === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 });
      const end = endOfWeek(currentDate, { weekStartsOn: 0 });
      if (start.getMonth() === end.getMonth()) return format(start, 'MMMM yyyy');
      return `${format(start, 'MMM')} - ${format(end, 'MMM yyyy')}`;
    }
    return format(currentDate, 'EEEE, MMMM d, yyyy');
  };

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleAddEvent = async () => {
    if (!newEvent.title || !newEvent.startTime) return;

    const startTime = newEvent.startTime;
    const endTime = newEvent.endTime || new Date(startTime.getTime() + 60 * 60 * 1000);

    let eventId: string | undefined;

    // Save event to Supabase via CalendarContext
    try {
      eventId = await addEvent({
        title: newEvent.title,
        description: newEvent.description,
        startTime,
        endTime,
        type: newEvent.type,
        color: getColorForType(newEvent.type),
        location: newEvent.location,
        isAllDay: newEvent.isAllDay,
      });
      toast({ title: 'Event Created', description: 'Event saved successfully' });
    } catch (error) {
      console.error('Failed to create event:', error);
      toast({ title: 'Error', description: 'Failed to save event', variant: 'destructive' });
    }

    if (eventId) {
      addActivity({
        label: `Created event: ${newEvent.title}`,
        icon: CalendarIcon,
        tone: 'text-green-500',
        type: 'calendar',
        relatedId: eventId,
        route: '/calendar',
      });
    }

    setIsEventDialogOpen(false);
    setNewEvent({ ...EMPTY_EVENT });
  };

  // Google Calendar sync disabled
  const handleSync = async () => {
    toast({
      title: 'Sync Unavailable',
      description: 'Google Calendar sync is currently disabled.',
    });
  };

  return {
    // state
    currentDate,
    selectedDate,
    setSelectedDate,
    viewMode,
    setViewMode,
    isEventDialogOpen,
    setIsEventDialogOpen,
    isSyncing,
    isCalendarLoading,
    newEvent,
    setNewEvent,

    // computed
    getHeaderTitle,
    getWeekDays,
    getCalendarDays,
    getAllEventsForDate,
    getEventsForDayInWeek,
    getAllDayEventsForDay,
    getEventStyle,

    // navigation
    goToPrevious,
    goToNext,
    goToToday,

    // actions
    handleAddEvent,
    handleSync,
  };
}
