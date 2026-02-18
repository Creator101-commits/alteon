/**
 * Home Access Center (HAC) Web Scraper Types
 * TypeScript interfaces for grades, assignments, courses, and report cards
 */

export interface HACCredentials {
  username: string;
  password: string;
  districtBaseUrl?: string; // e.g., "https://lis-hac.eschoolplus.powerschool.com"
}

export interface HACSession {
  sessionId: string;
  cookies: string;
  expiresAt: Date;
  credentials: HACCredentials;
}

export interface HACAssignment {
  dateDue: string;
  dateAssigned: string;
  name: string;
  category: string;
  score: string;
  /** Parsed numeric earned points from the score column */
  earnedPoints: number | null;
  /** Total possible points for this assignment */
  totalPoints: number | null;
  /** Weight multiplier for this assignment (e.g. 1.00) */
  weight: number | null;
  /** Calculated percentage: (earnedPoints / totalPoints) * 100 */
  percentage: number | null;
}

export interface HACCourse {
  courseId: string;
  name: string;
  courseCode?: string;
  period?: string;
  teacher?: string;
  room?: string;
  grade: string;
  numericGrade: number | null;
  gpa: number | null;
  assignments: HACAssignment[];
}

/** A cycle option available in the HAC dropdown */
export interface HACCycleOption {
  text: string;
  value: string;
}

export interface HACReportCardCourse {
  course: string;
  courseCode: string;
  grade: number;
  numericGrade: number;
  gpa: number;
}

export interface HACReportCardCycle {
  cycleName: string;
  courses: HACReportCardCourse[];
  averageGpa: number;
}

export interface HACReportCard {
  cycles: HACReportCardCycle[];
  overallGpa: number;
}

export interface HACGradesResponse {
  grades: HACCourse[];
  overallAverage: number;
  highlightedCourse: HACCourse | null;
  /** Available grading cycles from the HAC dropdown */
  availableCycles: HACCycleOption[];
  /** The currently selected cycle value */
  currentCycle: string | null;
}

export interface HACLoginResponse {
  success: boolean;
  sessionId: string;
  message?: string;
  error?: string;
}

export interface HACGPACalculation {
  cumulativeGpa: number;
  currentCoursesCount: number;
  pastCyclesCount: number;
  pastCyclesDetail: {
    cycleName: string;
    courses: { courseName: string; grade: number; gpa: number }[];
    averageGpa: number;
  }[];
}

// GPA calculation types — includes dual credit and pre-AP
export type CourseLevel = 'regular' | 'advanced' | 'ap' | 'dual' | 'preap';

export interface GPAScale {
  regular: number;   // 5.0
  advanced: number;  // 5.5
  ap: number;        // 6.0
  dual: number;      // 6.0
  preap: number;     // 5.5
}

// Default HAC base URL (can be overridden)
export const DEFAULT_HAC_BASE_URL = "https://lis-hac.eschoolplus.powerschool.com";

// HAC endpoints
export const HAC_ENDPOINTS = {
  LOGIN: "/HomeAccess/Account/LogOn",
  ASSIGNMENTS: "/HomeAccess/Content/Student/Assignments.aspx",
  REPORT_CARDS: "/HomeAccess/Content/Student/ReportCards.aspx",
  TRANSCRIPT: "/HomeAccess/Content/Student/Transcript.aspx",
  ATTENDANCE: "/HomeAccess/Content/Student/Attendance.aspx",
  SCHEDULE: "/HomeAccess/Content/Student/Classes.aspx",
} as const;
