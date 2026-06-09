import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import SEOHead from '@/components/SEOHead.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, FileText } from 'lucide-react';
import { generateBlogPostingSchema } from '@/utils/seoUtils.js';

const BlogArticlePage = () => {
  const { id } = useParams();
  const [article, setArticle] = useState(null);
  const [htmlContent, setHtmlContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [relatedArticles, setRelatedArticles] = useState([]);

  useEffect(() => {
    const fetchArticleData = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: res, error: fetchErr } = await supabase.from('blog_articles').select('*').eq('id', id).single();
        if (fetchErr) throw fetchErr;
        setArticle(res);
        setHtmlContent(res.content_html || res.content || '');

        const { data: related } = await supabase
          .from('blog_articles')
          .select('id, title, featured_image_url, content')
          .eq('is_published', true)
          .neq('id', id)
          .order('created_at', { ascending: false })
          .limit(3);
        setRelatedArticles(related ?? []);

      } catch (err) {
        console.error("Error loading article:", err);
        setError("Article not found or unavailable.");
      } finally {
        setLoading(false);
      }
    };
    fetchArticleData();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [id]);

  if (loading) {
    return (
      <div className="container-default max-w-6xl mx-auto py-24 space-y-8 min-h-[100dvh]">
        <Skeleton className="h-12 w-3/4 rounded-lg" />
        <Skeleton className="h-6 w-1/4 rounded-md" />
        <Skeleton className="aspect-[21/9] w-full rounded-2xl" />
        <div className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="container-default py-32 text-center flex flex-col items-center min-h-[100dvh]">
        <FileText className="w-16 h-16 text-muted-foreground opacity-50 mb-6" />
        <h2 className="text-3xl font-bold mb-4">Article Not Found</h2>
        <p className="text-muted-foreground mb-8">The article you are looking for does not exist or has been removed.</p>
        <Link to="/blog" className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90">
          Return to Blog
        </Link>
      </div>
    );
  }

  const imageUrl = article.featured_image_url || null;

  // Generate blog posting structured data
  const blogStructuredData = generateBlogPostingSchema({
    title: article.title,
    image: article.featured_image_url,
    author: article.author || 'CardPop Team',
    publishedAt: article.created_at,
    updated: article.updated_at,
    excerpt: article.excerpt
  });

  return (
    <article className="min-h-[100dvh] bg-background pb-24 overflow-x-hidden">
      <SEOHead
        title={`${article.title} | CardPop Blog`}
        description={article.excerpt || `Read ${article.title} on The Parallel Report — CardPop's trading card blog.`}
        ogImage={article.featured_image_url || undefined}
        structuredData={blogStructuredData}
      />
      
      <div className="container-default pt-12 pb-8">
        <Link to="/blog" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group">
          <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform duration-300" /> 
          Back to The Parallel Report
        </Link>
      </div>

      {imageUrl && (
        <div className="container-default max-w-6xl mx-auto mb-12">
          <div className="aspect-[21/9] rounded-2xl overflow-hidden bg-muted shadow-lg">
             <img src={imageUrl} alt={article.title} className="w-full h-full object-cover" />
          </div>
        </div>
      )}

      <div className="container-default max-w-6xl mx-auto mb-8">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-balance">{article.title}</h1>
        <p className="text-muted-foreground font-medium">By {article.author || 'CardPop Team'}</p>
      </div>

      <div className="w-full mb-24">
        {htmlContent ? (
          <div 
            className="article-content w-full max-w-4xl mx-auto prose prose-neutral dark:prose-invert px-4"
            dangerouslySetInnerHTML={{ __html: htmlContent }} 
          />
        ) : (
          <div className="container-default max-w-6xl mx-auto">
            <p className="text-muted-foreground italic">No content available for this article.</p>
          </div>
        )}
      </div>

      {relatedArticles.length > 0 && (
        <section className="bg-secondary/30 py-20 border-t border-border">
          <div className="container-default">
            <h2 className="text-3xl font-bold mb-10 text-center">More from the Blog</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {relatedArticles.map((related) => {
                const relImg = related.featured_image_url || null;
                return (
                  <Link 
                    key={related.id} 
                    to={`/blog/${related.id}`} 
                    className="group flex flex-col bg-card border border-border rounded-xl overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300 h-full"
                  >
                    <div className="aspect-[16/9] bg-muted relative overflow-hidden">
                      {relImg ? (
                        <img src={relImg} alt={related.title} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground bg-secondary/50">
                          <FileText className="w-8 h-8 opacity-20" />
                        </div>
                      )}
                    </div>
                    <div className="p-5 flex flex-col flex-1">
                      <h3 className="font-bold text-lg mb-2 line-clamp-2 group-hover:text-primary transition-colors text-balance">
                        {related.title}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {related.content?.substring(0, 80)}...
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </article>
  );
};

export default BlogArticlePage;