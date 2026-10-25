import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import {
  Flag, Clock, Eye, CheckCircle, XCircle, RefreshCw, Loader2,
  ShieldAlert, ExternalLink, AlertTriangle,
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

// Reports are not client-readable (RLS), so this dashboard reads + writes through
// the admin-gated backend (/reports). Mirrors the verification dashboard's shape.

const STATUS_CONFIG = {
  open:      { label: 'Open',      cls: 'bg-amber-500/10 text-amber-700 border-amber-300 dark:text-amber-400',     icon: Clock },
  reviewing: { label: 'Reviewing', cls: 'bg-blue-500/10 text-blue-700 border-blue-300 dark:text-blue-400',         icon: Eye },
  actioned:  { label: 'Actioned',  cls: 'bg-emerald-500/10 text-emerald-700 border-emerald-300 dark:text-emerald-400', icon: CheckCircle },
  dismissed: { label: 'Dismissed', cls: 'bg-muted text-muted-foreground border-border',                            icon: XCircle },
};

const REASON_LABELS = {
  counterfeit: 'Counterfeit', scam: 'Scam', prohibited_item: 'Prohibited item',
  misrepresentation: 'Misrepresented', inappropriate: 'Inappropriate', spam: 'Spam', other: 'Other',
};

// Reasons that signal fraud/safety risk — surfaced more prominently.
const HIGH_RISK = new Set(['counterfeit', 'scam', 'prohibited_item']);

// Where a reported target lives, so moderators can jump straight to it.
const targetLink = (type, id) => {
  if (type === 'listing') return `/marketplace/${id}`;
  if (type === 'user') return `/seller/${id}`;
  if (type === 'event') return `/events/${id}`;
  return null;
};

const ACTIONS = [
  { value: 'reviewing', label: 'Mark Reviewing', icon: Eye,         btnCls: 'border-blue-300 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950' },
  { value: 'actioned',  label: 'Action & Resolve', icon: CheckCircle, btnCls: 'bg-emerald-500 hover:bg-emerald-600 text-white border-0' },
  { value: 'dismissed', label: 'Dismiss',         icon: XCircle,     btnCls: 'border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950' },
];

const StatCard = ({ icon: Icon, label, value, accent, loading }) => (
  <Card className="relative overflow-hidden border-border shadow-sm">
    <CardContent className="p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${accent}`}>
          <Icon className="w-4.5 h-4.5" />
        </div>
      </div>
      {loading ? <Skeleton className="h-9 w-16" /> : (
        <p className="text-4xl font-extrabold tabular-nums tracking-tight text-foreground">{value}</p>
      )}
    </CardContent>
  </Card>
);

const ReportsModerationPage = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('open');
  const [selected, setSelected] = useState(null);
  const [actionOpen, setActionOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const fetchRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const res = await apiClient.fetch(`/reports${qs}`);
      if (!res.ok) throw new Error('Failed to load reports');
      const data = await res.json();
      setReports(data.reports ?? []);
    } catch {
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchRef.current = load;
    load();
  }, [load]);

  const openAction = (report, action = '') => {
    setSelected(report);
    setPendingAction(action);
    setNotes('');
    setActionOpen(true);
  };

  const handleAction = async () => {
    if (!selected || !pendingAction) return;
    setSaving(true);
    try {
      const res = await apiClient.fetch(`/reports/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: pendingAction, resolution_notes: notes.trim() || null }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || 'Failed to update report');
      }
      toast.success(`Report ${STATUS_CONFIG[pendingAction]?.label.toLowerCase()}`);
      setActionOpen(false);
      fetchRef.current?.();
    } catch (err) {
      toast.error(err.message || 'Action failed');
    } finally {
      setSaving(false);
    }
  };

  const counts = {
    open:      reports.filter(r => r.status === 'open').length,
    reviewing: reports.filter(r => r.status === 'reviewing').length,
    resolved:  reports.filter(r => r.status === 'actioned' || r.status === 'dismissed').length,
  };

  const pendingActionCfg = ACTIONS.find(a => a.value === pendingAction);

  return (
    <div className="space-y-8">
      <Helmet><title>Reports & Moderation | Admin</title></Helmet>

      <AdminPageHeader
        icon={Flag}
        title="Reports & Moderation"
        subtitle={counts.open > 0
          ? `${counts.open} report${counts.open !== 1 ? 's' : ''} awaiting review`
          : 'No open reports — all clear'}
      >
        <Button
          variant="outline"
          onClick={() => fetchRef.current?.()}
          disabled={loading}
          className="rounded-xl h-10 px-4 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </AdminPageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Clock}       label="Open"      value={counts.open}      accent="bg-amber-500/10 text-amber-600"   loading={loading} />
        <StatCard icon={Eye}         label="Reviewing" value={counts.reviewing} accent="bg-blue-500/10 text-blue-600"     loading={loading} />
        <StatCard icon={CheckCircle} label="Resolved"  value={counts.resolved}  accent="bg-emerald-500/10 text-emerald-600" loading={loading} />
      </div>

      <div className="flex justify-end">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger aria-label="Filter by status" className="w-full sm:w-[190px] h-10 rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="reviewing">Reviewing</SelectItem>
            <SelectItem value="actioned">Actioned</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="shadow-sm border-border overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
          </div>
        ) : reports.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Flag className="w-8 h-8 text-primary/40" />
            </div>
            <p className="font-bold text-lg mb-1">No reports found</p>
            <p className="text-muted-foreground text-sm">Nothing matches your current filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-border bg-muted/30">
                  <TableHead className="px-6 py-4 text-xs font-bold uppercase tracking-wider">Reason</TableHead>
                  <TableHead className="py-4 text-xs font-bold uppercase tracking-wider">Target</TableHead>
                  <TableHead className="py-4 text-xs font-bold uppercase tracking-wider">Reporter</TableHead>
                  <TableHead className="py-4 text-xs font-bold uppercase tracking-wider">Status</TableHead>
                  <TableHead className="py-4 text-xs font-bold uppercase tracking-wider">Submitted</TableHead>
                  <TableHead className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map(r => {
                  const cfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.open;
                  const Icon = cfg.icon;
                  const link = targetLink(r.target_type, r.target_id);
                  const highRisk = HIGH_RISK.has(r.reason);
                  return (
                    <TableRow key={r.id} className="hover:bg-muted/40 transition-colors group">
                      <TableCell className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {highRisk && <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />}
                          <span className="font-bold text-sm">{REASON_LABELS[r.reason] || r.reason}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <span className="text-xs font-medium text-muted-foreground capitalize">{r.target_type}</span>
                        {link ? (
                          <Link to={link} className="ml-1.5 inline-flex items-center gap-1 text-xs font-mono text-primary hover:underline">
                            {String(r.target_id).slice(0, 8)} <ExternalLink className="w-3 h-3" />
                          </Link>
                        ) : (
                          <span className="ml-1.5 text-xs font-mono">{String(r.target_id).slice(0, 8)}</span>
                        )}
                      </TableCell>
                      <TableCell className="py-4 text-sm">
                        {r.reporter?.display_name || r.reporter?.username || '—'}
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge variant="outline" className={`font-bold text-xs gap-1 ${cfg.cls}`}>
                          <Icon className="w-3 h-3" />{cfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground tabular-nums py-4">
                        {r.created_at ? format(new Date(r.created_at), 'dd MMM yyyy') : '—'}
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm" variant="outline"
                            onClick={() => openAction(r, r.status === 'open' ? 'reviewing' : 'actioned')}
                            className="h-8 rounded-lg text-xs gap-1.5"
                          >
                            <ShieldAlert className="w-3.5 h-3.5" /> Triage
                          </Button>
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

      {/* ── Triage modal ─────────────────────────────────────────── */}
      <Dialog open={actionOpen} onOpenChange={setActionOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="w-5 h-5" /> Triage report
            </DialogTitle>
            <DialogDescription>
              {selected && (
                <>
                  {REASON_LABELS[selected.reason] || selected.reason} · {selected.target_type}{' '}
                  <span className="font-mono">{String(selected.target_id).slice(0, 8)}</span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {selected?.details && (
              <div className="p-3.5 bg-muted/50 rounded-xl border border-border">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Reporter's note</p>
                <p className="text-sm whitespace-pre-wrap">{selected.details}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="font-bold text-sm">Decision</Label>
              <div className="flex flex-wrap gap-2">
                {ACTIONS.map(a => {
                  const Icon = a.icon;
                  const active = pendingAction === a.value;
                  return (
                    <Button
                      key={a.value} type="button" size="sm" variant="outline"
                      onClick={() => setPendingAction(a.value)}
                      className={`rounded-xl text-xs font-bold gap-1.5 ${active ? a.btnCls : ''}`}
                    >
                      <Icon className="w-3.5 h-3.5" />{a.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="resolution-notes" className="font-bold text-sm">
                Resolution notes <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="resolution-notes"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="What did you do / decide? (internal)"
                rows={3}
                className="rounded-xl resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setActionOpen(false)} disabled={saving} className="rounded-xl">
              Cancel
            </Button>
            <Button
              onClick={handleAction}
              disabled={saving || !pendingAction}
              className="rounded-xl font-bold gap-2"
            >
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : `Confirm ${pendingActionCfg?.label || ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReportsModerationPage;
