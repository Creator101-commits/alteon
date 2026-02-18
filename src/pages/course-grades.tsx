/**
 * Course Grades Detail Page
 * Shows detailed grades for a specific course
 */

import React, { useMemo, useEffect, useState } from 'react';
import { useLocation, useRoute } from 'wouter';
import { useHAC } from '@/contexts/HACContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  ChevronLeft, 
  Loader2
} from 'lucide-react';

// Circular progress component
function CircularProgress({ value, size = 160 }: { value: number; size?: number }) {
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;
  
  const getColor = (grade: number) => {
    if (grade >= 90) return '#22c55e'; // green
    if (grade >= 80) return '#3b82f6'; // blue
    if (grade >= 70) return '#eab308'; // yellow
    return '#ef4444'; // red
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-muted"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={getColor(value)}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold">{value.toFixed(2)}</span>
        <span className="text-sm text-muted-foreground">Overall</span>
      </div>
    </div>
  );
}

// Category card component
function CategoryCard({ name, value, color }: { name: string; value: number | null; color: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{name}</p>
            <p className="text-2xl font-bold">{value !== null ? value.toFixed(2) : 'N/A'}</p>
          </div>
          <div 
            className="w-4 h-4 rounded-full" 
            style={{ backgroundColor: color }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// Get color for assignment category
function getCategoryColor(category: string): string {
  const colors: { [key: string]: string } = {
    'Major': '#a855f7', // purple
    'Major Grades': '#a855f7',
    'Daily': '#22c55e', // green
    'Daily Grades': '#22c55e',
    'Learning Checks': '#eab308', // yellow
    'Quiz': '#3b82f6', // blue
    'Homework': '#f97316', // orange
    'Test': '#ef4444', // red
    'Project': '#06b6d4', // cyan
  };
  
  // Try to match category
  for (const [key, color] of Object.entries(colors)) {
    if (category.toLowerCase().includes(key.toLowerCase())) {
      return color;
    }
  }
  return '#6b7280'; // default gray
}

// Get score badge color
function getScoreColor(score: string): string {
  if (!score || score === 'N/A' || score === '') {
    return 'bg-muted text-muted-foreground';
  }
  // Remove % symbol and parse
  const scoreStr = score.replace('%', '').trim();
  const numScore = parseFloat(scoreStr);
  if (isNaN(numScore)) return 'bg-muted text-muted-foreground';
  if (numScore >= 90) return 'bg-green-500 text-white';
  if (numScore >= 80) return 'bg-blue-500 text-white';
  if (numScore >= 70) return 'bg-yellow-500 text-white';
  return 'bg-red-500 text-white';
}

// Format score for display — prefer percentage when available
function formatScore(score: string, percentage?: number | null, earnedPoints?: number | null, totalPoints?: number | null): string {
  // If we have earnedPoints and totalPoints, show fraction
  if (earnedPoints !== null && earnedPoints !== undefined && totalPoints !== null && totalPoints !== undefined) {
    return `${earnedPoints}/${totalPoints}`;
  }
  if (!score || score === 'N/A' || score === '') {
    return 'N/A';
  }
  if (score.includes('%')) {
    return score.trim();
  }
  const num = parseFloat(score);
  if (isNaN(num)) return score;
  return num.toFixed(2);
}

export default function CourseGrades() {
  const [, params] = useRoute('/course-grades/:courseId');
  const [, setLocation] = useLocation();
  const { gradesData, isLoading, fetchGradesForCycle, cycleGradesCache } = useHAC();
  
  const courseId = params?.courseId ? decodeURIComponent(params.courseId) : null;
  
  // Get cycle from URL query params
  const [cycleValue, setCycleValue] = useState<string | null>(null);
  const [cycleGrades, setCycleGrades] = useState<typeof gradesData>(null);
  const [loadingCycle, setLoadingCycle] = useState(false);
  
  useEffect(() => {
    // Parse cycle from URL
    const urlParams = new URLSearchParams(window.location.search);
    const cycle = urlParams.get('cycle');
    if (cycle) {
      setCycleValue(cycle);
    }
  }, []);
  
  // Fetch cycle grades if needed
  useEffect(() => {
    const fetchData = async () => {
      if (cycleValue) {
        setLoadingCycle(true);
        try {
          const data = await fetchGradesForCycle(cycleValue);
          setCycleGrades(data);
        } finally {
          setLoadingCycle(false);
        }
      } else {
        // Reset cycle grades if no cycle value
        setCycleGrades(null);
      }
    };
    fetchData();
  }, [cycleValue, fetchGradesForCycle]);
  
  // Determine which data source to use - be explicit
  const dataSource = useMemo(() => {
    if (cycleValue) {
      return cycleGrades;
    }
    return gradesData;
  }, [cycleValue, cycleGrades, gradesData]);
  
  // Find the course - match by courseId first, then by course code in name
  const course = useMemo(() => {
    if (!dataSource || !courseId) return null;
    
    // First try exact courseId match
    let found = dataSource.grades.find(c => c.courseId === courseId);
    
    // If not found and we have a course code, try matching by course code in the name
    if (!found) {
      found = dataSource.grades.find(c => 
        c.name.includes(courseId) || c.courseId.includes(courseId)
      );
    }
    
    return found || null;
  }, [dataSource, courseId]);

  // Calculate category averages using earnedPoints/totalPoints when available
  const categoryAverages = useMemo(() => {
    if (!course) return {};
    
    const categories: { [key: string]: { totalEarned: number; totalPossible: number; simpleTotal: number; simpleCount: number } } = {};
    
    course.assignments.forEach(assignment => {
      const cat = assignment.category || 'Other';
      
      // Filter out invalid categories
      if (!cat || /^[\d.%]+$/.test(cat.trim()) || cat.trim() === '') {
        return;
      }
      
      if (!categories[cat]) {
        categories[cat] = { totalEarned: 0, totalPossible: 0, simpleTotal: 0, simpleCount: 0 };
      }
      
      // Prefer earnedPoints/totalPoints for accuracy
      if (assignment.earnedPoints !== null && assignment.earnedPoints !== undefined && 
          assignment.totalPoints !== null && assignment.totalPoints !== undefined && assignment.totalPoints > 0) {
        categories[cat].totalEarned += assignment.earnedPoints;
        categories[cat].totalPossible += assignment.totalPoints;
      } else if (assignment.score && assignment.score !== 'N/A' && assignment.score !== '') {
        const scoreStr = assignment.score.replace('%', '').trim();
        const score = parseFloat(scoreStr);
        if (!isNaN(score) && score >= 0 && score <= 150) {
          categories[cat].simpleTotal += score;
          categories[cat].simpleCount += 1;
        }
      }
    });
    
    const averages: { [key: string]: number | null } = {};
    for (const [cat, data] of Object.entries(categories)) {
      if (data.totalPossible > 0) {
        // Use points-based average (more accurate)
        const avg = (data.totalEarned / data.totalPossible) * 100;
        if (avg >= 0 && avg <= 150) {
          averages[cat] = avg;
        }
      } else if (data.simpleCount > 0) {
        const avg = data.simpleTotal / data.simpleCount;
        if (avg >= 0 && avg <= 150) {
          averages[cat] = avg;
        }
      }
    }
    
    return averages;
  }, [course]);

  // Show loading only when we're actively fetching and don't have data yet
  const shouldShowLoading = (cycleValue && loadingCycle && !cycleGrades) || 
                           (!cycleValue && isLoading && !gradesData);
  
  if (shouldShowLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto py-8 px-6">
          <Button variant="ghost" onClick={() => setLocation('/hac-grades')}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Card className="mt-8">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Course not found</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="bg-primary text-primary-foreground py-6 px-6">
        <div className="max-w-4xl mx-auto">
          <Button 
            variant="ghost" 
            size="sm"
            className="text-primary-foreground hover:bg-primary-foreground/20 -ml-2 mb-2"
            onClick={() => setLocation('/hac-grades')}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <h1 className="text-2xl font-bold text-center">{course.name}</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto py-6 px-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left side - Overall grade and categories */}
          <div className="space-y-4">
            {/* Circular Grade Display */}
            <Card>
              <CardContent className="p-6 flex justify-center">
                <CircularProgress value={course.numericGrade || 0} />
              </CardContent>
            </Card>

            {/* Category Breakdowns */}
            {Object.keys(categoryAverages).length > 0 && Object.entries(categoryAverages).map(([category, avg]) => {
              // Extra validation - only show valid category names
              if (!category || category.length < 2 || /^\d+\.?\d*%?$/.test(category)) {
                return null;
              }
              return (
                <CategoryCard 
                  key={category}
                  name={category}
                  value={avg}
                  color={getCategoryColor(category)}
                />
              );
            })}
          </div>

          {/* Right side - Assignments list */}
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground text-center mb-4">
                  Tap on a Grade Category to View More Info
                </p>
                
                <div className="space-y-2">
                  {course.assignments.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No assignments yet
                    </p>
                  ) : (
                    course.assignments.map((assignment, idx) => (
                      <div 
                        key={idx}
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        {/* Category color indicator */}
                        <div 
                          className="w-2 h-10 rounded-full flex-shrink-0"
                          style={{ backgroundColor: getCategoryColor(assignment.category) }}
                        />
                        
                        {/* Assignment info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {assignment.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {assignment.dateDue}
                            {assignment.weight !== null && assignment.weight !== undefined && assignment.weight !== 1 && (
                              <span> • Weight: {assignment.weight}</span>
                            )}
                          </p>
                        </div>
                        
                        {/* Score badge — show fraction + percentage */}
                        <div className="flex items-center gap-2">
                          {assignment.percentage !== null && assignment.percentage !== undefined && (
                            <span className="text-xs text-muted-foreground">
                              {assignment.percentage.toFixed(1)}%
                            </span>
                          )}
                          <div className={`px-3 py-1 rounded-md text-sm font-bold ${getScoreColor(assignment.score)}`}>
                            {formatScore(assignment.score, assignment.percentage, assignment.earnedPoints, assignment.totalPoints)}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
