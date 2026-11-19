import React from 'react';
import { ExternalLink, FileText, ImageIcon, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { isPdfUrl, isImageUrl, safeVendorUrl, VENDOR_INFO_ANCHOR } from '@/utils/eventVendorInfo.js';
import { publicImageUrl } from '@/utils/imageUrl.js';

// The event page's "Vendor Information" section (events.vendor_info, cleaned
// by cleanVendorInfo, + vendor_application_url): the organiser's words, the
// apply button, documents, links and the vendor FAQ. "Want to be a vendor?"
// under the RSVP buttons links to its anchor. Renders nothing when empty.
const EventVendorInfo = ({ info, applicationUrl = '', isPast = false }) => {
  const apply = isPast ? '' : safeVendorUrl(applicationUrl);
  const { intro, faqs, documents, links } = info;
  if (!intro && !faqs.length && !documents.length && !links.length && !apply) return null;

  return (
    <section id={VENDOR_INFO_ANCHOR} aria-labelledby="event-vendor-info-heading" className="space-y-5 scroll-mt-24">
      <div className="flex items-center gap-2">
        <Store className="w-4 h-4 text-brand-red" aria-hidden="true" />
        <h2 id="event-vendor-info-heading" className="font-heading text-xl font-bold text-foreground">Vendor Information</h2>
      </div>

      {intro && <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">{intro}</p>}

      {(apply || links.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {apply && (
            <Button className="font-bold gap-2" asChild>
              <a href={apply} target="_blank" rel="noopener noreferrer">
                <Store className="w-4 h-4" /> Apply for a trader table
              </a>
            </Button>
          )}
          {links.map((l, i) => (
            <Button key={`${l.url}-${i}`} variant="outline" className="font-semibold gap-2" asChild>
              <a href={l.url} target="_blank" rel="noopener noreferrer nofollow">
                {l.label} <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              </a>
            </Button>
          ))}
        </div>
      )}

      {documents.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Documents</h3>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 list-none p-0 m-0">
            {documents.map((d, i) => {
              const image = !isPdfUrl(d.url) && isImageUrl(d.url);
              const Icon = image ? ImageIcon : FileText;
              return (
                <li key={`${d.url}-${i}`}>
                  <a
                    href={image ? publicImageUrl(d.url) : d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm hover:border-primary/40 hover:bg-muted/40 transition-colors"
                  >
                    {image ? (
                      <img src={publicImageUrl(d.url)} alt="" loading="lazy" className="w-12 h-12 rounded-lg object-cover bg-muted shrink-0" />
                    ) : (
                      <span className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5 text-primary" aria-hidden="true" />
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block font-semibold text-foreground truncate">{d.title}</span>
                      <span className="block text-xs text-muted-foreground">{isPdfUrl(d.url) ? 'PDF — opens in a new tab' : 'Opens in a new tab'}</span>
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {faqs.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Vendor FAQs</h3>
          <Accordion type="multiple" className="w-full">
            {faqs.map((f, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger className="text-base font-semibold text-foreground">{f.question}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground whitespace-pre-wrap leading-relaxed">{f.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      )}
    </section>
  );
};

export default EventVendorInfo;
