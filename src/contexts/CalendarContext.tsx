import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { storage } from "@/lib/supabase-storage";
import type { CalendarEvent as CalendarEventDB } from "@shared/schema";

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  type: "assignment" | "event" | "class" | "personal";
  color: string;
  location?: string;
  attendees?: string[];
  isAllDay?: boolean;
  assignmentId?: string;
}

interface CalendarContextType {
  events: CalendarEvent[];
  isLoading: boolean;
  addEvent: (event: Omit<CalendarEvent, "id">) => Promise<string>;
  updateEvent: (id: string, event: Partial<CalendarEvent>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  getEventsForDate: (date: Date) => CalendarEvent[];
  addAssignmentToCalendar: (assignment: any) => Promise<void>;
  refreshEvents: () => Promise<void>;
}

const CalendarContext = createContext<CalendarContextType | undefined>(undefined);

export const useCalendar = () => {
  const context = useContext(CalendarContext);
  if (!context) {
    throw new Error("useCalendar must be used within a CalendarProvider");
  }
  return context;
};

/** Map Supabase row → local CalendarEvent shape */
function dbToLocal(row: CalendarEventDB): CalendarEvent {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    startTime: row.startTime instanceof Date ? row.startTime : new Date(row.startTime as any),
    endTime: row.endTime instanceof Date ? row.endTime : new Date(row.endTime as any),
    type: (row.type as CalendarEvent["type"]) ?? "event",
    color: row.color ?? "bg-blue-500",
    location: row.location ?? undefined,
    isAllDay: row.isAllDay ?? false,
    assignmentId: row.assignmentId ?? undefined,
  };
}

export const CalendarProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch all events from Supabase when user changes
  const refreshEvents = useCallback(async () => {
    if (!user?.uid) {
      setEvents([]);
      return;
    }
    setIsLoading(true);
    try {
      const rows = await storage.getCalendarEventsByUserId(user.uid);
      setEvents(rows.map(dbToLocal));
    } catch (err) {
      console.error("Failed to load calendar events:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    refreshEvents();
  }, [refreshEvents]);

  const addEvent = async (event: Omit<CalendarEvent, "id">): Promise<string> => {
    if (!user?.uid) throw new Error("Not authenticated");

    const created = await storage.createCalendarEvent({
      userId: user.uid,
      title: event.title,
      description: event.description ?? null,
      startTime: event.startTime,
      endTime: event.endTime,
      type: event.type ?? "event",
      color: event.color ?? "bg-blue-500",
      location: event.location ?? null,
      isAllDay: event.isAllDay ?? false,
      assignmentId: event.assignmentId ?? null,
    });

    setEvents((prev) => [...prev, dbToLocal(created)]);
    return created.id;
  };

  const updateEvent = async (id: string, eventUpdate: Partial<CalendarEvent>) => {
    const updated = await storage.updateCalendarEvent(id, {
      ...(eventUpdate.title !== undefined && { title: eventUpdate.title }),
      ...(eventUpdate.description !== undefined && { description: eventUpdate.description ?? null }),
      ...(eventUpdate.startTime !== undefined && { startTime: eventUpdate.startTime }),
      ...(eventUpdate.endTime !== undefined && { endTime: eventUpdate.endTime }),
      ...(eventUpdate.type !== undefined && { type: eventUpdate.type }),
      ...(eventUpdate.color !== undefined && { color: eventUpdate.color }),
      ...(eventUpdate.location !== undefined && { location: eventUpdate.location ?? null }),
      ...(eventUpdate.isAllDay !== undefined && { isAllDay: eventUpdate.isAllDay }),
      ...(eventUpdate.assignmentId !== undefined && { assignmentId: eventUpdate.assignmentId ?? null }),
    });

    if (updated) {
      setEvents((prev) =>
        prev.map((e) => (e.id === id ? dbToLocal(updated) : e)),
      );
    }
  };

  const deleteEvent = async (id: string) => {
    const success = await storage.deleteCalendarEvent(id);
    if (success) {
      setEvents((prev) => prev.filter((e) => e.id !== id));
    }
  };

  const getEventsForDate = (date: Date): CalendarEvent[] => {
    return events.filter((event) => {
      const eventDate = new Date(event.startTime);
      return (
        eventDate.getFullYear() === date.getFullYear() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getDate() === date.getDate()
      );
    });
  };

  const addAssignmentToCalendar = async (assignment: any) => {
    if (!user?.uid) return;

    const existingEvent = events.find((event) => event.assignmentId === assignment.id);
    if (existingEvent) return;

    const dueTime = new Date(assignment.dueDate);
    await addEvent({
      title: `📝 ${assignment.title}`,
      description: `Assignment due for ${assignment.className}\n\n${assignment.description || ""}`,
      startTime: dueTime,
      endTime: new Date(dueTime.getTime() + 60 * 60 * 1000),
      type: "assignment",
      color: assignment.classColor || "bg-red-500",
      assignmentId: assignment.id,
    });
  };

  return (
    <CalendarContext.Provider
      value={{
        events,
        isLoading,
        addEvent,
        updateEvent,
        deleteEvent,
        getEventsForDate,
        addAssignmentToCalendar,
        refreshEvents,
      }}
    >
      {children}
    </CalendarContext.Provider>
  );
};
