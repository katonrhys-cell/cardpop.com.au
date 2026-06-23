import React, { useState, useEffect } from 'react';
import { Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getRecentlyViewed, clearRecentlyViewed } from '@/utils/recentlyViewed.js';
import { useNavigate } from 'react-router-dom';

const RecentlyViewed = ({ className = '' }) => {
  const [recentlyViewed, setRecentlyViewed] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    setRecentlyViewed(getRecentlyViewed());
  }, []);

  const handleClear = () => {
    const cleared = clearRecentlyViewed();
    setRecentlyViewed(cleared);
  };

  const handleItemClick = (item) => {
    navigate(item.url);
  };

  if (recentlyViewed.length === 0) return null;

  return (
    <div className={`bg-card border border-border rounded-xl p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Recently Viewed</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClear}
          className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <X className="w-3 h-3 mr-1" />
          Clear
        </Button>
      </div>
      
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {recentlyViewed.map((item) => (
          <button
            key={item.id}
            onClick={() => handleItemClick(item)}
            className="group relative aspect-[4/5] rounded-lg overflow-hidden bg-muted hover:ring-2 hover:ring-primary transition-all"
          >
            {item.image ? (
              <img
                src={item.image}
                alt={item.title}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                No Image
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="absolute bottom-0 left-0 right-0 p-2">
                <p className="text-white text-xs line-clamp-2 font-medium">{item.title}</p>
                {item.price && (
                  <p className="text-white text-xs font-bold">${item.price}</p>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default RecentlyViewed;
