import React from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarPlus, Ticket, Megaphone, ArrowRight, Check, ClipboardList,
  BadgeCheck, Tag, BarChart3,
} from 'lucide-react';
import SEOHead from '@/components/SEOHead.jsx';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import { OrganiserReachSection, useOrganiserStats } from '@/components/events/OrganiserReach.jsx';
import {
  LIST_EVENT_FAQS, LIST_EVENT_HERO, LIST_EVENT_PATH, LIST_EVENT_SEO,
  LIST_EVENT_STEPS, LIST_EVENT_TIERS, SUBMIT_EVENT_PATH,
  LIST_EVENT_FEATURED_PACKAGES, FEATURED_EARLY_BIRD_NOTE, FEATURED_BUNDLE_NOTE,
} from '@/data/listYourEvent.js';

const TIER_ICONS = { listing: CalendarPlus, offer: Ticket, featured: Megaphone };
const STEP_ICONS = [ClipboardList, BadgeCheck, Tag, BarChart3];
const CtaLink = ({ cta, className }) => (cta.external ? (
  <a href={cta.href} className={className}>
    {cta.label} <ArrowRight className="h-4 w-4" />
  </a>
) : (
  <Link to={cta.href} className={className}>
    {cta.label} <ArrowRight className="h-4 w-4" />
  </Link>
));

const ListYourEventPage = () => {
  const stats = useOrganiserStats();

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={LIST_EVENT_SEO.title}
        description={LIST_EVENT_SEO.description}
        canonicalUrl={LIST_EVENT_PATH}
      />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-primary/10 via-card to-background py-20 sm:py-24">
        <div className="container-default relative text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15">
            <CalendarPlus className="h-8 w-8 text-primary" />
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
            {LIST_EVENT_HERO.eyebrow}
          </div>
          <h1 className="mx-auto mt-5 max-w-2xl font-serif text-4xl font-bold leading-tight sm:text-5xl">
            {LIST_EVENT_HERO.h1}
          </h1>
          <p className="mx-auto mt-4 max-w-xl leading-relaxed text-muted-foreground">
            {LIST_EVENT_HERO.intro}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to={SUBMIT_EVENT_PATH}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-8 py-3.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 sm:w-auto"
            >
              Submit your event <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#options"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-card px-8 py-3.5 text-sm font-bold transition-colors hover:border-primary/50 sm:w-auto"
            >
              See the options
            </a>
          </div>
        </div>
      </section>

      <div className="container-default space-y-16 py-12">

        {/* Live audience — hidden until there is an honest number to show */}
        <OrganiserReachSection stats={stats} />

        {/* Options */}
        <section id="options" className="scroll-mt-8">
          <h2 className="mb-6 text-center font-serif text-2xl font-bold sm:text-3xl">Three ways to promote your show</h2>
          <div className="grid gap-4 lg:grid-cols-3">
            {LIST_EVENT_TIERS.map((tier) => {
              const Icon = TIER_ICONS[tier.key] || CalendarPlus;
              return (
                <div
                  key={tier.key}
                  className={`flex flex-col rounded-3xl border bg-card p-6 ${tier.highlight ? 'border-primary shadow-md' : 'border-border'}`}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold">{tier.price}</span>
                  </div>
                  <h3 className="mb-1 text-lg font-bold">{tier.name}</h3>
                  <p className="mb-4 text-sm leading-relaxed text-muted-foreground">{tier.summary}</p>
                  <ul className="mb-6 space-y-2 text-sm">
                    {tier.points.map((p) => (
                      <li key={p} className="flex gap-2">
                        <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                  <CtaLink
                    cta={tier.cta}
                    className={`mt-auto inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-bold transition-opacity hover:opacity-90 ${tier.highlight ? 'bg-primary text-primary-foreground' : 'border border-border bg-background'}`}
                  />
                </div>
              );
            })}
          </div>
        </section>

        {/* Featured Placement packages — prices from utils/featuredPackages.js */}
        <section id="featured-packages" aria-labelledby="featured-packages-heading" className="scroll-mt-8">
          <h2 id="featured-packages-heading" className="mb-2 text-center font-serif text-2xl font-bold sm:text-3xl">
            Featured Placement packages
          </h2>
          <p className="mx-auto mb-6 max-w-xl text-center text-sm text-muted-foreground">{FEATURED_EARLY_BIRD_NOTE}</p>
          <div className="grid gap-4 lg:grid-cols-3">
            {LIST_EVENT_FEATURED_PACKAGES.map((pkg) => (
              <div
                key={pkg.key}
                className={`flex flex-col rounded-3xl border bg-card p-6 ${pkg.highlight ? 'border-primary shadow-md' : 'border-border'}`}
              >
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <h3 className="text-lg font-bold">{pkg.name}</h3>
                  <span className="text-2xl font-bold tabular-nums">{pkg.price}</span>
                </div>
                <p className="mb-3 text-xs text-muted-foreground">or {pkg.packPrice} for 3 events</p>
                {pkg.highlight && <span className="mb-3 self-start rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">Most popular</span>}
                <ul className="mb-6 space-y-2 text-sm">
                  {pkg.points.map((p) => (
                    <li key={p} className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to={`${SUBMIT_EVENT_PATH}?feature=1`}
                  className={`mt-auto inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-bold transition-opacity hover:opacity-90 ${pkg.highlight ? 'bg-primary text-primary-foreground' : 'border border-border bg-background'}`}
                >
                  Feature Now <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ))}
          </div>
          <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-muted-foreground">{FEATURED_BUNDLE_NOTE}</p>
        </section>

        {/* How it works */}
        <section>
          <h2 className="mb-6 text-center font-serif text-2xl font-bold sm:text-3xl">How it works</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {LIST_EVENT_STEPS.map(({ step, body }, i) => {
              const Icon = STEP_ICONS[i] || ClipboardList;
              return (
                <div key={step} className="flex gap-4 rounded-3xl border border-border bg-card p-6">
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="mb-1 font-bold">{step}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* FAQ */}
        <section>
          <h2 className="mb-6 font-serif text-2xl font-bold">Questions from organisers</h2>
          <Accordion type="single" collapsible className="w-full overflow-hidden rounded-3xl border border-border bg-card px-2 sm:px-4">
            {LIST_EVENT_FAQS.map(({ q, a }, i) => (
              <AccordionItem key={q} value={`faq-${i}`} className="px-3 last:border-b-0">
                <AccordionTrigger className="text-left font-bold">{q}</AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-muted-foreground">{a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        {/* Final CTA */}
        <section className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 p-10 text-center">
          <h2 className="mb-3 font-serif text-2xl font-bold">Got a show coming up?</h2>
          <p className="mx-auto mb-7 max-w-md leading-relaxed text-muted-foreground">
            List it free today. See what&rsquo;s already on the{' '}
            <Link to="/events" className="font-semibold text-primary hover:underline">events calendar</Link>.
          </p>
          <Link
            to={SUBMIT_EVENT_PATH}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-10 py-3.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 sm:w-auto"
          >
            Submit your event <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      </div>
    </div>
  );
};

export default ListYourEventPage;
