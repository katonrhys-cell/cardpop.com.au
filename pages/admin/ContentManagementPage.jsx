import React, { useState, useEffect, useRef } from 'react';
import { Plus, Search, Edit, Trash2, FileText, AlertCircle, RefreshCcw, FileCode2, Globe, EyeOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient.js';
import ArticleEditorModal from '@/components/ArticleEditorModal.jsx';

const ContentManagementPage = () => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const isMounted = useRef(true);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState(null);

  const fetchArticles = async () => {
    if (!isMounted.current) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('blog_articles')
        .select('*, author_profile:profiles!author_id(display_name, username)')
        .order('created_at', { ascending: false });
      if (fetchErr) throw fetchErr;
      if (isMounted.current) setArticles(data ?? []);
    } catch (err) {
      console.error("Error fetching articles:", err);
      if (isMounted.current) setError(err.message || "Failed to load articles.");
    } finally {
      if (isMounted.current) setLoading(false);
    }
  };

  useEffect(() => {
    isMounted.current = true;
    fetchArticles();
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleCreateNew = () => {
    setSelectedArticle(null);
    setIsModalOpen(true);
  };

  const handleEdit = (article) => {
    setSelectedArticle(article);
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this article? This action cannot be undone.")) return;
    
    try {
      const { error } = await supabase.from('blog_articles').delete().eq('id', id);
      if (error) throw error;
      toast.success("Article deleted successfully.");
      setArticles(articles.filter(a => a.id !== id));
    } catch (err) {
      console.error("Delete error:", err);
      toast.error(err.message || "Failed to delete article.");
    }
  };

  const filteredArticles = articles.filter(a => 
    a.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.content?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading text-foreground tracking-tight">Blog Management</h1>
          <p className="text-muted-foreground mt-1 text-lg">Manage full content and metadata of all blog articles.</p>
        </div>
        <Button onClick={handleCreateNew} className="gap-2 font-bold shadow-sm transition-transform active:scale-[0.98]">
          <Plus className="w-4 h-4" /> New Article
        </Button>
      </div>

      <Card className="p-6 border-border shadow-sm bg-card rounded-2xl">
        <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search articles by title or content..." 
              className="pl-9 bg-background text-foreground"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="rounded-xl border border-border overflow-hidden bg-background">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="font-semibold text-foreground w-[22%]">Title</TableHead>
                <TableHead className="font-semibold text-foreground w-[28%] hidden md:table-cell">Content Preview</TableHead>
                <TableHead className="font-semibold text-foreground w-[12%] hidden lg:table-cell">Author</TableHead>
                <TableHead className="font-semibold text-foreground w-[10%] hidden xl:table-cell">Created</TableHead>
                <TableHead className="font-semibold text-foreground w-[10%] hidden sm:table-cell">Status</TableHead>
                <TableHead className="text-right font-semibold text-foreground w-[18%]">Actions</TableHead>
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
                    <TableCell><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <AlertCircle className="w-8 h-8 text-destructive mb-2" />
                      <p className="mb-4 font-medium text-foreground">Failed to load articles</p>
                      <Button variant="outline" onClick={fetchArticles} className="gap-2">
                        <RefreshCcw className="w-4 h-4" /> Retry Connection
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
                      <p className="text-sm mt-1">Create your first article or adjust search terms.</p>
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
                      <span className="flex items-center gap-1.5 text-primary">
                        <FileCode2 className="w-4 h-4" /> Document Attached
                      </span>
                    );
                  } else if (article.content) {
                    contentPreview = article.content.length > 100 
                      ? article.content.substring(0, 100) + '...' 
                      : article.content;
                  }

                  return (
                    <TableRow key={article.id} className="group hover:bg-muted/30 transition-colors">
                      <TableCell className="font-medium text-foreground align-top pt-4">
                        <div className="line-clamp-2 text-balance leading-snug">{article.title}</div>
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden md:table-cell align-top pt-4">
                        <div className="line-clamp-2 text-sm leading-relaxed">{contentPreview}</div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm hidden lg:table-cell align-top pt-4">
                        <div className="truncate">{article.author || article.author_profile?.display_name || article.author_profile?.username || 'Unknown'}</div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm tabular-nums hidden xl:table-cell align-top pt-4">
                        {formatDate(article.created_at)}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell align-top pt-4">
                        {article.is_published ? (
                          <Badge className="bg-green-500/10 text-green-700 border-green-200 gap-1">
                            <Globe className="w-3 h-3" /> Published
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground gap-1">
                            <EyeOff className="w-3 h-3" /> Draft
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right align-top pt-3">
                        <div className="flex justify-end items-center gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 gap-1.5" 
                            onClick={() => handleEdit(article)}
                          >
                            <Edit className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">View / Edit</span>
                          </Button>
                          
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" 
                            onClick={() => handleDelete(article.id)} 
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
      </Card>

      <ArticleEditorModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        article={selectedArticle}
        onSave={fetchArticles}
      />
    </div>
  );
};

export default ContentManagementPage;