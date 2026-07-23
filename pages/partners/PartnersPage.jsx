import React from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import { Link } from 'react-router-dom';
import {
  Store, Megaphone, Users, ArrowRight, Tag, Link2, HandCoins,
  BadgeCheck, ClipboardList, Rocket, Banknote,
} from 'lucide-react';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';

// One code, three jobs — the whole program in a sentence each.
const CODE_POWERS = [
  {
    icon: Tag,
    title: 'Your audience saves',
    body: 'Customers who use your code get your negotiated discount on CardPop Shop orders and their first seller-membership payment.',
  },
  {
    icon: HandCoins,
    title: 'You earn commission',
    body: 'Every referred purchase books you a commission — a percentage of the sale, paid straight to your bank via Stripe.',
  },
  {
    icon: Link2,
    title: 'Your link does the work',
    body: 'Share cardpop.com.au/?ref=YOURCODE anywhere. We track the click and apply your code automatically at checkout.',
  },
];

const WHO_CAN_APPLY = [
  {
    icon: Store,
    title: 'Local game stores',
    body: 'Bring your in-store community online. Add your store to our directory, promote your events, and earn on every customer you send our way.',
  },
  {
    icon: Megaphone,
    title: 'Content creators',
    body: 'YouTube, TikTok, Twitch, Whatnot — if you talk cards to an Australian audience, your code turns that reach into revenue.',
  },
  {
    icon: Users,
    title: 'Community builders',
    body: 'Run a club, a Discord, a Facebook group or a card show? Give your members a discount and get rewarded for growing the hobby.',
  },
];

const HOW_IT_WORKS = [
  {
    icon: ClipboardList,
    step: '1. Apply',
    body: 'Tell us about your store or audience and request your preferred code — it takes two minutes.',
  },
  {
    icon: BadgeCheck,
    step: '2. Get approved',
    body: 'We review every application personally and set your discount and commission rates when we approve you.',
  },
  {
    icon: Rocket,
    step: '3. Share your code',
    body: 'Drop your code and referral link in-store, in videos, in your community — anywhere collectors will see it.',
  },
  {
    icon: Banknote,
    step: '4. Get paid',
    body: 'Track clicks, referred orders and earnings on your partner dashboard. Payouts land in your bank via Stripe.',
  },
];

const FAQS = [
  {
    q: 'Who can become a CardPop partner?',
    a: 'Local game stores, content creators, and community builders with an Australian trading-card audience. Every application is reviewed by a human — tell us about your store or audience and we\'ll take it from there.',
  },
  {
    q: 'What do I earn?',
    a: 'A percentage of every referred CardPop Shop order (calculated on the item subtotal after your code\'s discount) and of the first payment when someone you refer becomes a CardPop seller. Your exact rates are agreed when your application is approved.',
  },
  {
    q: 'How do payouts work?',
    a: 'Commission accrues on your partner dashboard as referred orders are paid. Payouts are transferred to your bank account through Stripe — the same rails CardPop sellers are paid on. You\'ll complete a quick one-time Stripe onboarding from your dashboard.',
  },
  {
    q: 'Can I choose my own code?',
    a: 'Yes — request your preferred code on the application (letters, numbers and hyphens, 4–20 characters). We confirm it at approval, tweaking only if it\'s taken or too close to an existing code.',
  },
  {
    q: 'What does my audience get?',
    a: 'Your code gives them your negotiated percentage off CardPop Shop orders, and off their first month when they join as a seller. The discount is funded by CardPop, never by you.',
  },
  {
    q: 'I run a game store — does this connect to the store directory?',
    a: 'Yes. If your store is already listed on our card-shops directory you can link your listing in the application, and if it isn\'t we\'ll happily add it when you\'re approved.',
  },
];

const PartnersPage = () => (
  <div className="min-h-screen bg-background">
    <SEOHead
      title="Partner Program | CardPop — Earn with Australia's Card Marketplace"
      description="Join the CardPop Retailer Network. Local game stores, creators and community builders earn commission on referred sales with a personal discount code and referral link."
      keywords="cardpop partner program, lgs partner australia, trading card affiliate australia, card store partnership, tcg affiliate program"
    />

    {/* Hero */}
    <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-primary/10 via-card to-background py-20 sm:py-24">
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.4] pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, hsl(var(--primary)/0.15) 1px, transparent 0)',
          backgroundSize: '22px 22px',
        }}
      />
      <div className="container-default relative text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15">
          <Store className="h-8 w-8 text-primary" />
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
          CardPop Retailer Network
        </div>
        <h1 className="mx-auto mt-5 max-w-2xl font-serif text-4xl font-bold leading-tight sm:text-5xl">
          Partner with CardPop.<br />Grow the hobby, get paid.
        </h1>
        <p className="mx-auto mt-4 max-w-xl leading-relaxed text-muted-foreground">
          Local game stores, creators and community builders get a personal code that
          rewards their audience with discounts — and rewards them with commission on
          every referred sale.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/partners/apply"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-8 py-3.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 sm:w-auto"
          >
            Apply as Partner <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="#how-it-works"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-card px-8 py-3.5 text-sm font-bold transition-colors hover:border-primary/50 sm:w-auto"
          >
            How it works
          </a>
        </div>
      </div>
    </section>

    <div className="container-default space-y-16 py-12">

      {/* One code, three jobs */}
      <section>
        <h2 className="mb-6 text-center font-serif text-2xl font-bold sm:text-3xl">One code. Three ways it works for you.</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {CODE_POWERS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-3xl border border-border bg-card p-6">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mb-2 font-bold">{title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-8">
        <h2 className="mb-6 text-center font-serif text-2xl font-bold sm:text-3xl">How it works</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {HOW_IT_WORKS.map(({ icon: Icon, step, body }) => (
            <div key={step} className="flex gap-4 rounded-3xl border border-border bg-card p-6">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="mb-1 font-bold">{step}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Who can apply */}
      <section>
        <h2 className="mb-6 text-center font-serif text-2xl font-bold sm:text-3xl">Built for the people who build the hobby</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {WHO_CAN_APPLY.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-3xl border border-border bg-card p-6 text-center">
              <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mb-2 font-bold">{title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section>
        <h2 className="mb-6 font-serif text-2xl font-bold">Frequently Asked Questions</h2>
        <Accordion type="single" collapsible className="w-full overflow-hidden rounded-3xl border border-border bg-card px-2 sm:px-4">
          {FAQS.map(({ q, a }, i) => (
            <AccordionItem key={q} value={`faq-${i}`} className="px-3 last:border-b-0">
              <AccordionTrigger className="text-left font-bold">{q}</AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">{a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* Final CTA */}
      <section className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 p-10 text-center">
        <h2 className="mb-3 font-serif text-2xl font-bold">Ready to join the network?</h2>
        <p className="mx-auto mb-7 max-w-md leading-relaxed text-muted-foreground">
          Applications take two minutes and every one is reviewed personally. We'll
          come back to you with your code and your rates.
        </p>
        <Link
          to="/partners/apply"
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-10 py-3.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 sm:w-auto"
        >
          Apply as Partner <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

    </div>
  </div>
);

export default PartnersPage;
