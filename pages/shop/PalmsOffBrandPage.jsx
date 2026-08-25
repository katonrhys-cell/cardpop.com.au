import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronRight, Package } from 'lucide-react';
import SEOHead from '@/components/SEOHead.jsx';
import Breadcrumb from '@/components/Breadcrumb.jsx';
import CardImage from '@/components/CardImage.jsx';
import NotFoundPage from '@/pages/NotFoundPage.jsx';
import {
  PALMS_OFF_PRODUCTS, palmsOffImages, palmsOffImageAlt, palmsOffProductsInCategory,
} from '@/data/palmsOffCatalogue.js';
import {
  PALMS_OFF_CATEGORY_SLUGS, PALMS_OFF_CATEGORIES, resolvePalmsOffCategory,
} from '@/data/palmsOffCategories.js';
import { BINDER_PRODUCTS } from '@/data/shopBinderProducts.js';

const SITE_ORIGIN = 'https://cardpop.com.au';

const ProductCard = ({ product, href }) => {
  const [hero] = palmsOffImages(product);
  return (
    <Link
      to={href}
      className="group flex flex-col rounded-2xl border border-border bg-card overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
    >
      <div className="aspect-[4/3] bg-white dark:bg-zinc-950 overflow-hidden">
        <CardImage
          src={hero}
          alt={palmsOffImageAlt(product, product.imagePaths[0])}
          imgClassName="h-full w-full object-contain p-4 group-hover:scale-105 transition-transform duration-500"
        />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <p className="font-bold leading-snug text-foreground group-hover:text-primary transition-colors">
          {product.shortTitle}
        </p>
        {product.colours.length > 1 && (
          <p className="text-sm text-muted-foreground">{product.colours.length} colours</p>
        )}
        <span className="mt-auto inline-flex items-center pt-2 text-sm font-semibold text-primary">
          View details <ChevronRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
};

/**
 * Serves two routes:
 *   /shop/palms-off-gaming                 → the brand hub (all categories)
 *   /shop/palms-off-gaming/:categorySlug   → one category's products
 *
 * They share a component because the category page is the hub filtered to one
 * category; splitting them would duplicate the card grid and the JSON-LD.
 */
const PalmsOffBrandPage = () => {
  const { categorySlug } = useParams();
  const category = categorySlug ? resolvePalmsOffCategory(categorySlug) : null;

  if (categorySlug && !category) return <NotFoundPage />;

  const products = category
    ? palmsOffProductsInCategory(category.slug)
    : PALMS_OFF_PRODUCTS;

  const canonical = category
    ? `${SITE_ORIGIN}/shop/palms-off-gaming/${category.slug}`
    : `${SITE_ORIGIN}/shop/palms-off-gaming`;

  const title = category
    ? `${category.heading} | CardPop Australia`
    : 'Palms Off Gaming Australia | Binders, Sleeves & Card Protection | CardPop';
  const description = category
    ? category.blurb
    : 'Shop the full Palms Off Gaming range in Australia — zip binders, blackout deck sleeves, top loaders, mag lock cases, graded card cases, Mint Fit sleeves, deck boxes and playmats.';

  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: category ? category.heading : 'Palms Off Gaming products',
    numberOfItems: products.length,
    itemListElement: products.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Product',
        name: p.title,
        sku: p.sku,
        brand: { '@type': 'Brand', name: 'Palms Off Gaming' },
        image: palmsOffImages(p)[0],
        url: `${SITE_ORIGIN}/shop/palms-off-gaming/${p.categorySlug}/${p.slug}`,
      },
    })),
  };

  const crumbs = [
    { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_ORIGIN },
    { '@type': 'ListItem', position: 2, name: 'Shop', item: `${SITE_ORIGIN}/shop` },
    { '@type': 'ListItem', position: 3, name: 'Palms Off Gaming', item: `${SITE_ORIGIN}/shop/palms-off-gaming` },
    ...(category ? [{ '@type': 'ListItem', position: 4, name: category.name, item: canonical }] : []),
  ];

  const faqLd = category?.faqs?.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: category.faqs.map((f) => ({
      '@type': 'Question', name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  } : null;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={title}
        description={description}
        canonicalUrl={canonical}
        ogImage={palmsOffImages(products[0])[0]}
        structuredData={[
          itemListLd,
          { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs },
          faqLd,
        ].filter(Boolean)}
      />

      <div className="container mx-auto px-4 py-6 md:py-10">
        <Breadcrumb items={[
          { label: 'Home', path: '/' },
          { label: 'Shop', path: '/shop' },
          ...(category
            ? [{ label: 'Palms Off Gaming', path: '/shop/palms-off-gaming' }, { label: category.name }]
            : [{ label: 'Palms Off Gaming' }]),
        ]} />

        <header className="max-w-3xl">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-brand-red to-rose-700 text-white">
              <Package className="h-5 w-5" />
            </span>
            <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Palms Off Gaming
            </p>
          </div>
          <h1 className="mt-4 text-3xl md:text-4xl font-extrabold leading-tight text-foreground">
            {category ? category.heading : 'Palms Off Gaming'}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            {category ? category.intro : 'Palms Off Gaming make card protection that is built around one idea: every layer between a card and the world should be one you never have to think about again. Binders whose pockets load from the side so nothing falls out, sleeves cut to fit a specific holder rather than approximately, rigid loaders in every point size, and cases that close on a magnet instead of a clasp. The full range is below.'}
          </p>
          {category?.choosing && (
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">{category.choosing}</p>
          )}
        </header>

        {/* Category index — hub only. */}
        {!category && (
          <nav className="mt-8 flex flex-wrap gap-2" aria-label="Palms Off Gaming categories">
            <Link
              to="/shop/binders"
              className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold hover:border-primary hover:text-primary transition-colors"
            >
              Binders ({BINDER_PRODUCTS.length})
            </Link>
            {PALMS_OFF_CATEGORY_SLUGS.map((slug) => (
              <Link
                key={slug}
                to={`/shop/palms-off-gaming/${slug}`}
                className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold hover:border-primary hover:text-primary transition-colors"
              >
                {PALMS_OFF_CATEGORIES[slug].name} ({palmsOffProductsInCategory(slug).length})
              </Link>
            ))}
          </nav>
        )}

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {products.map((p) => (
            <ProductCard
              key={p.slug}
              product={p}
              href={`/shop/palms-off-gaming/${p.categorySlug}/${p.slug}`}
            />
          ))}
        </div>

        {category?.faqs?.length > 0 && (
          <section className="mt-14 max-w-3xl">
            <h2 className="text-2xl font-bold text-foreground">Common questions</h2>
            <div className="mt-4 space-y-6">
              {category.faqs.map((faq) => (
                <div key={faq.q}>
                  <h3 className="font-semibold text-foreground">{faq.q}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{faq.a}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {!category && (
          <section className="mt-14 max-w-3xl">
            <h2 className="text-2xl font-bold text-foreground">Binders</h2>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              The binder range has its own section, covering the Collector&apos;s Series zip
              binders in 4, 9 and 12 pocket layouts, the top loader binders, the Stealth
              range and the ring binder.
            </p>
            <Link
              to="/shop/binders"
              className="mt-4 inline-flex items-center font-semibold text-primary"
            >
              Browse all {BINDER_PRODUCTS.length} binders <ChevronRight className="h-4 w-4" />
            </Link>
          </section>
        )}
      </div>
    </div>
  );
};

export default PalmsOffBrandPage;
