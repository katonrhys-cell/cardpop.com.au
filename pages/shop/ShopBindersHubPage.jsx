import React from 'react';
import { Link } from 'react-router-dom';
import { BookMarked, ChevronRight } from 'lucide-react';
import SEOHead from '@/components/SEOHead.jsx';
import Breadcrumb from '@/components/Breadcrumb.jsx';
import CardImage from '@/components/CardImage.jsx';
import { BINDER_PRODUCTS, binderImages, binderImageAlt } from '@/data/shopBinderProducts.js';

const SITE_ORIGIN = 'https://cardpop.com.au';
const CANONICAL = `${SITE_ORIGIN}/shop/binders`;

const TITLE = 'Palms Off Gaming Binders | Zip & Top Loader Binders | CardPop Australia';
const DESCRIPTION =
  'Shop the full Palms Off Gaming binder range in Australia — Collector\'s Series and Stealth zip binders in 4, 9 and 12 pocket layouts, top loader binders and the ring binder. Archival-safe, side-loading pockets.';

/**
 * /shop/binders — the parent of every /shop/binders/:slug product page.
 *
 * This exists as a real page rather than a redirect because it is the
 * breadcrumb parent of eight product URLs: a 404 or a bounce there would waste
 * the internal links every product page points at it.
 */
const ShopBindersHubPage = () => {
  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Palms Off Gaming binders',
    numberOfItems: BINDER_PRODUCTS.length,
    itemListElement: BINDER_PRODUCTS.map((product, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Product',
        name: product.title,
        sku: product.sku,
        brand: { '@type': 'Brand', name: 'Palms Off Gaming' },
        image: binderImages(product)[0],
        url: `${SITE_ORIGIN}/shop/binders/${product.slug}`,
      },
    })),
  };

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_ORIGIN },
      { '@type': 'ListItem', position: 2, name: 'Shop', item: `${SITE_ORIGIN}/shop` },
      { '@type': 'ListItem', position: 3, name: 'Binders', item: CANONICAL },
    ],
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={TITLE}
        description={DESCRIPTION}
        canonicalUrl={CANONICAL}
        ogImage={binderImages(BINDER_PRODUCTS[0])[0]}
        structuredData={[itemListLd, breadcrumbLd]}
      />

      <div className="container mx-auto px-4 py-6 md:py-10">
        <Breadcrumb items={[
          { label: 'Home', path: '/' },
          { label: 'Shop', path: '/shop' },
          { label: 'Binders' },
        ]} />

        <header className="max-w-3xl">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-white">
              <BookMarked className="h-5 w-5" />
            </span>
            <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Palms Off Gaming
            </p>
          </div>
          <h1 className="mt-4 text-3xl md:text-4xl font-extrabold leading-tight text-foreground">
            Palms Off Gaming Binders
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Palms Off Gaming build binders around one idea: a card should not be able to fall
            out. Every zip binder in the range uses side-loading pockets that open toward the
            spine rather than the top, a metal zip that runs the full perimeter, and archival
            pockets that are acid-free and PVC-free so nothing leaches into a card face over the
            years it sits there.
          </p>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            The range splits three ways. The <strong>Collector&apos;s Series</strong> zip binders
            come in 4, 9 and 12 pocket layouts for raw cards. The <strong>top loader</strong>{' '}
            binders take cards that are already in 35pt loaders, so nothing is handled twice. The{' '}
            <strong>Stealth</strong> binders are the same construction in a quieter finish. If you
            need pages you can re-order, the ring binder takes interchangeable pages including
            PSA 4-slot graded pages.
          </p>
        </header>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {BINDER_PRODUCTS.map((product) => {
            const [hero] = binderImages(product);
            return (
              <Link
                key={product.slug}
                to={`/shop/binders/${product.slug}`}
                className="group flex flex-col rounded-2xl border border-border bg-card overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
              >
                <div className="aspect-[4/3] bg-white dark:bg-zinc-950 overflow-hidden">
                  <CardImage
                    src={hero}
                    alt={binderImageAlt(product, product.imageFiles[0])}
                    imgClassName="h-full w-full object-contain p-4 group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="flex flex-1 flex-col gap-1.5 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {product.range}
                    {product.pocketsPerPage ? ` · ${product.pocketsPerPage} pocket` : ''}
                  </p>
                  <p className="font-bold leading-snug text-foreground group-hover:text-primary transition-colors">
                    {product.shortTitle}
                  </p>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    Holds {product.holds}. {product.colours.length}{' '}
                    {product.colours.length === 1 ? 'colour' : 'colours'}.
                  </p>
                  <span className="mt-auto inline-flex items-center pt-2 text-sm font-semibold text-primary">
                    View details <ChevronRight className="h-4 w-4" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        <section className="mt-14 max-w-3xl">
          <h2 className="text-2xl font-bold text-foreground">Choosing a binder</h2>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            Pocket count is the first decision. <strong>Four pockets</strong> to a page suits
            oversized art, full-art trainers and anything you want to display with room around it.{' '}
            <strong>Nine pockets</strong> is the layout most collections are already sorted in and
            the one that makes gaps in a set obvious at a glance. <strong>Twelve pockets</strong>{' '}
            holds a third more per page, which matters for bulk, trade stock and set consolidation.
          </p>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            The second decision is whether your cards are already in top loaders. If they are —
            trade stock, a grading queue, high-value singles — a top loader binder files them
            without taking them out, which removes an entire round of handling. If they are raw or
            sleeved, a standard zip binder is the right choice.
          </p>
        </section>
      </div>
    </div>
  );
};

export default ShopBindersHubPage;
