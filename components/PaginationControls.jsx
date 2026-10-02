import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const PaginationControls = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;

  // Changing page swaps the whole grid, so the controls (at the bottom) would
  // otherwise leave the shopper staring at the footer of the new page.
  const goToPage = (page) => {
    onPageChange(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="flex items-center justify-center gap-2 mt-12 mb-8">
      <Button
        variant="outline"
        size="sm"
        onClick={() => goToPage(currentPage - 1)}
        disabled={currentPage === 1}
        className="gap-1"
        aria-label="Previous page"
      >
        <ChevronLeft className="w-4 h-4" /> Prev
      </Button>
      
      <div className="flex items-center gap-1">
        {[...Array(totalPages)].map((_, i) => {
          const page = i + 1;
          // Show first, last, current, and adjacent pages
          if (
            page === 1 ||
            page === totalPages ||
            (page >= currentPage - 1 && page <= currentPage + 1)
          ) {
            return (
              <Button
                key={page}
                variant={currentPage === page ? "default" : "ghost"}
                size="sm"
                className={`w-9 h-9 p-0 ${currentPage === page ? 'pointer-events-none' : ''}`}
                onClick={() => goToPage(page)}
                aria-label={`Page ${page}`}
                aria-current={currentPage === page ? "page" : undefined}
              >
                {page}
              </Button>
            );
          } else if (
            page === currentPage - 2 ||
            page === currentPage + 2
          ) {
            return <span key={page} className="text-muted-foreground px-1">...</span>;
          }
          return null;
        })}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={() => goToPage(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="gap-1"
        aria-label="Next page"
      >
        Next <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  );
};

export default PaginationControls;