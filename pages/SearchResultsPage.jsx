import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import pb from '@/lib/pocketbaseClient.js';
import SEOHead from '@/components/SEOHead.jsx';
import ProductGrid from '@/components/ProductGrid.jsx';
import PaginationControls from '@/components/PaginationControls.jsx';
import SearchBar from '@/components/SearchBar.jsx';
import { Badge } from '@/components/ui/badge';

const SearchResultsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      try {
        let filterStr = 'marketplaceStatus != "Private"';
        
        if (query) {
          const safeQuery = query.replace(/"/g, '\\"');
          filterStr += ` && (cardName ~ "${safeQuery}" || description ~ "${safeQuery}")`;
        }

        const res = await pb.collection('cardListings').getList(page, 16, {
          filter: filterStr,
          sort: '-created',
          $autoCancel: false
        });
        
        setResults(res.items);
        setTotalPages(res.totalPages);
        setTotalItems(res.totalItems);
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [query, page]);

  return (
    <div className="container-default section-padding">
      <SEOHead 
        title={`Search Results for "${query}" | CardPop`} 
        description={`Find ${query} trading cards and collectibles.`}
      />
      
      <div className="max-w-2xl mx-auto text-center mb-12">
        <h1 className="text-3xl md:text-4xl font-bold font-heading mb-6">Search Results</h1>
        <SearchBar initialQuery={query} className="mx-auto" />
      </div>

      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">
          {totalItems} results found {query && <span>for "{query}"</span>}
        </h2>
        {query && (
          <Badge variant="outline" className="cursor-pointer" onClick={() => setSearchParams({})}>
            Clear Search x
          </Badge>
        )}
      </div>

      <ProductGrid items={results} loading={loading} isVault={true} />
      
      <PaginationControls 
        currentPage={page} 
        totalPages={totalPages} 
        onPageChange={setPage} 
      />
    </div>
  );
};

export default SearchResultsPage;