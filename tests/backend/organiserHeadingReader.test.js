import { vi, describe, it, expect, beforeEach } from 'vitest';

const state = vi.hoisted(() => ({ reply: null, stop: 'end_turn', params: null, usage: [] }));

vi.mock('../../src/utils/aiUsage.js', () => ({
  recordAiUsage: vi.fn(async (entry) => { state.usage.push(entry); }),
}));
vi.mock('../../src/utils/aiTracing.js', () => ({
  traceMessagesCreate: vi.fn(async (_name, params, run) => run(params)),
}));
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    constructor() {
      this.beta = { messages: { create: async (params) => {
        state.params = params;
        return { model: 'claude-sonnet-5-5', usage: { input_tokens: 900, output_tokens: 80 }, stop_reason: state.stop, content: [{ type: 'text', text: JSON.stringify(state.reply) }] };
      } } };
    }
  },
}));

import { readHeadingStyleFromLogo } from '../../src/utils/organiserHeadingReader.js';

const NAME = 'Geelong Comic and Toy Fair';
const seg = (text, font, extra = {}) => ({ text, font, italic: false, case: 'upper', tracking: 'wide', scale: 1, fill: '#ffffff', outline: '#000000', shadow: null, ...extra });
const read = () => readHeadingStyleFromLogo({ name: NAME, mediaType: 'image/jpeg', base64: 'AAAA', userId: 'admin-1' });

beforeEach(() => { state.reply = null; state.stop = 'end_turn'; state.params = null; state.usage = []; });

describe('readHeadingStyleFromLogo', () => {
  it('sends the logo inline and returns a cleaned style with the fonts it saw', async () => {
    state.reply = {
      has_lettering: true,
      layout: 'stacked',
      segments: [seg('Geelong', 'league-gothic'), seg('Comic and Toy', 'bangers', { italic: true, shadow: '#f28c1e' }), seg('Fair', 'league-gothic')],
      source_fonts: ['League Gothic', 'Bangers'],
    };
    const result = await read();
    expect(result.style.segments.map((s) => s.font)).toEqual(['league-gothic', 'bangers', 'league-gothic']);
    expect(result.style.layout).toBe('stacked');
    expect(result.style.segments[1]).toMatchObject({ italic: true, fill: '#ffffff', outline: '#000000', shadow: '#f28c1e' });
    expect(result.sourceFonts).toEqual(['League Gothic', 'Bangers']);
    expect(state.params.messages[0].content[0]).toEqual({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'AAAA' } });
    expect(state.usage).toEqual([expect.objectContaining({ feature: 'organiser_heading_style', userId: 'admin-1' })]);
  });

  it('returns no style, with a note, for a logo without lettering or a reply that rewords the name', async () => {
    state.reply = { has_lettering: false, segments: [], source_fonts: [] };
    expect(await read()).toMatchObject({ style: null, note: expect.stringContaining('no lettering') });
    state.reply = { has_lettering: true, segments: [seg('Geelong Comic & Toy Fair', 'bangers')], source_fonts: [] };
    expect(await read()).toMatchObject({ style: null, note: expect.stringContaining('couldn’t be matched') });
    expect(state.usage).toHaveLength(2);
  });

  it('throws on a refusal, after recording the usage', async () => {
    state.stop = 'refusal';
    state.reply = {};
    await expect(read()).rejects.toThrow(/declined/);
    expect(state.usage).toHaveLength(1);
  });
});
