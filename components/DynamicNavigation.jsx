import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Search, ChevronRight, Home } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const DynamicNavigation = ({ categories = [] }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  // Generate simple breadcrumbs from URL
  const pathnames = location.pathname.split('/').filter(x => x);
  
  return (
    <div className="w-full bg-card border-b border-border py-4 px-4 sm:px-6 lg:px-8 shadow-sm mb-8 z-10 relative">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-4 items-center justify-between">
        
        {/* Breadcrumbs */}
        <nav className="flex items-center text-sm font-medium text-muted-foreground w-full md:w-auto overflow-x-auto whitespace-nowrap scrollbar-hide">
          <Link to="/" className="hover:text-primary transition-colors flex items-center gap-1">
            <Home className="w-4 h-4" />
          </Link>
          {pathnames.map((name, index) => {
            const routeTo = `/${pathnames.slice(0, index + 1).join('/')}`;
            const isLast = index === pathnames.length - 1;
            return (
              <React.Fragment key={name}>
                <ChevronRight className="w-4 h-4 mx-1 flex-shrink-0" />
                {isLast ? (
                  <span className="text-foreground capitalize">{decodeURIComponent(name).replace(/-/g, ' ')}</span>
                ) : (
                  <Link to={routeTo} className="hover:text-primary transition-colors capitalize">
                    {decodeURIComponent(name).replace(/-/g, ' ')}
                  </Link>
                )}
              </React.Fragment>
            );
          })}
        </nav>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="relative w-full md:w-96 flex-shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            type="search" 
            placeholder="Search products, categories..." 
            className="w-full pl-9 pr-20 bg-background border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-primary h-10 rounded-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Button 
            type="submit" 
            size="sm" 
            className="absolute right-1 top-1 bottom-1 h-8 rounded-full px-4"
          >
            Search
          </Button>
        </form>

      </div>
    </div>
  );
};

export default DynamicNavigation;