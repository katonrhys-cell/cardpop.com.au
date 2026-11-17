import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

const state = vi.hoisted(() => ({ pages: {}, fetched: [], modelReply: null, modelCalls: 0, usage: [] }));

vi.mock('../../src/utils/safeFetch.js', () => ({
  isFetchableHttpUrl: (url) => /^https?:\/\//.test(url),
  fetchWebpageContent: vi.fn(async (url) => {
    state.fetched.push(url);
    if (!(url in state.pages)) throw new Error('Failed to fetch webpage: 404 Not Found');
    return state.pages[url];
  }),
  extractTextFromHtml: (html) => html.replace(/<[^>]+>/g, ' ').trim(),
}));
vi.mock('../../src/utils/aiUsage.js', () => ({
  recordAiUsage: vi.fn(async (entry) => { state.usage.push(entry); }),
}));
vi.mock('../../src/utils/aiTracing.js', () => ({
  traceMessagesCreate: vi.fn(async (_name, params, run) => run(params)),
}));
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    constructor() {
      this.beta = { messages: { create: async () => {
        state.modelCalls += 1;
        return { model: 'claude-haiku-5-5', usage: { input_tokens: 10, output_tokens: 5 }, stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(state.modelReply) }] };
      } } };
    }
  },
}));

import { readStoreDetails } from '../../src/utils/storeDetails.js';

const ld = (data) => `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
const FULL = ld({
  '@type': 'Store', telephone: '(03) 9123 4567',
  address: { streetAddress: '12 Example St', addressLocality: 'Fitzroy', addressRegion: 'VIC', postalCode: '3065' },
  openingHours: ['Mo-Fr 09:00-17:00'],
});

beforeEach(() => {
  state.pages = {}; state.fetched = []; state.modelReply = null; state.modelCalls = 0; state.usage = [];
  process.env.ANTHROPIC_API_KEY = 'test-key';
});
afterEach(() => { delete process.env.ANTHROPIC_API_KEY; });

describe('readStoreDetails', () => {
  it('uses structured data alone when the homepage has it all', async () => {
    state.pages['https://shop.example/'] = `${FULL}<a href="/pages/contact">Contact</a>`;
    const result = await readStoreDetails('https://shop.example/');
    expect(result.details.address).toBe('12 Example St, Fitzroy VIC 3065');
    expect(result.details.opening_hours).toBe('Monday to Friday: 9am – 5pm');
    expect(result.usedModel).toBe(false);
    expect(state.fetched).toEqual(['https://shop.example/']);
    expect(state.modelCalls).toBe(0);
  });

  it('reads the contact page, then asks the model only for what is still missing', async () => {
    state.pages['https://shop.example/'] = '<a href="tel:0391234567">Call</a><a href="/pages/contact">Contact</a>';
    state.pages['https://shop.example/pages/contact'] = '<p>Find us at 12 Example St</p>';
    state.modelReply = { address: '12 Example St, Fitzroy', phone: '9999 9999', opening_hours: ['Saturday: 10am – 4pm'], instagram_url: 'https://evil.example/x' };
    const result = await readStoreDetails('https://shop.example/', { storeName: 'Example Cards', userId: 'admin-1' });
    expect(state.fetched).toEqual(['https://shop.example/', 'https://shop.example/pages/contact']);
    expect(result.usedModel).toBe(true);
    // The phone from the page's own markup wins over the model's.
    expect(result.details).toEqual({
      address: '12 Example St, Fitzroy', suburb: null, phone: '0391234567',
      opening_hours: 'Saturday: 10am – 4pm', instagram_url: null,
    });
    expect(state.usage).toEqual([expect.objectContaining({ feature: 'store_details', userId: 'admin-1' })]);
  });

  it('reports rather than guesses when there is no API key', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    state.pages['https://shop.example/'] = '<p>Welcome</p>';
    const result = await readStoreDetails('https://shop.example/');
    expect(result.details.address).toBeNull();
    expect(result.note).toMatch(/ANTHROPIC_API_KEY/);
    expect(state.modelCalls).toBe(0);
  });

  it('refuses a non-http link and surfaces an unreachable site', async () => {
    await expect(readStoreDetails('ftp://shop.example/')).rejects.toThrow(/https/);
    await expect(readStoreDetails('https://gone.example/')).rejects.toThrow(/404/);
  });
});
