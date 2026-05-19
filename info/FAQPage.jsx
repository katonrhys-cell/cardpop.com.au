import React from 'react';
import { Helmet } from 'react-helmet';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import InfoPageLayout from '@/components/InfoPageLayout.jsx';

const FAQPage = () => {
  return (
    <InfoPageLayout 
      title="Frequently Asked Questions" 
      description="Find answers to common questions about buying, selling, and vaulting."
      breadcrumbs={[{ label: 'FAQ' }]}
    >
      <Helmet>
        <title>FAQ | CardPop</title>
      </Helmet>
      
      <div className="mt-8">
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="item-1">
            <AccordionTrigger className="text-lg font-bold">How does the CardPop Vault work?</AccordionTrigger>
            <AccordionContent className="text-muted-foreground text-base">
              The Vault is our secure storage facility. When you buy a card, you can choose to send it to your Vault instead of your home. This allows you to instantly relist the card for sale without paying shipping fees, or hold it securely as an investment.
            </AccordionContent>
          </AccordionItem>
          
          <AccordionItem value="item-2">
            <AccordionTrigger className="text-lg font-bold">What are the selling fees?</AccordionTrigger>
            <AccordionContent className="text-muted-foreground text-base">
              We charge a flat 8% commission on all successful sales. There are no listing fees. If you sell an item directly from your Vault, the commission is reduced to 6%.
            </AccordionContent>
          </AccordionItem>
          
          <AccordionItem value="item-3">
            <AccordionTrigger className="text-lg font-bold">How do I get paid when I sell an item?</AccordionTrigger>
            <AccordionContent className="text-muted-foreground text-base">
              Funds from successful sales are added to your CardPop Wallet balance. You can use this balance to purchase other items on the platform, or withdraw it to your nominated bank account at any time.
            </AccordionContent>
          </AccordionItem>
          
          <AccordionItem value="item-4">
            <AccordionTrigger className="text-lg font-bold">Are trades protected?</AccordionTrigger>
            <AccordionContent className="text-muted-foreground text-base">
              Yes. When you agree to a trade, both parties send their items to our authentication center. We verify the condition and authenticity of all items before forwarding them to their final destinations.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </InfoPageLayout>
  );
};

export default FAQPage;