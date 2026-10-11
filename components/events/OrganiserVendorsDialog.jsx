import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { AlertTriangle } from 'lucide-react';
import apiServerClient from '@/lib/apiServerClient';
import ProfileAvatar from '@/components/ProfileAvatar.jsx';

// A verified organiser's view of who has RSVP'd as a vendor to their event.
// Served by GET /events/:id/vendors, which checks the caller organises the
// event and has been verified by an admin. Names and profiles only — no emails.

const OrganiserVendorsDialog = ({ event, onClose }) => {
  const [vendors, setVendors] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    if (!event?.id) return undefined;
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    setVendors([]);
    (async () => {
      try {
        const res = await apiServerClient.fetch(`/events/${event.id}/vendors`);
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || 'Failed to load vendors');
        if (!cancelled) setVendors(body.vendors || []);
      } catch (err) {
        if (!cancelled) setLoadError(err.message || 'Failed to load vendors');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [event?.id]);

  return (
    <Dialog open={!!event} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Vendors ({isLoading ? '…' : vendors.length})</DialogTitle>
          <DialogDescription className="line-clamp-2">{event?.title}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
            </div>
          ) : loadError ? (
            <div className="flex items-center gap-2 text-sm text-destructive p-4 rounded-lg border border-destructive/20 bg-destructive/5">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {loadError}
            </div>
          ) : vendors.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">No one has signed up as a vendor yet.</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {vendors.map((v) => (
                <li key={v.user_id} className="flex items-center gap-3 p-3">
                  <ProfileAvatar profile={v} size="sm" />
                  <div className="min-w-0 flex-1">
                    <Link to={`/seller/${v.user_id}`} className="font-semibold text-sm text-foreground hover:underline truncate block">
                      {v.display_name || v.username || 'CardPop member'}
                    </Link>
                    {v.username && <p className="text-xs text-muted-foreground truncate">@{v.username}</p>}
                  </div>
                  {v.created_at && (
                    <span className="text-[11px] text-muted-foreground shrink-0">{format(new Date(v.created_at), 'd MMM yyyy')}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OrganiserVendorsDialog;
