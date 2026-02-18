import { Switch, Route } from "wouter";
import "katex/dist/katex.min.css";
import "prismjs/themes/prism.css"; 
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ColorCustomizationProvider } from "@/contexts/ColorCustomizationContext";
import { CalendarProvider } from "@/contexts/CalendarContext";
import { ActivityProvider } from "@/contexts/ActivityContext";
import { HACProvider } from "@/contexts/HACContext";
import { usePersistentData } from "@/hooks/usePersistentData";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { OptimizedDock } from "@/components/OptimizedDock";
import { Sidebar } from "@/components/Sidebar";
import { AppStateProvider, usePreferences } from "@/contexts/AppStateContext";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useColorCustomization } from "@/contexts/ColorCustomizationContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocation } from "wouter";
import { GraduationCap, Moon, Sun, Plus, Palette } from "lucide-react";

// Pages - Lazy loaded for better performance
import Landing from "@/pages/landing";
import AuthPage from "@/pages/auth";
import SignupPage from "@/pages/signup";
import CalendarCallback from "@/pages/calendar-callback";
import PrivacyPolicy from "@/pages/privacy-policy";
import TermsOfService from "@/pages/terms-of-service";
import NotFound from "@/pages/not-found";

// Lazy loaded components
import {
  LazyDashboard,
  LazyCalendar,
  LazyAssignments,
  LazyClasses,
  LazyFiles,
  LazyLearn,
  LazyAiChat,
  LazyAnalytics,
  LazyHabits,
  LazyTodos,
  LazyToDoList,
  LazySettings,
  LazyHACGrades,
  LazyGPACalculator,
  LazyCourseGrades,
} from "@/components/LazyComponents";

import { Suspense, useEffect } from "react";
import { PageLoading } from "@/components/LoadingSpinner";
import { errorReporter } from "@/lib/errorReporting";

function AppNavigation() {
  const { user, userData, signOut, hasGoogleAccess } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [, setLocation] = useLocation();
  const { isRestoring } = usePersistentData();
  const { customization } = useColorCustomization();

  // Initialize error reporter with user context
  useEffect(() => {
    errorReporter.init();
    
    if (user) {
      errorReporter.setUser(user.uid, user.email || undefined);
    }

    return () => {
      if (!user) {
        errorReporter.clearUser();
      }
    };
  }, [user]);

  return (
    <nav className="bg-background/80 backdrop-blur-sm border-b border-border/50 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <img src="../images/alteon-logo.png" alt="Alteon Logo" className="h-5 w-5 object-contain" />
            <span className="text-lg font-medium text-foreground">Alteon</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          {user && (
            <div className="flex items-center space-x-3">
              {/* Gentle Status Indicator */}
              <div className={`flex items-center space-x-1.5 px-2 py-1 rounded-full text-xs ${
                isRestoring 
                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' 
                  : hasGoogleAccess 
                    ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' 
                    : 'bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${
                  isRestoring 
                    ? 'bg-blue-500 animate-pulse' 
                    : hasGoogleAccess 
                      ? 'bg-green-500' 
                      : 'bg-gray-400'
                }`} />
                {isRestoring ? 'Syncing...' : hasGoogleAccess ? 'Connected' : 'Offline'}
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center space-x-2 px-2 hover:bg-muted/50 transition-colors">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={user.photoURL || ""} alt={user.displayName || ""} />
                      <AvatarFallback className="text-xs">
                        {user.displayName?.split(' ').map(n => n[0]).join('') || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-light text-sm">{user.displayName}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => setLocation("/settings")} className="text-sm">
                    Settings
                  </DropdownMenuItem>
                  {!hasGoogleAccess && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-sm text-primary font-medium" onClick={() => setLocation("/auth")}>
                        Connect Google
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut} className="text-sm">
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

function DataRestorationHandler() {
  usePersistentData();
  return null;
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const { preferences } = usePreferences();
  const navigationStyle = preferences.navigationStyle || 'dock';

  return (
    <div className="h-screen flex flex-col">
      <AppNavigation />
      <DataRestorationHandler />
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Navigation (when enabled) */}
        {navigationStyle === 'sidebar' && <Sidebar />}
        
        <main className={`flex-1 p-8 overflow-y-auto bg-background ${navigationStyle === 'dock' ? 'pb-32' : 'pb-8'}`}>
          {children}
        </main>
      </div>
      
      {/* Dock Navigation (when enabled) */}
      {navigationStyle === 'dock' && <OptimizedDock />}
    </div>
  );
}

function Router() {
  const { user, loading } = useAuth();

  if (loading) {
    return <PageLoading message="Initializing Alteon..." />;
  }

  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/signup" component={SignupPage} />
      
      {/* OAuth Callback Routes */}
      <Route path="/auth/calendar/google" component={CalendarCallback} />
      <Route path="/auth/calendar/outlook" component={CalendarCallback} />
      
      {/* Protected Routes - Lazy loaded for better performance */}
      <Route path="/dashboard">
        <ProtectedRoute fallback={<Landing />}>
          <AppLayout>
            <Suspense fallback={<PageLoading message="Loading Dashboard..." />}>
              <LazyDashboard />
            </Suspense>
          </AppLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/calendar">
        <ProtectedRoute fallback={<Landing />}>
          <AppLayout>
            <Suspense fallback={<PageLoading message="Loading Calendar..." />}>
              <LazyCalendar />
            </Suspense>
          </AppLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/assignments">
        <ProtectedRoute fallback={<Landing />}>
          <AppLayout>
            <Suspense fallback={<PageLoading message="Loading Assignments..." />}>
              <LazyAssignments />
            </Suspense>
          </AppLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/classes">
        <ProtectedRoute fallback={<Landing />}>
          <AppLayout>
            <Suspense fallback={<PageLoading message="Loading Classes..." />}>
              <LazyClasses />
            </Suspense>
          </AppLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/files">
        <ProtectedRoute fallback={<Landing />}>
          <AppLayout>
            <Suspense fallback={<PageLoading message="Loading Files..." />}>
              <LazyFiles />
            </Suspense>
          </AppLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/learn">
        <ProtectedRoute fallback={<Landing />}>
          <AppLayout>
            <Suspense fallback={<PageLoading message="Loading Learn..." />}>
              <LazyLearn />
            </Suspense>
          </AppLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/ai-chat">
        <ProtectedRoute fallback={<Landing />}>
          <AppLayout>
            <Suspense fallback={<PageLoading message="Loading AI Chat..." />}>
              <LazyAiChat />
            </Suspense>
          </AppLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/analytics">
        <ProtectedRoute fallback={<Landing />}>
          <AppLayout>
            <Suspense fallback={<PageLoading message="Loading Analytics..." />}>
              <LazyAnalytics />
            </Suspense>
          </AppLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/habits">
        <ProtectedRoute fallback={<Landing />}>
          <AppLayout>
            <Suspense fallback={<PageLoading message="Loading Habits..." />}>
              <LazyHabits />
            </Suspense>
          </AppLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/todo-list">
        <ProtectedRoute fallback={<Landing />}>
          <AppLayout>
            <Suspense fallback={<PageLoading message="Loading To-Do Board..." />}>
              <LazyToDoList />
            </Suspense>
          </AppLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/settings">
        <ProtectedRoute fallback={<Landing />}>
          <AppLayout>
            <Suspense fallback={<PageLoading message="Loading Settings..." />}>
              <LazySettings />
            </Suspense>
          </AppLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/hac-grades">
        <ProtectedRoute fallback={<Landing />}>
          <AppLayout>
            <Suspense fallback={<PageLoading message="Loading HAC Grades..." />}>
              <LazyHACGrades />
            </Suspense>
          </AppLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/gpa-calculator">
        <ProtectedRoute fallback={<Landing />}>
          <AppLayout>
            <Suspense fallback={<PageLoading message="Loading GPA Calculator..." />}>
              <LazyGPACalculator />
            </Suspense>
          </AppLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/course-grades/:courseId">
        <ProtectedRoute fallback={<Landing />}>
          <AppLayout>
            <Suspense fallback={<PageLoading message="Loading Course..." />}>
              <LazyCourseGrades />
            </Suspense>
          </AppLayout>
        </ProtectedRoute>
      </Route>
      
      {/* Legal Pages - Public access */}
      <Route path="/privacy-policy" component={PrivacyPolicy} />
      <Route path="/terms-of-service" component={TermsOfService} />
      
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppStateProvider>
        <ThemeProvider>
          <ColorCustomizationProvider>
            <AuthProvider>
              <HACProvider>
                <ActivityProvider>
                  <CalendarProvider>
                    <TooltipProvider>
                      <Toaster />
                      <Router />
                    </TooltipProvider>
                  </CalendarProvider>
                </ActivityProvider>
              </HACProvider>
            </AuthProvider>
          </ColorCustomizationProvider>
        </ThemeProvider>
      </AppStateProvider>
    </QueryClientProvider>
  );
}

export default App;
