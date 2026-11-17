import { vi, describe, it, expect, beforeEach } from 'vitest';

const state = vi.hoisted(() => ({ due: [], selectError: null, updates: [], updateError: null, alreadyPublished: new Set(), filters: [] }));

vi.mock('../../src/utils/logger.js', () => ({ default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../../src/utils/supabaseClient.js', () => {
  const from = () => {
    let mode = 'select';
    let id = null;
    const b = {};
    b.select = vi.fn(() => b);
    b.update = vi.fn((patch) => { mode = 'update'; state.updates.push(patch); return b; });
    b.eq = vi.fn((col, val) => { if (col === 'id') id = val; state.filters.push([col, val]); return b; });
    b.not = vi.fn((...a) => { state.filters.push(['not', ...a]); return b; });
    b.lte = vi.fn((col, val) => { state.filters.push(['lte', col, val]); return b; });
    b.order = vi.fn(() => b);
    b.limit = vi.fn(() => b);
    b.then = (resolve, reject) => {
      const result = mode === 'select'
        ? { data: state.selectError ? null : state.due, error: state.selectError }
        : (state.updateError && state.updateError.id === id
          ? { data: null, error: { message: state.updateError.message } }
          : { data: state.alreadyPublished.has(id) ? [] : [{ id }], error: null });
      return Promise.resolve(result).then(resolve, reject);
    };
    return b;
  };
  const client = { from: vi.fn(from) };
  return { default: client, supabase: client };
});

import { publishDueArticles } from '../../src/utils/blogScheduledPublish.js';
import {
  addDays, cleanPublishOn, formatPublishOn, isDue, scheduleError, suggestPublishOn, sydneyDateString,
} from '../../utils/blogSchedule.js';

beforeEach(() => {
  state.due = []; state.selectError = null; state.updates = []; state.updateError = null;
  state.alreadyPublished = new Set(); state.filters = [];
});

describe('blog schedule rules', () => {
  it('reads "today" in Sydney, not UTC', () => {
    // 21:07 UTC is 07:07 the next morning in Sydney (AEST) — the daily run.
    expect(sydneyDateString(new Date('2026-07-01T21:07:00Z'))).toBe('2026-07-02');
    expect(sydneyDateString(new Date('2026-07-01T10:00:00Z'))).toBe('2026-07-01');
  });

  it('accepts only real calendar dates', () => {
    expect(cleanPublishOn('2026-11-21')).toBe('2026-11-21');
    for (const bad of ['2026-02-30', '21/11/2026', '2026-11-21T00:00:00Z', '', null, 20261121]) {
      expect(cleanPublishOn(bad)).toBeNull();
    }
  });

  it('knows when a draft is due', () => {
    expect(isDue('2026-11-20', '2026-11-21')).toBe(true);
    expect(isDue('2026-11-21', '2026-11-21')).toBe(true);
    expect(isDue('2026-11-22', '2026-11-21')).toBe(false);
    expect(isDue(null, '2026-11-21')).toBe(false);
  });

  it('offers dates from tomorrow to a year out', () => {
    expect(scheduleError('2026-11-22', '2026-11-21')).toBeNull();
    expect(scheduleError('2026-11-21', '2026-11-21')).toMatch(/tomorrow/);
    expect(scheduleError('2026-11-01', '2026-11-21')).toMatch(/tomorrow/);
    expect(scheduleError('2027-12-01', '2026-11-21')).toMatch(/year/);
    expect(scheduleError('nonsense', '2026-11-21')).toMatch(/Choose a date/);
  });

  it('suggests a date a few days after the last one, never in the past', () => {
    expect(suggestPublishOn([], { today: '2026-11-21' })).toBe('2026-11-22');
    expect(suggestPublishOn(['2026-11-24', '2026-11-27', 'junk'], { today: '2026-11-21' })).toBe('2026-11-30');
    // The last article went out weeks ago: tomorrow, not a date in the past.
    expect(suggestPublishOn(['2026-11-05'], { today: '2026-11-21' })).toBe('2026-11-22');
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
  });

  it('labels a date for the admin list', () => {
    expect(formatPublishOn('2026-11-21')).toMatch(/Sat.*21.*Nov/);
    expect(formatPublishOn('bad')).toBe('');
  });
});

describe('publishDueArticles', () => {
  const NOW = new Date('2026-11-20T21:07:00Z'); // 21 Nov, 08:07 in Sydney (AEDT)

  it('publishes each due draft and asks only for unpublished, dated rows up to today', async () => {
    state.due = [
      { id: 'a1', slug: 'first', title: 'First', publish_on: '2026-11-19' },
      { id: 'a2', slug: 'second', title: 'Second', publish_on: '2026-11-21' },
    ];
    const out = await publishDueArticles(NOW);
    expect(out.published.map((a) => a.slug)).toEqual(['first', 'second']);
    expect(out.failed).toBe(0);
    expect(state.updates).toEqual([{ is_published: true }, { is_published: true }]);
    expect(state.filters).toContainEqual(['lte', 'publish_on', '2026-11-21']);
    expect(state.filters).toContainEqual(['is_published', false]);
  });

  it('does nothing when no draft is due', async () => {
    const out = await publishDueArticles(NOW);
    expect(out).toEqual({ published: [], failed: 0 });
    expect(state.updates).toEqual([]);
  });

  it('does not report an article someone published in the meantime', async () => {
    state.due = [{ id: 'a1', slug: 'first', title: 'First', publish_on: '2026-11-21' }];
    state.alreadyPublished.add('a1');
    const out = await publishDueArticles(NOW);
    expect(out).toEqual({ published: [], failed: 0 });
  });

  it('carries on past one failed article and counts it', async () => {
    state.due = [
      { id: 'a1', slug: 'first', title: 'First', publish_on: '2026-11-21' },
      { id: 'a2', slug: 'second', title: 'Second', publish_on: '2026-11-21' },
    ];
    state.updateError = { id: 'a1', message: 'boom' };
    const out = await publishDueArticles(NOW);
    expect(out.published.map((a) => a.slug)).toEqual(['second']);
    expect(out.failed).toBe(1);
  });

  it('throws when the due list cannot be read', async () => {
    state.selectError = { message: 'column blog_articles.publish_on does not exist' };
    await expect(publishDueArticles(NOW)).rejects.toThrow(/scheduled articles/);
  });
});
