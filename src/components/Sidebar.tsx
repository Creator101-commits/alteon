import { useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useHAC } from "@/contexts/HACContext";
import {
  LayoutDashboard,
  BookOpen,
  GraduationCap,
  Wrench,
  Bot,
  BarChart3,
  FolderOpen,
  School,
  Settings,
  ChevronRight,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  requiresHAC?: boolean;
}

const navigationItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/assignments", label: "Assignments", icon: BookOpen },
  { href: "/classes", label: "Classes", icon: GraduationCap },
  { href: "/files", label: "Files", icon: FolderOpen },
  { href: "/hac-grades", label: "HAC Grades", icon: School, requiresHAC: true },
  { href: "/learn", label: "Learn", icon: Wrench },
  { href: "/ai-chat", label: "AI Chatbot", icon: Bot },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export const Sidebar = () => {
  const [location] = useLocation();
  const { isConnected: hacConnected } = useHAC();
  const [isExpanded, setIsExpanded] = useState(false);

  // Filter items based on conditions
  const visibleItems = navigationItems.filter(item => {
    if (item.requiresHAC && !hacConnected) return false;
    return true;
  });

  return (
    <aside 
      className={cn(
        "bg-background border-r border-border h-full flex flex-col transition-all duration-300 ease-in-out relative group",
        isExpanded ? "w-56" : "w-16"
      )}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {/* Expand indicator */}
      <div className={cn(
        "absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-background border border-border rounded-full flex items-center justify-center shadow-sm transition-all duration-300 opacity-0 group-hover:opacity-100",
        isExpanded && "rotate-180"
      )}>
        <ChevronRight className="h-3 w-3 text-muted-foreground" />
      </div>

      <nav className="space-y-1 flex-1 p-2 pt-4">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href;
          
          return (
            <Link key={item.href} href={item.href}>
              <a
                className={cn(
                  "flex items-center rounded-lg transition-all duration-200 text-sm font-medium relative group/item",
                  isExpanded ? "p-2.5 space-x-3" : "p-3 justify-center",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                title={!isExpanded ? item.label : undefined}
              >
                <Icon className={cn("h-4 w-4 flex-shrink-0", !isExpanded && "h-5 w-5")} />
                <span className={cn(
                  "whitespace-nowrap transition-all duration-300",
                  isExpanded ? "opacity-100 w-auto" : "opacity-0 w-0 overflow-hidden"
                )}>
                  {item.label}
                </span>
                
                {/* Tooltip for collapsed state */}
                {!isExpanded && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded-md shadow-md opacity-0 group-hover/item:opacity-100 pointer-events-none whitespace-nowrap z-50 border border-border transition-opacity duration-150">
                    {item.label}
                  </div>
                )}
              </a>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
};
