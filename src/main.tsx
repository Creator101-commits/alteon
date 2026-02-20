import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";

// Web Vitals monitoring for performance tracking
// Reports Core Web Vitals: CLS, INP (replaced FID), FCP, LCP, TTFB
const reportWebVitals = async () => {
  if (import.meta.env.PROD) {
    const { onCLS, onFCP, onINP, onLCP, onTTFB } = await import('web-vitals');
    
    const logVital = (metric: { name: string; value: number; rating: string }) => {
      // Log to console in a compact format
      console.log(`[Vitals] ${metric.name}: ${Math.round(metric.value)}ms (${metric.rating})`);
      
      // You can send to analytics here:
      // analytics.track('web_vital', metric);
    };
    
    onCLS(logVital);
    onFCP(logVital);
    onINP(logVital); // INP replaced FID in web-vitals v4
    onLCP(logVital);
    onTTFB(logVital);
  }
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

// Initialize web vitals reporting
reportWebVitals();
