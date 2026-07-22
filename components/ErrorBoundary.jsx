import React from 'react';
import { AlertCircle, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, resetKey: props.resetKey };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  // Reset error state when the route changes (resetKey prop changes)
  static getDerivedStateFromProps(props, state) {
    if (state.hasError && props.resetKey !== undefined && props.resetKey !== state.resetKey) {
      return { hasError: false, error: null, resetKey: props.resetKey };
    }
    if (props.resetKey !== state.resetKey) {
      return { resetKey: props.resetKey };
    }
    return null;
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // A `fallback` prop (including `null`) lets a caller opt out of the
      // full-screen error card — used to isolate a single list item (e.g. one
      // malformed card in a grid) so its crash drops just that item instead of
      // blanking the whole page via a route-level boundary.
      if (this.props.fallback !== undefined) {
        return this.props.fallback;
      }
      return (
        <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 bg-background">
          <div className="bg-card rounded-2xl p-8 max-w-md w-full text-center border border-border shadow-lg">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <h2 className="text-2xl font-serif font-bold mb-3 text-foreground">Something went wrong</h2>
            <p className="text-muted-foreground mb-8 text-base leading-relaxed">
              We encountered an unexpected issue while loading this section. Please try refreshing the page.
            </p>
            <Button 
              onClick={() => window.location.reload()} 
              size="lg"
              className="w-full font-bold tracking-wide rounded-xl shadow-sm transition-all active:scale-[0.98]"
            >
              <RefreshCcw className="w-4 h-4 mr-2" />
              Refresh Page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;