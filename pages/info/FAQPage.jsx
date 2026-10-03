import React from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import { generateFAQStructuredData } from '@/utils/seoUtils.js';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import InfoPageLayout from '@/components/InfoPageLayout.jsx';
import { MARKETPLACE_PROTECTION as MP, SHOP_PROTECTION, PROTECTION_COPY } from '@/utils/buyerProtectionPolicy.js';

const FAQ_ITEMS = [
  {
    question: 'Do I need an account to buy?',
    answer: 'Not for CardPop Shop products — supplies, binders and sealed stock check out as a guest. Cards bought from other collectors on the marketplace need a free account (it’s how the seller reaches you and how your Buyer Protection is tied to the order); you can create it at checkout and come straight back. Larger marketplace orders also ask for a one-time ID check through Stripe.',
  },
  {
    question: 'What does shipping cost and how long does it take?',
    answer: 'CardPop Shop orders ship tracked within Australia: a flat rate under the free-shipping threshold and free above it, dispatched within 2 business days. Marketplace cards ship at the postage the seller sets, shown on the listing and in your cart before you pay; sellers are expected to post within a week. See the Shipping page for the current rates.',
  },
  {
    question: 'What if a card arrives and it isn’t what was described?',
    answer: PROTECTION_COPY.marketplaceSummary,
  },
  {
    question: 'Can I return a card because I changed my mind?',
    answer: `Not a marketplace card — a sale between collectors is binding once the card is as advertised. New CardPop Shop products can be returned or exchanged within ${SHOP_PROTECTION.windowDays} days of delivery for any reason, unused and in their packaging.`,
  },
  {
    question: 'What happens if the seller never posts my card?',
    answer: PROTECTION_COPY.notShippedSummary,
  },
  {
    question: 'How does the CardPop™ Vault work?',
    answer: 'The Vault is your digital collection on CardPop™. Add a card by photographing it — our card identification fills in the details for you — then track its estimated value, show it off on your public profile, and list it for sale in a couple of clicks. Your cards stay with you; the Vault keeps the record, the photos and the market data in one place.',
  },
  {
    question: 'What are the selling fees on CardPop™?',
    answer: 'There are no listing fees — you only pay a commission when an item actually sells. The exact commission for your sale is shown in the price breakdown before you confirm, and again on the order once it completes, so there are never surprise deductions.',
  },
  {
    question: 'How do I get paid when I sell an item on CardPop™?',
    answer: 'Sales are paid out to your Stripe-connected bank account once the order completes. Until you connect a payout account, proceeds are held in your CardPop™ Wallet and released when you do.',
  },
  {
    question: 'Can I trade cards with other collectors on CardPop™?',
    answer: 'Not yet. Card-for-card trading is on the roadmap and is switched off until it’s ready — listings are for sale only. When it launches, trades will run through CardPop™ so your transaction history and Buyer Protection apply.',
  },
];

const FAQPage = () => {
  const faqSchema = generateFAQStructuredData(FAQ_ITEMS);

  return (
    <InfoPageLayout
      title="Frequently Asked Questions"
      description="Find answers to common questions about buying, selling, and vaulting."
      breadcrumbs={[{ label: 'FAQ' }]}
    >
      <SEOHead
        title="FAQ | CardPop Australia™ — Trading Card Marketplace"
        description="Answers to common questions about buying, selling and trading on CardPop™ — Australia's trusted trading card marketplace. Learn about fees, the Vault, trades, and payments."
        canonicalUrl="https://cardpop.com.au/faq"
        structuredData={faqSchema}
      />
      
      <div className="mt-8">
        <Accordion type="single" collapsible className="w-full">
          {FAQ_ITEMS.map((item, i) => (
            <AccordionItem key={i} value={`item-${i + 1}`}>
              <AccordionTrigger className="text-lg font-bold">{item.question}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-base">{item.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </InfoPageLayout>
  );
};

export default FAQPage;