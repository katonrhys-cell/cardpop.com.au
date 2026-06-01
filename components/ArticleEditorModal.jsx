import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Upload, FileCode, CheckCircle2 } from 'lucide-react';

const CATEGORIES = [
  { value: 'australia-focus',  label: 'Australia Focus'   },
  { value: 'beginner-guides',  label: 'Beginner Guides'   },
  { value: 'card-spotlight',   label: 'Card Spotlight'    },
  { value: 'grading-guides',   label: 'Grading Guides'    },
  { value: 'investing-value',  label: 'Investing & Value' },
  { value: 'news-releases',    label: 'News & Releases'   },
];

const slugify = (text) =>
  text.toLowerCase().trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

const parseHTMLFile = (htmlText) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, 'text/html');

  // Title: prefer <h1>, fall back to <title>
  const h1 = doc.querySelector('h1');
  const titleTag = doc.querySelector('title');
  const extractedTitle = h1?.textContent?.trim() || titleTag?.textContent?.trim() || '';

  // Remove h1 so it doesn't duplicate in the content body
  h1?.remove();

  // Content: prefer <article> or <main>, fall back to <body>
  const contentEl = doc.querySelector('article') || doc.querySelector('main') || doc.body;
  contentEl?.querySelectorAll('script, style, noscript, iframe').forEach(el => el.remove());
  const extractedHTML = contentEl?.innerHTML?.trim() || '';

  // Excerpt: first <p> text, max 300 chars
  const firstP = doc.querySelector('p');
  const raw = firstP?.textContent?.trim() || '';
  const extractedExcerpt = raw.length > 300 ? raw.slice(0, 297) + '…' : raw;

  return { title: extractedTitle, content: extractedHTML, excerpt: extractedExcerpt };
};

const ArticleEditorModal = ({ isOpen, onClose, article, onSave }) => {
  const { currentUser } = useAuth();
  const fileInputRef = useRef(null);

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [content, setContent] = useState('');
  const [author, setAuthor] = useState('');
  const [category, setCategory] = useState('');
  const [featuredImageUrl, setFeaturedImageUrl] = useState('');
  const [featured, setFeatured] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [importedFileName, setImportedFileName] = useState('');

  useEffect(() => {
    setTitle(article?.title ?? '');
    setSlug(article?.slug ?? '');
    setExcerpt(article?.excerpt ?? '');
    setContent(article?.content ?? '');
    setAuthor(article?.author ?? '');
    setCategory(article?.category ?? '');
    setFeaturedImageUrl(article?.featured_image_url ?? '');
    setFeatured(article?.featured ?? false);
    setIsPublished(article?.is_published ?? false);
    setImportedFileName('');
  }, [article, isOpen]);

  const handleTitleChange = (value) => {
    setTitle(value);
    if (!article?.id) setSlug(slugify(value));
  };

  const processFile = useCallback((file) => {
    if (!file || !file.name.match(/\.html?$/i)) {
      toast.error('Please select an .html or .htm file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const { title: t, content: c, excerpt: ex } = parseHTMLFile(e.target.result);
      if (t) { setTitle(t); setSlug(slugify(t)); }
      if (c) setContent(c);
      if (ex) setExcerpt(prev => prev || ex);
      setImportedFileName(file.name);
      toast.success(`Imported "${file.name}" — fill in the remaining fields below.`);
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    processFile(e.dataTransfer.files?.[0]);
  };

  const handleFileInput = (e) => {
    processFile(e.target.files?.[0]);
    e.target.value = '';
  };

  const handleSave = async () => {
    if (!title.trim()) { toast.error('Title is required.'); return; }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        slug: slug.trim() || slugify(title.trim()),
        excerpt: excerpt.trim() || null,
        content: content.trim() || null,
        author: author.trim() || null,
        category: category || null,
        featured_image_url: featuredImageUrl.trim() || null,
        featured,
        is_published: isPublished,
        published_at: isPublished ? (article?.published_at ?? new Date().toISOString()) : null,
      };

      if (article?.id) {
        const { error } = await supabase.from('blog_articles').update(payload).eq('id', article.id);
        if (error) throw error;
        toast.success('Article updated.');
      } else {
        const { error } = await supabase.from('blog_articles').insert({ ...payload, author_id: currentUser?.id });
        if (error) throw error;
        toast.success('Article created.');
      }

      onSave?.();
      onClose?.();
    } catch (err) {
      console.error('Save error:', err);
      toast.error(err.message || 'Failed to save article.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{article?.id ? 'Edit Article' : 'New Article'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">

          {/* ── HTML Import Zone ── */}
          <div
            className={`relative border-2 border-dashed rounded-xl p-5 text-center transition-colors cursor-pointer select-none ${
              isDragging
                ? 'border-primary bg-primary/5'
                : importedFileName
                  ? 'border-emerald-500/40 bg-emerald-500/5'
                  : 'border-border hover:border-primary/50 hover:bg-muted/30'
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".html,.htm"
              className="hidden"
              onChange={handleFileInput}
            />
            {importedFileName ? (
              <div className="flex items-center justify-center gap-2 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span className="text-sm font-medium">{importedFileName}</span>
                <span className="text-xs text-muted-foreground">(click to replace)</span>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-center gap-2 mb-1">
                  {isDragging
                    ? <FileCode className="w-5 h-5 text-primary" />
                    : <Upload className="w-5 h-5 text-muted-foreground" />
                  }
                  <span className="text-sm font-semibold text-foreground">
                    {isDragging ? 'Drop to import' : 'Drop an HTML file to auto-fill'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Extracts title, body content, and excerpt — you complete author, category, and image.
                </p>
              </>
            )}
          </div>

          {/* ── Title ── */}
          <div className="space-y-1">
            <Label>Title <span className="text-destructive">*</span></Label>
            <Input
              value={title}
              onChange={e => handleTitleChange(e.target.value)}
              placeholder="Article title…"
            />
          </div>

          {/* ── Slug ── */}
          <div className="space-y-1">
            <Label>Slug</Label>
            <Input
              value={slug}
              onChange={e => setSlug(slugify(e.target.value))}
              placeholder="url-friendly-slug"
              className="font-mono text-sm"
            />
          </div>

          {/* ── Author + Category ── */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Author</Label>
              <Input
                value={author}
                onChange={e => setAuthor(e.target.value)}
                placeholder="Author name…"
              />
            </div>
            <div className="space-y-1">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category…" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ── Featured Image URL ── */}
          <div className="space-y-1">
            <Label>Featured Image URL</Label>
            <Input
              value={featuredImageUrl}
              onChange={e => setFeaturedImageUrl(e.target.value)}
              placeholder="https://…"
              type="url"
            />
          </div>

          {/* ── Excerpt ── */}
          <div className="space-y-1">
            <Label>Excerpt</Label>
            <Textarea
              value={excerpt}
              onChange={e => setExcerpt(e.target.value)}
              placeholder="Short summary shown in article previews…"
              rows={2}
            />
          </div>

          {/* ── Content ── */}
          <div className="space-y-1">
            <Label>
              Content
              {importedFileName && (
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">HTML from import</span>
              )}
            </Label>
            <Textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Write your article… (HTML is supported)"
              rows={12}
              className="font-mono text-xs"
            />
          </div>

          {/* ── Toggles ── */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between rounded-lg border border-border p-3 bg-muted/30">
              <div>
                <Label className="text-sm font-medium">Featured</Label>
                <p className="text-xs text-muted-foreground">Show in Featured Stories.</p>
              </div>
              <Switch checked={featured} onCheckedChange={setFeatured} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3 bg-muted/30">
              <div>
                <Label className="text-sm font-medium">Published</Label>
                <p className="text-xs text-muted-foreground">Visible to all users.</p>
              </div>
              <Switch checked={isPublished} onCheckedChange={setIsPublished} />
            </div>
          </div>

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Article'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ArticleEditorModal;
