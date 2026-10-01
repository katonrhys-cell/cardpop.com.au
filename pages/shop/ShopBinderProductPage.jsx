import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MessageSquare, ShoppingCart, PackageX, Check, ChevronRight, Clock } from 'lucide-react';
import SEOHead from '@/components/SEOHead.jsx';
import Breadcrumb from '@/components/Breadcrumb.jsx';
import ProductImageCarousel from '@/components/ProductImageCarousel.jsx';
import ShopListedProductPage from '@/pages/shop/ShopListedProductPage.jsx';
import { Button } from '@/components/ui/button';
import ShopEnquiryDialog from '@/components/ShopEnquiryDialog.jsx';
import VariantPicker from '@/components/shop/VariantPicker.jsx';
import { activeVariants, pickDefaultVariant, toCartVariant, variantInStock, variantPrice } from '@/utils/shopVariants.js';
import { colourListText, familyAsVariants, productImages, sortColourNames } from '@/utils/shopFamily.js';
import ColourSwatch from '@/components/shop/ColourSwatch.jsx';
import useShopLine from '@/hooks/useShopLine.js';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useCart } from '@/hooks/useCart.jsx';
import { toast } from 'sonner';
import {
  resolveBinderProduct, binderImages, binderImageAlt, binderSpecs, BINDER_PRODUCTS,
} from '@/data/shopBinderProducts.js';

const SITE_ORIGIN = 'https://cardpop.com.au';

const ShopBinderProductPage = () => {
  const { productSlug } = useParams();
  const { addToCart, setIsCartOpen } = useCart();
  const product = resolveBinderProduct(productSlug);

  // The DB row carries the commercial fields only (price, stock, status). All
  // copy, specs and imagery come from data/shopBinderProducts.js so the page
  // renders identically for the SPA, the prerenderer and the sitemap.
  // Colour families (one product per colour) come back as `family`, with
  // `row` = the chosen colour; otherwise `row` is the single product row.
  const { row, family, selectedId, setSelectedId, loading } = useShopLine({
    slug: product?.slug, sku: product?.sku, enabled: !!product,
  });
  const [enquiryOpen, setEnquiryOpen] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState(null);
  useEffect(() => { setSelectedVariantId(pickDefaultVariant(row)?.id ?? null); }, [row]);

  // Not a catalogue binder (e.g. a CardPop house binder): same URL shape,
  // generic product page.
  if (!product) return <ShopListedProductPage categorySlug="binders" productSlug={productSlug} />;

  const canonical = `${SITE_ORIGIN}/shop/binders/${product.slug}`;
  // A chosen colour shows its own photos; the catalogue's are the fallback.
  const images = family.length > 0 && productImages(row).length > 0 ? productImages(row) : binderImages(product);
  const lineTitle = (family.length > 0 && row?.title) || product.title;
  // The colours actually stocked (the picker's own list) once the family has
  // loaded; the catalogue list until then.
  const rangeColours = sortColourNames(family.length > 1 ? family.map((f) => f.colour) : product.colours.map((c) => c.name));
  const specs = binderSpecs(product);
  const price = row?.price_aud != null && Number(row.price_aud) > 0 ? Number(row.price_aud) : null;
  const rrp = row?.retail_price_aud != null && Number(row.retail_price_aud) > 0
    ? Number(row.retail_price_aud)
    : null;
  // With colour variants the buyable unit is the chosen variant.
  const variants = activeVariants(row);
  const chosenVariant = variants.find((v) => v.id === selectedVariantId) || null;
  const inStock = variants.length > 0 ? !!chosenVariant && variantInStock(chosenVariant) : (row?.stock_quantity ?? 0) > 0;
  const anyVariantInStock = variants.length > 0 ? variants.some(variantInStock) : inStock;
  // The CTA flips itself. While a product has no price (or is still `draft`) it
  // is enquiry-only: the button sends people to sign up, and the page is
  // complete — and indexable — without a price. The moment a price is set and
  // the row is switched to `active` in /admin/products, the same page starts
  // rendering Add to cart and emitting an Offer. No code change, no redeploy:
  // stock arriving is an admin edit, not a release.
  const isPurchasable = row?.status === 'active' && price != null;
  // Admin-flagged pre-launch: shown, not buyable; the CTA opens the enquiry form.
  const isComingSoon = row?.status === 'coming_soon';

  const related = BINDER_PRODUCTS.filter((p) => p.slug !== product.slug).slice(0, 4);

  const handleAddToCart = () => {
    if (!row || !isPurchasable) return;
    if (variants.length > 0 && !chosenVariant) { toast.error('Please choose a colour first.'); return; }
    if (!inStock) return;
    const unitPrice = chosenVariant ? variantPrice({ price_aud: price }, chosenVariant) : price;
    const cartVariant = chosenVariant
      ? toCartVariant({ id: row.id, price_aud: unitPrice, stock_quantity: row.stock_quantity }, chosenVariant)
      : {
          id: row.id,
          price_in_cents: Math.round(price * 100),
          manage_inventory: row.stock_quantity !== null,
          inventory_quantity: row.stock_quantity,
        };
    addToCart(
      {
        id: row.id, source: 'shop', type: 'shop',
        title: lineTitle, price: unitPrice, image: images[0] || null,
      },
      cartVariant,
      1,
      cartVariant.inventory_quantity ?? 999,
    ).then(() => {
      toast.success('Added to cart', {
        action: { label: 'View cart', onClick: () => setIsCartOpen(true) },
      });
    });
  };

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
            <ProductImageCarousel key={row?.id || 'line'} images={images} />
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
                  <Badge variant={anyVariantInStock ? 'default' : 'destructive'}>
                    {anyVariantInStock ? (variants.length > 0 && chosenVariant && !inStock ? `${chosenVariant.colour || 'This colour'} sold out` : 'In stock') : 'Sold out'}
                  </Badge>
                </>
              ) : isComingSoon ? (
                <>
                  {rrp != null && (
                    <span className="text-lg font-semibold tabular-nums text-muted-foreground">
                      RRP ${rrp.toFixed(2)}
                    </span>
                  )}
                  <Badge className="bg-brand-charcoal text-white hover:bg-brand-charcoal">Coming soon</Badge>
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

            {/* Enquiry until priced, checkout after. `state` carries which
                product was being viewed so the signup page can attribute the
                enquiry without putting it in the URL. */}
            {family.length > 1 && (
              <VariantPicker
                product={{ variants: familyAsVariants(family) }}
                value={selectedId}
                onChange={(v) => setSelectedId(v.id)}
                showAvailability={!isComingSoon}
                className="mt-6"
              />
            )}

            {isPurchasable && variants.length > 0 && (
              <VariantPicker
                product={row}
                value={selectedVariantId}
                onChange={(v) => setSelectedVariantId(v.id)}
                className="mt-6"
              />
            )}

            <div className="mt-6">
              {isComingSoon ? (
                <>
                  <Button size="lg" className="w-full sm:w-auto" onClick={() => setEnquiryOpen(true)}>
                    <Clock className="w-5 h-5 mr-2" />Coming soon — register interest
                  </Button>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Not available to order yet. Enquire and we&apos;ll let you know the moment it is.
                  </p>
                  <ShopEnquiryDialog
                    open={enquiryOpen}
                    onOpenChange={setEnquiryOpen}
                    reason="coming_soon"
                    product={{ id: row.id, title: lineTitle }}
                  />
                </>
              ) : isPurchasable && anyVariantInStock ? (
                <Button size="lg" className="w-full sm:w-auto" onClick={handleAddToCart} disabled={variants.length > 0 && !inStock}>
                  <ShoppingCart className="w-5 h-5 mr-2" />{variants.length > 0 && chosenVariant && !inStock ? `${chosenVariant.colour || 'Colour'} sold out` : 'Add to cart'}
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
                    product={{ id: row.id, title: lineTitle }}
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

            {rangeColours.length > 1 && variants.length === 0 && (family.length > 1 ? (
              // The picker above already shows every colour as a chip, so the
              // range is written out once as prose instead of a second chip
              // row — still crawlable, no visual duplicate.
              <div className="mt-8">
                <h2 className="text-lg font-bold text-foreground">Colour range</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  The {product.title} comes in {rangeColours.length} colours: {colourListText(rangeColours)}.
                  Pick a colour above to see its own photos and availability — handy for
                  colour-coding decks, games or collections at a glance.
                </p>
              </div>
            ) : (
              <div className="mt-8">
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  Available in {rangeColours.length} colours
                </h2>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {rangeColours.map((colour) => (
                    <li
                      key={colour}
                      className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm"
                    >
                      <ColourSwatch name={colour} />
                      {colour}
                    </li>
                  ))}
                </ul>
              </div>
            ))}

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

        {product.details?.length > 0 && (
          <section className="mt-14 max-w-3xl">
            <h2 className="text-2xl font-bold text-foreground">About the {product.shortTitle}</h2>
            <div className="mt-4 space-y-4">
              {product.details.map((paragraph) => (
                <p key={paragraph.slice(0, 40)} className="text-base leading-relaxed text-muted-foreground">{paragraph}</p>
              ))}
            </div>
          </section>
        )}

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
