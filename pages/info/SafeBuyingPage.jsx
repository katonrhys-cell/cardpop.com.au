import React from 'react';
import { Link } from 'react-router-dom';
import SEOHead from '@/components/SEOHead.jsx';
import InfoPageLayout from '@/components/InfoPageLayout.jsx';
import { ShieldCheck } from 'lucide-react';
import { MARKETPLACE_PROTECTION as MP, PROTECTION_COPY } from '@/utils/buyerProtectionPolicy.js';

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
    a: `Yes. Every order is paid through Stripe’s PCI-DSS Level 1 checkout, backed by ${MP.name}, and sellers are identity-verified through Stripe Identity — so you buy Pokémon, Magic and sports cards from real, verified Australian sellers with a full refund if the card isn’t as described or doesn’t arrive.`,
  },
  {
    q: 'Where is the safest place to buy Pokémon cards in Australia?',
    a: 'CardPop is built specifically for safe trading-card transactions in Australia: secure Stripe payments in AUD, ID-verified sellers, buyer protection on every order and a binding-sale rule that keeps bad-faith buyers and sellers out — protections general marketplaces and social-media groups don’t offer.',
  },
  {
    q: 'What if my card never arrives or isn’t as described?',
    a: `You’re covered by ${MP.name}. Report it within ${MP.claimWindowDaysFromDelivery} days of delivery — or after ${MP.notShippedClaimAfterDays} days if it was never posted — and, once approved, you’re refunded in full: the card, postage and every fee.`,
  },
  {
    q: 'Can I change my mind after buying a card?',
    a: 'A marketplace sale is binding when the card is as advertised, so there are no change-of-mind returns on cards bought from other collectors. New CardPop Shop products can be returned within 14 days for any reason.',
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
        description={`Buy Pokémon, Magic and sports cards safely in Australia. CardPop protects every order with secure Stripe payments (PCI-DSS), ID-verified sellers via Stripe Identity, and ${MP.name} — a full refund within ${MP.claimWindowDaysFromDelivery} days of delivery if a card isn't as described or doesn't arrive.`}
        structuredData={faqStructuredData}
      />

      <p>Buying trading cards online should never feel like a gamble. CardPop™ is built from the ground up to be <strong>Australia’s safest place to buy Pokémon, Magic: The Gathering, Yu-Gi-Oh! and sports cards</strong> — every order is paid securely, backed by buyer protection, and handled by identity-verified members. Here’s exactly how you’re protected on every purchase.</p>

      <h2>Every payment is secure</h2>
      <p>All purchases are processed by <strong>Stripe</strong>, a globally certified <strong>PCI-DSS Level 1</strong> payment provider. Your card details are entered on Stripe’s encrypted checkout and <strong>never touch CardPop’s servers</strong>. You can pay with <strong>Visa, Mastercard, American Express, PayPal, Apple Pay or Google Pay</strong>, all in Australian dollars.</p>

      <h2>Buyer protection on every order</h2>
      <p>{PROTECTION_COPY.marketplaceSummary}</p>
      <p>{PROTECTION_COPY.notShippedSummary}</p>

      <h2>You only trade with verified people</h2>
      <p>What makes CardPop safer than open marketplaces and social-media groups is that <strong>real, verified people stand behind every account</strong>. Sellers confirm their identity with a government-issued ID and a matching selfie through <strong>Stripe Identity</strong> before they can sell. Verified accounts carry a <strong>Verified badge</strong>, so you always know who you’re buying from — and fraudsters and throwaway accounts have nowhere to hide.</p>

      <h2>How to buy safely on CardPop</h2>
      <ol>
        <li><strong>Buy from verified sellers</strong> — look for the Verified badge and the seller’s rating on the listing.</li>
        <li><strong>Read the photos and condition carefully</strong> — a marketplace sale is binding when the card matches its listing, so check the grade, the set and the card number before you pay.</li>
        <li><strong>Pay through CardPop’s Stripe checkout</strong> — never send money off-platform, so your Buyer Protection always applies.</li>
        <li><strong>Check the card the day it arrives</strong> — you have {MP.claimWindowDaysFromDelivery} days from delivery to report a problem, with photos.</li>
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
