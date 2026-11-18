import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient.js';
import SEOHead from '@/components/SEOHead.jsx';
import { STATIC_SECTIONS, SITE_INDEX_LIMITS, buildDynamicSections } from '@/utils/siteIndex.js';

// The visitor-facing Site Index (linked from the footer). Search engines read
// /sitemap.xml (api/sitemap.js); this is a page of links for people.
// What each section holds is decided in utils/siteIndex.js.

const today = () => new Date().toISOString().slice(0, 10);
const rows = (result) => (result.status === 'fulfilled' && !result.value.error ? result.value.data ?? [] : []);

async function loadSiteIndex() {
  // Each list is bounded and reads only what its links need; one failing
  // query leaves its section out, never the page.
  const [listings, events, articles, players, stores] = await Promise.allSettled([
    supabase.from('listings')
      .select('id, slug, vault_item:vault_items(card_name, set_name, card_number, year)')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(SITE_INDEX_LIMITS.listings),
    supabase.from('events_public')
      .select('id, slug, title, start_date, state')
      .eq('status', 'approved')
      .gte('start_date', today())
      .order('start_date', { ascending: true })
      .limit(SITE_INDEX_LIMITS.events),
    supabase.from('blog_articles')
      .select('slug, title')
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(SITE_INDEX_LIMITS.articles),
    supabase.from('players')
      .select('slug, name')
      .eq('is_published', true)
      .order('name', { ascending: true })
      .limit(SITE_INDEX_LIMITS.players),
    supabase.from('local_game_stores')
      .select('city')
      .eq('status', 'approved')
      .limit(SITE_INDEX_LIMITS.stores),
  ]);
  return buildDynamicSections({
    listings: rows(listings), events: rows(events), articles: rows(articles), players: rows(players), stores: rows(stores),
  });
}

const Section = ({ section }) => (
  <section aria-labelledby={`site-index-${section.key}`} className="break-inside-avoid mb-10">
    <h2 id={`site-index-${section.key}`} className="text-lg font-bold font-heading mb-3 border-b pb-2">
      {section.title}
    </h2>
    <ul className="space-y-1">
      {section.links.map((link) => (
        <li key={link.path}>
          <Link to={link.path} className="text-sm text-foreground hover:text-primary hover:underline py-1 inline-block">
            {link.label}
          </Link>
          {link.note && <span className="text-xs text-muted-foreground ml-2">{link.note}</span>}
        </li>
      ))}
    </ul>
    {section.more && (
      <Link to={section.more.path} className="text-sm font-semibold text-primary hover:underline mt-3 inline-block">
        {section.more.label} →
      </Link>
    )}
  </section>
);

const SitemapPage = () => {
  const [dynamicSections, setDynamicSections] = useState([]);

  useEffect(() => {
    let cancelled = false;
    loadSiteIndex()
      .then((sections) => { if (!cancelled) setDynamicSections(sections); })
      .catch(() => { /* the static sections are already on screen */ });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="container-default section-padding">
      <SEOHead
        title="Site Index | CardPop"
        description="Every section of CardPop in one place: cards for sale, card supplies, upcoming events, card shops by city, price guides, grading guides and articles."
      />
      <h1 className="text-3xl font-bold font-heading mb-2">Site Index</h1>
      <p className="text-muted-foreground mb-8 border-b pb-4">
        Every section of CardPop in one place. Cards listed here are for sale right now.
      </p>
      <div className="columns-1 md:columns-2 lg:columns-3 gap-10">
        {[...STATIC_SECTIONS.slice(0, 1), ...dynamicSections, ...STATIC_SECTIONS.slice(1)].map((section) => (
          <Section key={section.key} section={section} />
        ))}
      </div>
    </div>
  );
};

export default SitemapPage;
