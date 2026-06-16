import React from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import { generateFAQStructuredData } from '@/utils/seoUtils.js';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import InfoPageLayout from '@/components/InfoPageLayout.jsx';

const FAQ_ITEMS = [
  {
    question: 'How does the CardPop Vault work?',
    answer: 'The Vault is our secure storage facility. When you buy a card, you can choose to send it to your Vault instead of your home. This allows you to instantly relist the card for sale without paying shipping fees, or hold it securely as an investment.',
  },
  {
    question: 'What are the selling fees on CardPop?',
    answer: 'We charge a flat 8% commission on all successful sales. There are no listing fees. If you sell an item directly from your Vault, the commission is reduced to 6%.',
  },
  {
    question: 'How do I get paid when I sell an item on CardPop?',
    answer: 'Funds from successful sales are added to your CardPop Wallet balance. You can use this balance to purchase other items on the platform, or withdraw it to your nominated bank account at any time.',
  },
  {
    question: 'Are trades protected on CardPop?',
    answer: 'Yes. When you agree to a trade, both parties send their items to our authentication center. We verify the condition and authenticity of all items before forwarding them to their final destinations.',
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
        title="FAQ | CardPop Australia — Trading Card Marketplace"
        description="Answers to common questions about buying, selling and trading on CardPop — Australia's trusted trading card marketplace. Learn about fees, the Vault, trades, and payments."
        canonicalUrl="https://cardpop.online/faq"
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