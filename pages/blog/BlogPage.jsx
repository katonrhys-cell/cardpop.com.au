
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient.js';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BookOpen, FileX, AlertCircle, Search, User, Calendar, ArrowRight } from 'lucide-react';
import { htmlExcerpt } from '@/utils/htmlExcerpt.js';
import { BLOG_CATEGORIES as CATEGORIES } from '@/data/blogCategories.js';

const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map(c => [c.slug, c.label]));

const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });

const CategoryBadge = ({ slug }) => {
  const label = CATEGORY_MAP[slug] || slug;
  if (!label) return null;
  return (
    <span className="absolute -top-3 right-0 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full shadow-sm pointer-events-none">
      {label}
    </span>
  );
};

const ImagePlaceholder = () => (
  <div className="absolute inset-0 flex items-center justify-center bg-secondary/50">
    <BookOpen className="w-8 h-8 text-muted-foreground opacity-20" />
  </div>
);

// Large card for Featured Stories (2-col grid)
const FeaturedCard = ({ article, showBadge = true }) => {
  const imageUrl = article.featured_image_url || null;
  return (
    <Link
      to={`/blog/${article.slug || article.id}`}
      className="group relative flex flex-col bg-card border border-border rounded-2xl overflow-visible hover:shadow-lg hover:-translate-y-1 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <div className="aspect-video bg-muted relative overflow-hidden flex items-center justify-center">
        {imageUrl
          ? <img src={imageUrl} alt={article.title} loading="lazy" decoding="async" className="object-contain w-full h-full group-hover:scale-105 transition-transform duration-500" />
          : <ImagePlaceholder />
        }
      </div>
      {showBadge && <CategoryBadge slug={article.category} />}
      <div className="p-6 flex flex-col flex-1">
        <h3 className="font-bold text-xl mb-2 line-clamp-2 group-hover:text-primary transition-colors leading-snug">
          {article.title}
        </h3>
        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed mb-4 flex-1">
          {article.excerpt || htmlExcerpt(article.content, 130)}
        </p>
        <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-4 mt-auto">
          <span className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" />
            {article.author || 'CardPop Australia'}
          </span>
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {formatDate(article.created_at)}
          </span>
        </div>
      </div>
    </Link>
  );
};

// Standard card for the main articles grid (3-col)
const ArticleCard = ({ article, showBadge = true }) => {
  const imageUrl = article.featured_image_url || null;
  return (
    <Link
      to={`/blog/${article.slug || article.id}`}
      className="group relative flex flex-col bg-card border border-border rounded-2xl overflow-visible hover:shadow-lg hover:-translate-y-1 transition-all duration-300 h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <div className="aspect-[16/9] bg-muted relative overflow-hidden flex items-center justify-center">
        {imageUrl
          ? <img src={imageUrl} alt={article.title} loading="lazy" decoding="async" className="object-contain w-full h-full group-hover:scale-105 transition-transform duration-500" />
          : <ImagePlaceholder />
        }
      </div>
      {showBadge && <CategoryBadge slug={article.category} />}
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-center justify-between mb-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {article.author || 'CardPop Australia'}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {formatDate(article.created_at)}
          </span>
        </div>
        <h3 className="font-bold text-lg mb-2 line-clamp-2 group-hover:text-primary transition-colors leading-snug">
          {article.title}
        </h3>
        <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed mt-auto">
          {article.excerpt || htmlExcerpt(article.content, 110)}
        </p>
      </div>
    </Link>
  );
};

const BlogPage = () => {
  const { category: categoryParam } = useParams();
  const [searchParams] = useSearchParams();
  const tagParam = searchParams.get('tag');
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await supabase.from('blog_articles').select('*').eq('is_published', true).order('created_at', { ascending: false }).limit(100);
      setArticles(data ?? []);
    } catch (err) {
      setError('Failed to load articles. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchArticles(); }, [fetchArticles]);

  // Articles for the Featured Stories strip (only on the main blog page, no search/category/tag filter)
  const featuredArticles = useMemo(
    () => (!categoryParam && !tagParam && !searchTerm ? articles.filter(a => a.featured).slice(0, 4) : []),
    [articles, categoryParam, tagParam, searchTerm]
  );

  // Articles for the main grid, filtered by category param, tag param or search
  const displayedArticles = useMemo(() => {
    let filtered = articles;
    if (categoryParam) filtered = filtered.filter(a => a.category === categoryParam);
    if (tagParam) {
      const t = tagParam.toLowerCase();
      filtered = filtered.filter(a => Array.isArray(a.tags) && a.tags.some(tag => tag?.toLowerCase() === t));
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(a =>
        a.title?.toLowerCase().includes(q) ||
        a.author?.toLowerCase().includes(q) ||
        a.excerpt?.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [articles, categoryParam, tagParam, searchTerm]);

  // Article count per category for the Explore section
  const categoryCounts = useMemo(() => {
    const counts = {};
    articles.forEach(a => { if (a.category) counts[a.category] = (counts[a.category] || 0) + 1; });
    return counts;
  }, [articles]);

  const activeCategory = categoryParam ? CATEGORY_MAP[categoryParam] : null;
  const pageTitle = activeCategory
    ? `${activeCategory} | Blog`
    : tagParam
      ? `${tagParam} articles | The Parallel Report`
      : 'The Parallel Report | CardPop';
  const pageDescription = activeCategory
    ? `${activeCategory} from The Parallel Report by CardPop — trading card analysis, guides and insights for Australian Pokémon, MTG and sports card collectors.`
    : tagParam
      ? `Articles tagged “${tagParam}” from The Parallel Report by CardPop — trading card analysis, guides and insights for Australian collectors.`
      : 'The Parallel Report by CardPop — trading card news, market analysis, grading guides and investment insights for Australian Pokémon, MTG and sports card collectors.';

  return (
    <div className="min-h-[100dvh] bg-background">
      <SEOHead
        title={pageTitle}
        description={pageDescription}
        canonicalUrl={categoryParam ? `https://cardpop.com.au/blog/category/${categoryParam}` : 'https://cardpop.com.au/blog'}
      />

      {/* ── Hero ── */}
      <section className="bg-card border-b border-border py-20 text-center">
        <div className="container-default">
          <BookOpen className="w-12 h-12 text-primary mx-auto mb-6" />
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            {activeCategory || tagParam || 'The Parallel Report'}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            {activeCategory
              ? `Showing all articles in ${activeCategory}`
              : tagParam
                ? `Showing all articles tagged “${tagParam}”`
                : 'Insights, news, and deep-dives from the forefront of the collecting world.'}
          </p>
          <div className="max-w-md mx-auto relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              name="blog-search"
              aria-label="Search articles by title or author"
              placeholder="Search articles by title or author..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-12 rounded-full bg-background border-border shadow-sm"
            />
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16 space-y-16">

        {/* ── Featured Stories ── */}
        {!loading && featuredArticles.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold mb-6">Featured Stories</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {featuredArticles.map(article => (
                <FeaturedCard key={article.id} article={article} />
              ))}
            </div>
          </section>
        )}

        {/* ── Explore by Topic ── */}
        {!categoryParam && !tagParam && !searchTerm && !loading && (
          <section>
            <h2 className="text-2xl font-bold mb-6">Explore by Topic</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {CATEGORIES.map(cat => (
                <Link
                  key={cat.slug}
                  to={`/blog/category/${cat.slug}`}
                  className="group flex flex-col justify-between bg-card border border-border rounded-2xl p-6 hover:shadow-md hover:border-primary/30 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div>
                    <h3 className="font-bold text-lg mb-2 group-hover:text-primary transition-colors">
                      {cat.label}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                      {cat.desc}
                    </p>
                  </div>
                  <span className="flex items-center gap-1.5 text-primary text-xs font-bold uppercase tracking-wider">
                    View Articles
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── All / Filtered Articles ── */}
        <section>
          {(activeCategory || tagParam) && (
            <div className="mb-6">
              <Link to="/blog" className="inline-flex items-center text-sm text-primary font-semibold hover:underline mb-3">
                ← All Articles
              </Link>
              <h2 className="text-2xl font-bold">
                {activeCategory || `Tagged: ${tagParam}`}
              </h2>
            </div>
          )}
          {!activeCategory && !tagParam && !searchTerm && !loading && displayedArticles.length > 0 && (
            <h2 className="text-2xl font-bold mb-6">Latest Articles</h2>
          )}

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
            <div className="flex flex-col items-center justify-center py-16 px-4 bg-destructive/5 rounded-3xl border border-destructive/10 text-center max-w-2xl mx-auto">
              <AlertCircle className="w-10 h-10 text-destructive mb-4" />
              <h2 className="text-xl font-bold mb-2">Connection Error</h2>
              <p className="text-sm text-muted-foreground mb-6">{error}</p>
              <Button onClick={fetchArticles} size="lg">Retry Connection</Button>
            </div>
          ) : displayedArticles.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayedArticles.map(article => (
                <ArticleCard key={article.id} article={article} showBadge={!categoryParam} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 px-4 bg-muted/20 rounded-3xl border border-border border-dashed text-center">
              <FileX className="w-10 h-10 text-muted-foreground mb-4 opacity-50" />
              <p className="text-lg font-bold mb-2">No articles found</p>
              <p className="text-sm text-muted-foreground max-w-md">
                {searchTerm
                  ? `No articles match "${searchTerm}". Try different keywords.`
                  : activeCategory
                    ? `No articles in ${activeCategory} yet. Check back soon.`
                    : tagParam
                      ? `No articles tagged “${tagParam}” yet. Check back soon.`
                      : "We're working on new content. Check back soon."}
              </p>
              {(searchTerm || activeCategory || tagParam) && (
                <Button variant="outline" className="mt-6" asChild>
                  <Link to="/blog">View All Articles</Link>
                </Button>
              )}
            </div>
          )}
        </section>

      </div>
    </div>
  );
};

export default BlogPage;
