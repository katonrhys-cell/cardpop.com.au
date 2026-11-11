import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import * as Sentry from '@sentry/node';
import {
  aiTracesSampler,
  chatRequestAttributes,
  chatResponseAttributes,
  usageAttributes,
  toGenAiMessages,
  traceAiAgent,
  traceChat,
  traceMessagesCreate,
  recordChatResponse,
  withAiConversation,
  setAiConversationId,
  markAgentFailed,
  flushAfterResponse,
  PHOTO_PLACEHOLDER,
  MAX_RECORDED_CHARS,
} from '../../src/utils/aiTracing.js';

const PHOTO_BYTES = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const photoBlock = { type: 'image', source: { type: 'base64', media_type: 'image/png', data: PHOTO_BYTES } };

describe('message shaping', () => {
  it('records text and replaces photos with a placeholder, never the bytes', () => {
    const messages = toGenAiMessages([{ role: 'user', content: [{ type: 'text', text: 'Read this card' }, photoBlock, photoBlock] }]);
    expect(messages).toEqual([{ role: 'user', parts: [
      { type: 'text', content: 'Read this card' },
      { type: 'text', content: PHOTO_PLACEHOLDER },
      { type: 'text', content: PHOTO_PLACEHOLDER },
    ] }]);
    expect(JSON.stringify(messages)).not.toContain(PHOTO_BYTES);
  });

  it('accepts string content and clips very long text', () => {
    const [m] = toGenAiMessages([{ role: 'user', content: 'x'.repeat(MAX_RECORDED_CHARS + 50) }]);
    expect(m.parts[0].content.startsWith('x'.repeat(MAX_RECORDED_CHARS))).toBe(true);
    expect(m.parts[0].content).toContain('50 more characters not recorded');
  });

  it('maps thinking to reasoning and web search to tool call / response', () => {
    const attrs = chatResponseAttributes({
      model: 'claude-sonnet-5-5',
      content: [
        { type: 'thinking', thinking: 'Let me look.' },
        { type: 'server_tool_use', id: 'srv_1', name: 'web_search', input: { query: 'card shows' } },
        { type: 'web_search_tool_result', tool_use_id: 'srv_1', content: [{ type: 'web_search_result', title: 'Show', url: 'https://example.com', encrypted_content: 'zzz' }] },
        { type: 'text', text: 'Found one.' },
      ],
    }, { recordContent: true });
    const [out] = JSON.parse(attrs['gen_ai.output.messages']);
    expect(out.parts.map((p) => p.type)).toEqual(['reasoning', 'tool_call', 'tool_call_response', 'text']);
    expect(out.parts[2].result).toContain('https://example.com');
    expect(out.parts[2].result).not.toContain('zzz');
  });

  it('counts cache reads/writes inside the input total', () => {
    expect(usageAttributes({ input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 100, cache_creation_input_tokens: 20 })).toEqual({
      'gen_ai.usage.input_tokens': 130,
      'gen_ai.usage.output_tokens': 5,
      'gen_ai.usage.total_tokens': 135,
      'gen_ai.usage.cache_read.input_tokens': 100,
      'gen_ai.usage.cache_creation.input_tokens': 20,
    });
  });

  it('leaves prompts and replies out when content recording is off', () => {
    const req = chatRequestAttributes({ model: 'm', system: 'sys', messages: [{ role: 'user', content: 'hi' }], recordContent: false });
    expect(req['gen_ai.input.messages']).toBeUndefined();
    expect(req['gen_ai.system_instructions']).toBeUndefined();
    const res = chatResponseAttributes({ model: 'm', content: [{ type: 'text', text: 'reply' }], usage: { input_tokens: 1, output_tokens: 1 } }, { recordContent: false });
    expect(res['gen_ai.output.messages']).toBeUndefined();
    expect(res['gen_ai.usage.output_tokens']).toBe(1);
  });
});

describe('aiTracesSampler', () => {
  it('keeps AI operations and leaves everything else to the base rate', () => {
    expect(aiTracesSampler({ name: 'invoke_agent Card identifier', attributes: {} })).toBe(1);
    expect(aiTracesSampler({ name: 'x', attributes: { 'sentry.op': 'gen_ai.chat' } })).toBe(1);
    expect(aiTracesSampler({ name: 'GET /api/listings', attributes: {}, inheritOrSampleWith: (r) => r })).toBe(0);
    expect(aiTracesSampler({ name: 'GET /api/listings', attributes: {}, inheritOrSampleWith: () => 1 })).toBe(1);
  });
});

describe('spans sent to Sentry', () => {
  const sent = [];
  const transport = () => ({
    send: async (envelope) => {
      for (const [header, item] of envelope[1]) if (header.type === 'transaction') sent.push(item);
      return {};
    },
    flush: async () => true,
  });

  beforeAll(() => {
    Sentry.init({
      dsn: 'https://public@o0.ingest.sentry.io/0',
      transport,
      tracesSampler: aiTracesSampler,
      dataCollection: { genAI: { inputs: true, outputs: true } },
      // The production defaults, which include the ConversationId integration.
    });
  });
  afterAll(async () => { await Sentry.close(); });
  beforeEach(() => { sent.length = 0; });

  const reply = {
    id: 'msg_1',
    model: 'claude-haiku-5-5',
    stop_reason: 'end_turn',
    usage: { input_tokens: 40, output_tokens: 12, cache_read_input_tokens: 0 },
    content: [{ type: 'text', text: '{"name":"Charizard"}' }],
  };

  it('nests a chat span under the agent span, tagged with the conversation and member id', async () => {
    await withAiConversation({ conversationId: 'blog-topic-7', userId: 'user-123' }, () => traceAiAgent('Card identifier', () => traceChat(
      { model: 'claude-haiku-5-5', system: 'You read cards.', messages: [{ role: 'user', content: [{ type: 'text', text: 'Read it' }, photoBlock] }], maxTokens: 1500 },
      async (span) => { recordChatResponse(span, reply); return 'ok'; },
    )));
    await Sentry.flush(1000);

    expect(sent).toHaveLength(1);
    const tx = sent[0];
    expect(tx.transaction).toBe('invoke_agent Card identifier');
    expect(tx.contexts.trace.op).toBe('gen_ai.invoke_agent');
    expect(tx.contexts.trace.data['gen_ai.conversation.id']).toBe('blog-topic-7');
    expect(tx.user).toEqual({ id: 'user-123' });

    const chat = tx.spans.find((s) => s.op === 'gen_ai.chat');
    expect(chat.description).toBe('chat claude-haiku-5-5');
    expect(chat.data).toMatchObject({
      'gen_ai.operation.name': 'chat',
      'gen_ai.provider.name': 'anthropic',
      'gen_ai.request.model': 'claude-haiku-5-5',
      'gen_ai.response.model': 'claude-haiku-5-5',
      'gen_ai.usage.input_tokens': 40,
      'gen_ai.usage.output_tokens': 12,
      'gen_ai.conversation.id': 'blog-topic-7',
    });
    expect(JSON.parse(chat.data['gen_ai.output.messages'])[0].parts[0].content).toBe('{"name":"Charizard"}');
    expect(JSON.stringify(sent)).not.toContain(PHOTO_BYTES);
  });

  it('starts its own trace under an unsampled request span instead of being dropped with it', async () => {
    await Sentry.startSpan({ name: 'GET /api/card-ocr', forceTransaction: true }, () => traceMessagesCreate(
      'Supplier price reader',
      { model: 'claude-haiku-5-5', max_tokens: 2000, messages: [{ role: 'user', content: 'Page text' }] },
      async () => reply,
    ));
    await Sentry.flush(1000);
    expect(sent.map((t) => t.transaction)).toEqual(['invoke_agent Supplier price reader']);
    expect(sent[0].spans.map((s) => s.op)).toEqual(['gen_ai.chat']);
  });

  it('marks a failed model call as an error and rethrows', async () => {
    await expect(traceAiAgent('Grade estimator', () => traceChat({ model: 'claude-sonnet-5-5', messages: [] }, async () => {
      throw new Error('Anthropic API error 529: overloaded');
    }))).rejects.toThrow('529');
    await Sentry.flush(1000);
    const chat = sent[0].spans.find((s) => s.op === 'gen_ai.chat');
    expect(chat.status).not.toBe('ok');
    expect(chat.data['error.type']).toBe('Error');
  });

  it('keeps a conversation id set part-way through a job inside that job', async () => {
    await withAiConversation({}, async () => {
      setAiConversationId('event-scan-42');
      await traceAiAgent('Event extractor', async () => 'done');
    });
    await traceAiAgent('Event extractor', async () => 'done');
    await Sentry.flush(1000);
    expect(sent).toHaveLength(2);
    expect(sent[0].contexts.trace.data['gen_ai.conversation.id']).toBe('event-scan-42');
    expect(sent[1].contexts.trace.data['gen_ai.conversation.id']).toBeUndefined();
  });

  it('marks the agent run failed when a caller turns an API error into a return value', async () => {
    await traceAiAgent('Listing description writer', (agentSpan) => traceChat({ model: 'claude-haiku-5-5', messages: [] }, async (span) => {
      markAgentFailed(span, 'http_529');
      markAgentFailed(agentSpan, 'http_529');
      return { data: null };
    }));
    await Sentry.flush(1000);
    expect(sent[0].contexts.trace.status).not.toBe('ok');
    expect(sent[0].contexts.trace.data['error.type']).toBe('http_529');
  });
});

describe('flushAfterResponse', () => {
  const key = Symbol.for('@vercel/request-context');
  afterAll(() => { vi.unstubAllEnvs(); delete globalThis[key]; });

  it('hands the flush to Vercel waitUntil instead of making the request wait', () => {
    vi.stubEnv('VERCEL', '1');
    const waitUntil = vi.fn();
    globalThis[key] = { get: () => ({ waitUntil }) };
    expect(flushAfterResponse()).toBeUndefined();
    expect(waitUntil).toHaveBeenCalledTimes(1);
    expect(typeof waitUntil.mock.calls[0][0].then).toBe('function');
  });

  it('does nothing off Vercel', () => {
    vi.stubEnv('VERCEL', '');
    const waitUntil = vi.fn();
    globalThis[key] = { get: () => ({ waitUntil }) };
    flushAfterResponse();
    expect(waitUntil).not.toHaveBeenCalled();
  });
});

