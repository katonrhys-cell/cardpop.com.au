import React from 'react';
import { Link } from 'react-router-dom';
import SEOHead from '@/components/SEOHead.jsx';
import InfoPageLayout from '@/components/InfoPageLayout.jsx';
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
// with PayPal/Afterpay/wallets offered as methods), PayPal for membership
// billing, and Stripe Identity for the ID check at registration.

const PILLARS = [
  {
    icon: Lock,
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
    title: 'ID-verified members',
    body: 'Sellers confirm their identity with a government ID and selfie through Stripe Identity, so you only ever trade with a verified human.',
  },
];

const Pillar = ({ icon: Icon, title, body }) => (
  <div className="rounded-2xl border border-border bg-card p-6 text-center">
    <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
      <Icon className="h-6 w-6" />
    </span>
    <h3 className="mb-2 text-base font-bold text-foreground">{title}</h3>
    <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
  </div>
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
    a: 'At checkout you can pay with Visa, Mastercard, American Express, PayPal, Afterpay, Apple Pay, Google Pay or Stripe Link. CardPop memberships can also be billed securely through PayPal.',
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
      eyebrow="CardPop™ Australia"
      title="Trust & Safety"
      description="Secure payments, verified members and buyer protection on every order — here’s exactly how we keep your money and your trades safe."
    >
      <SEOHead
        title="Trust & Safety — Secure Payments & Buyer Protection | CardPop™"
        description="How CardPop protects you: PCI-DSS payments via Stripe, PayPal, a 14-day Buyer Protection Guarantee, seller chargeback protection, and Stripe Identity ID verification at registration."
        structuredData={faqStructuredData}
      />

      {/* Three-pillar summary — escapes prose styling for the card grid. */}
      <div className="not-prose mb-12 grid gap-4 sm:grid-cols-3">
        {PILLARS.map((p) => (
          <Pillar key={p.title} {...p} />
        ))}
      </div>

      <h2 className="flex items-center gap-2"><Lock className="h-5 w-5 text-primary" /> Secure Payments</h2>
      <p>Every purchase on CardPop™ is processed by <strong>Stripe</strong>, a globally certified <strong>PCI-DSS Level 1</strong> payment provider. Card details are entered inside Stripe’s encrypted, hosted checkout — they never touch or pass through CardPop’s servers. At checkout you can pay with <strong>Visa, Mastercard, American Express, PayPal, Afterpay, Apple Pay, Google Pay or Stripe Link</strong>, and CardPop memberships can also be billed securely through PayPal. All traffic is protected by 256-bit SSL end to end.</p>

      <h2 className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /> Buyer Protection</h2>
      <p>Every order is backed by our <strong>14-day Buyer Protection Guarantee</strong>. If an item doesn’t arrive within the expected timeframe, or is significantly not as described, you can request a full refund through our resolution process. Your payment is only ever released to the seller once the transaction completes cleanly, so you’re never left out of pocket for an order that goes wrong.</p>

      <h2 className="flex items-center gap-2"><PackageCheck className="h-5 w-5 text-primary" /> Seller Protection</h2>
      <p>Sellers are protected against fraudulent chargebacks and false claims. As long as you ship to the buyer’s <strong>verified address with tracking and signature confirmation</strong>, you’re covered — a would-be scammer can’t claim “item not received” against a signed, tracked delivery.</p>

      <h2 className="flex items-center gap-2"><BadgeCheck className="h-5 w-5 text-primary" /> Verified Identity at Registration</h2>
      <p>What sets CardPop™ apart from open marketplaces is that <strong>real people stand behind every account</strong>. During registration, members verify their identity through <strong>Stripe Identity</strong>: you photograph a government-issued ID (passport or driver licence) and take a matching selfie. Stripe performs the check and confirms the match — <strong>CardPop never stores your document images</strong>. Verified accounts earn the <strong>Verified badge</strong> that buyers and sellers look for, and selling requires a verified identity. The result is a community where fraudsters and throwaway accounts have nowhere to hide.</p>

      <h2 className="flex items-center gap-2"><RefreshCw className="h-5 w-5 text-primary" /> Authentication Services</h2>
      <p>For high-value items and trades, we offer <strong>middleman authentication</strong>. Items are shipped to our facility where experts verify authenticity and condition before forwarding to the buyer — so both sides can transact with total confidence.</p>

      <h2 className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> Community Guidelines</h2>
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
