import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, X, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ADMIN_SECTIONS, filterAdminSections } from '@/components/admin/adminSections.js';

// The dashboard's map of the admin area: every screen as one compact row,
// grouped by job, with a search box that narrows the lot as you type (Enter
// opens the first match).
const AdminDirectory = () => {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const sections = useMemo(() => filterAdminSections(query), [query]);
  const searching = query.trim().length > 0;
  const firstMatch = sections[0]?.items[0];

  const onSubmit = (e) => {
    e.preventDefault();
    if (searching && firstMatch) navigate(firstMatch.link);
  };

  return (
    <section aria-labelledby="admin-directory-heading" className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h2 id="admin-directory-heading" className="text-2xl font-serif font-bold text-foreground">Manage</h2>
        <form onSubmit={onSubmit} role="search" className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find an admin area…"
            aria-label="Find an admin area"
            className="h-11 rounded-xl pl-10 pr-10 bg-card [&::-webkit-search-cancel-button]:hidden"
          />
          {searching && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </form>
      </div>

      {!searching && (
        <nav aria-label="Admin groups" className="flex flex-wrap gap-2">
          {ADMIN_SECTIONS.map(({ id, title, icon: Icon }) => (
            <a
              key={id}
              href={`#admin-${id}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:border-primary/50 hover:text-primary transition-colors"
            >
              <Icon className="w-3.5 h-3.5" />
              {title}
            </a>
          ))}
        </nav>
      )}

      {sections.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card px-6 py-10 text-center text-muted-foreground">
          Nothing matches “{query.trim()}”. Try a different word.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {sections.map(({ id, title, summary, icon: SectionIcon, items }) => (
            <div
              key={id}
              id={`admin-${id}`}
              className="scroll-mt-40 rounded-2xl border border-border bg-card shadow-sm overflow-hidden flex flex-col"
            >
              <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-muted/30">
                <div className="w-9 h-9 shrink-0 rounded-lg bg-primary flex items-center justify-center">
                  <SectionIcon className="w-[18px] h-[18px] text-primary-foreground" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-serif font-bold text-lg leading-tight text-foreground">{title}</h3>
                  <p className="text-xs text-muted-foreground truncate">{summary}</p>
                </div>
              </div>
              <ul className="p-2">
                {items.map(({ title: itemTitle, description, link, icon: Icon }) => (
                  <li key={link}>
                    <Link
                      to={link}
                      className="group flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors"
                    >
                      <Icon className="w-[18px] h-[18px] shrink-0 text-primary" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-foreground group-hover:text-primary">{itemTitle}</span>
                        <span className="block text-xs text-muted-foreground truncate">{description}</span>
                      </span>
                      <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default AdminDirectory;
