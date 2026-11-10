import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Plus, Search, Pencil, Trash2, RefreshCw, ExternalLink, Handshake, GripVertical, BadgeCheck } from 'lucide-react';
import WebsiteBadgeDialog from '@/components/WebsiteBadgeDialog.jsx';
import { gradingPartnerBadgeSnippet } from '@/utils/websiteBadge.js';
import AdminPageHeader from '@/components/admin/AdminPageHeader.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient.js';
import { GRADING_PARTNER_ADMIN_COLUMNS } from '@/lib/gradingPartners.js';
import { GRADING_COMPANIES, graderStyle } from '@/data/gradingCompanies.js';
import GraderLogo from '@/components/grading/GraderLogo.jsx';
import {
  cleanCompanies, cleanCompanyLinks, companyForKey, gradingPartnerSlug, gradingPartnersPath, parseCategories, partnerDomain,
} from '@/utils/gradingPartners.js';

const EMPTY = {
  name: '', slug: '', website: '', location: '', description: '', companies: [], company_links: {}, categories: '', notes: '',
  sort_order: 100, is_active: true,
};

const toForm = (p) => ({
  ...EMPTY,
  ...p,
  location: p.location || '', description: p.description || '', notes: p.notes || '',
  companies: cleanCompanies(p.companies),
  company_links: cleanCompanyLinks(p.company_links),
  categories: (p.categories || []).join(', '),
});

const HTTP = /^https?:\/\//i;

/** Form → row. Returns { row } or { errors }. Exported for tests. */
export const buildGradingPartnerRow = (form) => {
  const errors = {};
  const name = String(form.name || '').trim();
  const slug = gradingPartnerSlug(form.slug || name);
  const website = String(form.website || '').trim();
  const companies = cleanCompanies(form.companies);
  if (!name) errors.name = 'Name is required.';
  if (!slug) errors.slug = 'Slug is required.';
  if (!HTTP.test(website)) errors.website = 'Enter the full website address, starting with https://.';
  if (!companies.length) errors.companies = 'Tick at least one grading company this partner submits to.';
  const links = {};
  for (const [k, v] of Object.entries(form.company_links || {})) {
    const url = String(v || '').trim();
    if (!url) continue;
    if (!HTTP.test(url)) { errors[`link_${k}`] = 'Links must start with https://.'; continue; }
    links[k] = url;
  }
  const sortOrder = Number(form.sort_order);
  if (Object.keys(errors).length) return { errors };
  const nul = (v) => { const s = String(v ?? '').trim(); return s || null; };
  return {
    row: {
      name,
      slug,
      website,
      location: nul(form.location),
      description: nul(form.description),
      companies,
      company_links: cleanCompanyLinks(links),
      categories: parseCategories(form.categories),
      notes: nul(form.notes),
      sort_order: Number.isFinite(sortOrder) ? Math.trunc(sortOrder) : 100,
      is_active: form.is_active !== false,
    },
  };
};

const matches = (p, q) => {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return [p.name, p.slug, p.location, p.website, ...(p.companies || []), ...(p.categories || [])]
    .some((v) => String(v || '').toLowerCase().includes(s));
};

const GradingPartnersAdminPage = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [badgePartner, setBadgePartner] = useState(null);
  const [editing, setEditing] = useState(null); // null | 'new' | row
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const load = async (showToast = false) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('grading_submission_partners')
      .select(GRADING_PARTNER_ADMIN_COLUMNS)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })
      .limit(500);
    setLoading(false);
    if (error) { toast.error(`Could not load partners: ${error.message}`); return; }
    setRows(data || []);
    if (showToast) toast.success('Partners refreshed');
  };

  useEffect(() => { load(); }, []);

  const visible = useMemo(() => rows.filter((p) => matches(p, query)), [rows, query]);

  const openNew = () => { setForm(EMPTY); setErrors({}); setEditing('new'); };
  const openEdit = (p) => { setForm(toForm(p)); setErrors({}); setEditing(p); };
  const close = () => { if (!saving) { setEditing(null); setErrors({}); } };
  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const toggleCompany = (k) => setForm((f) => ({
    ...f,
    companies: f.companies.includes(k) ? f.companies.filter((x) => x !== k) : [...f.companies, k],
  }));
  const setLink = (k, value) => setForm((f) => ({ ...f, company_links: { ...f.company_links, [k]: value } }));

  const save = async (e) => {
    e.preventDefault();
    const built = buildGradingPartnerRow(form);
    if (built.errors) { setErrors(built.errors); return; }
    setSaving(true);
    const isNew = editing === 'new';
    const q = isNew
      ? supabase.from('grading_submission_partners').insert(built.row).select(GRADING_PARTNER_ADMIN_COLUMNS).single()
      : supabase.from('grading_submission_partners').update(built.row).eq('id', editing.id).select(GRADING_PARTNER_ADMIN_COLUMNS).single();
    const { data, error } = await q;
    setSaving(false);
    if (error) {
      if (error.code === '23505') setErrors({ slug: 'That slug is already used by another partner.' });
      else toast.error(`Save failed: ${error.message}`);
      return;
    }
    setRows((list) => (isNew ? [...list, data] : list.map((p) => (p.id === data.id ? data : p))).sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)));
    setEditing(null);
    toast.success(isNew ? `${data.name} added` : `${data.name} saved`);
  };

  const toggleActive = async (p) => {
    const { error } = await supabase.from('grading_submission_partners').update({ is_active: !p.is_active }).eq('id', p.id);
    if (error) { toast.error(`Could not update: ${error.message}`); return; }
    setRows((list) => list.map((x) => (x.id === p.id ? { ...x, is_active: !p.is_active } : x)));
  };

  const remove = async () => {
    if (!deleting) return;
    const { error } = await supabase.from('grading_submission_partners').delete().eq('id', deleting.id);
    if (error) { toast.error(`Delete failed: ${error.message}`); return; }
    setRows((list) => list.filter((p) => p.id !== deleting.id));
    toast.success(`${deleting.name} deleted`);
    setDeleting(null);
  };

  return (
    <div className="container-default py-8">
      <Helmet><title>Grading Partners | Admin | CardPop</title></Helmet>
      <AdminPageHeader
        title="Grading Partners"
        subtitle="The Australian stores and services that submit cards to PSA, Beckett, CGC, ACE, SGC and TAG. Shown on Submission Partners (filtered by company — where every “Grade with…” button on the estimator lands) and on Compare Companies."
      >
        <Button variant="outline" size="sm" onClick={() => load(true)}><RefreshCw className="mr-1.5 h-4 w-4" /> Refresh</Button>
        <Button size="sm" onClick={openNew}><Plus className="mr-1.5 h-4 w-4" /> Add partner</Button>
      </AdminPageHeader>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search partners, companies, locations…" className="pl-9" aria-label="Search partners" />
        </div>
        <p className="text-sm text-muted-foreground">
          {rows.length} partner{rows.length === 1 ? '' : 's'} · {rows.filter((p) => p.is_active).length} active ·{' '}
          <Link to={gradingPartnersPath()} className="text-primary hover:underline">view public page</Link>
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"><span className="sr-only">Order</span></TableHead>
              <TableHead>Partner</TableHead>
              <TableHead>Submits to</TableHead>
              <TableHead className="hidden md:table-cell">Location</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array(5).fill(0).map((_, i) => (
                <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
              ))
            ) : visible.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                {rows.length ? 'No partner matches that search.' : 'No partners yet — add the first one.'}
              </TableCell></TableRow>
            ) : visible.map((p) => (
              <TableRow key={p.id} className={p.is_active ? '' : 'opacity-60'}>
                <TableCell className="text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><GripVertical className="h-3 w-3" />{p.sort_order}</span></TableCell>
                <TableCell>
                  <p className="font-bold text-foreground">{p.name}</p>
                  <a href={p.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
                    {partnerDomain(p.website) || p.website} <ExternalLink className="h-3 w-3" />
                  </a>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {cleanCompanies(p.companies).map(companyForKey).filter(Boolean).map((g) => (
                      <span key={g.key} className="inline-flex items-center h-6 px-1.5 rounded-md border border-[var(--grader-border)] dark:border-[var(--grader-border-dark)] bg-[var(--grader-tint)] dark:bg-[var(--grader-tint-dark)]" style={graderStyle(g)} title={g.full}>
                        <GraderLogo grader={g} height={12} wordmarkClassName="text-[10px]" />
                      </span>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{p.location || '—'}</TableCell>
                <TableCell>
                  <Switch checked={!!p.is_active} onCheckedChange={() => toggleActive(p)} aria-label={`Show ${p.name}`} />
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => setBadgePartner(p)} aria-label={`Website badge for ${p.name}`} title="Website badge"><BadgeCheck className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(p)} aria-label={`Edit ${p.name}`}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleting(p)} aria-label={`Delete ${p.name}`}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={editing !== null} onOpenChange={(o) => { if (!o) close(); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <form onSubmit={save} className="space-y-5">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Handshake className="h-5 w-5 text-primary" /> {editing === 'new' ? 'Add partner' : `Edit ${editing?.name || ''}`}</DialogTitle>
              <DialogDescription>A store or service that submits cards to a grading company on a collector's behalf. Plain text; keep the description to a sentence or two and never promise a turnaround CardPop can't vouch for.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="gp-name">Name *</Label>
                <Input id="gp-name" value={form.name} onChange={(e) => setField('name', e.target.value)} required />
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gp-slug">Slug</Label>
                <Input id="gp-slug" value={form.slug} onChange={(e) => setField('slug', e.target.value)} placeholder={gradingPartnerSlug(form.name) || 'auto from name'} />
                {errors.slug && <p className="text-xs text-destructive">{errors.slug}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gp-website">Website *</Label>
                <Input id="gp-website" value={form.website} onChange={(e) => setField('website', e.target.value)} placeholder="https://…" required />
                {errors.website && <p className="text-xs text-destructive">{errors.website}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gp-location">Location</Label>
                <Input id="gp-location" value={form.location} onChange={(e) => setField('location', e.target.value)} placeholder="Melbourne, VIC · Australia-wide (mail-in)" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="gp-description">Description</Label>
              <Textarea id="gp-description" rows={3} value={form.description} onChange={(e) => setField('description', e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Submits to *</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {GRADING_COMPANIES.map((g) => {
                  const k = g.key.toLowerCase();
                  const on = form.companies.includes(k);
                  return (
                    <div key={g.key} className={`rounded-xl border p-3 ${on ? 'border-[var(--grader-ink)] dark:border-[var(--grader-ink-dark)] bg-[var(--grader-tint)] dark:bg-[var(--grader-tint-dark)]' : 'border-border'}`} style={graderStyle(g)}>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={on} onChange={() => toggleCompany(k)} aria-label={`Submits to ${g.name}`} className="h-4 w-4" />
                        <GraderLogo grader={g} height={16} wordmarkClassName="text-sm" />
                        <span className="text-sm">{g.full}</span>
                      </label>
                      {on && (
                        <div className="mt-2">
                          <Input value={form.company_links[k] || ''} onChange={(e) => setLink(k, e.target.value)} placeholder={`Their ${g.name} page (optional) — https://…`} aria-label={`${g.name} page link`} className="h-8 text-xs" />
                          {errors[`link_${k}`] && <p className="text-xs text-destructive mt-1">{errors[`link_${k}`]}</p>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {errors.companies && <p className="text-xs text-destructive">{errors.companies}</p>}
              <p className="text-[11px] text-muted-foreground">The public page links the card to the company-specific page when one is set, otherwise to the website.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="gp-categories">Card types</Label>
                <Input id="gp-categories" value={form.categories} onChange={(e) => setField('categories', e.target.value)} placeholder="TCG, Sports Cards, AFL" />
                <p className="text-[11px] text-muted-foreground">Comma-separated chips shown on the card.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gp-sort">Sort order</Label>
                <Input id="gp-sort" inputMode="numeric" value={form.sort_order} onChange={(e) => setField('sort_order', e.target.value)} />
                <p className="text-[11px] text-muted-foreground">Lower shows first.</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="gp-notes">Admin notes</Label>
              <Textarea id="gp-notes" rows={2} value={form.notes} onChange={(e) => setField('notes', e.target.value)} placeholder="Where this came from, what to re-check and when. Never shown publicly." />
            </div>

            <div className="flex items-center gap-3">
              <Switch id="gp-active" checked={form.is_active !== false} onCheckedChange={(v) => setField('is_active', v)} />
              <Label htmlFor="gp-active">Shown on the site</Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={close} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : editing === 'new' ? 'Add partner' : 'Save changes'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <WebsiteBadgeDialog
        open={badgePartner !== null}
        onClose={() => setBadgePartner(null)}
        kind="gradingPartner"
        snippet={badgePartner ? gradingPartnerBadgeSnippet(badgePartner) : ''}
        title={badgePartner ? `Website badge for ${badgePartner.name}` : 'Website badge'}
        description="Send this code to the partner to paste on their website. It links to CardPop's submission-partner list, where they're featured, which gives CardPop a relevant Australian backlink."
      />
      <AlertDialog open={deleting !== null} onOpenChange={(o) => { if (!o) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              It disappears from the Submission Partners and Compare Companies pages. To hide it without losing the entry, switch “Shown on the site” off instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default GradingPartnersAdminPage;
