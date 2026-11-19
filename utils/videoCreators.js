// Saved video creators (public.video_creators) — the YouTubers / influencers
// credited under event videos, kept once and reused.
//
// A video's credit is still the snapshot inside its JSON entry
// (`creator: { name, avatar_url, instagram, … }`, utils/eventVideos.js). When
// it was picked from the saved list it also carries that creator's `id` and
// `slug`: the id is how /creators/<slug> finds every video they made, and the
// database rewrites the snapshot wherever it is used when the saved creator
// is edited (trg_video_creators_sync_credits).
//
// Dependency-free: the video form, the creator page, api/prerender.js and
// api/sitemap.js all read the same shape from here. See docs/video-creators.md.

import { CREATOR_PLATFORMS, cleanEventVideos, cleanVideoCreator, creatorLinks, youTubeThumbnailUrl } from './eventVideos.js';
import { organiserPath } from './eventOrganisers.js';
import { watchVideoPath } from './videoWatch.js';

export const SITE_URL = 'https://cardpop.com.au';
export const VIDEO_CREATORS_PATH = '/creators';
export const VIDEO_CREATOR_COLUMNS = 'id, slug, name, avatar_url, instagram, youtube, tiktok, facebook, x, updated_at';
export const MAX_SAVED_CREATORS = 500;

// What the creator page reads from each table whose videos carry credits.
export const CREATOR_EVENT_COLUMNS = 'id, slug, title, suburb, state, start_date, end_date, event_videos, updated_at';
export const CREATOR_ORGANISER_COLUMNS = 'id, slug, name, videos, updated_at';

const str = (v) => (typeof v === 'string' ? v.trim() : '');

/** "Simple Simon!" → "simple-simon". '' when the name has nothing usable. */
export const creatorSlug = (name) => str(name)
  .normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  .slice(0, 60).replace(/-+$/g, '');

/** The creator's public page, or null without a slug. */
export const videoCreatorPath = (creatorOrSlug) => {
  const slug = typeof creatorOrSlug === 'string' ? creatorOrSlug : creatorOrSlug?.slug;
  return str(slug) ? `${VIDEO_CREATORS_PATH}/${encodeURIComponent(str(slug))}` : null;
};

/** A saved row → the credit a video stores (cleaned, with id + slug). */
export const creatorRowToCredit = (row) => cleanVideoCreator(row);

/**
 * A credit as the form holds it → the columns a saved row takes, or null when
 * it has no name (a saved creator needs one — it names their page).
 */
export const creditToCreatorRow = (credit) => {
  const clean = cleanVideoCreator(credit);
  if (!clean?.name) return null;
  const row = { name: clean.name, avatar_url: clean.avatar_url || null };
  for (const { key } of CREATOR_PLATFORMS) row[key] = clean[key] || null;
  return row;
};

const CREDIT_FIELDS = ['name', 'avatar_url', ...CREATOR_PLATFORMS.map((p) => p.key)];

/** Does the credit in the form differ from the saved creator it is linked to? */
export const creditDiffersFromSaved = (credit, savedRow) => {
  const a = cleanVideoCreator(credit) || {};
  const b = cleanVideoCreator(savedRow) || {};
  return CREDIT_FIELDS.some((key) => (a[key] || '') !== (b[key] || ''));
};

/** How a saved creator reads in the picker: "SimpleSimon (@simplesimonyoutube)". */
export const savedCreatorLabel = (row) => {
  const handle = creatorLinks(cleanVideoCreator(row) || {}).map((l) => l.handle).find(Boolean);
  return handle ? `${row.name} (${handle})` : row.name;
};

/** The jsonb containment probe that finds a creator's videos in a video list column. */
export const creatorVideosProbe = (creatorId) => JSON.stringify([{ creator: { id: creatorId } }]);

/**
 * Every video that credits a creator, from the event and organiser rows that
 * hold one: [{ key, title, thumbnailUrl, path, parentName, parentPath, where,
 * date, addedAt }], newest event first. `path` is the video's watch page. The
 * same video on an event and on its organiser's page is listed once, under the
 * event.
 */
export const creatorVideosFromRows = (creatorId, { events = [], organisers = [] } = {}) => {
  const seen = new Set();
  const out = [];
  const take = (videos, parent) => {
    for (const v of cleanEventVideos(videos)) {
      if (v.creator?.id !== creatorId || seen.has(v.id)) continue;
      seen.add(v.id);
      out.push({
        key: v.id,
        title: v.title || '',
        thumbnailUrl: youTubeThumbnailUrl(v.id),
        path: watchVideoPath(parent.parentPath, v.id),
        addedAt: v.added_at || null,
        ...parent,
      });
    }
  };
  for (const event of events || []) {
    if (!event || !(event.slug || event.id)) continue;
    take(event.event_videos, {
      parentKind: 'event',
      parentName: str(event.title) || 'Trading card event',
      parentPath: `/events/${event.slug || event.id}`,
      where: [str(event.suburb), str(event.state)].filter(Boolean).join(', '),
      date: str(event.start_date).split('T')[0] || null,
    });
  }
  for (const org of organisers || []) {
    const path = org ? organiserPath(org) : null;
    if (!path) continue;
    take(org.videos, { parentKind: 'organiser', parentName: str(org.name) || 'Event organiser', parentPath: path, where: '', date: null });
  }
  const sortKey = (v) => v.date || (v.addedAt || '').split('T')[0] || '';
  return out.sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
};

/** The events a creator has covered, once each, in the order of their videos. */
export const creatorEventsCovered = (videos) => {
  const seen = new Set();
  return videos.filter((v) => v.parentKind === 'event' && !seen.has(v.parentPath) && seen.add(v.parentPath));
};

/**
 * Title, description, canonical and structured data for /creators/<slug>.
 * No VideoObject here — a video's markup lives only on its watch page.
 */
export const creatorPageMeta = (creator, videos = [], { siteUrl = SITE_URL } = {}) => {
  const name = str(creator?.name) || 'Video creator';
  const canonical = `${siteUrl}${videoCreatorPath(creator)}`;
  const events = creatorEventsCovered(videos);
  const eventNames = events.slice(0, 3).map((v) => v.parentName).join(', ');
  const description = videos.length
    ? `${videos.length} card show video${videos.length === 1 ? '' : 's'} by ${name} on CardPop${eventNames ? ` — ${eventNames}${events.length > 3 ? ' and more' : ''}` : ''}. Watch their event coverage and follow them.`
    : `${name} films trading card shows and events. Their videos on CardPop will be listed here.`;
  const links = creatorLinks(cleanVideoCreator(creator) || {});
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${siteUrl}/` },
        { '@type': 'ListItem', position: 2, name: 'Events', item: `${siteUrl}/events` },
        { '@type': 'ListItem', position: 3, name, item: canonical },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ProfilePage',
      url: canonical,
      mainEntity: {
        '@type': 'Person',
        name,
        url: canonical,
        ...(creator?.avatar_url ? { image: creator.avatar_url } : {}),
        ...(links.length ? { sameAs: links.map((l) => l.url) } : {}),
      },
    },
  ];
  return {
    name,
    title: `${name} — Card Show Videos | CardPop`,
    description,
    canonical,
    jsonLd,
    links,
    // An empty page says nothing yet: keep it out of the index until it has a video.
    indexable: videos.length > 0,
  };
};
