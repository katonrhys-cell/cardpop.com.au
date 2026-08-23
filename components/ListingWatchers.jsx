import React, { useEffect, useState } from 'react';
import { Eye } from 'lucide-react';

// Social-proof line: how many watchlists this listing sits on. Only the
// aggregate is exposed (see src/routes/listing-stats.js); renders nothing
// until there's at least one watcher, so it never nags on quiet listings.
const ListingWatchers = ({ listingId, className = '' }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!listingId) return;
    let cancelled = false;
    fetch(`/api/listing-stats/${listingId}/watchers`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => { if (!cancelled && data) setCount(data.watchers || 0); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [listingId]);

  if (count < 1) return null;

  return (
    <p className={`flex items-center gap-1.5 text-sm font-medium text-muted-foreground ${className}`}>
      <Eye className="w-4 h-4 text-primary" />
      {count === 1 ? '1 collector is watching this card' : `${count} collectors are watching this card`}
    </p>
  );
};

export default ListingWatchers;
