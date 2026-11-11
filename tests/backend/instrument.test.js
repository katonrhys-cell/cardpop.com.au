import { describe, it, expect } from 'vitest';
import * as Sentry from '@sentry/node';
import { scrubSentryTransaction } from '../../src/instrument.js';

describe('src/instrument.js', () => {
  it('keeps the SDK on its sendDefaultPii:false data-collection defaults', () => {
    // Passing any `dataCollection` object to Sentry.init swaps the PII-off
    // defaults for the full-collection ones (user info, headers, bodies).
    const options = Sentry.getClient().getOptions();
    expect(options.dataCollection).toBeUndefined();
    expect(options.sendDefaultPii).toBe(false);
    const dc = Sentry.getClient().getDataCollectionOptions();
    expect(dc.userInfo).toBe(false);
    expect(dc.httpBodies).toEqual([]);
    expect(dc.cookies).not.toBe(true);
    expect(dc.httpHeaders.request).not.toBe(true);
  });
});

describe('scrubSentryTransaction', () => {
  it('redacts secret-shaped keys outside the root span data and keeps the token counts', () => {
    const event = scrubSentryTransaction({
      request: { data: '{"password":"x"}', headers: { authorization: 'Bearer y', 'user-agent': 'ua' } },
      extra: { apiKey: 'k', note: 'ok' },
      contexts: {
        trace: { data: { 'gen_ai.usage.input_tokens': 40, 'gen_ai.usage.output_tokens': 12 } },
        custom: { access_token: 't', fine: 1 },
      },
      user: { id: 'u1', email: 'a@b.c', ip_address: '1.2.3.4' },
    });
    expect(event.request.data).toBeUndefined();
    expect(event.request.headers).toEqual({ 'user-agent': 'ua' });
    expect(event.extra).toEqual({ apiKey: '[Filtered]', note: 'ok' });
    expect(event.contexts.custom).toEqual({ access_token: '[Filtered]', fine: 1 });
    expect(event.contexts.trace.data['gen_ai.usage.input_tokens']).toBe(40);
    expect(event.user).toEqual({ id: 'u1' });
  });
});
