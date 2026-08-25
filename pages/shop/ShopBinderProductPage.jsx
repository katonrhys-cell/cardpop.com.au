import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MessageSquare, Check, ChevronRight } from 'lucide-react';
import SEOHead from '@/components/SEOHead.jsx';
import Breadcrumb from '@/components/Breadcrumb.jsx';
import ProductImageCarousel from '@/components/ProductImageCarousel.jsx';
import NotFoundPage from '@/pages/NotFoundPage.jsx';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabaseClient.js';
import {
  resolveBinderProduct, binderImages, binderImageAlt, binderSpecs, BINDER_PRODUCTS,
} from '@/data/shopBinderProducts.js';

const SITE_ORIGIN = 'https://cardpop.com.au';

const ShopBinderProductPage = () => {
  const { productSlug } = useParams();
  const product = resolveBinderProduct(productSlug);

  // The DB row carries the commercial fields only (price, stock, status). All
  // copy, specs and imagery come from data/shopBinderProducts.js so the page
  // renders identically for the SPA, the prerenderer and the sitemap.
  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!product) { setLoading(false); return undefined; }
    let cancelled = false;
    setLoading(true);
    supabase
      .from('shop_products')
      .select('id, price_aud, retail_price_aud, stock_quantity, status')
      .eq('slug', product.slug)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) { setRow(data || null); setLoading(false); }
      });
    return () => { cancelled = true; };
  }, [product]);

  if (!product) return <NotFoundPage />;

  const canonical = `${SITE_ORIGIN}/shop/binders/${product.slug}`;
  const images = binderImages(product);
  const specs = binderSpecs(product);
  const price = row?.price_aud != null && Number(row.price_aud) > 0 ? Number(row.price_aud) : null;
  const rrp = row?.retail_price_aud != null && Number(row.retail_price_aud) > 0
    ? Number(row.retail_price_aud)
    : null;
  const inStock = (row?.stock_quantity ?? 0) > 0;
  // These binders are enquiry-only: the CTA sends people to sign up rather than
  // to a checkout, so the page is complete (and indexable) without a price. An
  // Offer is emitted only once a real price is set and the row is switched to
  // `active` in /admin/products — asserting a price we won't honour is worse
  // than shipping a Product node with no Offer.
  const isPurchasable = row?.status === 'active' && price != null;

  const related = BINDER_PRODUCTS.filter((p) => p.slug !== product.slug).slice(0, 4);

  // ── Structured data ───────────────────────────────────────────────────────
  const productLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.metaDescription,
    image: images,
    sku: product.sku,
    brand: { '@type': 'Brand', name: 'Palms Off Gaming' },
    category: 'Binders',
    url: canonical,
    ...(isPurchasable ? {
      offers: {
        '@type': 'Offer',
        url: canonical,
        priceCurrency: 'AUD',
        price: price.toFixed(2),
        availability: inStock
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
        itemCondition: 'https://schema.org/NewCondition',
        seller: { '@type': 'Organization', name: 'CardPop Australia™' },
      },
    } : {}),
  };

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_ORIGIN },
      { '@type': 'ListItem', position: 2, name: 'Shop', item: `${SITE_ORIGIN}/shop` },
      { '@type': 'ListItem', position: 3, name: 'Binders', item: `${SITE_ORIGIN}/shop/binders` },
      { '@type': 'ListItem', position: 4, name: product.shortTitle, item: canonical },
    ],
  };

  const faqLd = product.faqs?.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: product.faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  } : null;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={product.metaTitle}
        description={product.metaDescription}
        canonicalUrl={canonical}
        ogImage={images[0]}
        ogImageAlt={binderImageAlt(product, product.imageFiles[0])}
        structuredData={[productLd, breadcrumbLd, faqLd].filter(Boolean)}
      />

      <div className="container mx-auto px-4 py-6 md:py-10">
        <Breadcrumb items={[
          { label: 'Home', path: '/' },
          { label: 'Shop', path: '/shop' },
          { label: 'Binders', path: '/shop/binders' },
          { label: product.shortTitle },
        ]} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* ── Gallery ─────────────────────────────────────────────────── */}
          <div>
            <ProductImageCarousel images={images} />
          </div>

          {/* ── Buy box ─────────────────────────────────────────────────── */}
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Palms Off Gaming · {product.range}
            </p>
            <h1 className="mt-2 text-3xl md:text-4xl font-extrabold leading-tight text-foreground">
              {product.title}
            </h1>

            <div className="mt-4 flex items-center gap-3 flex-wrap">
              {loading ? (
                <Skeleton className="h-9 w-28" />
              ) : isPurchasable ? (
                <>
                  <span className="text-3xl font-extrabold tabular-nums text-foreground">
                    ${price.toFixed(2)}
                  </span>
                  {rrp != null && rrp > price && (
                    <span className="text-lg text-muted-foreground line-through tabular-nums">
                      ${rrp.toFixed(2)}
                    </span>
                  )}
                  <Badge variant={inStock ? 'default' : 'secondary'}>
                    {inStock ? 'In stock' : 'Out of stock'}
                  </Badge>
                </>
              ) : rrp != null ? (
                <span className="text-lg font-semibold tabular-nums text-muted-foreground">
                  RRP ${rrp.toFixed(2)}
                </span>
              ) : null}
            </div>

            <p className="mt-5 text-base leading-relaxed text-muted-foreground">
              {product.intro}
            </p>

            {/* Enquiry-driven, not checkout-driven: every binder sends the
                visitor to sign up, where the enquiry is taken. `state` carries
                which product was being viewed so the signup page can attribute
                the enquiry without putting it in the URL. */}
            <div className="mt-6">
              <Button size="lg" className="w-full sm:w-auto" asChild>
                <Link to="/signup" state={{ enquiry: { sku: product.sku, title: product.title } }}>
                  <MessageSquare className="w-5 h-5 mr-2" />
                  Enquire now
                </Link>
              </Button>
              <p className="mt-2 text-sm text-muted-foreground">
                Create a free CardPop account and we&apos;ll come back to you on price,
                colours and availability.
              </p>
            </div>

            {/* Colour range. Each colour becomes its own product (and its own
                page) in a later pass — until then this is informational. */}
            {product.colours.length > 1 && (
              <div className="mt-8">
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  Also available in
                </h2>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {product.colours.map((colour) => (
                    <li
                      key={colour.name}
                      className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm"
                    >
                      <span
                        className="h-3.5 w-3.5 rounded-full ring-1 ring-black/10"
                        style={{ backgroundColor: colour.hex }}
                        aria-hidden="true"
                      />
                      {colour.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* ── Highlights ────────────────────────────────────────────── */}
            <div className="mt-8">
              <h2 className="text-lg font-bold text-foreground">Why collectors pick this binder</h2>
              <ul className="mt-3 space-y-2">
                {product.highlights.map((point) => (
                  <li key={point} className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" aria-hidden="true" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* ── Specifications ──────────────────────────────────────────────── */}
        <section className="mt-14 max-w-3xl">
          <h2 className="text-2xl font-bold text-foreground">Specifications</h2>
          <dl className="mt-4 divide-y divide-border rounded-2xl border border-border overflow-hidden">
            {specs.map((spec) => (
              <div key={spec.label} className="grid grid-cols-3 gap-4 px-4 py-3 text-sm even:bg-muted/30">
                <dt className="font-semibold text-foreground">{spec.label}</dt>
                <dd className="col-span-2 text-muted-foreground">{spec.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ── FAQ ─────────────────────────────────────────────────────────── */}
        {product.faqs?.length > 0 && (
          <section className="mt-14 max-w-3xl">
            <h2 className="text-2xl font-bold text-foreground">Common questions</h2>
            <div className="mt-4 space-y-6">
              {product.faqs.map((faq) => (
                <div key={faq.q}>
                  <h3 className="font-semibold text-foreground">{faq.q}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{faq.a}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Related ─────────────────────────────────────────────────────── */}
        <section className="mt-14">
          <h2 className="text-2xl font-bold text-foreground">Other Palms Off Gaming binders</h2>
          <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
            {related.map((other) => (
              <Link
                key={other.slug}
                to={`/shop/binders/${other.slug}`}
                className="group rounded-2xl border border-border bg-card p-4 hover:shadow-lg hover:-translate-y-0.5 transition-all"
              >
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  {other.range}
                </p>
                <p className="mt-1 font-bold leading-snug text-foreground group-hover:text-primary transition-colors">
                  {other.shortTitle}
                </p>
                <span className="mt-2 inline-flex items-center text-sm text-primary">
                  View <ChevronRight className="h-4 w-4" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default ShopBinderProductPage;
