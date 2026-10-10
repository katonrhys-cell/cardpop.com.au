import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('../../../src/utils/logger.js', () => ({
  default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockStream = vi.hoisted(() => vi.fn());
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    constructor() {
      this.beta = { messages: { stream: mockStream } };
    }
  },
}));

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));

import { runScheduledGeneration } from '../../../src/utils/blogArticleGenerator.js';

// ─── Supabase fake ────────────────────────────────────────────────────────────
// Each table gets a queue of results, consumed in call order at the terminal
// of a chain. Writes are recorded so tests can assert on what was persisted.
const queues = new Map();
const writes = [];

function enqueue(table, ...results) {
  queues.set(table, [...(queues.get(table) || []), ...results]);
}

mockSupabase.from.mockImplementation((table) => {
  const take = () => {
    const queue = queues.get(table) || [];
    return queue.length > 0 ? queue.shift() : { data: null, error: null };
  };
  const b = {};
  for (const method of ['select', 'eq', 'in', 'order', 'limit']) b[method] = vi.fn(() => b);
  b.update = vi.fn((patch) => {
    writes.push({ table, op: 'update', patch });
    return b;
  });
  b.insert = vi.fn((row) => {
    writes.push({ table, op: 'insert', row });
    return b;
  });
  b.maybeSingle = vi.fn(() => Promise.resolve(take()));
  b.single = vi.fn(() => Promise.resolve(take()));
  b.then = (resolve, reject) => Promise.resolve(take()).then(resolve, reject);
  return b;
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const topic = (overrides = {}) => ({
  id: 'topic-1',
  slug: 'psa-grading-costs-australia',
  title_hint: 'PSA grading costs from Australia',
  brief: 'Break down real submission costs.',
  category: 'grading-guides',
  keywords: ['psa grading australia'],
  marketplace_keywords: ['psa 10'],
  tracked_card_slugs: [],
  author: 'CardPop Research Team',
  priority: 100,
  min_snapshot_days: 7,
  status: 'queued',
  attempts: 0,
  ...overrides,
});

// A body long enough to clear the 900-word floor with genuine sentence-length
// variance and no banned vocabulary.
function longBody() {
  const sentences = [
    'Grading is a condition call.',
    'It is not a valuation, and treating it as one is how collectors talk themselves into submissions that never made financial sense in the first place.',
    'PSA charges in US dollars.',
    'Once you add return postage, insurance and the exchange rate, an Australian submission lands well above the sticker price you see quoted on the American forums.',
    'Do the sums before you post anything.',
    'A card worth three hundred dollars raw needs a genuine top grade to justify the round trip, and most raw cards are not genuine top grades.',
    'Check the centring first.',
    'Hold it under a lamp and look at the surface at an angle, because print lines and light scratches are the two things that quietly cap a card at a nine.',
  ];
  const paragraphs = [];
  for (let i = 0; i < 16; i += 1) {
    paragraphs.push(`<p>${sentences.join(' ')}</p>`);
  }
  return `<h2>What it actually costs</h2>${paragraphs.slice(0, 8).join('')}<h2>What to send</h2>${paragraphs.slice(8).join('')}`;
}

const draft = (overrides = {}) => ({
  title: 'PSA grading costs from Australia',
  excerpt: 'What a submission really costs once postage and the exchange rate are counted.',
  content: longBody(),
  seo_title: 'PSA Grading Cost Australia 2026',
  seo_description: 'Real PSA submission costs for Australian collectors, including postage.',
  read_time_minutes: 9,
  tags: ['psa', 'grading', 'australia'],
  faqs: [{ question: 'How long does PSA take?', answer: 'Months, typically.' }],
  ...overrides,
});

function respondWith(payload, stopReason = 'end_turn') {
  mockStream.mockReturnValueOnce({
    finalMessage: () =>
      Promise.resolve({
        stop_reason: stopReason,
        content: [{ type: 'text', text: JSON.stringify(payload) }],
      }),
  });
}

const lastWrite = (table, op) => [...writes].reverse().find((w) => w.table === table && w.op === op);

beforeEach(() => {
  vi.clearAllMocks();
  queues.clear();
  writes.length = 0;
  process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
  delete process.env.BLOG_AUTOPUBLISH;
});

afterEach(() => {
  delete process.env.BLOG_AUTOPUBLISH;
  delete process.env.ANTHROPIC_API_KEY;
});

describe('runScheduledGeneration', () => {
  it('reports nothing to do on an empty queue', async () => {
    enqueue('blog_article_topics', { data: [], error: null });

    const result = await runScheduledGeneration();
    expect(result).toEqual({ generated: false, reason: 'No topic ready in the queue.' });
    expect(mockStream).not.toHaveBeenCalled();
  });

  it('generates a draft and stores it unpublished by default', async () => {
    const t = topic();
    enqueue('blog_article_topics', { data: [t], error: null }); // queue read
    enqueue('blog_articles', { data: null, error: null }); // slug collision check
    enqueue('blog_article_topics', { data: { ...t, status: 'generating' }, error: null }); // claim
    enqueue('blog_articles', { data: { id: 'article-1', slug: t.slug }, error: null }); // insert
    enqueue('blog_article_topics', { data: null, error: null }); // mark generated
    respondWith(draft());

    const result = await runScheduledGeneration();

    expect(result.generated).toBe(true);
    expect(result.published).toBe(false);
    expect(result.attempts).toBe(1);

    const insert = lastWrite('blog_articles', 'insert');
    expect(insert.row.is_published).toBe(false);
    expect(insert.row.published_at).toBeNull();
    expect(insert.row.auto_generated).toBe(true);
    expect(insert.row.generation_model).toBe('claude-opus-5-5');
    expect(insert.row.slug).toBe(t.slug);
    // Topic metadata wins over anything the model might have invented.
    expect(insert.row.marketplace_keywords).toEqual(['psa 10']);
    expect(insert.row.author).toBe('CardPop Research Team');

    expect(lastWrite('blog_article_topics', 'update').patch).toMatchObject({
      status: 'generated',
      article_id: 'article-1',
    });
  });

  it('publishes immediately when BLOG_AUTOPUBLISH is on', async () => {
    process.env.BLOG_AUTOPUBLISH = 'true';
    const t = topic();
    enqueue('blog_article_topics', { data: [t], error: null });
    enqueue('blog_articles', { data: null, error: null });
    enqueue('blog_article_topics', { data: t, error: null });
    enqueue('blog_articles', { data: { id: 'article-1', slug: t.slug }, error: null });
    enqueue('blog_article_topics', { data: null, error: null });
    respondWith(draft());

    const result = await runScheduledGeneration();

    expect(result.published).toBe(true);
    const insert = lastWrite('blog_articles', 'insert');
    expect(insert.row.is_published).toBe(true);
    expect(insert.row.published_at).toEqual(expect.any(String));
  });

  it('truncates SEO fields to their column limits', async () => {
    const t = topic();
    enqueue('blog_article_topics', { data: [t], error: null });
    enqueue('blog_articles', { data: null, error: null });
    enqueue('blog_article_topics', { data: t, error: null });
    enqueue('blog_articles', { data: { id: 'article-1', slug: t.slug }, error: null });
    enqueue('blog_article_topics', { data: null, error: null });
    respondWith(draft({ seo_title: 'x'.repeat(120), seo_description: 'y'.repeat(400) }));

    await runScheduledGeneration();

    const insert = lastWrite('blog_articles', 'insert');
    expect(insert.row.seo_title.length).toBeLessThanOrEqual(60);
    expect(insert.row.seo_description.length).toBeLessThanOrEqual(155);
  });

  it('skips a topic whose slug already has an article and takes the next one', async () => {
    const taken = topic({ id: 'topic-taken', slug: 'already-live' });
    const next = topic({ id: 'topic-next', slug: 'fresh-slug' });

    enqueue('blog_article_topics', { data: [taken, next], error: null });
    enqueue('blog_articles', { data: { id: 'existing-article' }, error: null }); // collision
    enqueue('blog_article_topics', { data: null, error: null }); // mark skipped
    enqueue('blog_articles', { data: null, error: null }); // next slug is free
    enqueue('blog_article_topics', { data: next, error: null }); // claim next
    enqueue('blog_articles', { data: { id: 'article-2', slug: next.slug }, error: null });
    enqueue('blog_article_topics', { data: null, error: null });
    respondWith(draft());

    const result = await runScheduledGeneration();

    expect(result.generated).toBe(true);
    expect(result.topic).toBe('fresh-slug');

    const skipWrite = writes.find(
      (w) => w.table === 'blog_article_topics' && w.op === 'update' && w.patch.status === 'skipped',
    );
    expect(skipWrite.patch.article_id).toBe('existing-article');
  });

  it('defers a topic back to the queue when price history is too shallow', async () => {
    const t = topic({ tracked_card_slugs: ['charizard'], min_snapshot_days: 30 });

    enqueue('blog_article_topics', { data: [t], error: null });
    enqueue('blog_articles', { data: null, error: null });
    enqueue('blog_article_topics', { data: t, error: null });
    // Only two days of history against a 30-day gate.
    enqueue('tracked_cards', {
      data: [{ id: 'c1', slug: 'charizard', name: 'Charizard', set_name: 'Base', card_number: '4', category: 'pokemon' }],
      error: null,
    });
    enqueue('card_price_snapshots', {
      data: [
        { card_id: 'c1', snapshot_date: '2026-07-24', raw_avg: 300, raw_min: 250, raw_max: 350, raw_count: 5, graded_avg: 900, graded_min: 800, graded_max: 1000, graded_count: 3 },
        { card_id: 'c1', snapshot_date: '2026-07-25', raw_avg: 310, raw_min: 260, raw_max: 360, raw_count: 5, graded_avg: 910, graded_min: 810, graded_max: 1010, graded_count: 3 },
      ],
      error: null,
    });
    enqueue('blog_article_topics', { data: null, error: null }); // requeue

    const result = await runScheduledGeneration();

    expect(result.generated).toBe(false);
    expect(result.deferred).toEqual([t.slug]);
    expect(mockStream).not.toHaveBeenCalled();

    // Back to 'queued', so tomorrow's run retries it once the data is deeper.
    expect(lastWrite('blog_article_topics', 'update').patch.status).toBe('queued');
  });

  it('skips past a deferred topic and generates the next one that is ready', async () => {
    const blocked = topic({
      id: 'topic-blocked',
      slug: 'charizard-price-watch',
      tracked_card_slugs: ['charizard'],
      min_snapshot_days: 30,
      priority: 10,
    });
    const ready = topic({ id: 'topic-ready', priority: 20 });

    // First pass claims the blocked topic.
    enqueue('blog_article_topics', { data: [blocked, ready], error: null });
    enqueue('blog_articles', { data: null, error: null });
    enqueue('blog_article_topics', { data: blocked, error: null });
    enqueue('tracked_cards', {
      data: [{ id: 'c1', slug: 'charizard', name: 'Charizard', set_name: 'Base', card_number: '4', category: 'pokemon' }],
      error: null,
    });
    enqueue('card_price_snapshots', {
      data: [
        { card_id: 'c1', snapshot_date: '2026-07-25', raw_avg: 310, raw_min: 260, raw_max: 360, raw_count: 5, graded_avg: 910, graded_min: 810, graded_max: 1010, graded_count: 3 },
      ],
      error: null,
    });
    enqueue('blog_article_topics', { data: null, error: null }); // requeue blocked

    // Second pass sees it back at 'queued' but skips it and takes `ready`.
    enqueue('blog_article_topics', { data: [blocked, ready], error: null });
    enqueue('blog_articles', { data: null, error: null });
    enqueue('blog_article_topics', { data: ready, error: null });
    enqueue('blog_articles', { data: { id: 'article-2', slug: ready.slug }, error: null });
    enqueue('blog_article_topics', { data: null, error: null }); // mark generated
    respondWith(draft());

    const result = await runScheduledGeneration();

    expect(result.generated).toBe(true);
    expect(result.topic).toBe(ready.slug);
    expect(result.deferred).toEqual([blocked.slug]);
    expect(mockStream).toHaveBeenCalledTimes(1);
  });

  it('retries once with the style violations fed back', async () => {
    const t = topic();
    enqueue('blog_article_topics', { data: [t], error: null });
    enqueue('blog_articles', { data: null, error: null });
    enqueue('blog_article_topics', { data: t, error: null });
    enqueue('blog_articles', { data: { id: 'article-1', slug: t.slug }, error: null });
    enqueue('blog_article_topics', { data: null, error: null });

    // First draft uses banned vocabulary; second is clean.
    respondWith(draft({ content: longBody().replace('Grading is a condition call.', 'Let us delve into grading.') }));
    respondWith(draft());

    const result = await runScheduledGeneration();

    expect(result.generated).toBe(true);
    expect(result.attempts).toBe(2);
    expect(mockStream).toHaveBeenCalledTimes(2);

    // The retry prompt names the violation.
    const retryPrompt = mockStream.mock.calls[1][0].messages[0].content;
    expect(retryPrompt).toContain('YOUR PREVIOUS DRAFT WAS REJECTED');
    expect(retryPrompt).toContain('delve');
  });

  it('marks the topic failed when both drafts break the style rules', async () => {
    const t = topic();
    enqueue('blog_article_topics', { data: [t], error: null });
    enqueue('blog_articles', { data: null, error: null });
    enqueue('blog_article_topics', { data: t, error: null });
    enqueue('blog_article_topics', { data: null, error: null }); // mark failed

    const bad = draft({ content: '<h2>Short</h2><p>Too short to publish.</p>' });
    respondWith(bad);
    respondWith(bad);

    await expect(runScheduledGeneration()).rejects.toThrow(/failed style checks after 2 attempts/);

    expect(lastWrite('blog_article_topics', 'update').patch.status).toBe('failed');
    // Nothing was written to the blog.
    expect(writes.some((w) => w.table === 'blog_articles' && w.op === 'insert')).toBe(false);
  });

  it('fails the topic when the model declines the request', async () => {
    const t = topic();
    enqueue('blog_article_topics', { data: [t], error: null });
    enqueue('blog_articles', { data: null, error: null });
    enqueue('blog_article_topics', { data: t, error: null });
    enqueue('blog_article_topics', { data: null, error: null });

    mockStream.mockReturnValueOnce({
      finalMessage: () =>
        Promise.resolve({ stop_reason: 'refusal', stop_details: { category: 'cyber' }, content: [] }),
    });

    await expect(runScheduledGeneration()).rejects.toThrow(/Model declined the request/);
    expect(lastWrite('blog_article_topics', 'update').patch.status).toBe('failed');
  });

  it('does not take a topic another run already claimed', async () => {
    const t = topic();
    enqueue('blog_article_topics', { data: [t], error: null });
    enqueue('blog_articles', { data: null, error: null });
    // Conditional update matched no row: a concurrent run got there first.
    enqueue('blog_article_topics', { data: null, error: null });

    const result = await runScheduledGeneration();

    expect(result.generated).toBe(false);
    expect(mockStream).not.toHaveBeenCalled();
  });

  it('requests the article with structured output and the price-grounded prompt', async () => {
    const t = topic();
    enqueue('blog_article_topics', { data: [t], error: null });
    enqueue('blog_articles', { data: null, error: null });
    enqueue('blog_article_topics', { data: t, error: null });
    enqueue('blog_articles', { data: { id: 'article-1', slug: t.slug }, error: null });
    enqueue('blog_article_topics', { data: null, error: null });
    respondWith(draft());

    await runScheduledGeneration();

    const request = mockStream.mock.calls[0][0];
    expect(request.model).toBe('claude-opus-5-5');
    expect(request.output_config.format.type).toBe('json_schema');
    expect(request.output_config.format.schema.required).toContain('content');
    expect(request.thinking).toEqual({ type: 'adaptive' });
    // Effort is set explicitly: Claude Opus 5.5 defaults to medium.
    expect(request.output_config.effort).toBe('high');
    // The house-style prompt is a cached system block.
    expect(request.system).toHaveLength(1);
    expect(request.system[0].text).toContain('never invent a figure');
    expect(request.system[0].cache_control).toEqual({ type: 'ephemeral' });
    expect(request.messages[0].content).toContain('psa grading australia');
  });
});
