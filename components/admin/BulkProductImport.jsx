import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, ImagePlus, Loader2, Trash2, Upload, X } from 'lucide-react';
import { mapWithConcurrency, uploadShopImage } from '@/utils/uploadProductImages.js';
import {
  PRODUCT_CSV_TEMPLATE,
  PRODUCT_STATUSES,
  PRODUCT_TYPES,
  attachImagesToRows,
  buildProductPayload,
  chunk,
  parseProductCsv,
  rowsFromImageFiles,
  validateRows,
} from '@/utils/bulkProductImport.js';
import useShopCategoryGroups from '@/hooks/useShopCategoryGroups.js';

// Products are inserted in batches so a large import commits progressively —
// a failure at product 400 doesn't roll back the first 399, and the admin sees
// steady progress rather than one long stall.
const INSERT_BATCH = 20;

// Uploads in flight across the whole batch. Each image is decoded and
// re-encoded on the main thread before it goes up, so this is a CPU/memory
// ceiling as much as a network one — 4 keeps a big import responsive.
const UPLOAD_CONCURRENCY = 4;

const isImage = (file) => /^image\//i.test(file.type) || /\.(jpe?g|png|webp|avif|heic|heif|gif)$/i.test(file.name);
const isCsv = (file) => /\.csv$/i.test(file.name) || /csv/i.test(file.type);

const downloadTemplate = () => {
  const blob = new Blob([PRODUCT_CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'cardpop-product-import-template.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const BulkProductImport = ({ open, onOpenChange, onComplete }) => {
  const { currentUser } = useAuth();
  const { groups: categoryGroups } = useShopCategoryGroups();
  const [phase, setPhase] = useState('select'); // select | review | importing | done
  const [imageFiles, setImageFiles] = useState([]);
  const [csvFile, setCsvFile] = useState(null);
  const [csvText, setCsvText] = useState('');
  const [csvWarning, setCsvWarning] = useState(null);
  const [rows, setRows] = useState([]);
  const [unmatchedCount, setUnmatchedCount] = useState(0);
  // Slugs/titles already in the shop, fetched once when the review table is
  // built. Held in a ref so every re-validation after an inline edit keeps
  // warning about duplicates instead of silently forgetting them.
  const existingRef = useRef({ existingSlugs: new Set(), existingTitles: new Set() });
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState({ label: '', done: 0, total: 0 });
  const [result, setResult] = useState(null);
  const imageInputRef = useRef(null);
  const csvInputRef = useRef(null);
  const previewUrls = useRef(new Map());

  const reset = useCallback(() => {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrls.current.clear();
    setPhase('select');
    setImageFiles([]);
    setCsvFile(null);
    setCsvText('');
    setCsvWarning(null);
    setRows([]);
    setUnmatchedCount(0);
    setProgress({ label: '', done: 0, total: 0 });
    setResult(null);
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  useEffect(() => () => {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrls.current.clear();
  }, []);

  const previewFor = (file) => {
    if (!file || typeof File === 'undefined' || !(file instanceof File)) return null;
    if (!previewUrls.current.has(file)) previewUrls.current.set(file, URL.createObjectURL(file));
    return previewUrls.current.get(file);
  };

  const acceptFiles = useCallback(async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    const images = files.filter(isImage);
    const csv = files.find(isCsv);

    if (images.length) setImageFiles((prev) => [...prev, ...images]);
    if (csv) {
      setCsvFile(csv);
      setCsvText(await csv.text());
    }
    if (!images.length && !csv) toast.error('Drop image files and/or a .csv — nothing else is read.');
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    acceptFiles(e.dataTransfer?.files);
  }, [acceptFiles]);

  // ── Build the review table ───────────────────────────────────────────────
  const buildRows = async () => {
    let draft;
    let unmatched = 0;
    setCsvWarning(null);

    if (csvText) {
      const parsed = parseProductCsv(csvText);
      if (parsed.error) {
        toast.error(parsed.error);
        return;
      }
      if (!parsed.rows.length) {
        toast.error('That CSV has no product rows.');
        return;
      }
      if (parsed.unknownHeaders.length) {
        setCsvWarning(`Ignored unrecognised column${parsed.unknownHeaders.length > 1 ? 's' : ''}: ${parsed.unknownHeaders.join(', ')}`);
      }
      const attached = attachImagesToRows(parsed.rows, imageFiles);
      draft = attached.rows;
      unmatched = attached.unmatchedFiles.length;
    } else {
      if (!imageFiles.length) {
        toast.error('Add photos, a CSV, or both.');
        return;
      }
      draft = rowsFromImageFiles(imageFiles);
    }

    // Dedupe against what's already in the shop so re-running an import
    // surfaces the overlap instead of silently doubling the catalogue.
    const existingSlugs = new Set();
    const existingTitles = new Set();
    const existingSkus = new Set();
    try {
      const { data } = await supabase.from('shop_products').select('slug,title,sku').limit(5000);
      (data || []).forEach((p) => {
        if (p.slug) existingSlugs.add(p.slug);
        if (p.title) existingTitles.add(p.title.toLowerCase());
        if (p.sku) existingSkus.add(p.sku);
      });
    } catch {
      // Non-fatal: without this we can't de-duplicate slugs/SKUs up front, and
      // a collision would surface as a failed insert in the summary instead.
    }
    existingRef.current = { existingSlugs, existingTitles, existingSkus };

    setRows(validateRows(draft, existingRef.current));
    setUnmatchedCount(unmatched);
    setPhase('review');
  };

  const revalidate = (list) => validateRows(list, existingRef.current);

  const updateRow = (index, patch) =>
    setRows((prev) => revalidate(prev.map((r, i) => (i === index ? { ...r, ...patch } : r))));

  const removeRow = (index) => setRows((prev) => prev.filter((_, i) => i !== index));

  const applyToAll = (patch) => setRows((prev) => revalidate(prev.map((r) => ({ ...r, ...patch }))));

  const validRows = useMemo(() => rows.filter((r) => r.valid), [rows]);
  const invalidCount = rows.length - validRows.length;
  const totalImages = useMemo(
    () => rows.reduce((sum, r) => sum + (r.files?.filter((f) => typeof f !== 'string').length || 0), 0),
    [rows]
  );

  // ── Import ───────────────────────────────────────────────────────────────
  const runImport = async () => {
    if (!validRows.length) return;
    setPhase('importing');
    setResult(null);

    const failures = [];
    let created = 0;
    let uploaded = 0;
    // Counts every entry the upload queue will visit, including already-hosted
    // URLs that pass straight through — the queue ticks once per entry, so the
    // denominator has to match or the bar overshoots.
    const totalUploads = validRows.reduce((sum, r) => sum + (r.files?.length || 0), 0);

    setProgress({ label: 'Uploading photos', done: 0, total: totalUploads || validRows.length });

    for (const batch of chunk(validRows, INSERT_BATCH)) {
      // Every photo in the batch goes into ONE concurrency-capped queue rather
      // than a queue per product — otherwise 20 products each uploading "one at
      // a time" is still 20 concurrent uploads, and a big import saturates the
      // browser's connection pool.
      const slots = batch.map((row) => new Array((row.files || []).length).fill(null));
      const rowErrors = batch.map(() => []);

      const tasks = [];
      batch.forEach((row, ri) => (row.files || []).forEach((file, fi) => tasks.push({ ri, fi, file })));

      await mapWithConcurrency(tasks, UPLOAD_CONCURRENCY, async ({ ri, fi, file }) => {
        // Strings are images already hosted elsewhere (a URL in the CSV).
        if (typeof file === 'string') {
          slots[ri][fi] = file;
          return;
        }
        try {
          const { url } = await uploadShopImage(file);
          slots[ri][fi] = url;
        } catch (err) {
          rowErrors[ri].push(err.message || `${file.name} failed to upload`);
        } finally {
          uploaded += 1;
          setProgress((p) => ({ ...p, done: uploaded }));
        }
      });

      // A product survives losing some of its photos; losing all of them means
      // it would go live with no image, so that's a failure worth reporting.
      const uploadedRows = [];
      batch.forEach((row, ri) => {
        const urls = slots[ri].filter(Boolean);
        if (!urls.length && (row.files?.length || 0) > 0) {
          failures.push({ title: row.title, error: rowErrors[ri][0] || 'Image upload failed' });
          return;
        }
        uploadedRows.push({ row, urls });
      });

      if (!uploadedRows.length) continue;

      setProgress((p) => ({ ...p, label: 'Saving products' }));
      const payloads = uploadedRows.map(({ row, urls }) => buildProductPayload(row, urls, currentUser?.id ?? null));

      const { error } = await supabase.from('shop_products').insert(payloads);
      if (error) {
        uploadedRows.forEach(({ row }) => failures.push({ title: row.title, error: error.message }));
      } else {
        created += payloads.length;
      }
      setProgress((p) => ({ ...p, label: 'Uploading photos' }));
    }

    setResult({ created, failures });
    setPhase('done');
    if (created) toast.success(`${created} product${created === 1 ? '' : 's'} added to the shop.`);
    if (failures.length) toast.error(`${failures.length} product${failures.length === 1 ? '' : 's'} failed — see the summary.`);
    if (created && onComplete) onComplete();
  };

  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto bg-background rounded-2xl border-border">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold font-serif">Bulk Import Products</DialogTitle>
          <DialogDescription>
            Drop a folder of photos (and optionally a CSV) to add many products at once. Every photo is
            compressed and given a grid thumbnail on upload.
          </DialogDescription>
        </DialogHeader>

        {phase === 'select' && (
          <div className="space-y-6">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => imageInputRef.current?.click()}
              className={`rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer transition-colors ${
                dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/40'
              }`}
            >
              <Upload className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="font-bold">Drop product photos here</p>
              <p className="text-sm text-muted-foreground mt-1">
                JPG, PNG, WebP or HEIC. Photos of the same product share a name —
                <code className="mx-1 px-1 rounded bg-muted">charizard-front.jpg</code> and
                <code className="mx-1 px-1 rounded bg-muted">charizard-back.jpg</code> become one product.
              </p>
              <p className="text-xs text-muted-foreground mt-2">You can drop a .csv in here too.</p>
            </div>
            <input
              type="file"
              ref={imageInputRef}
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => { acceptFiles(e.target.files); e.target.value = ''; }}
            />
            <input
              type="file"
              ref={csvInputRef}
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => { acceptFiles(e.target.files); e.target.value = ''; }}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-border p-4 flex items-center gap-3">
                <ImagePlus className="w-5 h-5 text-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm">{imageFiles.length} photo{imageFiles.length === 1 ? '' : 's'} ready</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {imageFiles.length ? imageFiles.slice(0, 3).map((f) => f.name).join(', ') : 'No photos selected yet'}
                  </p>
                </div>
                {imageFiles.length > 0 && (
                  <Button type="button" variant="ghost" size="icon" aria-label="Clear photos" onClick={() => setImageFiles([])}>
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>

              <div className="rounded-xl border border-border p-4 flex items-center gap-3">
                <FileSpreadsheet className="w-5 h-5 text-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm">{csvFile ? csvFile.name : 'No CSV (optional)'}</p>
                  <p className="text-xs text-muted-foreground">
                    {csvFile ? 'Titles, prices and stock come from the CSV.' : 'Without one, each photo becomes a draft product.'}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 shrink-0"
                  aria-label={csvFile ? 'Remove CSV' : 'Choose CSV'}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (csvFile) {
                      setCsvFile(null);
                      setCsvText('');
                    } else {
                      csvInputRef.current?.click();
                    }
                  }}
                >
                  {csvFile ? <X className="w-4 h-4" /> : 'Choose'}
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2 border-t border-border">
              <Button type="button" variant="ghost" className="gap-2" onClick={downloadTemplate}>
                <Download className="w-4 h-4" /> CSV template
              </Button>
              <div className="flex gap-3">
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button type="button" className="font-bold rounded-xl" onClick={buildRows} disabled={!imageFiles.length && !csvText}>
                  Continue
                </Button>
              </div>
            </div>
          </div>
        )}

        {phase === 'review' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="outline" className="bg-background">{rows.length} product{rows.length === 1 ? '' : 's'}</Badge>
              <Badge variant="outline" className="bg-background">{totalImages} photo{totalImages === 1 ? '' : 's'}</Badge>
              {invalidCount > 0 && (
                <Badge variant="outline" className="bg-background text-destructive border-destructive/30">
                  {invalidCount} need{invalidCount === 1 ? 's' : ''} attention
                </Badge>
              )}
              {unmatchedCount > 0 && (
                <Badge variant="outline" className="bg-background text-amber-600 border-amber-500/30">
                  {unmatchedCount} photo{unmatchedCount === 1 ? '' : 's'} matched no row
                </Badge>
              )}
            </div>

            {csvWarning && (
              <p className="text-xs text-amber-600 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" /> {csvWarning}
              </p>
            )}

            <div className="flex flex-wrap items-end gap-3 p-4 rounded-xl bg-muted/30 border border-border">
              <div className="space-y-1.5">
                <Label className="text-xs">Set category for all</Label>
                <Select onValueChange={(v) => applyToAll({ category: v })}>
                  <SelectTrigger className="h-9 w-52 bg-background"><SelectValue placeholder="Choose…" /></SelectTrigger>
                  <SelectContent>
                    {(categoryGroups || []).flatMap((g) => g.items).map((item) => (
                      <SelectItem key={item.slug} value={item.name}>{item.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Set type for all</Label>
                <Select onValueChange={(v) => applyToAll({ product_type: v })}>
                  <SelectTrigger className="h-9 w-40 bg-background"><SelectValue placeholder="Choose…" /></SelectTrigger>
                  <SelectContent>
                    {PRODUCT_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Set status for all</Label>
                <Select onValueChange={(v) => applyToAll({ status: v })}>
                  <SelectTrigger className="h-9 w-40 bg-background"><SelectValue placeholder="Choose…" /></SelectTrigger>
                  <SelectContent>
                    {PRODUCT_STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border border-border rounded-xl overflow-x-auto max-h-[46vh] overflow-y-auto">
              <Table>
                <TableHeader className="bg-muted/40 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="w-16">Photo</TableHead>
                    <TableHead className="min-w-[240px]">Product name</TableHead>
                    <TableHead className="w-40">SKU</TableHead>
                    <TableHead className="w-28">Price</TableHead>
                    <TableHead className="w-24">Stock</TableHead>
                    <TableHead className="w-40">Category</TableHead>
                    <TableHead className="w-32">Type</TableHead>
                    <TableHead className="w-32">Status</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, index) => {
                    const firstFile = row.files?.find((f) => typeof f !== 'string');
                    const preview = previewFor(firstFile);
                    return (
                      <TableRow key={`${row.sourceLine}-${index}`} className={row.valid ? '' : 'bg-destructive/5'}>
                        <TableCell>
                          <div className="w-12 h-14 rounded-md bg-muted overflow-hidden flex items-center justify-center">
                            {preview
                              ? <img src={preview} alt="" className="w-full h-full object-cover" />
                              : <ImagePlus className="w-4 h-4 opacity-40" />}
                          </div>
                          {row.files?.length > 1 && (
                            <span className="text-[10px] text-muted-foreground">+{row.files.length - 1}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            aria-label={`Product name row ${index + 1}`}
                            value={row.title}
                            onChange={(e) => updateRow(index, { title: e.target.value })}
                            className="h-9 bg-background"
                          />
                          {(row.errors.length > 0 || row.warnings.length > 0) && (
                            <p className={`text-[11px] mt-1 ${row.errors.length ? 'text-destructive' : 'text-amber-600'}`}>
                              {[...row.errors, ...row.warnings].join(' · ')}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            aria-label={`SKU row ${index + 1}`}
                            value={row.sku}
                            onChange={(e) => updateRow(index, { sku: e.target.value })}
                            className="h-9 bg-background font-mono text-xs uppercase"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            aria-label={`Price row ${index + 1}`}
                            type="number" step="0.01" min="0"
                            value={row.price_aud}
                            onChange={(e) => updateRow(index, { price_aud: e.target.value })}
                            className="h-9 bg-background tabular-nums"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            aria-label={`Stock row ${index + 1}`}
                            type="number" min="0"
                            value={row.stock_quantity}
                            onChange={(e) => updateRow(index, { stock_quantity: e.target.value })}
                            className="h-9 bg-background tabular-nums"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            aria-label={`Category row ${index + 1}`}
                            value={row.category}
                            onChange={(e) => updateRow(index, { category: e.target.value })}
                            className="h-9 bg-background"
                          />
                        </TableCell>
                        <TableCell>
                          <Select value={row.product_type} onValueChange={(v) => updateRow(index, { product_type: v })}>
                            <SelectTrigger className="h-9 bg-background capitalize"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {PRODUCT_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select value={row.status} onValueChange={(v) => updateRow(index, { status: v })}>
                            <SelectTrigger className="h-9 bg-background capitalize"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {PRODUCT_STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Button type="button" variant="ghost" size="icon" aria-label={`Remove row ${index + 1}`} onClick={() => removeRow(index)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between gap-3 pt-4 border-t border-border">
              <Button type="button" variant="ghost" onClick={() => setPhase('select')}>Back</Button>
              <Button type="button" className="font-bold rounded-xl" onClick={runImport} disabled={!validRows.length}>
                Import {validRows.length} product{validRows.length === 1 ? '' : 's'}
              </Button>
            </div>
          </div>
        )}

        {phase === 'importing' && (
          <div className="py-10 space-y-4 text-center">
            <Loader2 className="w-10 h-10 animate-spin mx-auto text-primary" />
            <p className="font-bold">{progress.label}…</p>
            <Progress value={pct} className="max-w-md mx-auto" />
            <p className="text-sm text-muted-foreground tabular-nums">{progress.done} / {progress.total}</p>
            <p className="text-xs text-muted-foreground">Keep this tab open — photos are compressed in your browser before upload.</p>
          </div>
        )}

        {phase === 'done' && result && (
          <div className="py-6 space-y-5">
            <div className="text-center space-y-2">
              <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500" />
              <p className="text-xl font-bold">{result.created} product{result.created === 1 ? '' : 's'} imported</p>
            </div>

            {result.failures.length > 0 && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-2 max-h-56 overflow-y-auto">
                <p className="font-bold text-sm flex items-center gap-2 text-destructive">
                  <AlertTriangle className="w-4 h-4" /> {result.failures.length} failed
                </p>
                <ul className="text-xs space-y-1">
                  {result.failures.map((f, i) => (
                    <li key={i}><span className="font-medium">{f.title || '(untitled)'}</span> — {f.error}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              <Button type="button" variant="ghost" onClick={reset}>Import more</Button>
              <Button type="button" className="font-bold rounded-xl" onClick={() => onOpenChange(false)}>Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default BulkProductImport;
