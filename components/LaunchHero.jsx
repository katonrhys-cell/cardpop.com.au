import React from 'react';

/**
 * Eager, dependency-free /launch hero. Used as the /launch route's Suspense
 * fallback in coming-soon builds so React's first commit paints the same hero
 * as the static launch shell (tools/launch-shell.html) while the full
 * LaunchPage chunk loads — no spinner flash over the already-painted shell.
 * Keep the markup in sync with pages/LaunchPage.jsx's hero section and the
 * shell. In non-coming-soon builds the only reference is inside a
 * dead-code-eliminated branch of App.jsx, so this module is tree-shaken out.
 */
const LaunchHero = () => (
  <div className="flex-grow bg-background">
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
          <div className="flex flex-col gap-3" aria-hidden="true">
            <div className="flex gap-2">
              <div className="flex h-10 w-full items-center rounded-input border border-[hsl(var(--input-border))] bg-background px-3 py-1 text-base shadow-sm md:text-sm text-muted-foreground">Your email address</div>
              <span className="inline-flex items-center justify-center whitespace-nowrap rounded-button text-sm font-medium bg-primary text-primary-foreground shadow h-10 shrink-0 px-4 py-2 opacity-50">Notify me</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3 text-center">
            No spam — one email when we launch. Unsubscribe anytime.
          </p>
        </div>
      </div>
    </section>
  </div>
);

export default LaunchHero;
