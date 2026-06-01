
import React from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import { Link } from 'react-router-dom';
import { FileQuestion, Home, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

const NotFoundPage = () => {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center bg-background font-sans">
      <SEOHead title="Page Not Found | CardPop" description="The page you're looking for doesn't exist. Return to CardPop and continue browsing." />
      
      <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-8 shadow-sm">
        <FileQuestion className="w-12 h-12 text-muted-foreground opacity-50" />
      </div>
      
      <h1 className="text-6xl md:text-8xl font-extrabold font-serif mb-4 text-foreground tracking-tight">
        404
      </h1>
      
      <h2 className="text-2xl md:text-3xl font-bold mb-4 text-foreground">
        Page Not Found
      </h2>
      
      <p className="text-muted-foreground text-lg max-w-md mx-auto mb-10 leading-relaxed text-balance">
        The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
      </p>
      
      <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
        <Button asChild size="lg" className="rounded-xl font-bold px-8 shadow-sm h-14">
          <Link to="/">
            <Home className="w-5 h-5 mr-2" /> 
            Back to Home
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="rounded-xl font-bold px-8 h-14">
          <Link to="/marketplace">
            <Search className="w-5 h-5 mr-2 text-muted-foreground" />
            Explore Marketplace
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFoundPage;
