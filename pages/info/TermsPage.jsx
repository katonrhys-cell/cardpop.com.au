import React from 'react';
import { Link } from 'react-router-dom';
import SEOHead from '@/components/SEOHead.jsx';
import { ScrollText } from 'lucide-react';
import InfoPageLayout from '@/components/InfoPageLayout.jsx';
import BusinessIdentityLine from '@/components/BusinessIdentityLine.jsx';
import {
  TERMS_DESCRIPTION, TERMS_INTRO, TERMS_LINKS, TERMS_SECTIONS, TERMS_TITLE, TERMS_UPDATED, TERMS_UPDATED_LABEL,
} from '@/data/termsOfService.js';

// The wording lives in data/termsOfService.js, which api/prerender.js renders
// too — edit it there so visitors and crawlers read the same document.
const TermsPage = () => (
  <InfoPageLayout
    icon={ScrollText}
    eyebrow="CardPop Australia™"
    title="Terms of Service"
    description="The agreement between you and CardPop™ when you browse, buy, sell or list on the platform."
  >
    <SEOHead title={TERMS_TITLE} description={TERMS_DESCRIPTION} />

    <p className="text-sm text-muted-foreground mb-2">
      Last updated: <time dateTime={TERMS_UPDATED}>{TERMS_UPDATED_LABEL}</time>
    </p>
    <BusinessIdentityLine className="text-sm text-muted-foreground mb-6" />
    <p>{TERMS_INTRO}</p>

    {TERMS_SECTIONS.map((section) => (
      <section key={section.h2}>
        <h2>{section.h2}</h2>
        {section.paras?.map((para) => <p key={para}>{para}</p>)}
        {section.items?.length > 0 && (
          <ul>
            {section.items.map((item) => <li key={item.text}>{item.text}</li>)}
          </ul>
        )}
      </section>
    ))}

    <h2>Related policies</h2>
    <ul>
      {TERMS_LINKS.map((link) => (
        <li key={link.href}><Link to={link.href}>{link.text}</Link></li>
      ))}
    </ul>
  </InfoPageLayout>
);

export default TermsPage;
