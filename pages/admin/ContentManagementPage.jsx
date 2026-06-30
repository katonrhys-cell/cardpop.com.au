import React, { useState, useEffect, useRef } from 'react';
import { Plus, Search, Edit, Trash2, FileText, AlertCircle, RefreshCcw, FileCode2, Globe, EyeOff, ArrowLeft, BookOpen, PenLine } from 'lucide-react';
import { Link } from 'react-router-dom';
import AdminPageHeader from '@/components/admin/AdminPageHeader.jsx';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient.js';
import ArticleEditorModal from '@/components/ArticleEditorModal.jsx';

const StatPill = ({ icon: Icon, label, value, accent }) => (
  <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card border border-border shadow-sm">
    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accent}`}>
      <Icon className="w-4 h-4" />
    </div>
    <div>
      <p className="text-xs text-muted-foreground font-medium leading-none mb-0.5">{label}</p>
      <p className="text-lg font-extrabold tabular-nums leading-none">{value}</p>
    </div>
  </div>
);

const ContentManagementPage = () => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const fetchRef = useRef(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState(null);

  const fetchArticles = async (cancelled = { value: false }) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('blog_articles')
        .select('*, author_profile:profiles!author_id(display_name, username)')
        .order('created_at', { ascending: false });
      if (fetchErr) throw fetchErr;
      if (!cancelled.value) setArticles(data ?? []);
    } catch (err) {
      if (!cancelled.value) setError(err.message || 'Failed to load articles.');
    } finally {
      if (!cancelled.value) setLoading(false);
    }
  };

  useEffect(() => {
    const cancelled = { value: false };
    fetchRef.current = () => fetchArticles(cancelled);
    fetchArticles(cancelled);
    return () => { cancelled.value = true; };
  }, []);

  const handleCreateNew = () => {
    setSelectedArticle(null);
    setIsModalOpen(true);
  };

  const handleEdit = (article) => {
    setSelectedArticle(article);
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase.from('blog_articles').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      toast.success('Article deleted.');
      setArticles(prev => prev.filter(a => a.id !== deleteTarget.id));
    } catch (err) {
      toast.error(err.message || 'Failed to delete article.');
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleQuickPublish = async (article) => {
    const next = !article.is_published;
    try {
      const { error } = await supabase
        .from('blog_articles')
        .update({ is_published: next })
        .eq('id', article.id);
      if (error) throw error;
      setArticles(prev => prev.map(a => a.id === article.id ? { ...a, is_published: next } : a));
      toast.success(next ? 'Article published.' : 'Article set to draft.');
    } catch (err) {
      toast.error('Failed to update status.');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-AU', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  const filteredArticles = articles.filter(a => {
    const matchesSearch =
      a.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.content?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'published' && a.is_published) ||
      (statusFilter === 'draft' && !a.is_published);
    return matchesSearch && matchesStatus;
  });

  const publishedCount = articles.filter(a => a.is_published).length;
  const draftCount = articles.filter(a => !a.is_published).length;

  return (
    <div className="text-foreground">
      <div className="space-y-8">

        <AdminPageHeader
          icon={BookOpen}
          title="Blog Management"
          subtitle="Manage content, metadata, and visibility of all blog articles."
        >
          <Button onClick={handleCreateNew} variant="outline" className="gap-2 shrink-0 rounded-xl h-10 px-4 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
            <Plus className="w-4 h-4" /> New Article
          </Button>
        </AdminPageHeader>

        {/* Stats */}
        <div className="flex flex-wrap gap-3">
          <StatPill icon={BookOpen} label="Total Articles" value={articles.length} accent="bg-primary/10 text-primary" />
          <StatPill icon={Globe} label="Published" value={publishedCount} accent="bg-emerald-500/10 text-emerald-600" />
          <StatPill icon={PenLine} label="Drafts" value={draftCount} accent="bg-amber-500/10 text-amber-600" />
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by title or content..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border overflow-hidden bg-card shadow-sm">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="font-semibold w-[30%]">Title</TableHead>
                <TableHead className="font-semibold w-[25%] hidden md:table-cell">Content Preview</TableHead>
                <TableHead className="font-semibold w-[12%] hidden lg:table-cell">Author</TableHead>
                <TableHead className="font-semibold w-[11%] hidden xl:table-cell">Created</TableHead>
                <TableHead className="font-semibold w-[10%] hidden sm:table-cell">Status</TableHead>
                <TableHead className="text-right font-semibold w-[12%]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
                    <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-full" /></TableCell>
                    <TableCell className="hidden lg:table-cell"><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell className="hidden xl:table-cell"><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell className="hidden sm:table-cell"><Skeleton className="h-6 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <AlertCircle className="w-8 h-8 text-destructive mb-2" />
                      <p className="mb-4 font-medium text-foreground">Failed to load articles</p>
                      <Button variant="outline" onClick={() => fetchRef.current?.()} className="gap-2">
                        <RefreshCcw className="w-4 h-4" /> Retry
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredArticles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <FileText className="w-12 h-12 mb-3 opacity-20" />
                      <p className="font-medium text-foreground text-lg">No articles found</p>
                      <p className="text-sm mt-1">Create your first article or adjust your filters.</p>
                      <Button onClick={handleCreateNew} variant="secondary" className="mt-4 gap-2">
                        <Plus className="w-4 h-4" /> Create Article
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredArticles.map((article) => {
                  let contentPreview = 'No content';
                  if (article.article_document) {
                    contentPreview = (
                      <span className="flex items-center gap-1.5 text-primary text-sm">
                        <FileCode2 className="w-4 h-4 shrink-0" /> Document Attached
                      </span>
                    );
                  } else if (article.content) {
                    contentPreview = article.content.length > 100
                      ? article.content.substring(0, 100) + '…'
                      : article.content;
                  }

                  return (
                    <TableRow key={article.id} className="group hover:bg-muted/30 transition-colors">
                      <TableCell className="font-medium align-top pt-4">
                        <div className="line-clamp-2 leading-snug">{article.title}</div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm hidden md:table-cell align-top pt-4">
                        <div className="line-clamp-2 leading-relaxed">{contentPreview}</div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm hidden lg:table-cell align-top pt-4">
                        <div className="truncate">
                          {article.author || article.author_profile?.display_name || article.author_profile?.username || 'Unknown'}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm tabular-nums hidden xl:table-cell align-top pt-4">
                        {formatDate(article.created_at)}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell align-top pt-4">
                        <button
                          onClick={() => handleQuickPublish(article)}
                          title={article.is_published ? 'Click to unpublish' : 'Click to publish'}
                          className="cursor-pointer"
                        >
                          {article.is_published ? (
                            <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-200 hover:bg-emerald-500/20 gap-1 transition-colors">
                              <Globe className="w-3 h-3" /> Published
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground hover:border-amber-400 hover:text-amber-600 gap-1 transition-colors">
                              <EyeOff className="w-3 h-3" /> Draft
                            </Badge>
                          )}
                        </button>
                      </TableCell>
                      <TableCell className="text-right align-top pt-3">
                        <div className="flex justify-end items-center gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5"
                            onClick={() => handleEdit(article)}
                          >
                            <Edit className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Edit</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteTarget(article)}
                            title="Delete Article"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <ArticleEditorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        article={selectedArticle}
        onSave={() => fetchRef.current?.()}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Article</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-semibold text-foreground">"{deleteTarget?.title}"</span>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ContentManagementPage;
