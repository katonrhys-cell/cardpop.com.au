import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Clock, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getSearchHistory, addToSearchHistory, clearSearchHistory } from '@/utils/searchHistory.js';

const SearchBar = ({ initialQuery = '', className = '', onSearchChange, placeholder = 'Search for cards, sealed products...' }) => {
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState([]);
  const [searchHistory, setSearchHistory] = useState([]);
  const [didYouMean, setDidYouMean] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const suggestionsRef = useRef(null);

  // Load search history on mount
  useEffect(() => {
    setSearchHistory(getSearchHistory());
  }, []);

  // Fetch search suggestions
  useEffect(() => {
    // Guard against out-of-order responses: a slow fetch for an earlier query
    // must not overwrite suggestions for the current one.
    let cancelled = false;

    const fetchSuggestions = async () => {
      if (query.length < 2) {
        if (!cancelled) {
          setSuggestions([]);
          // Show search history when query is empty
          if (query.length === 0) setShowSuggestions(searchHistory.length > 0);
        }
        return;
      }

      setLoading(true);
      try {
        const response = await fetch(`/api/search-suggestions?q=${encodeURIComponent(query)}&limit=8`);
        const data = await response.json();
        if (cancelled) return;
        setSuggestions(data.suggestions || []);
        setDidYouMean(data.didYouMean || null);
        setShowSuggestions(true);
      } catch (error) {
        if (cancelled) return;
        console.error('Error fetching suggestions:', error);
        setSuggestions([]);
        setDidYouMean(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const debounceTimer = setTimeout(fetchSuggestions, 300);
    return () => { cancelled = true; clearTimeout(debounceTimer); };
    // Intentionally not depending on searchHistory.length — it would re-fire the
    // network fetch when history changes. The empty-query branch reads it lazily.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) {
      // Save to search history
      const updatedHistory = addToSearchHistory(query.trim());
      setSearchHistory(updatedHistory);
      setShowSuggestions(false);
      
      if (onSearchChange) {
        onSearchChange(query.trim());
      } else {
        navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      }
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setQuery(suggestion);
    // Save to search history
    const updatedHistory = addToSearchHistory(suggestion);
    setSearchHistory(updatedHistory);
    setShowSuggestions(false);
    
    if (onSearchChange) {
      onSearchChange(suggestion);
    } else {
      navigate(`/search?q=${encodeURIComponent(suggestion)}`);
    }
  };

  const handleHistoryClick = (term) => {
    setQuery(term);
    setShowSuggestions(false);
    if (onSearchChange) {
      onSearchChange(term);
    } else {
      navigate(`/search?q=${encodeURIComponent(term)}`);
    }
  };

  const handleClearHistory = () => {
    const cleared = clearSearchHistory();
    setSearchHistory(cleared);
    setShowSuggestions(false);
  };

  const clearQuery = () => {
    setQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  return (
    <div className={`relative w-full max-w-md ${className}`} ref={suggestionsRef}>
      <form onSubmit={handleSearch} className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          type="search"
          name="q"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && setShowSuggestions(true)}
          className="w-full pl-9 pr-10 rounded-full bg-background border-input focus-visible:ring-primary"
          aria-label="Search items"
        />
        {query && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={clearQuery}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full hover:bg-muted"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </Button>
        )}
      </form>

      {/* Autosuggestions Dropdown */}
      {showSuggestions && (suggestions.length > 0 || searchHistory.length > 0 || loading) && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-background border border-border rounded-xl shadow-lg z-50 overflow-hidden">
          {loading ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Loading suggestions...
            </div>
          ) : (
            <>
              {/* Search History Section */}
              {query.length === 0 && searchHistory.length > 0 && (
                <>
                  <div className="px-4 py-2 border-b border-border flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">Recent Searches</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleClearHistory}
                      className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Clear
                    </Button>
                  </div>
                  <ul className="py-2">
                    {searchHistory.map((term, index) => (
                      <li key={index}>
                        <button
                          type="button"
                          onClick={() => handleHistoryClick(term)}
                          className="w-full px-4 py-2 text-left hover:bg-muted transition-colors text-sm flex items-center"
                        >
                          <Clock className="inline w-3 h-3 mr-2 text-muted-foreground" />
                          {term}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {/* Autosuggestions Section */}
              {query.length >= 2 && suggestions.length > 0 && (
                <ul className="py-2">
                  {suggestions.map((suggestion, index) => (
                    <li key={index}>
                      <button
                        type="button"
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="w-full px-4 py-2 text-left hover:bg-muted transition-colors text-sm"
                      >
                        <Search className="inline w-3 h-3 mr-2 text-muted-foreground" />
                        {suggestion}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Empty State */}
              {query.length >= 2 && suggestions.length === 0 && (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  {didYouMean ? (
                    <div>
                      <p className="mb-2">No suggestions found</p>
                      <button
                        type="button"
                        onClick={() => handleSuggestionClick(didYouMean)}
                        className="text-primary hover:underline font-medium"
                      >
                        Did you mean "{didYouMean}"?
                      </button>
                    </div>
                  ) : (
                    'No suggestions found'
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBar;