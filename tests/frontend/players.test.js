import { describe, it, expect } from 'vitest';
import {
  playerPath, playerSlug, playerInitials, foldDiacritics, playerMatchScore, matchPlayers,
  splitParagraphs, groupPlayersBySport, cleanKeyCards, parseAliases, playerSubtitle,
  playerSeo, playerFaqs, playersForSport, listingMeta, truncateAt, SEO_TITLE_MAX, SEO_DESCRIPTION_MAX, PLAYERS_INDEX_SEO,
} from '@/utils/players.js';

const PLAYERS = [
  { id: '1', slug: 'michael-jordan', name: 'Michael Jordan', sport: 'NBA', team: 'Chicago Bulls', aliases: ['MJ', 'Air Jordan'], sort_order: 1 },
  { id: '2', slug: 'lebron-james', name: 'LeBron James', sport: 'NBA', team: 'Los Angeles Lakers', aliases: ['King James', 'LBJ'], sort_order: 2 },
  { id: '3', slug: 'luka-doncic', name: 'Luka Dončić', sport: 'NBA', team: 'Los Angeles Lakers', aliases: ['Luka Doncic'], sort_order: 6 },
  { id: '4', slug: 'victor-wembanyama', name: 'Victor Wembanyama', sport: 'NBA', team: 'San Antonio Spurs', aliases: ['Wemby'], sort_order: 5 },
  { id: '5', slug: 'nick-daicos', name: 'Nick Daicos', sport: 'AFL', team: 'Collingwood', aliases: [], sort_order: 17 },
  { id: '6', slug: 'nathan-cleary', name: 'Nathan Cleary', sport: 'NRL', team: 'Penrith Panthers', aliases: [], sort_order: 19 },
];

describe('playerPath / playerSlug', () => {
  it('builds the canonical page path from a slug or a row', () => {
    expect(playerPath('lebron-james')).toBe('/players/lebron-james');
    expect(playerPath({ slug: 'nick-daicos' })).toBe('/players/nick-daicos');
    expect(playerPath(null)).toBe('/players');
  });

  it('slugifies names the way the DB constraint expects', () => {
    expect(playerSlug('Luka Dončić')).toBe('luka-doncic');
    expect(playerSlug("Shaquille O'Neal")).toBe('shaquille-oneal');
    expect(playerSlug('  Tom   Brady ')).toBe('tom-brady');
    expect(playerSlug('Lance "Buddy" Franklin')).toBe('lance-buddy-franklin');
    expect(playerSlug('Lance "Buddy" Franklin')).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
});

describe('playerInitials / foldDiacritics', () => {
  it('takes the first letter of the first two words', () => {
    expect(playerInitials('Luka Dončić')).toBe('LD');
    expect(playerInitials('Tiger Woods')).toBe('TW');
    expect(playerInitials('Pelé')).toBe('P');
    expect(playerInitials('')).toBe('');
  });

  it('strips accents', () => {
    expect(foldDiacritics('Dončić')).toBe('Doncic');
    expect(foldDiacritics('Jokić')).toBe('Jokic');
  });
});

describe('matchPlayers', () => {
  it('returns the stored order for an empty query, trimmed to the limit', () => {
    expect(matchPlayers(PLAYERS, '', 3).map((p) => p.slug)).toEqual(['michael-jordan', 'lebron-james', 'luka-doncic']);
    expect(matchPlayers(PLAYERS, '   ')).toHaveLength(6);
  });

  it('finds a player by surname prefix and by first name', () => {
    expect(matchPlayers(PLAYERS, 'dai')[0].slug).toBe('nick-daicos');
    expect(matchPlayers(PLAYERS, 'leb')[0].slug).toBe('lebron-james');
  });

  it('ignores diacritics in either direction', () => {
    expect(matchPlayers(PLAYERS, 'doncic')[0].slug).toBe('luka-doncic');
    expect(matchPlayers(PLAYERS, 'Dončić')[0].slug).toBe('luka-doncic');
  });

  it('matches nicknames and aliases', () => {
    expect(matchPlayers(PLAYERS, 'wemby')[0].slug).toBe('victor-wembanyama');
    expect(matchPlayers(PLAYERS, 'mj')[0].slug).toBe('michael-jordan');
    expect(matchPlayers(PLAYERS, 'king james')[0].slug).toBe('lebron-james');
  });

  it('matches reversed word order and falls back to the team', () => {
    expect(matchPlayers(PLAYERS, 'james lebron')[0].slug).toBe('lebron-james');
    expect(matchPlayers(PLAYERS, 'panthers')[0].slug).toBe('nathan-cleary');
  });

  it('prefers a name match over a team match and keeps non-matches out', () => {
    const lakers = matchPlayers(PLAYERS, 'lakers').map((p) => p.slug);
    expect(lakers).toEqual(expect.arrayContaining(['lebron-james', 'luka-doncic']));
    expect(lakers).not.toContain('michael-jordan');
    expect(matchPlayers(PLAYERS, 'zzz')).toEqual([]);
    expect(playerMatchScore(PLAYERS[0], 'Michael Jordan')).toBeGreaterThan(playerMatchScore(PLAYERS[0], 'bulls'));
  });

  it('copes with bad input', () => {
    expect(matchPlayers(null, 'x')).toEqual([]);
    expect(matchPlayers([{ id: 'x' }], 'a')).toEqual([]);
  });
});

describe('text helpers', () => {
  it('splits a plain-text bio into paragraphs on blank lines', () => {
    expect(splitParagraphs('One\nstill one.\n\nTwo.\n\n\nThree.')).toEqual(['One still one.', 'Two.', 'Three.']);
    expect(splitParagraphs(null)).toEqual([]);
  });

  it('groups by sport keeping order', () => {
    const groups = groupPlayersBySport(PLAYERS);
    expect(groups.map((g) => g.sport)).toEqual(['NBA', 'AFL', 'NRL']);
    expect(groups[0].players.map((p) => p.slug)[0]).toBe('michael-jordan');
  });

  it('cleans key-card rows and alias text from the admin form', () => {
    expect(cleanKeyCards([{ name: ' 1986-87 Fleer #57 ', note: ' The rookie. ' }, { name: '', note: 'orphan' }, null]))
      .toEqual([{ name: '1986-87 Fleer #57', note: 'The rookie.' }]);
    expect(parseAliases(' MJ, Air Jordan,\nmj , ')).toEqual(['MJ', 'Air Jordan']);
    expect(parseAliases('')).toEqual([]);
  });

  it('builds the subtitle from whatever is present', () => {
    expect(playerSubtitle({ sport: 'NBA', team: 'Chicago Bulls', position: 'Shooting guard' })).toBe('NBA · Chicago Bulls · Shooting guard');
    expect(playerSubtitle({ sport: 'AFL' })).toBe('AFL');
  });
});

describe('SEO helpers', () => {
  const wemby = { name: 'Victor Wembanyama', sport: 'NBA', team: 'San Antonio Spurs', headline: 'The most anticipated prospect since LeBron and the 2024 Rookie of the Year.' };

  it('keeps every title form inside the snippet limit, degrading for long names', () => {
    expect(playerSeo({ name: 'Kobe Bryant' }).title).toBe('Kobe Bryant Cards – Rookie Cards & Prices | CardPop');
    expect(playerSeo(wemby).title.length).toBeLessThanOrEqual(SEO_TITLE_MAX);
    const long = playerSeo({ name: 'Giannis Sina Ugo Antetokounmpo the Greek Freak' });
    expect(long.title).toBe('Giannis Sina Ugo Antetokounmpo the Greek Freak Cards | CardPop');
    expect(PLAYERS_INDEX_SEO.title.length).toBeLessThanOrEqual(SEO_TITLE_MAX);
    expect(PLAYERS_INDEX_SEO.description.length).toBeLessThanOrEqual(160);
  });

  it('leads the description with name and sport and caps its length at a word boundary', () => {
    // Lead + headline + tail would run to ~185 characters, so the tail is
    // dropped and the description is the lead and the full headline.
    const { description } = playerSeo(wemby);
    expect(description).toBe(`Victor Wembanyama (NBA, San Antonio Spurs): ${wemby.headline}`);
    expect(description.length).toBeLessThanOrEqual(SEO_DESCRIPTION_MAX);
    // A headline that is itself too long is cut at a word boundary with an ellipsis.
    const verbose = playerSeo({ ...wemby, headline: `${wemby.headline} He also led the league in blocks and made first-team All-Defense in his second season.` }).description;
    expect(verbose.length).toBeLessThanOrEqual(SEO_DESCRIPTION_MAX);
    expect(verbose.endsWith('…')).toBe(true);
    const short = playerSeo({ name: 'Nick Daicos', sport: 'AFL', team: 'Collingwood', headline: 'Magpies star.' }).description;
    expect(short).toBe('Nick Daicos (AFL, Collingwood): Magpies star. Key cards, AUD prices and every Nick Daicos card on CardPop.');
    expect(playerSeo({ name: 'Solo' }).description).toBe('Solo: Key cards, AUD prices and every Solo card on CardPop.');
  });

  it('truncates at a word boundary with an ellipsis', () => {
    expect(truncateAt('short', 20)).toBe('short');
    const t = truncateAt('one two three four five six seven', 15);
    expect(t.length).toBeLessThanOrEqual(15);
    expect(t).toBe('one two three…');
  });

  it('writes FAQs from the key cards, the tracker snapshot and the listing count only', () => {
    const faqs = playerFaqs({
      player: { name: 'LeBron James', key_cards: [{ name: '2003-04 Topps Chrome #111', note: 'The flagship rookie.' }, { name: '2003-04 Topps #221', note: '' }] },
      trackedCards: [{ name: 'LeBron James Topps Rookie', latest: { snapshot_date: '2026-10-17', raw_avg: 120.5, graded_avg: 900 } }],
      listingCount: 2,
      formatPrice: (v) => `A$${Number(v).toFixed(2)}`,
    });
    expect(faqs.map((f) => f.q)).toEqual([
      "What is LeBron James's rookie card?",
      'How much are LeBron James cards worth in Australia?',
      'Where can I buy LeBron James cards in Australia?',
    ]);
    expect(faqs[0].a).toBe('The card collectors treat as the key LeBron James rookie card is the 2003-04 Topps Chrome #111. The flagship rookie. Other cards worth knowing: 2003-04 Topps #221.');
    expect(faqs[1].a).toContain('As at 17 October 2026, LeBron James Topps Rookie lists for around A$120.50 ungraded and about A$900.00 graded');
    expect(faqs[2].a).toContain('2 LeBron James listings are live right now.');
  });

  it('never invents a price when there is no snapshot, and drops the rookie FAQ without key cards', () => {
    const faqs = playerFaqs({ player: { name: 'Reece Walsh', key_cards: [] }, trackedCards: [{ name: 'x', latest: null }], listingCount: 0 });
    expect(faqs).toHaveLength(2);
    expect(faqs[0].q).toBe('How much are Reece Walsh cards worth in Australia?');
    expect(faqs[0].a).not.toMatch(/\$/);
    expect(faqs[1].a).toContain('New Reece Walsh cards appear here as sellers list them.');
  });

  it('matches players to a collection by sport name or alias and dedupes the listing meta', () => {
    const players = [{ name: 'A', sport: 'NBA' }, { name: 'B', sport: 'AFL' }, { name: 'C', sport: 'Formula 1' }];
    expect(playersForSport(players, ['NBA', 'Basketball']).map((p) => p.name)).toEqual(['A']);
    expect(playersForSport(players, 'formula 1').map((p) => p.name)).toEqual(['C']);
    expect(playersForSport(players, [])).toEqual([]);
    expect(listingMeta('2003', '2003-04 Topps Chrome')).toBe('2003-04 Topps Chrome');
    expect(listingMeta('1986', 'Fleer')).toBe('1986 Fleer');
    expect(listingMeta(null, 'Fleer')).toBe('Fleer');
    expect(listingMeta('1986', null)).toBe('1986');
  });
});
