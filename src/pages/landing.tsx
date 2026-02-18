import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";

export default function Landing() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    if (user) {
      setLocation("/dashboard");
    }
  }, [user, setLocation]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleSignIn = () => {
    setLocation("/auth");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? "bg-background/95 backdrop-blur-sm" : "bg-transparent"
      }`}>
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <img src="../images/alteon-logo.png" alt="Alteon Logo" className="h-8 w-8 object-contain" />
              <span className="text-2xl font-medium tracking-wide">Alteon</span>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-muted-foreground hover:text-foreground transition-all duration-200 link-hover">Features</a>
              <button 
                onClick={handleSignIn}
                className="bg-foreground text-background px-4 py-1.5 rounded-md text-sm font-medium hover:bg-foreground/90 transition-all duration-200 btn-hover"
              >
                Sign In
              </button>
            </div>
            {/* Mobile menu button */}
            <button className="md:hidden">
              <div className="w-6 h-0.5 bg-black mb-1"></div>
              <div className="w-6 h-0.5 bg-black mb-1"></div>
              <div className="w-6 h-0.5 bg-black"></div>
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="min-h-screen flex items-center justify-center px-6 relative overflow-hidden">
        
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="space-y-12 animate-fade-in">
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-normal tracking-tight leading-none">
              Study<br />
              <span className="relative">
                Smarter
              </span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto leading-relaxed">
              AI-powered productivity tools for academic excellence
            </p>
            
            <button 
              onClick={handleSignIn}
              className="group inline-flex items-center bg-foreground text-background px-6 py-3 text-base font-medium rounded-md hover:bg-foreground/90 transition-all duration-200 btn-hover"
            >
              Get Started
              <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-normal mb-4 tracking-tight">Everything you need</h2>
            <p className="text-lg text-muted-foreground">Simple tools, powerful results</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-12">
            {[
              { label: "AI Summaries" },
              { label: "Smart Calendar" },
              { label: "Task Manager" },
              { label: "Analytics" },
              { label: "Flashcards" },
              { label: "Pomodoro Timer" },
              { label: "Mood Tracker" },
              { label: "Google Sync" }
            ].map((feature, index) => (
              <div 
                key={index} 
                className="text-center space-y-3 opacity-0 animate-slide-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="w-10 h-10 bg-muted rounded-md mx-auto"></div>
                <p className="text-base font-normal">{feature.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="p-8">
            <p className="text-xl md:text-2xl text-foreground mb-6 font-normal leading-relaxed">
              "Alteon transformed how I manage my coursework. My productivity increased by 300%."
            </p>
            <div className="space-y-1">
              <p className="text-lg font-medium">Sarah Chen</p>
              <p className="text-base text-muted-foreground">Computer Science, Stanford</p>
            </div>
          </div>
        </div>
      </section>

      {/* Used By Section */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-base text-muted-foreground">Used by 10,000+ students worldwide</p>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-normal mb-6 tracking-tight">Ready to start?</h2>
          <p className="text-lg text-muted-foreground mb-8">Join thousands of students already using Alteon</p>
          <button 
            onClick={handleSignIn}
            className="group inline-flex items-center bg-foreground text-background px-6 py-3 text-base font-medium rounded-md hover:bg-foreground/90 transition-all duration-200 btn-hover"
          >
            Get Started Free
            <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-6 md:space-y-0">
            <div className="text-lg font-medium">Alteon</div>
            <div className="flex space-x-6">
              <a href="#" className="text-muted-foreground hover:text-foreground transition-all duration-200 link-hover text-sm">Privacy</a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-all duration-200 link-hover text-sm">Terms</a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-all duration-200 link-hover text-sm">Support</a>
            </div>
          </div>
          <div className="mt-6 text-center text-muted-foreground">
            <p className="text-xs">&copy; 2025 Alteon. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
