import React from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import { generateFAQStructuredData } from '@/utils/seoUtils.js';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import InfoPageLayout from '@/components/InfoPageLayout.jsx';

const FAQ_ITEMS = [
  {
    question: 'How does the CardPop™ Vault work?',
    answer: 'The Vault is your digital collection on CardPop™. Add a card by photographing it — our card identification fills in the details for you — then track its estimated value, show it off on your public profile, and list it for sale or trade in a couple of clicks. Your cards stay with you; the Vault keeps the record, the photos and the market data in one place.',
  },
  {
    question: 'What are the selling fees on CardPop™?',
    answer: 'There are no listing fees — you only pay a commission when an item actually sells. The exact commission for your sale is shown in the price breakdown before you confirm, and again on the order once it completes, so there are never surprise deductions.',
  },
  {
    question: 'How do I get paid when I sell an item on CardPop™?',
    answer: 'Funds from successful sales are added to your CardPop™ Wallet balance. You can use this balance to purchase other items on the platform, or withdraw it to your nominated bank account at any time.',
  },
  {
    question: 'Can I trade cards with other collectors on CardPop™?',
    answer: 'Yes — you can mark any listing as "For Trade" (or "For Sale & Trade") and arrange the details with the other collector through CardPop™ Messages. Keep payments and shipping arrangements on CardPop™ so your transaction history and buyer protection apply; never move a deal off-platform.',
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