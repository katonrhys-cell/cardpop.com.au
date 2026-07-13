import React from 'react';
import { Link } from 'react-router-dom';
import { Gauge } from 'lucide-react';
import SEOHead from '@/components/SEOHead.jsx';
import InfoPageLayout from '@/components/InfoPageLayout.jsx';
import {
  CONVICTION_LEVELS,
  CONVICTION_TYPES,
  CONVICTION_TYPE_KEYS,
} from '@/utils/convictionRating.js';

const LEVELS = CONVICTION_LEVELS.filter(Boolean);

// A filled-to-N version of the 5-segment meter, tinted with the level colour.
const MiniMeter = ({ value, colour }) => (
  <span className="inline-flex items-center gap-1 align-middle" aria-hidden="true">
    {[1, 2, 3, 4, 5].map((i) => (
      <span key={i} className="h-1.5 w-4 rounded-full"
            style={{ background: i <= value ? colour : 'hsl(var(--muted))' }} />
    ))}
  </span>
);

const ConvictionRatingPage = () => {
  return (
    <InfoPageLayout
      title="The CardPop Conviction Rating"
      description="How strongly we stand behind a call — on one honest 1–5 scale. Here's exactly what every level means, so you know what to do with it."
      eyebrow="Research Methodology"
      icon={Gauge}
    >
      <SEOHead
        title="The CardPop Conviction Rating Explained | CardPop"
        description="What CardPop's 1–5 Conviction Rating means: the five strength levels (Minimal to Highest), the four rating types (Buy, Keeper, Grade, Impact), and the action each level implies."
        canonicalUrl="/conviction-rating"
      />

      <p>
        Anyone can say a card is “a good buy.” The <strong>CardPop Conviction Rating</strong> puts a
        number on it — a single, honest measure of <em>how strongly our research stands behind the
        central call of an article</em>. It's the same scale on every piece, so a “4” on one article
        means the same thing as a “4” on the next, and you can hold us to it over time.
      </p>

      <h2>It measures strength, not direction</h2>
      <p>
        This is the one thing to understand. The rating is <strong>one-directional</strong>: it runs
        from weak conviction to strong conviction. A high number does <em>not</em> automatically mean
        “price going up” — it means “we're highly confident in the call this article is making.” A low
        number isn't a failure either: a well-argued <em>“we looked, and we'd pass”</em> is one of the
        most valuable things we can tell you.
      </p>
      <p>
        Because we publish the full range — including the low end — the ratings build a track record
        you can actually judge us on. That's the point.
      </p>

      <h2>The five levels</h2>
      <p>Every rating, whatever its type, sits on this universal strength scale (cool = weak, hot = strong):</p>
      <div className="not-prose space-y-3 mt-4 mb-8">
        {LEVELS.map((l) => (
          <div key={l.value} className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold text-white shrink-0"
                    style={{ background: l.colour }}>
                {l.value}
              </span>
              <span className="font-bold text-foreground">{l.label}</span>
              <MiniMeter value={l.value} colour={l.colour} />
            </div>
            <p className="text-sm text-muted-foreground mt-2">{l.blurb}</p>
          </div>
        ))}
      </div>

      <h2>Four types — so the score fits the story</h2>
      <p>
        A grading guide and an investment thesis aren't asking the same question, so the rating
        adapts. The <strong>type</strong> is fixed by the article's category, and it changes what the
        1–5 is about and the action each level suggests:
      </p>

      {CONVICTION_TYPE_KEYS.map((key) => {
        const t = CONVICTION_TYPES[key];
        return (
          <div key={key} className="not-prose rounded-2xl border border-border bg-card p-5 mt-4 mb-4">
            <h3 className="font-bold text-foreground text-lg mb-0.5">{t.name}</h3>
            <p className="text-sm text-primary font-semibold mb-3">{t.question}</p>
            <ul className="space-y-1.5">
              {LEVELS.map((l) => (
                <li key={l.value} className="flex items-start gap-2.5 text-sm">
                  <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold text-white shrink-0"
                        style={{ background: l.colour }}>
                    {l.value}
                  </span>
                  <span className="text-muted-foreground">
                    <span className="font-semibold text-foreground">{l.label}</span>
                    {' — '}{t.actions[l.value]}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      <h2>What it is — and isn't</h2>
      <ul>
        <li><strong>It is</strong> our honest, on-the-record read at the time of writing.</li>
        <li><strong>It is</strong> a starting point for your own research, not a substitute for it.</li>
        <li><strong>It isn't</strong> financial advice, a price prediction, or a guarantee.</li>
        <li><strong>It isn't</strong> static — markets move, and a call can look different months later. Each article states its own time horizon.</li>
      </ul>
      <p>
        Educational and how-to articles carry <em>no</em> rating — there's no call to make, so we show
        a read-time cue instead. You'll only see a Conviction Rating where we're actually taking a
        position.
      </p>

      <p className="text-sm text-muted-foreground">
        Ready to see it in action? <Link to="/blog">Browse the latest CardPop research →</Link>
      </p>
    </InfoPageLayout>
  );
};

export default ConvictionRatingPage;
