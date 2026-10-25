import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { MessageSquareText, RefreshCw, Check, X } from 'lucide-react';
import AdminPageHeader from '@/components/admin/AdminPageHeader.jsx';
import { apiServerClient as apiClient } from '@/lib/apiServerClient.js';
import StarRating from '@/components/shop/StarRating.jsx';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';

// Admin → Product Reviews. Verified-purchase shop reviews wait here as
// `pending`; nothing shows on the storefront (or in Google's markup) until it is
// published. Reads and moderation go through /shop-reviews/admin (admin + MFA
// gate, service role) — see src/routes/shop-reviews.js.

const FILTERS = [
  ['pending', 'Awaiting approval'],
  ['published', 'Published'],
  ['rejected', 'Rejected'],
];

const ProductReviewsAdminPage = () => {
  const [status, setStatus] = useState('pending');
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.fetch(`/shop-reviews/admin?status=${status}`);
      if (!res.ok) throw new Error('Failed to load reviews');
      const body = await res.json();
      setReviews(body.reviews || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load reviews');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const moderate = async (id, next) => {
    setBusyId(id);
    try {
      const res = await apiClient.fetch(`/shop-reviews/admin/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error('Could not update the review');
      setReviews((prev) => prev.filter((r) => r.id !== id));
      toast.success(next === 'published' ? 'Review published' : 'Review rejected');
    } catch (err) {
      toast.error(err.message || 'Could not update the review');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-8">
      <Helmet><title>Product Reviews | Admin</title></Helmet>

      <AdminPageHeader
        icon={MessageSquareText}
        title="Product Reviews"
        subtitle="Approve verified-purchase reviews before they appear on the shop."
      >
        <Button variant="outline" onClick={load} disabled={loading}
          className="rounded-xl h-10 px-4 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </AdminPageHeader>

      <div className="flex justify-end">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger aria-label="Filter by status" className="w-full sm:w-[220px] h-10 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            {FILTERS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}</div>
      ) : reviews.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Nothing here.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-5 space-y-2">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="font-semibold text-foreground">
                      {r.product?.title || 'Product'}{r.product?.colour ? ` — ${r.product.colour}` : ''}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {r.reviewer_name} · order {String(r.order_id).slice(0, 8).toUpperCase()} · {format(new Date(r.created_at), 'dd MMM yyyy, h:mm a')}
                    </p>
                  </div>
                  <StarRating value={r.rating} />
                </div>
                {r.title && <p className="font-semibold text-sm">{r.title}</p>}
                {r.body && <p className="text-sm text-muted-foreground whitespace-pre-line">{r.body}</p>}
                <div className="flex items-center gap-2 pt-1">
                  {r.status !== 'published' && (
                    <Button size="sm" className="rounded-xl gap-1.5" disabled={busyId === r.id} onClick={() => moderate(r.id, 'published')}>
                      <Check className="w-4 h-4" /> Publish
                    </Button>
                  )}
                  {r.status !== 'rejected' && (
                    <Button size="sm" variant="outline" className="rounded-xl gap-1.5" disabled={busyId === r.id} onClick={() => moderate(r.id, 'rejected')}>
                      <X className="w-4 h-4" /> Reject
                    </Button>
                  )}
                  {r.status !== 'pending' && <Badge variant="outline" className="ml-auto text-xs">{r.status}</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductReviewsAdminPage;
