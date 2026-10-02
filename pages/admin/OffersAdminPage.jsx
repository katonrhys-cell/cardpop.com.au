import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import {
  HandCoins, RefreshCw, Clock, CreditCard, CheckCircle, TimerOff, ExternalLink,
} from 'lucide-react';
import AdminPageHeader from '@/components/admin/AdminPageHeader.jsx';
import { apiServerClient as apiClient } from '@/lib/apiServerClient.js';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { offerDisplayStatus } from '@/utils/offerEligibility.js';

// Every marketplace offer, read through the admin-gated GET /admin/offers
// (offers RLS only lets the two parties read a row). Oversight only: the
// buyer and seller drive the lifecycle; the database enforces the 48-hour
// response and payment windows.

const fmtMoney = (n) => `$${(Number(n) || 0).toFixed(2)}`;
const fmtWhen = (ts) => (ts ? format(new Date(ts), 'dd MMM, h:mm a') : '—');

const FILTERS = [
  ['all', 'All offers'],
  ['open', 'Open (awaiting response)'],
  ['awaiting_payment', 'Accepted — awaiting payment'],
  ['paid', 'Paid'],
  ['expired', 'Expired / unpaid'],
  ['declined', 'Declined'],
  ['withdrawn', 'Withdrawn'],
];

const STATUS_STYLE = {
  pending: 'bg-amber-500/10 text-amber-700 border-amber-300 dark:text-amber-400',
  countered: 'bg-violet-500/10 text-violet-700 border-violet-300 dark:text-violet-400',
  accepted: 'bg-primary/10 text-primary border-primary/30',
  paid: 'bg-emerald-500/10 text-emerald-700 border-emerald-300 dark:text-emerald-400',
  declined: 'bg-red-500/10 text-red-700 border-red-300 dark:text-red-400',
  expired: 'bg-muted text-muted-foreground border-border',
  withdrawn: 'bg-muted text-muted-foreground border-border',
};
const STATUS_LABEL = { accepted: 'awaiting payment' };

const person = (p) => (p ? (p.display_name || p.username || 'Unknown') : 'Unknown');

/** The next deadline that matters for an offer, if any. */
const deadlineOf = (offer, status) => {
  if (status === 'pending' || status === 'countered') return { label: 'Respond by', at: offer.expires_at };
  if (status === 'accepted') return { label: 'Pay by', at: offer.payment_due_at };
  if (status === 'paid') return { label: 'Paid', at: offer.paid_at };
  return null;
};

const StatCard = ({ icon: Icon, label, value, accent, loading }) => (
  <Card className="border-border shadow-sm">
    <CardContent className="p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${accent}`}><Icon className="w-4.5 h-4.5" /></div>
      </div>
      {loading ? <Skeleton className="h-9 w-16" /> : <p className="text-4xl font-extrabold tabular-nums tracking-tight text-foreground">{value}</p>}
    </CardContent>
  </Card>
);

const OffersAdminPage = () => {
  const [offers, setOffers] = useState([]);
  const [counts, setCounts] = useState({ open: 0, awaiting_payment: 0, paid: 0, expired: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const fetchRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const res = await apiClient.fetch(`/admin/offers${qs}`);
      if (!res.ok) throw new Error('Failed to load offers');
      const data = await res.json();
      setOffers(data.offers ?? []);
      setCounts({ open: 0, awaiting_payment: 0, paid: 0, expired: 0, ...(data.counts || {}) });
    } catch {
      toast.error('Failed to load offers');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchRef.current = load; load(); }, [load]);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <Helmet><title>Offers | Admin</title></Helmet>

      <AdminPageHeader
        icon={HandCoins}
        title="Offers"
        subtitle={`${counts.open} awaiting a response · ${counts.awaiting_payment} awaiting payment`}
      >
        <Button variant="outline" onClick={() => fetchRef.current?.()} disabled={loading}
          className="rounded-xl h-10 px-4 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </AdminPageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Clock} label="Open" value={counts.open} accent="bg-amber-500/10 text-amber-600" loading={loading} />
        <StatCard icon={CreditCard} label="Awaiting payment" value={counts.awaiting_payment} accent="bg-primary/10 text-primary" loading={loading} />
        <StatCard icon={CheckCircle} label="Paid" value={counts.paid} accent="bg-emerald-500/10 text-emerald-600" loading={loading} />
        <StatCard icon={TimerOff} label="Expired" value={counts.expired} accent="bg-muted text-muted-foreground" loading={loading} />
      </div>

      <div className="flex justify-end">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger aria-label="Filter by status" className="w-full sm:w-[260px] h-10 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            {FILTERS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="shadow-sm border-border overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
        ) : offers.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4"><HandCoins className="w-8 h-8 text-primary/40" /></div>
            <p className="font-bold text-lg mb-1">No offers</p>
            <p className="text-muted-foreground text-sm">Nothing matches your current filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-border bg-muted/30">
                  <TableHead className="px-6 py-4 text-xs font-bold uppercase tracking-wider">Card</TableHead>
                  <TableHead className="py-4 text-xs font-bold uppercase tracking-wider">Offer</TableHead>
                  <TableHead className="py-4 text-xs font-bold uppercase tracking-wider">Buyer</TableHead>
                  <TableHead className="py-4 text-xs font-bold uppercase tracking-wider">Seller</TableHead>
                  <TableHead className="py-4 text-xs font-bold uppercase tracking-wider">Status</TableHead>
                  <TableHead className="py-4 text-xs font-bold uppercase tracking-wider">Deadline</TableHead>
                  <TableHead className="px-6 py-4 text-xs font-bold uppercase tracking-wider">Made</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {offers.map((o) => {
                  const status = offerDisplayStatus(o);
                  const deadline = deadlineOf(o, status);
                  return (
                    <TableRow key={o.id} className="hover:bg-muted/40 transition-colors align-top">
                      <TableCell className="px-6 py-4">
                        <Link to={`/product/marketplace/${o.listing_id}`} className="inline-flex items-center gap-1 font-bold text-sm text-foreground hover:text-primary">
                          {o.listing?.vault_item?.card_name || 'Listing'} <ExternalLink className="w-3 h-3 shrink-0" />
                        </Link>
                        {Number(o.listing?.price_aud) > 0 && (
                          <p className="text-xs text-muted-foreground">Asking {fmtMoney(o.listing.price_aud)}</p>
                        )}
                      </TableCell>
                      <TableCell className="py-4 tabular-nums">
                        <p className="font-bold">{fmtMoney(o.amount_aud)}</p>
                        {o.counter_amount_aud != null && (
                          <p className="text-xs text-violet-700 dark:text-violet-400">Counter {fmtMoney(o.counter_amount_aud)}</p>
                        )}
                      </TableCell>
                      <TableCell className="py-4 text-sm">
                        <p className="font-medium">{person(o.buyer)}</p>
                        {o.buyer?.email && <a href={`mailto:${o.buyer.email}`} className="text-xs text-muted-foreground hover:text-primary">{o.buyer.email}</a>}
                      </TableCell>
                      <TableCell className="py-4 text-sm">
                        <p className="font-medium">{person(o.seller)}</p>
                        {o.seller?.email && <a href={`mailto:${o.seller.email}`} className="text-xs text-muted-foreground hover:text-primary">{o.seller.email}</a>}
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge variant="outline" className={`font-bold text-xs capitalize ${STATUS_STYLE[status] || ''}`}>
                          {STATUS_LABEL[status] || status}
                        </Badge>
                        {status === 'expired' && o.payment_due_at && !o.paid_at ? (
                          <p className="text-[11px] text-red-700 dark:text-red-400 mt-1 font-medium">Buyer didn&apos;t pay</p>
                        ) : null}
                      </TableCell>
                      <TableCell className="py-4 text-xs text-muted-foreground tabular-nums">
                        {deadline?.at ? <><span className="block font-medium text-foreground">{deadline.label}</span>{fmtWhen(deadline.at)}</> : '—'}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-xs text-muted-foreground tabular-nums">{fmtWhen(o.created_at)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default OffersAdminPage;
