import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';

const slugify = (text) =>
  text.toLowerCase().trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

const ArticleEditorModal = ({ isOpen, onClose, article, onSave }) => {
  const { currentUser } = useAuth();
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [content, setContent] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(article?.title ?? '');
    setSlug(article?.slug ?? '');
    setExcerpt(article?.excerpt ?? '');
    setContent(article?.content ?? '');
    setIsPublished(article?.is_published ?? false);
  }, [article, isOpen]);

  const handleTitleChange = (value) => {
    setTitle(value);
    if (!article?.id) {
      setSlug(slugify(value));
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Title is required.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        slug: slug.trim() || slugify(title.trim()),
        excerpt: excerpt.trim() || null,
        content: content.trim() || null,
        is_published: isPublished,
        published_at: isPublished ? (article?.published_at ?? new Date().toISOString()) : null,
      };

      if (article?.id) {
        const { error } = await supabase
          .from('blog_articles')
          .update(payload)
          .eq('id', article.id);
        if (error) throw error;
        toast.success('Article updated.');
      } else {
        const { error } = await supabase
          .from('blog_articles')
          .insert({ ...payload, author_id: currentUser?.id });
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
          <div className="space-y-1">
            <Label>Title <span className="text-destructive">*</span></Label>
            <Input
              value={title}
              onChange={e => handleTitleChange(e.target.value)}
              placeholder="Article title…"
            />
          </div>
          <div className="space-y-1">
            <Label>Slug</Label>
            <Input
              value={slug}
              onChange={e => setSlug(slugify(e.target.value))}
              placeholder="url-friendly-slug"
              className="font-mono text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label>Excerpt</Label>
            <Textarea
              value={excerpt}
              onChange={e => setExcerpt(e.target.value)}
              placeholder="Short summary shown in article previews…"
              rows={2}
            />
          </div>
          <div className="space-y-1">
            <Label>Content</Label>
            <Textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Write your article…"
              rows={12}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3 bg-muted/30">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Published</Label>
              <p className="text-xs text-muted-foreground">Visible to all users when enabled.</p>
            </div>
            <Switch checked={isPublished} onCheckedChange={setIsPublished} />
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
