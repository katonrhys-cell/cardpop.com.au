
import React, { useEffect, useState, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import pb from '@/lib/pocketbaseClient.js';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BookOpen, FileX, AlertCircle, Search, User } from 'lucide-react';

const BlogPage = () => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchArticles = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await pb.collection('blog_articles').getList(1, 50, {
        sort: '-created',
        $autoCancel: false
      });
      setArticles(res.items);
    } catch (err) {
      console.error("Error fetching articles:", err);
      setError('Failed to load articles. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArticles();
  }, []);

  const filteredArticles = useMemo(() => {
    if (!searchTerm.trim()) return articles;
    const lowerSearch = searchTerm.toLowerCase();
    return articles.filter(article => 
      article.title?.toLowerCase().includes(lowerSearch) || 
      article.author?.toLowerCase().includes(lowerSearch)
    );
  }, [articles, searchTerm]);

  return (
    <div className="min-h-[100dvh] bg-background">
      <Helmet><title>The Parallel Report | CardPop</title></Helmet>

      <section className="bg-card border-b border-border py-20 text-center">
        <div className="container-default">
          <BookOpen className="w-12 h-12 text-primary mx-auto mb-6" />
          <h1 className="text-4xl md:text-5xl font-bold mb-4">The Parallel Report</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Insights, news, and deep-dives from the forefront of the collecting world.
          </p>
          <div className="max-w-md mx-auto relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search articles by title or author..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-12 rounded-full bg-background border-border shadow-sm"
            />
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {Array(6).fill(0).map((_, i) => (
              <div key={i} className="flex flex-col space-y-4">
                <Skeleton className="aspect-[16/9] w-full rounded-2xl" />
                <Skeleton className="h-4 w-1/3 rounded-md" />
                <Skeleton className="h-7 w-5/6 rounded-md" />
                <Skeleton className="h-16 w-full rounded-md" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 md:py-24 px-4 bg-destructive/5 rounded-3xl border border-destructive/10 text-center max-w-2xl mx-auto">
            <AlertCircle className="w-10 h-10 md:w-12 md:h-12 text-destructive mb-4" />
            <h2 className="text-xl md:text-2xl font-bold text-foreground mb-2">Connection Error</h2>
            <p className="text-sm md:text-base text-muted-foreground mb-6">{error}</p>
            <Button onClick={fetchArticles} variant="default" size="lg" className="w-full sm:w-auto">
              Retry Connection
            </Button>
          </div>
        ) : filteredArticles.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {filteredArticles.map(article => {
              const imageUrl = article.featuredImage ? pb.files.getUrl(article, article.featuredImage) : null;
              const publishDate = new Date(article.created).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric'
              });
              
              return (
                <Link 
                  key={article.id} 
                  to={`/blog/${article.id}`} 
                  className="group flex flex-col bg-card border border-border rounded-2xl overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300 h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <div className="aspect-[16/9] bg-muted relative overflow-hidden">
                    {imageUrl ? (
                      <img 
                        src={imageUrl} 
                        alt={article.title} 
                        className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" 
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-muted-foreground bg-secondary/50">
                        <BookOpen className="w-8 h-8 opacity-20" />
                      </div>
                    )}
                  </div>
                  <div className="p-5 md:p-6 flex flex-col flex-1">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-xs md:text-sm font-medium text-muted-foreground tabular-nums tracking-wide uppercase">
                        {publishDate}
                      </div>
                      {article.author && (
                        <div className="flex items-center text-xs font-medium text-muted-foreground bg-secondary px-2 py-1 rounded-md">
                          <User className="w-3 h-3 mr-1" />
                          {article.author}
                        </div>
                      )}
                    </div>
                    <h3 className="font-bold text-xl md:text-2xl mb-2 md:mb-3 line-clamp-2 text-card-foreground group-hover:text-primary transition-colors text-balance leading-snug">
                      {article.title}
                    </h3>
                    <p className="text-sm md:text-base text-muted-foreground line-clamp-3 leading-relaxed mt-auto">
                      {article.content?.substring(0, 120)}...
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 md:py-24 px-4 bg-muted/20 rounded-3xl border border-border border-dashed text-center">
            <FileX className="w-10 h-10 md:w-12 md:h-12 text-muted-foreground mb-4 opacity-50" />
            <p className="text-foreground text-lg md:text-xl font-bold mb-2">No articles found</p>
            <p className="text-sm md:text-base text-muted-foreground max-w-md">
              {searchTerm ? `No articles match your search for "${searchTerm}". Try different keywords.` : "We're currently working on new content. Check back soon for the latest news and insights."}
            </p>
            {searchTerm && (
              <Button variant="outline" className="mt-6" onClick={() => setSearchTerm('')}>
                Clear Search
              </Button>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default BlogPage;
