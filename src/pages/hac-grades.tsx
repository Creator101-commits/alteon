/**
 * HAC Grades Page
 * Displays grades from Home Access Center
 * 
 * Uses server-provided availableCycles from the scraper, with automatic
 * cycle switching via PostBack and prefetch cache for instant tab switching.
 */

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useHAC } from '@/contexts/HACContext';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  GraduationCap, 
  RefreshCw, 
  Loader2, 
  AlertCircle,
  Settings,
  Calculator
} from 'lucide-react';

export default function HACGrades() {
  const { 
    isConnected, 
    isLoading, 
    gradesData, 
    reportCard,
    refreshGrades, 
    fetchReportCard,
    fetchGradesForCycle,
    availableCycles,
    cycleGradesCache,
    isPrefetching,
    error 
  } = useHAC();
  const [, setLocation] = useLocation();
  const [selectedCycleValue, setSelectedCycleValue] = useState<string>('');
  const [loadingCycle, setLoadingCycle] = useState(false);
  const [cycleData, setCycleData] = useState<typeof gradesData>(null);

  // Fetch report card on mount for past cycle summary data
  useEffect(() => {
    if (isConnected && !reportCard) {
      fetchReportCard();
    }
  }, [isConnected, reportCard, fetchReportCard]);

  // Current cycle value from server response
  const currentCycleValue = useMemo(() => {
    return gradesData?.currentCycle || '';
  }, [gradesData]);

  // Set default selected cycle to the server's current cycle
  useEffect(() => {
    if (currentCycleValue && !selectedCycleValue) {
      setSelectedCycleValue(currentCycleValue);
    }
  }, [currentCycleValue, selectedCycleValue]);

  // When user selects a different cycle tab, fetch data (from prefetch cache or server)
  const handleCycleSelect = useCallback(async (cycleValue: string) => {
    setSelectedCycleValue(cycleValue);
    
    // If it's the current/default cycle, use gradesData directly
    if (cycleValue === currentCycleValue) {
      setCycleData(null); // null = use gradesData
      return;
    }
    
    // Check cache first (instant if prefetched)
    const cached = cycleGradesCache.get(cycleValue);
    if (cached) {
      setCycleData(cached);
      return;
    }
    
    // Fetch from server
    setLoadingCycle(true);
    try {
      const data = await fetchGradesForCycle(cycleValue);
      setCycleData(data);
    } finally {
      setLoadingCycle(false);
    }
  }, [currentCycleValue, cycleGradesCache, fetchGradesForCycle]);

  // The active data for the selected cycle tab
  const activeGrades = useMemo(() => {
    if (selectedCycleValue === currentCycleValue || !selectedCycleValue) {
      return gradesData;
    }
    // Check cache (may have been prefetched after initial render)
    return cycleData || cycleGradesCache.get(selectedCycleValue) || null;
  }, [selectedCycleValue, currentCycleValue, gradesData, cycleData, cycleGradesCache]);

  // Redirect to settings if not connected
  useEffect(() => {
    if (!isConnected && !isLoading) {
      const timer = setTimeout(() => {
        if (!isConnected) {
          setLocation('/settings');
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isConnected, isLoading, setLocation]);

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto py-8 px-6">
          <Card className="border-dashed">
            <CardHeader className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4 mx-auto">
                <GraduationCap className="w-8 h-8 text-muted-foreground" />
              </div>
              <CardTitle className="text-xl">HAC Not Connected</CardTitle>
              <CardDescription className="max-w-md mx-auto">
                Connect your Home Access Center account in settings to view your grades.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center pb-12">
              <Button onClick={() => setLocation('/settings')}>
                <Settings className="h-4 w-4 mr-2" />
                Go to Settings
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-4xl mx-auto py-8 px-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-foreground mb-1">
              HAC Grades
            </h1>
            <p className="text-sm text-muted-foreground">
              Your grades from Home Access Center
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline"
              onClick={() => setLocation('/gpa-calculator')}
            >
              <Calculator className="h-4 w-4 mr-2" />
              GPA Calculator
            </Button>
            <Button 
              variant="outline" 
              onClick={() => refreshGrades()}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Refresh
            </Button>
          </div>
        </div>

        {error && (
          <Card className="mb-6 border-destructive">
            <CardContent className="py-4">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cycle Tabs - use server-provided availableCycles, fallback to current only */}
        {availableCycles.length > 0 ? (
          <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-2">
            {availableCycles.map((cycle) => {
              const isSelected = selectedCycleValue === cycle.value;
              const isCurrent = cycle.value === currentCycleValue;
              const hasCachedData = cycleGradesCache.has(cycle.value);
              
              return (
                <button
                  key={cycle.value}
                  onClick={() => handleCycleSelect(cycle.value)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                    isSelected
                      ? 'bg-primary text-primary-foreground'
                      : hasCachedData || isCurrent
                        ? 'bg-muted hover:bg-muted/80 text-muted-foreground'
                        : 'bg-muted/40 hover:bg-muted/50 text-muted-foreground/50'
                  }`}
                >
                  {cycle.text}
                  {isCurrent && !isSelected && (
                    <span className="ml-1 text-xs opacity-70">●</span>
                  )}
                </button>
              );
            })}
            {isPrefetching && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground ml-2 flex-shrink-0" />
            )}
          </div>
        ) : gradesData ? (
          <div className="flex items-center gap-1 mb-6">
            <button
              className="px-4 py-2 rounded-full text-sm font-medium bg-primary text-primary-foreground"
            >
              Current Cycle
            </button>
          </div>
        ) : null}

        {/* Current Cycle Indicator */}
        {selectedCycleValue && (
          <div className="mb-4 flex items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">
              {availableCycles.find(c => c.value === selectedCycleValue)?.text || 'Grades'}
            </h2>
            {selectedCycleValue === currentCycleValue && (
              <span className="px-2 py-0.5 text-xs font-medium bg-green-500/20 text-green-600 dark:text-green-400 rounded-full">
                Current
              </span>
            )}
            {activeGrades && (
              <span className="px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground rounded-full">
                Avg: {activeGrades.overallAverage.toFixed(2)}
              </span>
            )}
          </div>
        )}

        {/* Course List */}
        <div className="space-y-2">
          {(loadingCycle || (isLoading && !gradesData)) ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Loading grades...</p>
              </CardContent>
            </Card>
          ) : activeGrades && activeGrades.grades.length > 0 ? (
            activeGrades.grades.map((course) => (
              <div
                key={course.courseId}
                onClick={() => setLocation(
                  `/course-grades/${encodeURIComponent(course.courseId)}${
                    selectedCycleValue !== currentCycleValue 
                      ? `?cycle=${encodeURIComponent(selectedCycleValue)}` 
                      : ''
                  }`
                )}
                className="flex items-center justify-between p-4 rounded-lg bg-card border hover:bg-muted/30 transition-colors cursor-pointer"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground">{course.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {course.courseId} • {course.assignments.length} assignment{course.assignments.length !== 1 ? 's' : ''}
                    {course.gpa !== null && ` • GPA: ${course.gpa.toFixed(2)}`}
                  </p>
                </div>
                <div className={`text-xl font-bold px-3 py-1 rounded-lg ${
                  course.numericGrade !== null && course.numericGrade >= 90 
                    ? 'bg-green-500/20 text-green-600 dark:text-green-400' 
                    : course.numericGrade !== null && course.numericGrade >= 80 
                    ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                    : course.numericGrade !== null && course.numericGrade >= 70
                    ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400'
                    : 'bg-red-500/20 text-red-600 dark:text-red-400'
                }`}>
                  {course.grade}
                </div>
              </div>
            ))
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <div className="text-muted-foreground/50">
                  <GraduationCap className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No grades available</p>
                  <p className="text-sm mt-1">Grades will appear here once they are posted.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
