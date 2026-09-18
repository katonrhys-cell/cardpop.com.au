import React from 'react';
import { Link } from 'react-router-dom';
import SEOHead from '@/components/SEOHead.jsx';
import InfoPageLayout from '@/components/InfoPageLayout.jsx';
import CardPopBrand from '@/components/CardPopBrand.jsx';
import {
  ShieldHalf,
  ShieldCheck,
  BadgeCheck,
  Lock,
  RefreshCw,
  PackageCheck,
  Users,
} from 'lucide-react';

// Public trust hub, promoted from checkout, the ID-verification step and the
// footer. It explains the three pillars buyers and sellers actually worry
// about — how payments are secured, how purchases are protected, and how we
// verify who's on the other end of a trade. Copy is deliberately accurate to
// the integrations we run: Stripe for order checkout (PCI-DSS hosted payment,
// with PayPal and wallets offered as methods), Stripe for membership
// billing, and Stripe Identity for the ID check at registration.

// Stripe brand mark — white parallelogram, shown on Stripe's blurple tile
// (per Stripe's brand assets). Drawn inline so no external asset is fetched.
const StripeGlyph = ({ className }) => (
  <svg viewBox="0 0 48 48" aria-hidden="true" className={className}>
    <polygon points="13,18.2 35,13.4 35,31.4 13,36.2" fill="#fff" />
  </svg>
);

const PILLARS = [
  {
    icon: StripeGlyph,
    // Full-bleed glyph on Stripe's blurple, proportioned like Stripe's app icon.
    iconClassName: 'h-12 w-12',
    tileClassName: 'bg-[#635BFF]',
    title: 'Payments secured by Stripe',
    body: 'Every order is processed on Stripe’s PCI-DSS Level 1 checkout. Your card details are encrypted by Stripe and never touch CardPop’s servers.',
  },
  {
    icon: ShieldCheck,
    title: '14-day Buyer Protection',
    body: 'If your item doesn’t arrive or isn’t as described, request a full refund through our resolution process — every eligible order is covered.',
  },
  {
    icon: BadgeCheck,
    title: 'ID Verification',
    body: 'Sellers must be verified to sell and trade — every seller confirms their identity with a government ID and selfie through Stripe Identity, so you only ever deal with a verified human.',
  },
];

const Pillar = ({ icon: Icon, title, body, tileClassName = 'bg-primary/10 text-primary', iconClassName = 'h-6 w-6' }) => (
  <div className="rounded-2xl border border-border bg-card p-6 text-center">
    <span className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl ${tileClassName}`}>
      <Icon className={iconClassName} />
    </span>
    <h3 className="mb-2 text-base font-bold text-foreground">{title}</h3>
    <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
  </div>
);

// Section heading with a leading icon. items-start + a small top margin keeps
// the icon centred on the FIRST line, so it doesn't float awkwardly in the
// middle when the title wraps to two lines on mobile.
const SectionHeading = ({ icon: Icon, children }) => (
  <h2 className="flex items-start gap-2">
    <Icon className="mt-1.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
    <span>{children}</span>
  </h2>
);

// FAQ pairs drive both the on-page accordion feel and the FAQPage structured
// data below, which lets these questions surface directly in Google results.
const FAQ = [
  {
    q: 'Is my card information safe on CardPop?',
    a: 'Yes. Payments are processed by Stripe, a PCI-DSS Level 1 certified provider. Card details are entered inside Stripe’s encrypted checkout and are never stored on or transmitted through CardPop’s servers.',
  },
  {
    q: 'What payment methods can I use?',
    a: 'At checkout you can pay with Visa, Mastercard, American Express, PayPal, Apple Pay or Google Pay.',
  },
  {
    q: 'What happens if my order never arrives or is not as described?',
    a: 'You’re covered by our 14-day Buyer Protection Guarantee. Open a case through our resolution process and, if the item didn’t arrive or was significantly not as described, you’ll receive a full refund.',
  },
  {
    q: 'Why do I have to verify my ID when I register?',
    a: 'Identity verification is handled by Stripe Identity — you photograph a government ID and take a matching selfie. It keeps fraudsters and duplicate accounts off the platform, so every member trades with a verified person. Stripe performs the check; CardPop never stores your document images.',
  },
  {
    q: 'How are sellers protected?',
    a: 'As long as you ship to the buyer’s verified address with tracking and signature confirmation, you’re protected against fraudulent chargebacks and false “item not received” claims.',
  },
];

const TrustSafetyPage = () => {
  const faqStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };

  return (
    <InfoPageLayout
      icon={ShieldHalf}
      eyebrow={
        // Single span: the Badge is a flex container, which would otherwise
        // drop the whitespace-only text node between wordmark and "Australia".
        <span><CardPopBrand /> Australia</span>
      }
      title="Trust & Safety"
      description="Secure payments, verified members and buyer protection on every order — here’s exactly how we keep your money and your trades safe."
    >
      <SEOHead
        title="Trust & Safety — Secure Payments & Buyer Protection | CardPop™"
        description="How CardPop protects you: PCI-DSS payments via Stripe, a 14-day Buyer Protection Guarantee, seller chargeback protection, and Stripe Identity ID verification at registration."
        structuredData={faqStructuredData}
      />

      {/* Three-pillar summary — escapes prose styling for the card grid. */}
      <div className="not-prose mb-12 grid gap-4 sm:grid-cols-3">
        {PILLARS.map((p) => (
          <Pillar key={p.title} {...p} />
        ))}
      </div>

      <SectionHeading icon={Lock}>Secure Payments</SectionHeading>
      <p>Every purchase on <CardPopBrand /> is processed by <strong>Stripe</strong>, a globally certified <strong>PCI-DSS Level 1</strong> payment provider. Card details are entered inside Stripe’s encrypted, hosted checkout — they never touch or pass through CardPop’s servers. At checkout you can pay with <strong>Visa, Mastercard, American Express, PayPal, Apple Pay or Google Pay</strong>. All traffic is protected by 256-bit SSL end to end.</p>

      <SectionHeading icon={ShieldCheck}>Buyer Protection</SectionHeading>
      <p>Every order is backed by our <strong>14-day Buyer Protection Guarantee</strong>. If an item doesn’t arrive within the expected timeframe, or is significantly not as described, you can request a full refund through our resolution process. Your payment is only ever released to the seller once the transaction completes cleanly, so you’re never left out of pocket for an order that goes wrong.</p>

      <SectionHeading icon={PackageCheck}>Seller Protection</SectionHeading>
      <p>Sellers are protected against fraudulent chargebacks and false claims. As long as you ship to the buyer’s <strong>verified address with tracking and signature confirmation</strong>, you’re covered — a would-be scammer can’t claim “item not received” against a signed, tracked delivery.</p>

      <SectionHeading icon={BadgeCheck}>Verified Identity at Registration</SectionHeading>
      <p>What sets <CardPopBrand /> apart from open marketplaces is that <strong>real people stand behind every account</strong>. During registration, members verify their identity through <strong>Stripe Identity</strong>: you photograph a government-issued ID (passport or driver licence) and take a matching selfie. Stripe performs the check and confirms the match — <strong>CardPop never stores your document images</strong>. Verified accounts earn the <strong>Verified badge</strong> that buyers and sellers look for, and selling requires a verified identity. The result is a community where fraudsters and throwaway accounts have nowhere to hide.</p>

      <SectionHeading icon={RefreshCw}>Authentication Services</SectionHeading>
      <p>For high-value items and trades, we offer <strong>middleman authentication</strong>. Items are shipped to our facility where experts verify authenticity and condition before forwarding to the buyer — so both sides can transact with total confidence.</p>

      <SectionHeading icon={Users}>Community Guidelines</SectionHeading>
      <p>We maintain a <strong>zero-tolerance policy</strong> for fraud, harassment, and market manipulation. Users found violating these guidelines are permanently banned from the platform.</p>

      <h2>Frequently Asked Questions</h2>
      {FAQ.map(({ q, a }) => (
        <details key={q} className="group my-3 rounded-xl border border-border bg-card px-5 py-3 [&_summary]:cursor-pointer">
          <summary className="list-none font-semibold text-foreground marker:content-none">{q}</summary>
          <p className="mt-2 mb-0 text-muted-foreground">{a}</p>
        </details>
      ))}

      <p className="mt-10 text-sm text-muted-foreground">
        New here? See <Link to="/safe-buying" className="font-semibold text-primary hover:underline">how to buy safely on CardPop</Link>, then <Link to="/signup" className="font-semibold text-primary hover:underline">create your verified account</Link> or <Link to="/marketplace" className="font-semibold text-primary hover:underline">browse the marketplace</Link>.
      </p>
    </InfoPageLayout>
  );
};

export default TrustSafetyPage;
