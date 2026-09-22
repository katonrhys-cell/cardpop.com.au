import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MessageSquare, ShoppingCart, PackageX, Check, ChevronRight } from 'lucide-react';
import SEOHead from '@/components/SEOHead.jsx';
import Breadcrumb from '@/components/Breadcrumb.jsx';
import ProductImageCarousel from '@/components/ProductImageCarousel.jsx';
import NotFoundPage from '@/pages/NotFoundPage.jsx';
import { Button } from '@/components/ui/button';
import ShopEnquiryDialog from '@/components/ShopEnquiryDialog.jsx';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabaseClient.js';
import { useCart } from '@/hooks/useCart.jsx';
import { toast } from 'sonner';
import {
  resolvePalmsOffProduct, palmsOffImages, palmsOffImageAlt, palmsOffSpecs,
  palmsOffProductsInCategory,
} from '@/data/palmsOffCatalogue.js';
import { resolvePalmsOffCategory } from '@/data/palmsOffCategories.js';

const SITE_ORIGIN = 'https://cardpop.com.au';

/**
 * /shop/:categorySlug/:productSlug
 *
 * One page per product line, sitting inside the shop's normal product-type
 * taxonomy rather than a brand section — /shop/top-loaders/<product> alongside
 * every other top loader. The page's words come from the catalogue (title,
 * SKUs, colours) plus the product type's copy; see the note in
 * data/palmsOffCategories.js on why the type is the unit of writing. Only
 * price, stock and status are read from the DB.
 */
const ShopProductPage = () => {
  const { categorySlug, productSlug } = useParams();
  const { addToCart, setIsCartOpen } = useCart();
  const product = resolvePalmsOffProduct(productSlug);
  const category = resolvePalmsOffCategory(categorySlug);

  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [enquiryOpen, setEnquiryOpen] = useState(false);

  const validPair = Boolean(product && category && product.categorySlug === category.slug);

  useEffect(() => {
    if (!validPair) { setLoading(false); return undefined; }
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
  }, [validPair, product]);

  // A real product reached through the wrong category is a 404, not a redirect:
  // two URLs resolving to one page is the duplicate-content problem this whole
  // structure exists to avoid.
  if (!validPair) return <NotFoundPage />;

  const canonical = `${SITE_ORIGIN}/shop/${category.slug}/${product.slug}`;
  const images = palmsOffImages(product);
  const specs = palmsOffSpecs(product);
  const price = row?.price_aud != null && Number(row.price_aud) > 0 ? Number(row.price_aud) : null;
  const rrp = row?.retail_price_aud != null && Number(row.retail_price_aud) > 0
    ? Number(row.retail_price_aud)
    : null;
  const inStock = (row?.stock_quantity ?? 0) > 0;
  // Same self-flipping CTA as the binder pages: enquiry-only until priced and
  // active, then Add to cart with an Offer. Stock arriving is an admin edit.
  const isPurchasable = row?.status === 'active' && price != null;

  const siblings = palmsOffProductsInCategory(category.slug)
    .filter((p) => p.slug !== product.slug)
    .slice(0, 4);

  const handleAddToCart = () => {
    if (!row || !isPurchasable || !inStock) return;
    addToCart(
      {
        id: row.id, source: 'shop', type: 'shop',
        title: product.title, price, image: images[0] || null,
      },
      {
        id: row.id,
        price_in_cents: Math.round(price * 100),
        manage_inventory: row.stock_quantity !== null,
        inventory_quantity: row.stock_quantity,
      },
      1,
      row.stock_quantity ?? 999,
    ).then(() => {
      toast.success('Added to cart', {
        action: { label: 'View cart', onClick: () => setIsCartOpen(true) },
      });
    });
  };

  // Product copy wins where it exists; the product type's shared copy is the
  // fallback. FAQs stay type-level — "what does pt mean" has one answer for
  // every top loader on the site.
  const description = product.metaDescription
    || `${product.title}. ${category.blurb} Enquire now through CardPop Australia.`;
  const intro = product.intro || category.intro;
  const highlights = product.highlights || [];

  const productLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description,
    image: images,
    sku: product.sku,
    brand: { '@type': 'Brand', name: 'Palms Off Gaming' },
    category: category.name,
    url: canonical,
    ...(isPurchasable ? {
      offers: {
        '@type': 'Offer',
        url: canonical,
        priceCurrency: 'AUD',
        price: price.toFixed(2),
        availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
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
      { '@type': 'ListItem', position: 3, name: category.name, item: `${SITE_ORIGIN}/shop/category/${category.slug}` },
      { '@type': 'ListItem', position: 4, name: product.shortTitle, item: canonical },
    ],
  };

  const faqLd = category.faqs?.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: category.faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  } : null;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={`${product.title} | CardPop Australia`}
        description={description}
        canonicalUrl={canonical}
        ogImage={images[0]}
        ogImageAlt={palmsOffImageAlt(product, product.imagePaths[0])}
        structuredData={[productLd, breadcrumbLd, faqLd].filter(Boolean)}
      />

      <div className="container mx-auto px-4 py-6 md:py-10">
        <Breadcrumb items={[
          { label: 'Home', path: '/' },
          { label: 'Shop', path: '/shop' },
          { label: category.name, path: `/shop/category/${category.slug}` },
          { label: product.shortTitle },
        ]} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          <div><ProductImageCarousel images={images} /></div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Palms Off Gaming · {category.name}
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
                  <Badge variant={inStock ? 'default' : 'destructive'}>
                    {inStock ? 'In stock' : 'Sold out'}
                  </Badge>
                </>
              ) : rrp != null ? (
                <span className="text-lg font-semibold tabular-nums text-muted-foreground">
                  RRP ${rrp.toFixed(2)}
                </span>
              ) : null}
            </div>

            <p className="mt-5 text-base leading-relaxed text-muted-foreground">
              {intro}
            </p>

            <div className="mt-6">
              {isPurchasable && inStock ? (
                <Button size="lg" className="w-full sm:w-auto" onClick={handleAddToCart}>
                  <ShoppingCart className="w-5 h-5 mr-2" />Add to cart
                </Button>
              ) : isPurchasable ? (
                // Sold out: 0 stock on an otherwise live product. Offer an
                // enquiry that emails admin instead of a dead button.
                <>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button size="lg" variant="secondary" className="w-full sm:w-auto" disabled>
                      <PackageX className="w-5 h-5 mr-2" />Sold out
                    </Button>
                    <Button size="lg" variant="outline" className="w-full sm:w-auto" onClick={() => setEnquiryOpen(true)}>
                      <MessageSquare className="w-5 h-5 mr-2" />Enquire
                    </Button>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Sold out for now — enquire and we&apos;ll let you know when it&apos;s back.
                  </p>
                  <ShopEnquiryDialog
                    open={enquiryOpen}
                    onOpenChange={setEnquiryOpen}
                    product={{ id: row.id, title: product.title }}
                  />
                </>
              ) : (
                <>
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
                </>
              )}
            </div>

            {product.colours.length > 1 && (
              <div className="mt-8">
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  Available in {product.colours.length} colours
                </h2>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {product.colours.map((colour) => (
                    <li key={colour} className="rounded-full border border-border bg-card px-3 py-1.5 text-sm">
                      {colour}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {highlights.length > 0 && (
              <div className="mt-8">
                <h2 className="text-lg font-bold text-foreground">Why collectors pick this one</h2>
                <ul className="mt-3 space-y-2">
                  {highlights.map((point) => (
                    <li key={point} className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground">
                      <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" aria-hidden="true" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {category.choosing && (
              <div className="mt-8">
                <h2 className="text-lg font-bold text-foreground">Choosing the right one</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{category.choosing}</p>
              </div>
            )}
          </div>
        </div>

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

        {category.faqs?.length > 0 && (
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

        {siblings.length > 0 && (
          <section className="mt-14">
            <h2 className="text-2xl font-bold text-foreground">More {category.name.toLowerCase()}</h2>
            <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
              {siblings.map((other) => (
                <Link
                  key={other.slug}
                  to={`/shop/${category.slug}/${other.slug}`}
                  className="group rounded-2xl border border-border bg-card p-4 hover:shadow-lg hover:-translate-y-0.5 transition-all"
                >
                  <p className="font-bold leading-snug text-foreground group-hover:text-primary transition-colors">
                    {other.shortTitle}
                  </p>
                  <span className="mt-2 inline-flex items-center text-sm text-primary">
                    View <ChevronRight className="h-4 w-4" />
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default ShopProductPage;
