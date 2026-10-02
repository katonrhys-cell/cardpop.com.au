import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

// Always a single line. On phones the current page (the last, unlinked item)
// is visually hidden — it's the page heading right below — and any ancestor
// too long to fit truncates with an ellipsis instead of wrapping into a
// ragged multi-line block.
const Breadcrumb = ({ items = [] }) => {
  const lastIndex = items.length - 1;
  return (
    <nav aria-label="Breadcrumb" className="mb-4 min-w-0">
      <ol className="flex min-w-0 items-center gap-1 whitespace-nowrap text-sm text-muted-foreground">
        {items.map((item, index) => {
          const isCurrent = index === lastIndex && !item.path;
          return (
            <li
              key={index}
              className={
                isCurrent
                  ? 'sr-only sm:not-sr-only sm:flex sm:min-w-0 sm:items-center sm:gap-1'
                  : `flex items-center gap-1 ${index === 0 ? 'shrink-0' : 'min-w-0'}`
              }
            >
              {index > 0 && (
                <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 flex-shrink-0" />
              )}
              {item.path ? (
                <Link to={item.path} className="truncate hover:text-foreground transition-colors">
                  {item.label}
                </Link>
              ) : (
                <span aria-current={isCurrent ? 'page' : undefined} className="truncate text-foreground font-medium">
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumb;
