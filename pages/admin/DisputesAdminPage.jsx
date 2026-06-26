import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import {
  CreditCard, AlertTriangle, RefreshCw, Loader2, CheckCircle, Lock, ExternalLink,
} from 'lucide-react';
import AdminPageHeader from '@/components/admin/AdminPageHeader.jsx';
import { apiServerClient as apiClient } from '@/lib/apiServerClient.js';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { format } from 'date-fns';

// Chargeback queue — reads/resolves through the admin-gated backend. On a new
// dispute the webhook already froze the payout; here admins release it (if the
// dispute was won) or keep it frozen (if lost).

const RESOLVED = new Set(['resolved_released', 'resolved_kept']);
const fmtMoney = (n) => `$${(Number(n) || 0).toFixed(2)}`;

const statusBadge = (status) => {
  if (status === 'resolved_released') return 'bg-emerald-500/10 text-emerald-700 border-emerald-300 dark:text-emerald-400';
  if (status === 'resolved_kept') return 'bg-muted text-muted-foreground border-border';
  if (status === 'lost') return 'bg-red-500/10 text-red-700 border-red-300 dark:text-red-400';
  if (status === 'won') return 'bg-emerald-500/10 text-emerald-700 border-emerald-300 dark:text-emerald-400';
  return 'bg-amber-500/10 text-amber-700 border-amber-300 dark:text-amber-400';
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

const DisputesAdminPage = () => {
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('open');
  const [selected, setSelected] = useState(null);
  const [action, setAction] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const fetchRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const res = await apiClient.fetch(`/admin/disputes${qs}`);
      if (!res.ok) throw new Error('Failed to load disputes');
      const data = await res.json();
      setDisputes(data.disputes ?? []);
    } catch {
      toast.error('Failed to load disputes');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchRef.current = load; load(); }, [load]);

  const openResolve = (d, a) => { setSelected(d); setAction(a); setNotes(''); };

  const handleResolve = async () => {
    if (!selected || !action) return;
    setSaving(true);
    try {
      const res = await apiClient.fetch(`/admin/disputes/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, resolution_notes: notes.trim() || null }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || 'Failed to resolve dispute');
      }
      toast.success(action === 'release' ? 'Payout released to seller' : 'Payout kept frozen');
      setSelected(null);
      fetchRef.current?.();
    } catch (err) {
      toast.error(err.message || 'Action failed');
    } finally {
      setSaving(false);
    }
  };

  const counts = {
    open: disputes.filter((d) => !RESOLVED.has(d.status)).length,
    resolved: disputes.filter((d) => RESOLVED.has(d.status)).length,
    exposure: disputes.filter((d) => !RESOLVED.has(d.status)).reduce((s, d) => s + (Number(d.amount_aud) || 0), 0),
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <Helmet><title>Chargebacks | Admin</title></Helmet>

      <AdminPageHeader
        icon={CreditCard}
        title="Chargebacks & Disputes"
        subtitle={counts.open > 0 ? `${counts.open} open · ${fmtMoney(counts.exposure)} at risk` : 'No open disputes'}
      >
        <Button variant="outline" onClick={() => fetchRef.current?.()} disabled={loading}
          className="rounded-xl h-10 px-4 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </AdminPageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={AlertTriangle} label="Open" value={counts.open} accent="bg-amber-500/10 text-amber-600" loading={loading} />
        <StatCard icon={Lock} label="At Risk" value={fmtMoney(counts.exposure)} accent="bg-red-500/10 text-red-600" loading={loading} />
        <StatCard icon={CheckCircle} label="Resolved" value={counts.resolved} accent="bg-emerald-500/10 text-emerald-600" loading={loading} />
      </div>

      <div className="flex justify-end">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger aria-label="Filter by status" className="w-full sm:w-[190px] h-10 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="resolved_released">Released</SelectItem>
            <SelectItem value="resolved_kept">Kept frozen</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="shadow-sm border-border overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
        ) : disputes.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4"><CreditCard className="w-8 h-8 text-primary/40" /></div>
            <p className="font-bold text-lg mb-1">No disputes</p>
            <p className="text-muted-foreground text-sm">Nothing matches your current filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-border bg-muted/30">
                  <TableHead className="px-6 py-4 text-xs font-bold uppercase tracking-wider">Amount</TableHead>
                  <TableHead className="py-4 text-xs font-bold uppercase tracking-wider">Reason</TableHead>
                  <TableHead className="py-4 text-xs font-bold uppercase tracking-wider">Order</TableHead>
                  <TableHead className="py-4 text-xs font-bold uppercase tracking-wider">Status</TableHead>
                  <TableHead className="py-4 text-xs font-bold uppercase tracking-wider">Opened</TableHead>
                  <TableHead className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {disputes.map((d) => {
                  const resolved = RESOLVED.has(d.status);
                  return (
                    <TableRow key={d.id} className="hover:bg-muted/40 transition-colors">
                      <TableCell className="px-6 py-4 font-bold tabular-nums">{fmtMoney(d.amount_aud)}</TableCell>
                      <TableCell className="py-4 text-sm capitalize">{(d.reason || '—').replace(/_/g, ' ')}</TableCell>
                      <TableCell className="py-4">
                        {d.order_id ? (
                          <Link to={`/admin/orders`} className="inline-flex items-center gap-1 text-xs font-mono text-primary hover:underline">
                            {String(d.order_id).slice(0, 8)} <ExternalLink className="w-3 h-3" />
                          </Link>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge variant="outline" className={`font-bold text-xs ${statusBadge(d.status)}`}>{d.status?.replace(/_/g, ' ')}</Badge>
                      </TableCell>
                      <TableCell className="py-4 text-sm text-muted-foreground tabular-nums">{d.created_at ? format(new Date(d.created_at), 'dd MMM yyyy') : '—'}</TableCell>
                      <TableCell className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {resolved ? (
                            <span className="text-xs text-muted-foreground">Resolved</span>
                          ) : (
                            <>
                              <Button size="sm" onClick={() => openResolve(d, 'release')}
                                className="h-8 rounded-lg text-xs bg-emerald-500 hover:bg-emerald-600 text-white gap-1.5">
                                <CheckCircle className="w-3.5 h-3.5" /> Release
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => openResolve(d, 'keep_frozen')}
                                className="h-8 rounded-lg text-xs gap-1.5">
                                <Lock className="w-3.5 h-3.5" /> Keep frozen
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {action === 'release' ? <CheckCircle className="w-5 h-5 text-emerald-600" /> : <Lock className="w-5 h-5" />}
              {action === 'release' ? 'Release payout to seller' : 'Keep payout frozen'}
            </DialogTitle>
            <DialogDescription>
              {action === 'release'
                ? `This pays the seller their proceeds for the disputed order (${fmtMoney(selected?.amount_aud)}). Do this only when the chargeback was resolved in our favour.`
                : 'The seller payout stays on hold. Use this when the chargeback was lost or is still contested.'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-1.5">
            <Label htmlFor="dispute-notes" className="font-bold text-sm">Resolution notes <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Textarea id="dispute-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="rounded-xl resize-none" placeholder="Internal record of the decision…" />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSelected(null)} disabled={saving} className="rounded-xl">Cancel</Button>
            <Button onClick={handleResolve} disabled={saving}
              className={`rounded-xl font-bold gap-2 ${action === 'release' ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : ''}`}>
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : action === 'release' ? 'Release payout' : 'Keep frozen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DisputesAdminPage;
