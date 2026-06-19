import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet';
import {
  ShieldCheck, ShieldAlert, Clock, Eye, CheckCircle, XCircle,
  Search, RefreshCw, Loader2, FileText, MessageSquare, AlertCircle,
  TrendingUp, Users, Shield, ChevronRight,
} from 'lucide-react';
import AdminPageHeader from '@/components/admin/AdminPageHeader.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { useAuth } from '@/contexts/AuthContext.jsx';
import { format } from 'date-fns';

const STATUS_CONFIG = {
  pending:      { label: 'Pending',   cls: 'bg-amber-500/10 text-amber-700 border-amber-300 dark:text-amber-400',   icon: Clock },
  approved:     { label: 'Approved',  cls: 'bg-emerald-500/10 text-emerald-700 border-emerald-300 dark:text-emerald-400', icon: CheckCircle },
  rejected:     { label: 'Rejected',  cls: 'bg-red-500/10 text-red-700 border-red-300 dark:text-red-400',           icon: XCircle },
  suspended:    { label: 'Suspended', cls: 'bg-amber-500/10 text-amber-700 border-amber-300 dark:text-amber-400',   icon: ShieldAlert },
  revoked:      { label: 'Revoked',   cls: 'bg-red-500/10 text-red-700 border-red-300 dark:text-red-400',           icon: ShieldAlert },
};

const ACTIONS = [
  { value: 'approved',      label: 'Approve',          icon: CheckCircle,   btnCls: 'bg-emerald-500 hover:bg-emerald-600 text-white border-0' },
  { value: 'rejected',      label: 'Reject',            icon: XCircle,       btnCls: 'border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950' },
  { value: 'suspended',     label: 'Suspend',           icon: ShieldAlert,   btnCls: 'border-amber-300 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950' },
  { value: 'revoked',       label: 'Revoke',            icon: ShieldAlert,   btnCls: 'border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950' },
  { value: 'info_requested', label: 'Request Info',     icon: MessageSquare, btnCls: 'border-blue-300 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950' },
];

const StatCard = ({ icon: Icon, label, value, accent, loading }) => (
  <Card className="relative overflow-hidden border-border shadow-sm hover:shadow-md transition-all duration-300 hover:border-primary/40 group">
    <CardContent className="p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${accent}`}>
          <Icon className="w-4.5 h-4.5" />
        </div>
      </div>
      {loading ? (
        <Skeleton className="h-9 w-16" />
      ) : (
        <p className="text-4xl font-extrabold tabular-nums tracking-tight text-foreground">{value}</p>
      )}
      <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${accent.replace('bg-', 'bg-').replace('/10', '/60').replace('text-', '')} opacity-0 group-hover:opacity-100 transition-opacity`} />
    </CardContent>
  </Card>
);

const AdminVerificationDashboard = () => {
  const { currentUser } = useAuth();
  const [verifications, setVerifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [selected, setSelected] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [actionOpen, setActionOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [saving, setSaving] = useState(false);
  const [docUrls, setDocUrls] = useState({});
  const fetchRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        let query = supabase
          .from('user_verifications')
          .select(`*, profile:profiles!user_id(display_name, username, email:id, is_verified, verification_status, created_at, total_sales, reviews_count, rating)`)
          .order('submitted_at', { ascending: false });
        if (statusFilter !== 'all') query = query.eq('status', statusFilter);
        const { data, error } = await query;
        if (error) throw error;
        if (!cancelled) setVerifications(data ?? []);
      } catch {
        toast.error('Failed to load verifications');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchRef.current = run;
    run();
    return () => { cancelled = true; };
  }, [statusFilter]);

  const getDocUrl = async (path) => {
    if (!path) return null;
    if (docUrls[path]) return docUrls[path];
    const { data } = await supabase.storage.from('verification-docs').createSignedUrl(path, 3600);
    const url = data?.signedUrl;
    if (url) setDocUrls(prev => ({ ...prev, [path]: url }));
    return url;
  };

  const openDetail = async (v) => {
    setSelected(v);
    setDetailOpen(true);
    if (v.photo_id_path) getDocUrl(v.photo_id_path);
    if (v.selfie_path) getDocUrl(v.selfie_path);
  };

  const openAction = (v, action = '') => {
    setSelected(v);
    setPendingAction(action);
    setAdminNotes('');
    setAdditionalInfo('');
    setActionOpen(true);
  };

  const handleAction = async () => {
    if (!selected || !pendingAction) return;
    setSaving(true);
    try {
      const isInfoRequest = pendingAction === 'info_requested';
      const updateData = {
        admin_id: currentUser.id,
        admin_notes: adminNotes.trim() || null,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (isInfoRequest) {
        updateData.additional_info_requested = additionalInfo.trim() || null;
      } else {
        updateData.status = pendingAction;
        updateData.additional_info_requested = null;
      }
      const { error } = await supabase.from('user_verifications').update(updateData).eq('id', selected.id);
      if (error) throw error;
      await supabase.from('verification_audit_log').insert({
        verification_id: selected.id,
        admin_id: currentUser.id,
        action: pendingAction,
        notes: adminNotes.trim() || null,
      });
      const labels = { approved: 'Approved', rejected: 'Rejected', suspended: 'Suspended', revoked: 'Revoked', info_requested: 'Info requested' };
      toast.success(`${labels[pendingAction]} successfully`);
      setActionOpen(false);
      setDetailOpen(false);
      fetchRef.current?.();
    } catch (err) {
      toast.error(err.message || 'Action failed');
    } finally {
      setSaving(false);
    }
  };

  const filtered = verifications.filter(v => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      v.profile?.display_name?.toLowerCase().includes(q) ||
      v.profile?.username?.toLowerCase().includes(q) ||
      v.full_legal_name?.toLowerCase().includes(q)
    );
  });

  const counts = {
    pending:  verifications.filter(v => v.status === 'pending').length,
    approved: verifications.filter(v => v.status === 'approved').length,
    rejected: verifications.filter(v => v.status === 'rejected').length,
  };

  const pendingActionCfg = ACTIONS.find(a => a.value === pendingAction);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <Helmet><title>Verification Management | Admin</title></Helmet>

      <AdminPageHeader
        icon={Shield}
        title="Verification Management"
        subtitle={counts.pending > 0
          ? `${counts.pending} submission${counts.pending !== 1 ? 's' : ''} awaiting your review`
          : 'All submissions are up to date'}
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

      {/* ── Stat cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Clock}        label="Pending Review" value={counts.pending}  accent="bg-amber-500/10 text-amber-600"   loading={loading} />
        <StatCard icon={CheckCircle}  label="Approved"       value={counts.approved} accent="bg-emerald-500/10 text-emerald-600" loading={loading} />
        <StatCard icon={XCircle}      label="Rejected"       value={counts.rejected} accent="bg-red-500/10 text-red-600"        loading={loading} />
      </div>

      {/* ── Filters ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or username…"
            className="pl-9 h-10 rounded-xl"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[190px] h-10 rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="revoked">Revoked</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ── Table ───────────────────────────────────────────────── */}
      <Card className="shadow-sm border-border overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-8 h-8 text-primary/40" />
            </div>
            <p className="font-bold text-lg mb-1">No verifications found</p>
            <p className="text-muted-foreground text-sm">No submissions match your current filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-border bg-muted/30">
                  <TableHead className="px-6 py-4 text-xs font-bold uppercase tracking-wider">User</TableHead>
                  <TableHead className="py-4 text-xs font-bold uppercase tracking-wider">Legal Name</TableHead>
                  <TableHead className="py-4 text-xs font-bold uppercase tracking-wider">Status</TableHead>
                  <TableHead className="py-4 text-xs font-bold uppercase tracking-wider">Submitted</TableHead>
                  <TableHead className="py-4 text-xs font-bold uppercase tracking-wider">Reviewed</TableHead>
                  <TableHead className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(v => {
                  const cfg = STATUS_CONFIG[v.status] || STATUS_CONFIG.pending;
                  const Icon = cfg.icon;
                  return (
                    <TableRow key={v.id} className="hover:bg-muted/40 transition-colors group">
                      <TableCell className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-xs font-extrabold text-primary">
                              {(v.profile?.display_name || v.profile?.username || '?')[0].toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-bold text-sm">{v.profile?.display_name || v.profile?.username || '—'}</p>
                            <p className="text-xs text-muted-foreground">@{v.profile?.username}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold text-sm py-4">{v.full_legal_name}</TableCell>
                      <TableCell className="py-4">
                        <Badge variant="outline" className={`font-bold text-xs gap-1 ${cfg.cls}`}>
                          <Icon className="w-3 h-3" />{cfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground tabular-nums py-4">
                        {v.submitted_at ? format(new Date(v.submitted_at), 'dd MMM yyyy') : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground tabular-nums py-4">
                        {v.reviewed_at ? format(new Date(v.reviewed_at), 'dd MMM yyyy') : '—'}
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openDetail(v)}
                            className="h-8 rounded-lg text-xs gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Eye className="w-3.5 h-3.5" /> Review
                          </Button>
                          {v.status === 'pending' ? (
                            <Button
                              size="sm"
                              onClick={() => openAction(v, 'approved')}
                              className="h-8 rounded-lg text-xs bg-emerald-500 hover:bg-emerald-600 text-white gap-1.5 shadow-sm shadow-emerald-500/30"
                            >
                              <CheckCircle className="w-3.5 h-3.5" /> Approve
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openDetail(v)}
                              className="h-8 rounded-lg text-xs gap-1 text-muted-foreground"
                            >
                              View <ChevronRight className="w-3.5 h-3.5" />
                            </Button>
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

      {/* ── Detail Modal ─────────────────────────────────────────── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-2xl rounded-2xl p-0 overflow-hidden gap-0 max-h-[90vh] flex flex-col">
          {/* Modal header */}
          <div className="relative bg-brand-charcoal text-white px-6 pt-6 pb-5 shrink-0">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-brand-red/30 via-brand-charcoal to-brand-charcoal pointer-events-none" />
            <div className="relative">
              <DialogHeader>
                <DialogTitle className="text-white text-xl font-extrabold">Verification Review</DialogTitle>
                <DialogDescription className="text-white/60 text-sm mt-0.5">
                  {selected?.profile?.display_name || selected?.profile?.username}
                  {selected?.submitted_at && (
                    <> · Submitted {format(new Date(selected.submitted_at), 'dd MMM yyyy, h:mm a')}</>
                  )}
                </DialogDescription>
              </DialogHeader>
            </div>
          </div>

          <div className="overflow-y-auto flex-1 px-6 py-6 space-y-5">
            {selected && (
              <>
                {/* AI match banner */}
                {selected.id_extracted_name !== undefined && selected.id_extracted_name !== null ? (
                  <div className={`flex items-start gap-3 px-4 py-3.5 rounded-xl text-xs font-medium border ${
                    selected.name_match === true
                      ? 'bg-emerald-500/10 text-emerald-700 border-emerald-200'
                      : 'bg-amber-500/10 text-amber-700 border-amber-200'
                  }`}>
                    {selected.name_match === true
                      ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                    <div>
                      <span className="font-bold">
                        AI Name Match{selected.name_match_confidence ? ` · ${selected.name_match_confidence} confidence` : ''}:
                      </span>{' '}
                      {selected.name_match === true
                        ? `Extracted "${selected.id_extracted_name}" — matches submitted name`
                        : `Extracted "${selected.id_extracted_name}" — does not match submitted name`}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-medium border bg-muted/50 text-muted-foreground border-border">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    No AI name extraction data available for this submission.
                  </div>
                )}

                {/* Personal details grid */}
                <div className="grid grid-cols-2 gap-4">
                  {[
                    ['Full Legal Name', selected.full_legal_name],
                    ['Date of Birth',   selected.date_of_birth],
                    ['Phone',           selected.phone_number],
                    ['Status',          STATUS_CONFIG[selected.status]?.label],
                  ].map(([k, val]) => (
                    <div key={k} className="space-y-0.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{k}</p>
                      <p className="font-bold text-sm">{val || '—'}</p>
                    </div>
                  ))}
                  <div className="col-span-2 space-y-0.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Residential Address</p>
                    <p className="font-bold text-sm">{selected.residential_address || '—'}</p>
                  </div>
                </div>

                {/* Document images */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                  {[['Photo ID', selected.photo_id_path], ['Selfie', selected.selfie_path]].map(([label, path]) => (
                    <div key={label}>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">{label}</p>
                      {path && docUrls[path] ? (
                        <a href={docUrls[path]} target="_blank" rel="noopener noreferrer" className="block">
                          <img
                            src={docUrls[path]}
                            alt={label}
                            className="w-full h-44 object-cover rounded-xl border border-border hover:opacity-90 transition-opacity shadow-sm"
                          />
                        </a>
                      ) : path ? (
                        <button
                          onClick={() => getDocUrl(path)}
                          className="w-full h-44 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center text-sm text-muted-foreground hover:bg-muted/30 hover:border-primary/40 transition-all gap-2"
                        >
                          <Eye className="w-5 h-5 opacity-40" />
                          <span className="text-xs">Click to load</span>
                        </button>
                      ) : (
                        <div className="w-full h-44 rounded-xl border border-border bg-muted/30 flex items-center justify-center text-sm text-muted-foreground">
                          Not provided
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {selected.admin_notes && (
                  <div className="p-3.5 bg-muted/50 rounded-xl border border-border">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Admin Notes</p>
                    <p className="text-sm">{selected.admin_notes}</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Action buttons */}
          <div className="px-6 pb-6 border-t border-border pt-4 shrink-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Take Action</p>
            <div className="flex flex-wrap gap-2">
              {ACTIONS.map(a => {
                const Icon = a.icon;
                return (
                  <Button
                    key={a.value}
                    size="sm"
                    variant="outline"
                    className={`rounded-xl text-xs font-bold gap-1.5 ${a.btnCls}`}
                    onClick={() => { setDetailOpen(false); openAction(selected, a.value); }}
                  >
                    <Icon className="w-3.5 h-3.5" />{a.label}
                  </Button>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Action Confirmation Modal ────────────────────────────── */}
      <Dialog open={actionOpen} onOpenChange={setActionOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl p-0 overflow-hidden gap-0">
          <div className="relative bg-brand-charcoal text-white px-6 pt-6 pb-5">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-brand-red/30 via-brand-charcoal to-brand-charcoal pointer-events-none" />
            <div className="relative">
              <DialogHeader>
                <DialogTitle className="text-white text-lg font-extrabold flex items-center gap-2">
                  {pendingActionCfg && <pendingActionCfg.icon className="w-5 h-5" />}
                  {pendingActionCfg?.label}
                </DialogTitle>
                <DialogDescription className="text-white/60 text-sm">
                  {selected?.full_legal_name} · @{selected?.profile?.username}
                </DialogDescription>
              </DialogHeader>
            </div>
          </div>

          <div className="px-6 py-5 space-y-4">
            {pendingAction === 'info_requested' && (
              <div className="space-y-1.5">
                <Label className="font-bold text-sm">Message to User <span className="text-destructive">*</span></Label>
                <Textarea
                  value={additionalInfo}
                  onChange={e => setAdditionalInfo(e.target.value)}
                  placeholder="Describe what additional information or documents are needed…"
                  rows={3}
                  className="rounded-xl resize-none"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="font-bold text-sm">
                Admin Notes <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                value={adminNotes}
                onChange={e => setAdminNotes(e.target.value)}
                placeholder="Internal notes for the audit log…"
                rows={2}
                className="rounded-xl resize-none"
              />
            </div>
          </div>

          <DialogFooter className="px-6 pb-6 gap-2 border-t border-border pt-4">
            <Button variant="outline" onClick={() => setActionOpen(false)} disabled={saving} className="rounded-xl">
              Cancel
            </Button>
            <Button
              onClick={handleAction}
              disabled={saving || (pendingAction === 'info_requested' && !additionalInfo.trim())}
              className={`rounded-xl font-bold gap-2 ${
                pendingAction === 'approved'
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm shadow-emerald-500/30'
                  : pendingAction === 'rejected' || pendingAction === 'revoked'
                  ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'
                  : ''
              }`}
            >
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : `Confirm ${pendingActionCfg?.label || ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminVerificationDashboard;
