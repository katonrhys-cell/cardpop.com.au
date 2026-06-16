import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet';
import {
  ShieldCheck, ShieldAlert, Clock, Eye, CheckCircle, XCircle,
  Search, RefreshCw, Loader2, User, FileText, MessageSquare, AlertCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { format } from 'date-fns';

const STATUS_CONFIG = {
  pending:   { label: 'Pending',   cls: 'bg-amber-500/10 text-amber-700 border-amber-300',   icon: Clock },
  approved:  { label: 'Approved',  cls: 'bg-emerald-500/10 text-emerald-700 border-emerald-300', icon: CheckCircle },
  rejected:  { label: 'Rejected',  cls: 'bg-destructive/10 text-destructive border-destructive/30', icon: XCircle },
  suspended: { label: 'Suspended', cls: 'bg-amber-500/10 text-amber-700 border-amber-300',   icon: ShieldAlert },
  revoked:   { label: 'Revoked',   cls: 'bg-destructive/10 text-destructive border-destructive/30', icon: ShieldAlert },
};

const ACTIONS = [
  { value: 'approved',   label: 'Approve Verification', color: 'emerald' },
  { value: 'rejected',   label: 'Reject Verification',  color: 'destructive' },
  { value: 'suspended',  label: 'Suspend Verification', color: 'amber' },
  { value: 'revoked',    label: 'Revoke Verification',  color: 'destructive' },
  { value: 'info_requested', label: 'Request More Info', color: 'blue' },
];

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
          .select(`
            *,
            profile:profiles!user_id(display_name, username, email:id, is_verified, verification_status, created_at, total_sales, reviews_count, rating)
          `)
          .order('submitted_at', { ascending: false });

        if (statusFilter !== 'all') query = query.eq('status', statusFilter);

        const { data, error } = await query;
        if (error) throw error;
        if (!cancelled) setVerifications(data ?? []);
      } catch (err) {
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

      // Log the action
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

  const pendingCount = verifications.filter(v => v.status === 'pending').length;

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300 py-6 px-4 sm:px-6 md:px-8 max-w-7xl mx-auto">
      <Helmet><title>Verification Management | Admin</title></Helmet>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Verification Management</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {pendingCount > 0 ? `${pendingCount} pending review${pendingCount !== 1 ? 's' : ''}` : 'No pending reviews'}
          </p>
        </div>
        <Button variant="outline" onClick={() => fetchRef.current?.()} disabled={loading} className="rounded-xl h-10 px-4">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or username…" className="pl-9 h-10 rounded-xl" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px] h-10 rounded-xl">
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

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <ShieldCheck className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-30" />
            <p className="font-bold text-lg mb-1">No verifications found</p>
            <p className="text-muted-foreground text-sm">No submissions match your current filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-6">User</TableHead>
                  <TableHead>Legal Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Reviewed</TableHead>
                  <TableHead className="px-6 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(v => {
                  const cfg = STATUS_CONFIG[v.status] || STATUS_CONFIG.pending;
                  const Icon = cfg.icon;
                  return (
                    <TableRow key={v.id}>
                      <TableCell className="px-6">
                        <p className="font-bold text-sm">{v.profile?.display_name || v.profile?.username || '—'}</p>
                        <p className="text-xs text-muted-foreground">@{v.profile?.username}</p>
                      </TableCell>
                      <TableCell className="font-medium text-sm">{v.full_legal_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`font-bold text-xs ${cfg.cls}`}>
                          <Icon className="w-3 h-3 mr-1 inline-block" />{cfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground tabular-nums">
                        {v.submitted_at ? format(new Date(v.submitted_at), 'dd MMM yyyy') : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground tabular-nums">
                        {v.reviewed_at ? format(new Date(v.reviewed_at), 'dd MMM yyyy') : '—'}
                      </TableCell>
                      <TableCell className="px-6">
                        <div className="flex items-center justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => openDetail(v)} className="h-8 rounded-lg text-xs gap-1">
                            <Eye className="w-3.5 h-3.5" /> Review
                          </Button>
                          {v.status === 'pending' && (
                            <Button size="sm" onClick={() => openAction(v, 'approved')} className="h-8 rounded-lg text-xs bg-emerald-500 hover:bg-emerald-600 text-white gap-1">
                              <CheckCircle className="w-3.5 h-3.5" /> Approve
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
      </div>

      {/* Detail Modal */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-2xl rounded-2xl p-0 overflow-hidden gap-0 max-h-[90vh] flex flex-col">
          <div className="px-6 pt-6 pb-4 border-b border-border shrink-0">
            <DialogHeader>
              <DialogTitle>Verification Review</DialogTitle>
              <DialogDescription>
                {selected?.profile?.display_name || selected?.profile?.username} • Submitted {selected?.submitted_at ? format(new Date(selected.submitted_at), 'dd MMM yyyy, h:mm a') : ''}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
            {selected && (
              <>
                {/* AI name extraction result */}
                {(selected.id_extracted_name !== undefined && selected.id_extracted_name !== null) ? (
                  <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-medium border ${
                    selected.name_match === true
                      ? 'bg-emerald-500/10 text-emerald-700 border-emerald-200'
                      : selected.name_match === false
                      ? 'bg-amber-500/10 text-amber-700 border-amber-200'
                      : 'bg-muted text-muted-foreground border-border'
                  }`}>
                    {selected.name_match === true
                      ? <CheckCircle className="w-4 h-4 shrink-0" />
                      : <AlertCircle className="w-4 h-4 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <span className="font-bold">AI Name Match{selected.name_match_confidence ? ` (${selected.name_match_confidence} confidence)` : ''}:</span>{' '}
                      {selected.name_match === true
                        ? `Extracted "${selected.id_extracted_name}" — matches submitted name`
                        : `Extracted "${selected.id_extracted_name}" — does not match submitted name`}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-medium border bg-muted text-muted-foreground border-border">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>No AI name extraction data available for this submission</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {[
                    ['Full Legal Name', selected.full_legal_name],
                    ['Date of Birth', selected.date_of_birth],
                    ['Phone', selected.phone_number],
                    ['Status', STATUS_CONFIG[selected.status]?.label],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <p className="text-xs text-muted-foreground font-medium mb-0.5">{k}</p>
                      <p className="font-bold text-sm">{v || '—'}</p>
                    </div>
                  ))}
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground font-medium mb-0.5">Residential Address</p>
                    <p className="font-bold text-sm">{selected.residential_address}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                  {[
                    ['Photo ID', selected.photo_id_path],
                    ['Selfie', selected.selfie_path],
                  ].map(([label, path]) => (
                    <div key={label}>
                      <p className="text-xs text-muted-foreground font-medium mb-2">{label}</p>
                      {path && docUrls[path] ? (
                        <a href={docUrls[path]} target="_blank" rel="noopener noreferrer">
                          <img src={docUrls[path]} alt={label} className="w-full h-40 object-cover rounded-xl border border-border hover:opacity-90 transition-opacity" />
                        </a>
                      ) : path ? (
                        <button onClick={() => getDocUrl(path)} className="w-full h-40 rounded-xl border border-dashed border-border flex items-center justify-center text-sm text-muted-foreground hover:bg-muted/30 transition-colors gap-2">
                          <Eye className="w-4 h-4" /> Click to load document
                        </button>
                      ) : (
                        <div className="w-full h-40 rounded-xl border border-border bg-muted/30 flex items-center justify-center text-sm text-muted-foreground">Not provided</div>
                      )}
                    </div>
                  ))}
                </div>

                {selected.admin_notes && (
                  <div className="p-3 bg-muted/50 rounded-xl border border-border">
                    <p className="text-xs font-bold text-muted-foreground mb-1">Admin Notes</p>
                    <p className="text-sm">{selected.admin_notes}</p>
                  </div>
                )}
              </>
            )}
          </div>
          <div className="px-6 pb-6 border-t border-border pt-4 flex flex-wrap gap-2 shrink-0">
            {ACTIONS.map(a => (
              <Button
                key={a.value}
                size="sm"
                variant={a.value === 'approved' ? 'default' : 'outline'}
                className={`rounded-xl text-xs font-bold gap-1 ${a.value === 'approved' ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : a.value === 'rejected' || a.value === 'revoked' ? 'text-destructive border-destructive/30 hover:bg-destructive/10' : ''}`}
                onClick={() => { setDetailOpen(false); openAction(selected, a.value); }}
              >
                {a.label}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Action Confirmation Modal */}
      <Dialog open={actionOpen} onOpenChange={setActionOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>{ACTIONS.find(a => a.value === pendingAction)?.label}</DialogTitle>
            <DialogDescription>
              For: {selected?.full_legal_name} (@{selected?.profile?.username})
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {pendingAction === 'info_requested' && (
              <div className="space-y-1.5">
                <Label className="font-bold text-sm">Message to User *</Label>
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
              <Label className="font-bold text-sm">Admin Notes <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Textarea
                value={adminNotes}
                onChange={e => setAdminNotes(e.target.value)}
                placeholder="Internal notes for the audit log…"
                rows={2}
                className="rounded-xl resize-none"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setActionOpen(false)} disabled={saving} className="rounded-xl">Cancel</Button>
            <Button
              onClick={handleAction}
              disabled={saving || (pendingAction === 'info_requested' && !additionalInfo.trim())}
              className={`rounded-xl font-bold gap-2 ${pendingAction === 'approved' ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : ''}`}
            >
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminVerificationDashboard;
