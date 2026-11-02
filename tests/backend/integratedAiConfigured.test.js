import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../src/utils/supabaseClient.js', () => ({ supabase: {} }));

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

const { stream, streamOneShot, isIntegratedAiConfigured, IntegratedAiNotConfiguredError } =
  await import('../../src/api/integrated-ai.js');

// Production has never set INTEGRATED_AI_API_URL (the Hostinger-era proxy),
// so every call went to `undefined/generate` and came back as a bare 500:
// "Failed to parse URL from undefined/generate" (Vercel, 2026-10-29). The
// module now refuses up front with a 503-shaped error that names the variable.
describe('integrated-ai without INTEGRATED_AI_API_URL', () => {
  const saved = process.env.INTEGRATED_AI_API_URL;
  beforeEach(() => {
    delete process.env.INTEGRATED_AI_API_URL;
    fetchMock.mockReset();
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.INTEGRATED_AI_API_URL;
    else process.env.INTEGRATED_AI_API_URL = saved;
  });

  it('reports the proxy as not configured', () => {
    expect(isIntegratedAiConfigured()).toBe(false);
    process.env.INTEGRATED_AI_API_URL = 'https://ai.example.test';
    expect(isIntegratedAiConfigured()).toBe(true);
  });

  it('streamOneShot rejects with a 503 error and never calls fetch', async () => {
    await expect(streamOneShot({ systemPrompt: 'x', userMessage: [] }))
      .rejects.toBeInstanceOf(IntegratedAiNotConfiguredError);
    await expect(streamOneShot({ systemPrompt: 'x', userMessage: [] }))
      .rejects.toMatchObject({ status: 503, message: expect.stringContaining('INTEGRATED_AI_API_URL') });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('stream rejects before touching conversation history or fetch', async () => {
    await expect(stream({ userId: 'u1', systemPrompt: 'x', userMessage: [] }))
      .rejects.toMatchObject({ status: 503 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
