import React from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import NewsletterSignup from '@/components/NewsletterSignup.jsx';
import { Store, Archive, TrendingUp, Users, Instagram, Facebook } from 'lucide-react';

const FEATURES = [
  {
    Icon: Store,
    title: 'Buy, Sell & Trade',
    desc: 'A trusted Australian marketplace for Pokémon, Magic, sports cards and more.',
  },
  {
    Icon: Archive,
    title: 'Collection Vault',
    desc: 'Track every card you own, with photos, conditions and live values in one place.',
  },
  {
    Icon: TrendingUp,
    title: 'Live AU Market Prices',
    desc: 'Real Australian sold prices and market trends, not overseas guesswork.',
  },
  {
    Icon: Users,
    title: 'Community & Events',
    desc: 'Find local card shows, traders and collectors right across Australia.',
  },
];

const DiscordIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
);

const TikTokIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.04-.1z" />
  </svg>
);

const SOCIAL_LINKS = [
  { label: 'Instagram', href: 'https://www.instagram.com/cardpop_aus/', Icon: Instagram },
  { label: 'Facebook', href: 'https://www.facebook.com/profile.php?id=61591488466915', Icon: Facebook },
  { label: 'TikTok', href: 'https://tiktok.com/@cardpopau', Icon: TikTokIcon },
  { label: 'Discord', href: 'https://discord.gg/cardpop', Icon: DiscordIcon },
];

const LaunchPage = () => {
  return (
    <>
      {/* The site is live: this waitlist page stays reachable for old links
          but is never indexed — a "launching soon" page reads as
          under-construction to search engines and ad reviewers. */}
      <SEOHead
        title="CardPop — Australia's Trading Card Marketplace | Launching Late 2026"
        description="CardPop is launching late 2026: buy, sell and trade Pokémon, Magic and sports cards on Australia's new trading card marketplace. Join the launch list to be first in."
        noindex
      />

      <div className="flex-grow bg-background">
        {/* ── Hero ── */}
        <section className="px-6 pt-20 pb-16 md:pt-28 md:pb-20">
          <div className="max-w-2xl mx-auto text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-8">
              <span className="w-2 h-2 rounded-full bg-brand-red animate-pulse" aria-hidden="true" />
              Launching late 2026
            </span>

            <h1 className="text-[clamp(2.2rem,5vw,3.5rem)] leading-[1.08] font-extrabold mb-5">
              Australia&apos;s new home for{' '}
              <span className="text-brand-red">trading cards</span> is almost here.
            </h1>

            <p className="text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto mb-10">
              Buy, sell and trade Pokémon, Magic: The Gathering and sports cards
              with collectors you can trust — backed by live Australian market
              prices. Be the first to know when we open the doors.
            </p>

            <div className="max-w-md mx-auto text-left">
              <NewsletterSignup
                list="launch"
                buttonLabel="Notify me"
                successMessage="You're on the list! We'll email you the moment CardPop goes live."
                toastMessage="You're on the list! We'll email you the moment CardPop goes live."
              />
              <p className="text-xs text-muted-foreground mt-3 text-center">
                No spam — one email when we launch. Unsubscribe anytime.
              </p>
            </div>
          </div>
        </section>

        {/* ── What's coming ── */}
        <section className="px-6 pb-16 md:pb-20">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-center text-sm font-bold uppercase tracking-wider text-muted-foreground mb-8">
              What&apos;s coming
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {FEATURES.map(({ Icon, title, desc }) => (
                <div
                  key={title}
                  className="flex items-start gap-4 rounded-xl border border-border bg-card p-5"
                >
                  <div className="shrink-0 w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                    <Icon className="w-5 h-5 text-brand-red" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">{title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Socials ── */}
        <section className="px-6 pb-20 md:pb-28">
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-sm text-muted-foreground mb-5">
              Follow along while we build
            </p>
            <div className="flex items-center justify-center gap-3">
              {SOCIAL_LINKS.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`CardPop on ${label}`}
                  className="w-11 h-11 rounded-full border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-brand-red hover:border-brand-red/40 transition-colors"
                >
                  <Icon className="w-5 h-5" />
                </a>
              ))}
            </div>
          </div>
        </section>
      </div>
    </>
  );
};

export default LaunchPage;
