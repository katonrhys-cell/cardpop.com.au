import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import DOMPurify from 'dompurify';
import SEOHead from '@/components/SEOHead.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, FileText } from 'lucide-react';
import { generateBlogPostingSchema, generateFAQStructuredData, generateBreadcrumbStructuredData } from '@/utils/seoUtils.js';
import { htmlExcerpt } from '@/utils/htmlExcerpt.js';
import { publicImageUrl, toCdnUrl, cdnifyStorageUrlsInHtml, ensureImgAltInHtml } from '@/utils/imageUrl.js';
import { resolveConviction, CONVICTION_METHODOLOGY_PATH } from '@/utils/convictionRating.js';
import { BLOG_CATEGORY_MAP } from '@/data/blogCategories.js';
import { parseVideoUrl } from '@/utils/videoEmbed.js';

const ConvictionRating = ({ article }) => {
  const conviction = resolveConviction(article);
  if (!conviction) return null;
  const { rating, label, colour, blurb, type, action } = conviction;
  return (
    <div className="mt-4 pt-4 border-t border-white/10">
      {/* Type + current reading */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
        <span className="text-[10px] font-bold tracking-widest uppercase text-white/40">
          CardPop {type.name}™
        </span>
        <span className="text-xs font-semibold" style={{ color: colour }}>
          {rating}/5 &middot; {label}
        </span>
      </div>
      <p className="text-xs text-white/50 mb-2.5">{type.question} {blurb}</p>

      {/* Scale — 5 segments filled to the rating, with strength end-points */}
      <div className="max-w-[15rem]">
        <div className="flex items-center gap-1" role="img"
             aria-label={`${type.name} ${rating} out of 5: ${label} — ${action}`}>
          {[1, 2, 3, 4, 5].map((i) => (
            <span key={i} className="flex-1 h-1.5 rounded-full transition-colors"
                  style={{ background: i <= rating ? colour : 'rgba(255,255,255,0.12)' }} />
          ))}
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[9px] uppercase tracking-wider text-white/35">Minimal</span>
          <span className="text-[9px] uppercase tracking-wider text-white/35">Highest</span>
        </div>
      </div>

      {/* What it means for you */}
      <div className="mt-3 flex items-start gap-2">
        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: colour }} />
        <p className="text-xs text-white/70">
          <span className="font-semibold text-white/90">What this means:</span> {action}.
        </p>
      </div>

      <Link to={CONVICTION_METHODOLOGY_PATH}
            className="mt-2.5 inline-block text-[11px] font-semibold underline underline-offset-2 text-white/45 hover:text-white/80 transition-colors">
        How the CardPop Conviction Rating works →
      </Link>
    </div>
  );
};

const formatPublishedDate = (dateStr) => {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return null;
  }
};

const FAQ_DATA = {
  'understanding-card-parallels-the-complete-guide-2026': [
    {
      question: 'What is a parallel card in simple terms?',
      answer: 'A parallel is an alternate version of a base card — the same player, photo and design, but with a different foil finish, colour or serial number that makes it rarer. Because parallels are printed in smaller quantities than the base card, collectors pay more for them.'
    },
    {
      question: 'What does a serial number like 23/99 mean?',
      answer: 'It means your card is number 23 of only 99 ever printed of that exact parallel. The second number (99) is the total print run, so the lower it is, the scarcer the card. A stamp of 1/1 means it is the only copy in existence.'
    },
    {
      question: 'What is the difference between a Prizm and a Refractor?',
      answer: 'They are the same concept from different manufacturers. "Prizm" is Panini’s name for its chrome parallels (the base one is the Silver Prizm); "Refractor" is Topps’ name for its chrome parallels (the base one is simply the Refractor). Both are the entry-level chrome parallel that anchors a player’s market.'
    },
    {
      question: 'Which parallel colour is the rarest?',
      answer: 'It depends on the set, but the top of the ladder is almost always a 1/1 — the Superfractor (Topps), Gold Vinyl, or Black Finite (Panini). Below that, Gold is typically numbered to /10, making it the rarest of the standard colour tiers. Always check the specific product, as print runs change year to year.'
    },
    {
      question: 'Are parallels worth more than base cards?',
      answer: 'Almost always, yes — because they are scarcer. The same rookie can be worth a few dollars as a base card and hundreds or thousands as a numbered colour parallel. That said, scarcity only matters when there is demand for the player, and condition still affects price, so a parallel in a high PSA grade carries an additional premium.'
    }
  ],
  'the-cardpop-investors-guide-to-nba-rookie-cards-2026-27': [
    {
      question: 'Does the best basketball player always have the most valuable rookie cards?',
      answer: 'No. On-court production is one input, but card values are driven by a combination of superstar potential, marketability, scarcity, autograph desirability, social media presence and narrative. A player can score 25 a night and still generate limited hobby demand if collectors do not connect with their story. You are buying future demand, not statistics.'
    },
    {
      question: 'What made Victor Wembanyama’s autographs so sought after?',
      answer: 'Alongside standard signatures, Wembanyama released autographs featuring alien-themed sketches, inscriptions and personalised variations. These reinforced his "Alien" brand, felt instantly recognisable and stood apart from standard signatures, so collectors often chased them more aggressively than standard versions of comparable rarity. It is a clear example of unique, story-driven cards outperforming.'
    },
    {
      question: 'Which 2026-27 rookies are the top hobby prospects?',
      answer: 'CardPop’s Tier One prospects are AJ Dybantsa, Cameron Boozer and Darryn Peterson. Tier Two emerging stars include Caleb Wilson, Mikel Brown Jr. and Kingston Flemings, while Tier Three high-upside sleepers feature Karim Lopez, Darius Acuff Jr. and Nate Ament. Rankings are a starting point — draft position, team fit and early performance can reshape the board quickly.'
    },
    {
      question: 'Which rookie card types carry the highest conviction?',
      answer: 'The highest-conviction targets are National Treasures and Immaculate Rookie Patch Autographs (RPAs), Prizm Gold, Prizm Black Gold, Select Courtside Gold and on-card autographs. Prizm Silver, Optic Holo, Select Courtside and numbered colour parallels sit in the medium tier. Base rookies, mass-produced inserts and unnumbered parallels carry the lowest conviction.'
    },
    {
      question: 'Where can Australians buy and sell NBA rookie cards?',
      answer: 'CardPop is Australia’s dedicated trading card marketplace — built for local collectors with a 3% fee versus eBay’s 13.4%, and no international shipping hassles. For price research, eBay.com.au sold listings remain the benchmark.'
    }
  ],
  'psa-grading-guide-for-australian-collectors-2026': [
    {
      question: 'How much does PSA grading cost in Australia?',
      answer: 'Through Australian PSA Certified Dealers, PSA grading costs range from approximately AUD $68 per card (Economy, ~95 business days) to AUD $370+ per card (Super Express, ~15 business days). Note: Direct PSA submissions from Australia are currently suspended (May 2026) due to US tariff changes — Australian dealers are the only submission route until PSA reinstates international access.'
    },
    {
      question: 'What is the best PSA grade for an Australian collector?',
      answer: 'PSA 9 (Mint) is the sweet spot for most Australian collectors — it represents near-perfect condition, commands strong resale value, and is achievable for most well-cared-for modern cards. PSA 10 (Gem Mint) commands 4–10× premium prices but only 2–5% of modern cards submitted achieve it.'
    },
    {
      question: 'How do I submit cards for PSA grading in Australia?',
      answer: 'The easiest way is through an Australian PSA Certified Dealer. The Hobby Australia (Point Cook, VIC) is the only PSA Certified Dealer in the Southern Hemisphere. Other popular local submission services include Card Bot (Melbourne + postal), Mana Market, One Stop Poke Shop, and Slabd. All handle shipping, insurance and customs on your behalf.'
    },
    {
      question: 'How long does PSA grading take from Australia?',
      answer: 'Through an Australian dealer on Economy tier, expect 95 business days (roughly 4–5 calendar months) at PSA, plus transit time to and from the US. Express tiers reduce PSA time to 15–35 business days but cost significantly more. Total door-to-door time including transit is typically 5–6 months on Economy.'
    },
    {
      question: 'Is PSA grading worth it for Australian collectors?',
      answer: 'PSA grading is worth it when: the card is likely to grade PSA 9 or PSA 10, the graded value significantly exceeds raw value plus grading fees, and the card is liquid enough to sell easily. It is generally not worth grading common modern cards under AUD $100 raw value, or cards likely to grade PSA 8 or below.'
    },
    {
      question: 'What is the difference between PSA and BGS grading?',
      answer: 'PSA uses whole-number grades 1–10 and is the gold standard for sports cards resale value in Australia. BGS (Beckett) uses half-point grades including BGS 9.5, provides four sub-grades (centering, corners, edges, surface), and has a Black Label 10 Pristine as its top designation. PSA commands higher resale prices for sports cards in Australia.'
    }
  ]
};

const isUUID = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

// Build a URL-safe, unique anchor id from heading text.
const slugifyHeading = (text, used) => {
  const base = (text || '')
    .toLowerCase().trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '') || 'section';
  let id = base;
  let n = 2;
  while (used.has(id)) id = `${base}-${n++}`;
  used.add(id);
  return id;
};

// Given sanitized article HTML, inject anchor ids onto every <h2> and return
// both the augmented HTML and a table-of-contents list. Falls back gracefully
// when DOMParser is unavailable (e.g. non-browser rendering).
const buildTableOfContents = (sanitizedHtml) => {
  if (!sanitizedHtml || typeof window === 'undefined' || typeof window.DOMParser === 'undefined') {
    return { html: sanitizedHtml, toc: [] };
  }
  try {
    const doc = new window.DOMParser().parseFromString(sanitizedHtml, 'text/html');
    const used = new Set();
    const toc = Array.from(doc.querySelectorAll('h2'))
      .map((h) => {
        const text = h.textContent.trim();
        if (!text) return null;
        if (!h.id) h.id = slugifyHeading(text, used);
        else used.add(h.id);
        // Scroll offset for TOC anchor jumps lives in CSS (.article-content
        // headings) so it can respond to the sticky header's taller desktop
        // height — an inline style here couldn't carry a media query.
        return { id: h.id, text };
      })
      .filter(Boolean);
    return { html: doc.body.innerHTML, toc };
  } catch {
    return { html: sanitizedHtml, toc: [] };
  }
};

// vault_items.card_image stores a Supabase Storage path, not a full URL.
// Resolve it to a public URL (already-absolute http URLs are passed through).
const resolveCardImage = (path) => {
  if (!path) return null;
  return publicImageUrl(path);
};

const BlogArticlePage = () => {
  const { id, slug } = useParams();
  const navigate = useNavigate();
  const identifier = slug || id;
  const bySlug = !!slug || (id && !isUUID(id));

  const [article, setArticle] = useState(null);
  const [htmlContent, setHtmlContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [relatedArticles, setRelatedArticles] = useState([]);
  const [marketplaceCards, setMarketplaceCards] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const fetchArticleData = async () => {
      setLoading(true);
      setError(null);
      try {
        let query = supabase.from('blog_articles').select('*');
        query = bySlug
          ? query.eq('slug', identifier).single()
          : query.eq('id', identifier).single();

        const { data: res, error: fetchErr } = await query;
        if (fetchErr) throw fetchErr;
        if (cancelled) return;

        // Redirect UUID URLs and /blog/slug/ prefixed URLs to clean /blog/[slug]
        if (res.slug) {
          const target = `/blog/${res.slug}`;
          if (window.location.pathname !== target) {
            navigate(target, { replace: true });
            return;
          }
        }

        setArticle(res);
        // Article bodies store canonical Supabase URLs in their <img> tags —
        // rewrite them onto the image CDN before render so body images don't
        // bill Supabase egress on every view. Body images authored without
        // alt text get the article title as a fallback alt.
        setHtmlContent(ensureImgAltInHtml(
          cdnifyStorageUrlsInHtml(res.content_html || res.content || ''),
          res.title || '',
        ));

        const [relatedRes, cardsRes] = await Promise.all([
          supabase
            .from('blog_articles')
            .select('id, slug, title, featured_image_url, excerpt, content')
            .eq('is_published', true)
            .neq('id', res.id)
            .order('created_at', { ascending: false })
            .limit(3),
          (res.marketplace_keywords?.length > 0)
            ? supabase
                .from('listings')
                .select('id, slug, price_aud, accepts_offers, vault_items(card_name, set_name, grade, grading_company, card_image, year)')
                .eq('status', 'active')
                .limit(6)
            : Promise.resolve({ data: [] }),
        ]);

        if (!cancelled) {
          setRelatedArticles(relatedRes.data ?? []);
          // client-side filter by keywords since OR ilike across joined table is complex
          const keywords = (res.marketplace_keywords ?? []).map(k => k.toLowerCase());
          const filtered = (cardsRes.data ?? []).filter(l => {
            const name = (l.vault_items?.card_name ?? '').toLowerCase();
            return keywords.some(kw => name.includes(kw));
          });
          setMarketplaceCards(filtered);
        }

      } catch (err) {
        if (!cancelled) setError('Article not found or unavailable.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchArticleData();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return () => { cancelled = true; };
  }, [identifier, bySlug, navigate]);

  if (loading) {
    return (
      <div className="container-default max-w-[90rem] mx-auto py-24 space-y-8 min-h-[100dvh]">
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

  const imageUrl = toCdnUrl(article.featured_image_url) || null;
  // A featured VIDEO, when set, takes the hero slot in place of the image.
  // Falls back to null for empty/unsupported URLs (the image then renders).
  const videoInfo = parseVideoUrl(article.featured_video_url);
  // Portrait card/slab image shown in the empty right side of the "On this
  // page" panel — routed through the image CDN like every rendered image.
  const tocImageUrl = publicImageUrl(article.toc_image_url, 'media');
  const articleSlug = article.slug;
  const canonicalUrl = `https://cardpop.com.au/blog/${articleSlug}`;

  const wordCount = htmlContent
    ? htmlContent.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/gi, ' ').split(/\s+/).filter(Boolean).length
    : 0;

  // blog_articles.category stores the slug; resolve it to the shared taxonomy
  // (data/blogCategories.js) for the human label + pill colour. Mirrors the
  // server-side prerenderer (api/prerender.js) so on-page and bot metadata agree.
  const categoryMeta = article.category ? BLOG_CATEGORY_MAP[article.category] : null;
  const categoryLabel = categoryMeta?.label || article.category || null;

  const { html: contentHtml, toc } = buildTableOfContents(
    htmlContent ? DOMPurify.sanitize(htmlContent, { ADD_ATTR: ['target'] }) : ''
  );

  const blogStructuredData = generateBlogPostingSchema({
    title: article.seo_title || article.title,
    image: toCdnUrl(article.featured_image_url),
    author: article.author || 'The Parallel Report',
    publishedAt: article.published_at || article.created_at,
    updated: article.updated_at,
    excerpt: article.seo_description || article.excerpt,
    url: canonicalUrl,
    category: categoryLabel,
    tags: article.tags,
    readTime: article.read_time_minutes,
    wordCount
  });

  // Prefer editor-managed FAQs stored on the article; fall back to the
  // hard-coded map for the original articles that predate the `faqs` column.
  const faqData = (Array.isArray(article.faqs) && article.faqs.length > 0)
    ? article.faqs.filter(f => f && f.question && f.answer)
    : (articleSlug ? FAQ_DATA[articleSlug] : null);
  const faqStructuredData = (faqData && faqData.length > 0)
    ? generateFAQStructuredData(faqData.map(f => ({ question: f.question, answer: f.answer })))
    : null;

  const breadcrumbStructuredData = generateBreadcrumbStructuredData([
    { name: 'CardPop', url: 'https://cardpop.com.au' },
    { name: 'The Parallel Report', url: 'https://cardpop.com.au/blog' },
    ...(article.category ? [{ name: categoryLabel, url: `https://cardpop.com.au/blog/category/${encodeURIComponent(article.category)}` }] : []),
    { name: article.title, url: canonicalUrl },
  ]);

  const organisationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'CardPop',
    url: 'https://cardpop.com.au',
    logo: 'https://cardpop.com.au/logo.png',
    description: "Australia's trusted trading card marketplace and home of The Parallel Report.",
    sameAs: ['https://cardpop.com.au/blog'],
    publishingPrinciples: 'https://cardpop.com.au/blog',
  };

  // Emit VideoObject when the article carries a featured video, so the embed is
  // eligible for video rich results. thumbnailUrl prefers the auto-derived
  // YouTube still, falling back to the article's featured image.
  const videoStructuredData = videoInfo ? {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: article.seo_title || article.title,
    description: article.seo_description || article.excerpt || article.title,
    thumbnailUrl: videoInfo.thumbnailUrl || toCdnUrl(article.featured_image_url) || undefined,
    uploadDate: article.published_at || article.created_at,
    embedUrl: videoInfo.embedUrl,
  } : null;

  const structuredDataArray = [blogStructuredData, videoStructuredData, faqStructuredData, breadcrumbStructuredData, organisationSchema].filter(Boolean);

  return (
    <article className="min-h-[100dvh] bg-background pb-24 overflow-x-hidden">
      <SEOHead
        title={article.seo_title || `${article.title} | The Parallel Report`}
        description={article.seo_description || article.excerpt || `Read ${article.title} on The Parallel Report — CardPop's trading card blog.`}
        ogImage={toCdnUrl(article.featured_image_url) || undefined}
        ogImageAlt={article.title}
        canonicalUrl={canonicalUrl}
        structuredData={structuredDataArray.length === 1 ? structuredDataArray[0] : structuredDataArray}
      />

      {/* Parallel Report masthead — charcoal hero, CardPop Red accents */}
      <div className="bg-brand-charcoal text-white">
        <div className="container-default max-w-4xl mx-auto pt-8 pb-6">

          {/* Back link */}
          <Link to="/blog" className="inline-flex items-center text-xs font-medium text-white/50 hover:text-white/90 transition-colors group mb-8">
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5 group-hover:-translate-x-1 transition-transform duration-300" />
            Back to The Parallel Report
          </Link>

          {/* Publication identity */}
          <div className="flex items-center gap-3 mb-1">
            {/* Slab-inspired badge */}
            <div className="border border-white/20 rounded px-2.5 py-1 flex items-center gap-1.5 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-red inline-block" />
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/80">CardPop Research</span>
            </div>
          </div>

          <h2 className="font-heading text-2xl md:text-3xl font-bold tracking-tight text-white mb-1">
            The Parallel Report
          </h2>
          <p className="text-xs tracking-widest uppercase text-white/40 mb-2">
            Research &bull; Analysis &bull; Market Intelligence
          </p>
          <p className="text-sm text-white/55 mb-7">
            Exploring the stories, trends and data shaping the hobby.
          </p>

          {/* Divider */}
          <div className="border-t border-white/10 mb-7" />

          {/* Category badge — colour matches this category's pill on the blog
              grid and its icon in the nav dropdown (shared taxonomy). */}
          {categoryMeta && (
            <Link to={`/blog/category/${article.category}`}
                  className={`inline-block text-[11px] font-bold tracking-widest uppercase px-3 py-1 rounded mb-5 bg-gradient-to-br ${categoryMeta.gradient} text-white hover:opacity-90 transition-opacity`}>
              {categoryMeta.label}
            </Link>
          )}

          {/* Article title */}
          <h1 className="font-heading text-3xl md:text-4xl lg:text-[2.75rem] font-bold leading-snug tracking-tight text-white mb-5 text-balance">
            {article.title}
          </h1>

          {/* Excerpt */}
          {article.excerpt && (
            <p className="text-base text-white/65 leading-relaxed mb-7 max-w-2xl">
              {article.excerpt}
            </p>
          )}

          {/* Byline */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-bold" style={{ color: '#CE1126' }}>
            <span>By <span className="font-bold">{article.author || 'CardPop Research'}</span></span>
            {(article.published_at || article.created_at) && (
              <>
                <span className="opacity-40">&bull;</span>
                <span>{formatPublishedDate(article.published_at || article.created_at)}</span>
              </>
            )}
            {article.read_time_minutes && (
              <>
                <span className="opacity-40">&bull;</span>
                <span>{article.read_time_minutes} min read</span>
              </>
            )}
          </div>

          <ConvictionRating article={article} />

        </div>
      </div>

      {videoInfo ? (
        <div className="container-default max-w-4xl mx-auto mt-4 mb-4">
          <div className="rounded-2xl overflow-hidden bg-black shadow-lg aspect-video">
            <iframe
              src={videoInfo.embedUrl}
              title={article.title}
              className="block w-full h-full"
              loading="eager"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        </div>
      ) : imageUrl && (
        <div className="container-default max-w-4xl mx-auto mt-4 mb-4">
          <div className="rounded-2xl overflow-hidden bg-muted shadow-lg aspect-video">
             <img
               src={imageUrl}
               alt={article.title}
               className="block w-full h-full object-cover"
               fetchPriority="high"
               loading="eager"
               decoding="async"
             />
          </div>
        </div>
      )}

      <div className="w-full mt-10 mb-24">
        {htmlContent ? (
          <div className="w-full container-default">
            {toc.length >= 3 && (
              <nav aria-label="Table of contents" className="mb-10 rounded-xl border border-border bg-muted/30 p-5">
                <div className="flex gap-6">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">On this page</p>
                    <ol className="space-y-2">
                      {toc.map((item, i) => (
                        <li key={item.id} className="text-sm leading-snug">
                          <a href={`#${item.id}`} className="inline-flex gap-2 text-muted-foreground hover:text-primary transition-colors">
                            <span className="text-primary/50 tabular-nums shrink-0">{String(i + 1).padStart(2, '0')}</span>
                            <span>{item.text}</span>
                          </a>
                        </li>
                      ))}
                    </ol>
                  </div>
                  {tocImageUrl && (
                    <div className="hidden sm:flex shrink-0 items-center">
                      <img
                        src={tocImageUrl}
                        alt={article.toc_image_alt || article.title}
                        className="w-40 md:w-52 max-h-80 object-contain rounded-lg drop-shadow-md"
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                  )}
                </div>
              </nav>
            )}
            <div
              className="article-content prose prose-neutral dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: contentHtml }}
            ></div>
          </div>
        ) : (
          <div className="container-default max-w-[90rem] mx-auto">
            <p className="text-muted-foreground italic">No content available for this article.</p>
          </div>
        )}
      </div>

      {Array.isArray(article.tags) && article.tags.length > 0 && (
        <div className="w-full container-default mb-16">
          <div className="flex flex-wrap items-center gap-2 pt-8 border-t border-border">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mr-1">Topics</span>
            {article.tags.map((tag) => (
              <Link
                key={tag}
                to={`/blog?tag=${encodeURIComponent(tag)}`}
                className="text-xs font-medium px-3 py-1 rounded-full bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                {tag}
              </Link>
            ))}
          </div>
        </div>
      )}

      {faqData && faqData.length > 0 && (
        <section className="border-t border-border py-14">
          <div className="container-default max-w-4xl mx-auto">
            <h2 className="font-heading font-extrabold text-2xl mb-6">Frequently Asked Questions</h2>
            <div className="space-y-6">
              {faqData.map((faq, i) => (
                <div key={i}>
                  <h3 className="font-bold text-lg mb-1.5 text-balance">{faq.question}</h3>
                  <p className="text-muted-foreground leading-relaxed">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {marketplaceCards.length > 0 && (
        <section className="border-t border-border py-14">
          <div className="container-default max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="border border-white/20 rounded px-2.5 py-1 flex items-center gap-1.5 bg-brand-charcoal shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-red inline-block" />
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/80">CardPop Marketplace</span>
              </div>
            </div>
            <h2 className="font-heading font-extrabold text-xl mb-1">Shop Cards From This Article</h2>
            <p className="text-sm text-muted-foreground mb-6">Live listings from The CardPop Marketplace — updated in real time.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {marketplaceCards.map((listing) => {
                const card = listing.vault_items;
                const cardImageUrl = resolveCardImage(card?.card_image);
                // Route is /marketplace/:id/:slug? and the detail page fetches by
                // id, so the id must be the first segment (a bare slug or the
                // literal "listing" both render "product not found").
                const href = `/marketplace/${listing.id}${listing.slug ? `/${listing.slug}` : ''}`;
                return (
                  <Link
                    key={listing.id}
                    to={href}
                    className="group flex flex-col bg-card border border-border rounded-xl overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                  >
                    <div className="aspect-[3/4] bg-muted relative overflow-hidden">
                      {cardImageUrl ? (
                        <img src={cardImageUrl} alt={card.card_name} loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <FileText className="w-8 h-8 text-muted-foreground opacity-20" />
                        </div>
                      )}
                      {card?.grade && (
                        <span className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded bg-brand-charcoal text-white">
                          {card.grading_company} {card.grade}
                        </span>
                      )}
                    </div>
                    <div className="p-3 flex flex-col gap-1">
                      <p className="font-semibold text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                        {card?.card_name}
                      </p>
                      {card?.set_name && (
                        <p className="text-[11px] text-muted-foreground line-clamp-1">{card.set_name}{card.year ? ` · ${card.year}` : ''}</p>
                      )}
                      <p className="font-bold text-sm mt-1" style={{ color: '#CE1126' }}>
                        A${Number(listing.price_aud).toFixed(2)}
                        {listing.accepts_offers && <span className="text-[10px] font-normal text-muted-foreground ml-1">· offers</span>}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
            <div className="mt-6 text-center">
              <Link
                to="/marketplace"
                className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Browse all listings →
              </Link>
            </div>
          </div>
        </section>
      )}

      {relatedArticles.length > 0 && (
        <section className="bg-secondary/30 py-20 border-t border-border">
          <div className="container-default">
            <h2 className="text-3xl font-bold mb-10 text-center">More from Parallel Reports</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-[90rem] mx-auto">
              {relatedArticles.map((related) => {
                const relImg = toCdnUrl(related.featured_image_url) || null;
                const relLink = related.slug ? `/blog/${related.slug}` : `/blog/${related.id}`;
                return (
                  <Link
                    key={related.id}
                    to={relLink}
                    className="group flex flex-col bg-card border border-border rounded-xl overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300 h-full"
                  >
                    <div className="aspect-[16/9] bg-muted relative overflow-hidden">
                      {relImg ? (
                        <img src={relImg} alt={related.title} loading="lazy" decoding="async" className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" />
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
                        {related.excerpt || htmlExcerpt(related.content, 80)}
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
