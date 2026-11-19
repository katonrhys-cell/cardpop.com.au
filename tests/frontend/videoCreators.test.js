import { describe, it, expect } from 'vitest';
import { cleanEventVideos, cleanVideoCreator, eventVideosForSave } from '@/utils/eventVideos.js';
import {
  creatorEventsCovered,
  creatorPageMeta,
  creatorRowToCredit,
  creatorSlug,
  creatorVideosFromRows,
  creatorVideosProbe,
  creditDiffersFromSaved,
  creditToCreatorRow,
  savedCreatorLabel,
  videoCreatorPath,
} from '@/utils/videoCreators.js';

const ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ROW = {
  id: ID,
  slug: 'simplesimon',
  name: 'SimpleSimon',
  avatar_url: 'https://example.supabase.co/storage/v1/object/public/events/logos/creator-1.webp',
  instagram: 'https://www.instagram.com/simplesimonyoutube',
  youtube: 'https://www.youtube.com/@TheSimpleverse',
  tiktok: null, facebook: null, x: null,
  updated_at: '2026-11-18T00:00:00Z',
};
const credit = creatorRowToCredit(ROW);
const video = (id, title, creator) => ({ title, url: `https://www.youtube.com/watch?v=${id}`, ...(creator ? { creator } : {}) });

describe('saved creator on a video credit', () => {
  it('keeps the saved creator id and slug with the snapshot', () => {
    expect(credit).toEqual({
      name: 'SimpleSimon', avatar_url: ROW.avatar_url, instagram: ROW.instagram, youtube: ROW.youtube, id: ID, slug: 'simplesimon',
    });
  });

  it('drops an id or slug that is not one', () => {
    expect(cleanVideoCreator({ name: 'A', id: 'not-a-uuid', slug: 'a' })).toEqual({ name: 'A' });
    expect(cleanVideoCreator({ name: 'A', id: ID, slug: '../admin' })).toEqual({ name: 'A' });
    expect(cleanVideoCreator({ id: ID, slug: 'a' })).toBeNull();
  });

  it('survives the form round trip and the save', () => {
    const saved = eventVideosForSave([video('aaaaaaaaaaa', 'Recap', credit)], [], '2026-11-18T00:00:00.000Z');
    expect(saved[0].creator.id).toBe(ID);
    expect(cleanEventVideos(saved)[0].creator.slug).toBe('simplesimon');
  });
});

describe('creator rows', () => {
  it('builds a page slug from the name', () => {
    expect(creatorSlug('  Simple Simon! ')).toBe('simple-simon');
    expect(creatorSlug('Café Cards')).toBe('cafe-cards');
    expect(creatorSlug('!!!')).toBe('');
  });

  it('builds the page path', () => {
    expect(videoCreatorPath(ROW)).toBe('/creators/simplesimon');
    expect(videoCreatorPath({})).toBeNull();
  });

  it('turns a typed credit into the columns to save, and needs a name', () => {
    expect(creditToCreatorRow({ name: ' Simon ', instagram: '@simon', x: 'nonsense/..' })).toEqual({
      name: 'Simon', avatar_url: null, instagram: 'https://www.instagram.com/simon', youtube: null, tiktok: null, facebook: null, x: null,
    });
    expect(creditToCreatorRow({ instagram: '@simon' })).toBeNull();
  });

  it('knows when the form differs from the saved creator', () => {
    expect(creditDiffersFromSaved(credit, ROW)).toBe(false);
    expect(creditDiffersFromSaved({ ...credit, instagram: '@simplesimonyoutube' }, ROW)).toBe(false);
    expect(creditDiffersFromSaved({ ...credit, name: 'Simple Simon' }, ROW)).toBe(true);
    expect(creditDiffersFromSaved({ ...credit, tiktok: '@simon' }, ROW)).toBe(true);
  });

  it('labels a saved creator with their first handle', () => {
    expect(savedCreatorLabel(ROW)).toBe('SimpleSimon (@simplesimonyoutube)');
    expect(savedCreatorLabel({ name: 'No Socials' })).toBe('No Socials');
  });

  it('builds the containment probe', () => {
    expect(JSON.parse(creatorVideosProbe(ID))).toEqual([{ creator: { id: ID } }]);
  });
});

describe('a creator\'s videos', () => {
  const events = [
    { id: 'e1', slug: 'geelong-fair', title: 'Geelong Comic & Toy Fair', suburb: 'Geelong', state: 'VIC', start_date: '2026-10-04',
      event_videos: [video('aaaaaaaaaaa', 'Toys I never see', credit), video('bbbbbbbbbbb', 'Someone else', { name: 'Other' })] },
    { id: 'e2', slug: 'ballarat-show', title: 'Ballarat Card Show', suburb: 'Ballarat', state: 'VIC', start_date: '2026-11-08',
      event_videos: [video('ccccccccccc', '', credit)] },
  ];
  const organisers = [
    { id: 'o1', slug: 'geelong-fairs', name: 'Geelong Fairs', videos: [video('aaaaaaaaaaa', 'Toys I never see', credit), video('ddddddddddd', 'Org only', credit)] },
  ];
  const videos = creatorVideosFromRows(ID, { events, organisers });

  it('lists only their videos, newest event first, each once', () => {
    expect(videos.map((v) => v.key)).toEqual(['ccccccccccc', 'aaaaaaaaaaa', 'ddddddddddd']);
    expect(videos[1]).toMatchObject({
      title: 'Toys I never see',
      path: '/events/geelong-fair/videos/aaaaaaaaaaa',
      parentName: 'Geelong Comic & Toy Fair',
      parentPath: '/events/geelong-fair',
      where: 'Geelong, VIC',
      date: '2026-10-04',
    });
    expect(videos[2].path).toBe('/events/organisers/geelong-fairs/videos/ddddddddddd');
  });

  it('lists the events covered once each', () => {
    expect(creatorEventsCovered(videos).map((v) => v.parentName)).toEqual(['Ballarat Card Show', 'Geelong Comic & Toy Fair']);
  });

  it('describes the page, and keeps an empty one out of the index', () => {
    const meta = creatorPageMeta(ROW, videos);
    expect(meta.title).toBe('SimpleSimon — Card Show Videos | CardPop');
    expect(meta.canonical).toBe('https://cardpop.com.au/creators/simplesimon');
    expect(meta.description).toContain('3 card show videos by SimpleSimon');
    expect(meta.indexable).toBe(true);
    const profile = meta.jsonLd.find((n) => n['@type'] === 'ProfilePage');
    expect(profile.mainEntity.sameAs).toEqual([ROW.instagram, ROW.youtube]);
    expect(JSON.stringify(meta.jsonLd)).not.toContain('VideoObject');
    expect(creatorPageMeta(ROW, []).indexable).toBe(false);
  });
});
