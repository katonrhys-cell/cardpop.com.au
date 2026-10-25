import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  TicketPercent, Plus, RefreshCw, Copy, Pencil, Trash2, History, Lock, Shuffle, Search, Loader2,
} from 'lucide-react';
import AdminPageHeader from '@/components/admin/AdminPageHeader.jsx';
import { apiServerClient as apiClient } from '@/lib/apiServerClient.js';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';

// Admin → Promo Codes. Create checkout codes with any % off, a validity window,
// a one-off or ongoing usage policy and a note of who each code was given to,
// then see every time it was used. Everything goes through /admin/promo-codes
// (service role behind the admin + MFA gate); checkout redeems codes via the
// promo_code_redemptions ledger — see src/services/promoCodeService.js.

const fmtMoney = (n) => `$${(Number(n) || 0).toFixed(2)}`;
const fmtWhen = (ts) => (ts ? format(new Date(ts), 'dd MMM yyyy, h:mm a') : '—');
const fmtDay = (ts) => (ts ? format(new Date(ts), 'dd MMM yyyy') : null);

// No 0/O/1/I/L — codes get read out loud and typed from phone screens.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const generateCode = () => {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return `CP-${Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')}`;
};

// <input type="datetime-local"> speaks local time without a zone.
const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (value) => (value ? new Date(value).toISOString() : null);

const STATUS_STYLE = {
  active: 'bg-emerald-500/10 text-emerald-700 border-emerald-300 dark:text-emerald-400',
  scheduled: 'bg-amber-500/10 text-amber-700 border-amber-300 dark:text-amber-400',
  used_up: 'bg-muted text-muted-foreground border-border',
  expired: 'bg-muted text-muted-foreground border-border',
  inactive: 'bg-red-500/10 text-red-700 border-red-300 dark:text-red-400',
};
const STATUS_LABEL = { used_up: 'used up' };

const FILTERS = [
  ['all', 'All codes'],
  ['active', 'Active'],
  ['scheduled', 'Scheduled'],
  ['used_up', 'Used up'],
  ['expired', 'Expired'],
  ['inactive', 'Deactivated'],
];

const REDEMPTION_STYLE = {
  redeemed: 'bg-emerald-500/10 text-emerald-700 border-emerald-300 dark:text-emerald-400',
  reserved: 'bg-amber-500/10 text-amber-700 border-amber-300 dark:text-amber-400',
  released: 'bg-muted text-muted-foreground border-border',
};
const REDEMPTION_LABEL = { reserved: 'at checkout', released: 'abandoned' };

const EMPTY_FORM = {
  code: '',
  discountPct: '10',
  appliesTo: 'shop',
  usageType: 'single_use',
  maxRedemptions: '',
  oncePerCustomer: true,
  minOrderAud: '',
  maxDiscountAud: '',
  startsAt: '',
  expiresAt: '',
  issuedToName: '',
  issuedToEmail: '',
  restrictToEmail: false,
  description: '',
  notes: '',
  active: true,
};

const formFromCode = (c) => ({
  code: c.code,
  discountPct: String(Number(c.discount_pct)),
  appliesTo: c.applies_to,
  usageType: c.usage_type,
  maxRedemptions: c.max_redemptions != null ? String(c.max_redemptions) : '',
  oncePerCustomer: c.once_per_customer,
  minOrderAud: c.min_order_aud != null ? String(Number(c.min_order_aud)) : '',
  maxDiscountAud: c.max_discount_aud != null ? String(Number(c.max_discount_aud)) : '',
  startsAt: toLocalInput(c.starts_at),
  expiresAt: toLocalInput(c.expires_at),
  issuedToName: c.issued_to_name || '',
  issuedToEmail: c.issued_to_email || '',
  restrictToEmail: c.restrict_to_email,
  description: c.description || '',
  notes: c.notes || '',
  active: c.active,
});

const bodyFromForm = (f) => ({
  code: f.code.trim().toUpperCase(),
  discountPct: Number(f.discountPct),
  appliesTo: f.appliesTo,
  usageType: f.usageType,
  maxRedemptions: f.usageType === 'ongoing' && f.maxRedemptions !== '' ? Number(f.maxRedemptions) : null,
  oncePerCustomer: f.usageType === 'ongoing' ? f.oncePerCustomer : true,
  minOrderAud: f.minOrderAud === '' ? null : Number(f.minOrderAud),
  maxDiscountAud: f.maxDiscountAud === '' ? null : Number(f.maxDiscountAud),
  startsAt: fromLocalInput(f.startsAt),
  expiresAt: fromLocalInput(f.expiresAt),
  issuedToName: f.issuedToName,
  issuedToEmail: f.issuedToEmail,
  restrictToEmail: f.restrictToEmail,
  description: f.description,
  notes: f.notes,
  active: f.active,
});

const usageSummary = (c) => {
  if (c.usage_type === 'single_use') return 'One-off · single use';
  const parts = ['Ongoing'];
  parts.push(c.max_redemptions ? `max ${c.max_redemptions} uses` : 'unlimited');
  if (c.once_per_customer) parts.push('once per customer');
  return parts.join(' · ');
};

const StatCard = ({ label, value, loading }) => (
  <Card className="border-border shadow-sm">
    <CardContent className="p-5">
      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      {loading ? <Skeleton className="h-9 w-20 mt-3" /> : <p className="text-3xl font-extrabold tabular-nums tracking-tight text-foreground mt-2">{value}</p>}
    </CardContent>
  </Card>
);

const copyCode = async (code) => {
  try {
    await navigator.clipboard.writeText(code);
    toast.success(`Copied ${code}`);
  } catch {
    toast.error('Could not copy to clipboard');
  }
};

const PromoCodesAdminPage = () => {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const [editing, setEditing] = useState(null); // null | 'new' | code row
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [usageFor, setUsageFor] = useState(null);
  const [usage, setUsage] = useState([]);
  const [usageLoading, setUsageLoading] = useState(false);

  const [deleting, setDeleting] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.fetch('/admin/promo-codes');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCodes(data.codes ?? []);
    } catch {
      toast.error('Failed to load promo codes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return codes.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (!q) return true;
      return [c.code, c.issued_to_name, c.issued_to_email, c.description]
        .some((v) => v && v.toLowerCase().includes(q));
    });
  }, [codes, statusFilter, search]);

  const totals = useMemo(() => ({
    active: codes.filter((c) => c.status === 'active').length,
    uses: codes.reduce((n, c) => n + (c.redeemed_count || 0), 0),
    discount: codes.reduce((n, c) => n + (c.total_discount_aud || 0), 0),
  }), [codes]);

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  const setFromEvent = (key) => (e) => set(key)(e.target.value);

  const openNew = () => {
    setForm({ ...EMPTY_FORM, code: generateCode() });
    setEditing('new');
  };
  const openEdit = (c) => {
    setForm(formFromCode(c));
    setEditing(c);
  };

  const save = async (e) => {
    e.preventDefault();
    if (form.restrictToEmail && !form.issuedToEmail.trim()) {
      toast.error('Add the recipient’s email to lock the code to them.');
      return;
    }
    setSaving(true);
    try {
      const isNew = editing === 'new';
      const res = await apiClient.fetch(isNew ? '/admin/promo-codes' : `/admin/promo-codes/${editing.id}`, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyFromForm(form)),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save the code');
      toast.success(isNew ? `Created ${data.code.code}` : `Saved ${data.code.code}`);
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (c) => {
    try {
      const res = await apiClient.fetch(`/admin/promo-codes/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !c.active }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not update the code');
      toast.success(c.active ? `${c.code} deactivated` : `${c.code} reactivated`);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const confirmDelete = async () => {
    const c = deleting;
    try {
      const res = await apiClient.fetch(`/admin/promo-codes/${c.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not delete the code');
      toast.success(`${c.code} deleted`);
      setDeleting(null);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const openUsage = async (c) => {
    setUsageFor(c);
    setUsage([]);
    setUsageLoading(true);
    try {
      const res = await apiClient.fetch(`/admin/promo-codes/${c.id}/redemptions`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setUsage(data.redemptions ?? []);
    } catch {
      toast.error('Failed to load usage');
    } finally {
      setUsageLoading(false);
    }
  };

  const isNew = editing === 'new';
  const codeLocked = !isNew && editing && (editing.redeemed_count > 0);

  return (
    <div className="space-y-8">
      <Helmet><title>Promo Codes | Admin</title></Helmet>

      <AdminPageHeader
        icon={TicketPercent}
        title="Promo Codes"
        subtitle="Create discount codes, track who they went to and every time they’re used."
      >
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading}
            className="rounded-xl h-10 px-4 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button onClick={openNew} className="rounded-xl h-10 px-4">
            <Plus className="w-4 h-4 mr-2" /> New code
          </Button>
        </div>
      </AdminPageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Active codes" value={totals.active} loading={loading} />
        <StatCard label="Times used" value={totals.uses} loading={loading} />
        <StatCard label="Discount given" value={fmtMoney(totals.discount)} loading={loading} />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search code, recipient or label"
            aria-label="Search promo codes" className="pl-9 h-10 rounded-xl" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger aria-label="Filter by status" className="w-full sm:w-[220px] h-10 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            {FILTERS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="shadow-sm border-border overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4"><TicketPercent className="w-8 h-8 text-primary/40" /></div>
            <p className="font-bold text-lg mb-1">{codes.length ? 'No matching codes' : 'No promo codes yet'}</p>
            <p className="text-muted-foreground text-sm mb-4">
              {codes.length ? 'Nothing matches your search or filter.' : 'Create one to give someone a discount at checkout.'}
            </p>
            {!codes.length && <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" /> New code</Button>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-border bg-muted/30">
                  <TableHead className="px-6 py-4 text-xs font-bold uppercase tracking-wider">Code</TableHead>
                  <TableHead className="py-4 text-xs font-bold uppercase tracking-wider">Discount</TableHead>
                  <TableHead className="py-4 text-xs font-bold uppercase tracking-wider">Given to</TableHead>
                  <TableHead className="py-4 text-xs font-bold uppercase tracking-wider">Valid</TableHead>
                  <TableHead className="py-4 text-xs font-bold uppercase tracking-wider">Used</TableHead>
                  <TableHead className="py-4 text-xs font-bold uppercase tracking-wider">Status</TableHead>
                  <TableHead className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => {
                  const cap = c.usage_type === 'single_use' ? 1 : c.max_redemptions;
                  return (
                    <TableRow key={c.id} className="hover:bg-muted/40 transition-colors align-top">
                      <TableCell className="px-6 py-4">
                        <button type="button" onClick={() => copyCode(c.code)} title="Copy code"
                          className="inline-flex items-center gap-1.5 font-mono font-bold tracking-wider text-sm text-foreground hover:text-primary">
                          {c.code} <Copy className="w-3 h-3 shrink-0" />
                        </button>
                        {c.description && <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>}
                        <p className="text-[11px] text-muted-foreground mt-0.5">{usageSummary(c)}</p>
                      </TableCell>
                      <TableCell className="py-4 text-sm">
                        <p className="font-bold tabular-nums">{Number(c.discount_pct)}% off</p>
                        <p className="text-xs text-muted-foreground">{c.applies_to === 'all' ? 'Whole cart' : 'Shop items only'}</p>
                        {c.max_discount_aud != null && <p className="text-xs text-muted-foreground">Up to {fmtMoney(c.max_discount_aud)}</p>}
                        {c.min_order_aud != null && <p className="text-xs text-muted-foreground">Min spend {fmtMoney(c.min_order_aud)}</p>}
                      </TableCell>
                      <TableCell className="py-4 text-sm">
                        {c.issued_to_name || c.issued_to_email ? (
                          <>
                            {c.issued_to_name && <p className="font-medium">{c.issued_to_name}</p>}
                            {c.issued_to_email && (
                              <a href={`mailto:${c.issued_to_email}`} className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1">
                                {c.restrict_to_email && <Lock className="w-3 h-3" aria-label="Only this person can use it" />}
                                {c.issued_to_email}
                              </a>
                            )}
                          </>
                        ) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="py-4 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                        {c.starts_at && <p>From {fmtDay(c.starts_at)}</p>}
                        <p>{c.expires_at ? `Until ${fmtDay(c.expires_at)}` : 'No expiry'}</p>
                      </TableCell>
                      <TableCell className="py-4 text-sm tabular-nums">
                        <p className="font-bold">{c.redeemed_count}{cap ? ` / ${cap}` : ''}</p>
                        {c.total_discount_aud > 0 && <p className="text-xs text-muted-foreground">{fmtMoney(c.total_discount_aud)} off</p>}
                        {c.last_used_at && <p className="text-[11px] text-muted-foreground">Last {fmtDay(c.last_used_at)}</p>}
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge variant="outline" className={`font-bold text-xs capitalize ${STATUS_STYLE[c.status] || ''}`}>
                          {STATUS_LABEL[c.status] || c.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openUsage(c)} title="Usage history" aria-label={`Usage history for ${c.code}`}>
                            <History className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => openEdit(c)} title="Edit" aria-label={`Edit ${c.code}`}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Switch checked={c.active} onCheckedChange={() => toggleActive(c)}
                            aria-label={c.active ? `Deactivate ${c.code}` : `Activate ${c.code}`} className="mx-1" />
                          {c.redeemed_count === 0 && (
                            <Button size="icon" variant="ghost" onClick={() => setDeleting(c)} title="Delete" aria-label={`Delete ${c.code}`}
                              className="text-red-600 hover:text-red-700">
                              <Trash2 className="w-4 h-4" />
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

      {/* Create / edit */}
      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={save} className="space-y-5">
            <DialogHeader>
              <DialogTitle>{isNew ? 'New promo code' : `Edit ${editing?.code || ''}`}</DialogTitle>
              <DialogDescription>
                Buyers enter it in the Promo Code box at checkout (signed-in accounts only). CardPop funds
                the discount — sellers are still paid in full.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-1.5">
              <Label htmlFor="promo-code">Code</Label>
              <div className="flex gap-2">
                <Input id="promo-code" value={form.code} required disabled={codeLocked}
                  onChange={(e) => set('code')(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
                  maxLength={30} className="font-mono tracking-wider" />
                {!codeLocked && (
                  <Button type="button" variant="outline" onClick={() => set('code')(generateCode())}>
                    <Shuffle className="w-4 h-4 mr-2" /> Generate
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {codeLocked ? 'This code has been used, so its text is fixed.' : '4–30 letters, numbers or hyphens — e.g. SAM-VIP or SPRING25.'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="promo-pct">Percentage off</Label>
                <div className="relative">
                  <Input id="promo-pct" type="number" min="0.01" max="100" step="0.01" required
                    value={form.discountPct} onChange={setFromEvent('discountPct')} className="pr-8" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="promo-applies">Applies to</Label>
                <Select value={form.appliesTo} onValueChange={set('appliesTo')}>
                  <SelectTrigger id="promo-applies"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="shop">CardPop Shop items only</SelectItem>
                    <SelectItem value="all">Whole cart (incl. marketplace cards)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.appliesTo === 'all' && (
              <p className="text-xs text-amber-700 dark:text-amber-400 -mt-2">
                On marketplace cards CardPop pays the discount out of its own pocket — consider a maximum discount.
              </p>
            )}

            <div className="space-y-2">
              <Label>Type</Label>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Code type">
                {[
                  ['single_use', 'One-off', 'Works once, for one person, then it’s done.'],
                  ['ongoing', 'Ongoing', 'Reusable until it expires or hits a limit.'],
                ].map(([value, label, hint]) => (
                  <button key={value} type="button" role="radio" aria-checked={form.usageType === value}
                    onClick={() => set('usageType')(value)}
                    className={`text-left rounded-xl border p-3 transition-colors ${form.usageType === value ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'}`}>
                    <p className="font-bold text-sm">{label}</p>
                    <p className="text-xs text-muted-foreground">{hint}</p>
                  </button>
                ))}
              </div>
            </div>

            {form.usageType === 'ongoing' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                <div className="space-y-1.5">
                  <Label htmlFor="promo-max">Total uses allowed</Label>
                  <Input id="promo-max" type="number" min="1" step="1" placeholder="Unlimited"
                    value={form.maxRedemptions} onChange={setFromEvent('maxRedemptions')} />
                </div>
                <label className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 h-10">
                  <span className="text-sm">Once per customer</span>
                  <Switch checked={form.oncePerCustomer} onCheckedChange={set('oncePerCustomer')} />
                </label>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="promo-starts">Starts (optional)</Label>
                <Input id="promo-starts" type="datetime-local" value={form.startsAt} onChange={setFromEvent('startsAt')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="promo-expires">Expires (optional)</Label>
                <Input id="promo-expires" type="datetime-local" value={form.expiresAt} onChange={setFromEvent('expiresAt')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="promo-min">Minimum spend $ (optional)</Label>
                <Input id="promo-min" type="number" min="0" step="0.01" value={form.minOrderAud} onChange={setFromEvent('minOrderAud')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="promo-cap">Maximum discount $ (optional)</Label>
                <Input id="promo-cap" type="number" min="0.01" step="0.01" value={form.maxDiscountAud} onChange={setFromEvent('maxDiscountAud')} />
              </div>
            </div>

            <div className="rounded-xl border border-border p-4 space-y-4">
              <p className="text-sm font-bold">Who it’s for</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="promo-name">Name</Label>
                  <Input id="promo-name" value={form.issuedToName} onChange={setFromEvent('issuedToName')} maxLength={120} placeholder="e.g. Sam Lee" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="promo-email">Email</Label>
                  <Input id="promo-email" type="email" value={form.issuedToEmail} onChange={setFromEvent('issuedToEmail')} maxLength={254} />
                </div>
              </div>
              <label className="flex items-start justify-between gap-3">
                <span>
                  <span className="text-sm block">Only this person can use it</span>
                  <span className="text-xs text-muted-foreground">Checkout matches their CardPop login email.</span>
                </span>
                <Switch checked={form.restrictToEmail} onCheckedChange={set('restrictToEmail')} />
              </label>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="promo-desc">Label (optional)</Label>
              <Input id="promo-desc" value={form.description} onChange={setFromEvent('description')} maxLength={200} placeholder="e.g. Instagram giveaway October" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="promo-notes">Notes (optional)</Label>
              <Textarea id="promo-notes" value={form.notes} onChange={setFromEvent('notes')} maxLength={2000} rows={3} />
            </div>

            <label className="flex items-center justify-between gap-3">
              <span className="text-sm">Active</span>
              <Switch checked={form.active} onCheckedChange={set('active')} />
            </label>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isNew ? 'Create code' : 'Save changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Usage history */}
      <Dialog open={!!usageFor} onOpenChange={(open) => { if (!open) setUsageFor(null); }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono tracking-wider">{usageFor?.code}</DialogTitle>
            <DialogDescription>
              Every checkout that used this code. “At checkout” means the buyer is paying right now;
              “abandoned” checkouts don’t count towards the limit.
            </DialogDescription>
          </DialogHeader>
          {usageLoading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}</div>
          ) : usage.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Not used yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>When</TableHead>
                    <TableHead>Buyer</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead className="text-right">Discount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usage.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs tabular-nums whitespace-nowrap">{fmtWhen(r.redeemed_at || r.reserved_at)}</TableCell>
                      <TableCell className="text-sm">
                        <p className="font-medium">{r.buyer?.display_name || r.buyer?.username || '—'}</p>
                        {(r.buyer?.email || r.buyer_email) && (
                          <a href={`mailto:${r.buyer?.email || r.buyer_email}`} className="text-xs text-muted-foreground hover:text-primary">
                            {r.buyer?.email || r.buyer_email}
                          </a>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.order ? (
                          <>
                            <p className="font-mono">#{String(r.order.id).slice(0, 8)}</p>
                            <p className="text-muted-foreground">{fmtMoney(r.order.total_aud)} · {r.order.status}</p>
                          </>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-bold">{fmtMoney(r.discount_aud)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs capitalize ${REDEMPTION_STYLE[r.status] || ''}`}>
                          {REDEMPTION_LABEL[r.status] || r.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={!!deleting} onOpenChange={(open) => { if (!open) setDeleting(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleting?.code}?</DialogTitle>
            <DialogDescription>
              It has never been used, so it can be removed completely. Codes with usage history can only be deactivated.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PromoCodesAdminPage;
