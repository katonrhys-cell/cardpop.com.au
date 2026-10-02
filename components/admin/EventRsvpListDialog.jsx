import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { Download, Store, Users, AlertTriangle } from 'lucide-react';
import apiServerClient from '@/lib/apiServerClient';
import { toCsv } from '@/utils/finance.js';
import { toCdnUrl } from '@/utils/imageUrl.js';

// Admin list of everyone who has RSVP'd to an event — attendees ("buyer") and
// vendors. The raw event_rsvps rows are hidden from the public by RLS, and
// emails are service-role only, so the list comes from GET /admin/events/:id/rsvps.

const ROLE_LABELS = { buyer: 'Attendee', vendor: 'Vendor' };

const CSV_COLUMNS = [
  { label: 'Role', value: (r) => ROLE_LABELS[r.role] || r.role },
  { label: 'Name', value: (r) => r.display_name || '' },
  { label: 'Username', value: (r) => r.username || '' },
  { label: 'Email', value: (r) => r.email || '' },
  { label: 'RSVP date', value: (r) => (r.created_at ? format(new Date(r.created_at), 'yyyy-MM-dd HH:mm') : '') },
];

const slugify = (s) => String(s || 'event').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

function downloadCsv(filename, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const EventRsvpListDialog = ({ event, onClose }) => {
  const [rsvps, setRsvps] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [tab, setTab] = useState('all');

  useEffect(() => {
    if (!event?.id) return undefined;
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    setRsvps([]);
    setTab('all');
    (async () => {
      try {
        const res = await apiServerClient.fetch(`/admin/events/${event.id}/rsvps`);
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || 'Failed to load attendees');
        if (!cancelled) setRsvps(body.rsvps || []);
      } catch (err) {
        if (!cancelled) setLoadError(err.message || 'Failed to load attendees');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [event?.id]);

  const buyers = rsvps.filter((r) => r.role === 'buyer');
  const vendors = rsvps.filter((r) => r.role === 'vendor');
  const visible = tab === 'buyer' ? buyers : tab === 'vendor' ? vendors : rsvps;

  const exportCsv = () => {
    const suffix = tab === 'all' ? 'rsvps' : tab === 'vendor' ? 'vendors' : 'attendees';
    downloadCsv(`${slugify(event?.title)}-${suffix}.csv`, toCsv(visible, CSV_COLUMNS));
  };

  return (
    <Dialog open={!!event} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Who's going</DialogTitle>
          <DialogDescription className="line-clamp-2">{event?.title}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="all">All ({rsvps.length})</TabsTrigger>
              <TabsTrigger value="buyer">Attendees ({buyers.length})</TabsTrigger>
              <TabsTrigger value="vendor">Vendors ({vendors.length})</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={isLoading || visible.length === 0} className="rounded-lg">
            <Download className="w-4 h-4 mr-1.5" /> Export CSV
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
            </div>
          ) : loadError ? (
            <div className="flex items-center gap-2 text-sm text-destructive p-4 rounded-lg border border-destructive/20 bg-destructive/5">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {loadError}
            </div>
          ) : visible.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              {tab === 'vendor' ? 'No vendors yet.' : tab === 'buyer' ? 'No attendees yet.' : 'Nobody has RSVP’d yet.'}
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {visible.map((r) => (
                <li key={r.user_id} className="flex items-center gap-3 p-3">
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                    {r.avatar_url ? (
                      <img src={toCdnUrl(r.avatar_url)} alt="" loading="lazy" className="w-full h-full object-cover" />
                    ) : r.role === 'vendor' ? (
                      <Store className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <Users className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/seller/${r.user_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-sm text-foreground hover:underline truncate block"
                    >
                      {r.display_name || r.username || 'Unnamed user'}
                    </Link>
                    <p className="text-xs text-muted-foreground truncate">
                      {r.username ? `@${r.username}` : null}
                      {r.username && r.email ? ' · ' : null}
                      {r.email ? <a href={`mailto:${r.email}`} className="hover:underline">{r.email}</a> : null}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge variant={r.role === 'vendor' ? 'default' : 'outline'} className="text-xs">
                      {ROLE_LABELS[r.role] || r.role}
                    </Badge>
                    {r.created_at && (
                      <span className="text-[11px] text-muted-foreground">{format(new Date(r.created_at), 'd MMM yyyy')}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EventRsvpListDialog;
