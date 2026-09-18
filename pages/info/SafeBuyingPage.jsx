import React from 'react';
import { Link } from 'react-router-dom';
import SEOHead from '@/components/SEOHead.jsx';
import InfoPageLayout from '@/components/InfoPageLayout.jsx';
import { ShieldCheck } from 'lucide-react';

// SEO landing page targeting buyer-safety search intent — "safe place to buy
// Pokémon cards Australia", "is CardPop safe", "trading card marketplace buyer
// protection". Bot-prerendered via the matching STATIC_CONTENT['/safe-buying']
// entry in api/prerender.js (keep the two in sync — no cloaking), listed in the
// sitemap, and reachable from the footer. Copy is accurate to the integrations
// we run: Stripe order checkout (PCI-DSS, with PayPal/wallets as methods),
// Stripe membership billing, and Stripe Identity ID verification.

const FAQ = [
  {
    q: 'Is CardPop a safe place to buy trading cards?',
    a: 'Yes. Every order is paid through Stripe’s PCI-DSS Level 1 checkout, backed by a 14-day Buyer Protection Guarantee, and sellers are identity-verified through Stripe Identity — so you buy Pokémon, Magic and sports cards from real, verified Australian sellers with a full refund if anything goes wrong.',
  },
  {
    q: 'Where is the safest place to buy Pokémon cards in Australia?',
    a: 'CardPop is built specifically for safe trading-card transactions in Australia: secure Stripe payments in AUD, ID-verified sellers, buyer protection on every order, and optional middleman authentication for high-value cards — protections general marketplaces and social-media groups don’t offer.',
  },
  {
    q: 'What if my card never arrives or isn’t as described?',
    a: 'You’re covered by our 14-day Buyer Protection Guarantee. Open a case through our resolution process and, if the item didn’t arrive or was significantly not as described, you’ll receive a full refund.',
  },
  {
    q: 'How do I know the seller is genuine?',
    a: 'Sellers verify their identity with a government ID and a matching selfie through Stripe Identity before they can sell. Verified accounts carry a Verified badge, so you’re never trading with an anonymous or throwaway account.',
  },
  {
    q: 'Are my payment details secure?',
    a: 'Yes. Payments are processed entirely on Stripe’s encrypted, PCI-DSS-compliant checkout. Your card details are never stored on or transmitted through CardPop’s servers.',
  },
];

const SafeBuyingPage = () => {
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
      icon={ShieldCheck}
      eyebrow="CardPop Australia™"
      title="Why CardPop Is Safe: Buyer Protection & Secure Payments"
      description="Australia's safest place to buy Pokémon, Magic and sports cards — secure Stripe payments, ID-verified sellers and buyer protection on every order."
    >
      <SEOHead
        title="Safe Buying — Australia's Safest Place to Buy Trading Cards | CardPop™"
        description="Buy Pokémon, Magic and sports cards safely in Australia. CardPop protects every order with secure Stripe payments (PCI-DSS), ID-verified sellers via Stripe Identity, and a 14-day Buyer Protection Guarantee."
        structuredData={faqStructuredData}
      />

      <p>Buying trading cards online should never feel like a gamble. CardPop™ is built from the ground up to be <strong>Australia’s safest place to buy Pokémon, Magic: The Gathering, Yu-Gi-Oh! and sports cards</strong> — every order is paid securely, backed by buyer protection, and handled by identity-verified members. Here’s exactly how you’re protected on every purchase.</p>

      <h2>Every payment is secure</h2>
      <p>All purchases are processed by <strong>Stripe</strong>, a globally certified <strong>PCI-DSS Level 1</strong> payment provider. Your card details are entered on Stripe’s encrypted checkout and <strong>never touch CardPop’s servers</strong>. You can pay with <strong>Visa, Mastercard, American Express, PayPal, Apple Pay or Google Pay</strong>, all in Australian dollars.</p>

      <h2>Buyer protection on every order</h2>
      <p>Every purchase is backed by our <strong>14-day Buyer Protection Guarantee</strong>. If your item doesn’t arrive within the expected timeframe, or is significantly not as described, you can request a <strong>full refund</strong> through our resolution process. You’re never left out of pocket for an order that goes wrong.</p>

      <h2>You only trade with verified people</h2>
      <p>What makes CardPop safer than open marketplaces and social-media groups is that <strong>real, verified people stand behind every account</strong>. Sellers confirm their identity with a government-issued ID and a matching selfie through <strong>Stripe Identity</strong> before they can sell. Verified accounts carry a <strong>Verified badge</strong>, so you always know who you’re buying from — and fraudsters and throwaway accounts have nowhere to hide.</p>

      <h2>Authentication for high-value cards</h2>
      <p>For high-value cards and trades, we offer <strong>middleman authentication</strong>: items ship to our facility where experts verify authenticity and condition before forwarding to the buyer. Both sides transact with total confidence.</p>

      <h2>How to buy safely on CardPop</h2>
      <ol>
        <li><strong>Buy from verified sellers</strong> — look for the Verified badge on seller profiles.</li>
        <li><strong>Pay through CardPop’s Stripe checkout</strong> — never send money off-platform, so your Buyer Protection always applies.</li>
        <li><strong>Use authentication for big-ticket cards</strong> — add middleman authentication for peace of mind on high-value purchases.</li>
        <li><strong>Keep communication on-platform</strong> — it keeps a record and keeps you protected.</li>
      </ol>

      <h2>Frequently Asked Questions</h2>
      {FAQ.map(({ q, a }) => (
        <details key={q} className="group my-3 rounded-xl border border-border bg-card px-5 py-3 [&_summary]:cursor-pointer">
          <summary className="list-none font-semibold text-foreground marker:content-none">{q}</summary>
          <p className="mt-2 mb-0 text-muted-foreground">{a}</p>
        </details>
      ))}

      <p className="mt-10 text-sm text-muted-foreground">
        Read the full <Link to="/trust-safety" className="font-semibold text-primary hover:underline">Trust &amp; Safety policy</Link>, <Link to="/marketplace" className="font-semibold text-primary hover:underline">browse the marketplace</Link>, or <Link to="/signup" className="font-semibold text-primary hover:underline">create your verified account</Link>.
      </p>
    </InfoPageLayout>
  );
};

export default SafeBuyingPage;
