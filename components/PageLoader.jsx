
import React from 'react';
import { Loader2 } from 'lucide-react';

const PageLoader = () => {
  return (
    <div className="min-h-[calc(100vh-8rem)] flex flex-col items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 animate-in fade-in duration-500">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse"></div>
          <Loader2 className="w-10 h-10 text-primary animate-spin relative z-10" />
        </div>
        <p className="text-muted-foreground font-medium tracking-wide text-sm">Loading content...</p>
      </div>
    </div>
  );
};

export default PageLoader;
