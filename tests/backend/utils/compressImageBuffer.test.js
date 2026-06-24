import { vi, describe, it, expect, beforeEach } from 'vitest';

// Single hoisted context so the sharp mock's pipeline is stable across tests
// (clearAllMocks would otherwise wipe the mock's return value).
const ctx = vi.hoisted(() => {
  const calls = { jpeg: vi.fn(), png: vi.fn(), webp: vi.fn(), resize: vi.fn() };
  const toBuffer = vi.fn();
  const pipeline = {
    rotate: () => pipeline,
    resize: (...a) => { calls.resize(...a); return pipeline; },
    jpeg: (...a) => { calls.jpeg(...a); return pipeline; },
    png: (...a) => { calls.png(...a); return pipeline; },
    webp: (...a) => { calls.webp(...a); return pipeline; },
    toBuffer,
  };
  const sharp = vi.fn(() => pipeline);
  return { calls, toBuffer, sharp };
});

vi.mock('sharp', () => ({ default: ctx.sharp }));
vi.mock('../../../src/utils/logger.js', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { compressImageBuffer } from '../../../src/utils/compressImageBuffer.js';

const bigBuffer = (n = 200000) => Buffer.alloc(n, 1);

beforeEach(() => {
  ctx.sharp.mockClear();
  ctx.toBuffer.mockReset();
  Object.values(ctx.calls).forEach((fn) => fn.mockClear());
});

describe('compressImageBuffer', () => {
  it('returns the original for an unsupported mime type', async () => {
    const buf = bigBuffer();
    const out = await compressImageBuffer(buf, 'image/gif');
    expect(out).toEqual({ buffer: buf, contentType: 'image/gif' });
    expect(ctx.sharp).not.toHaveBeenCalled();
  });

  it('returns the original when the buffer is below the size threshold', async () => {
    const buf = Buffer.alloc(1000, 1);
    const out = await compressImageBuffer(buf, 'image/jpeg');
    expect(out.buffer).toBe(buf);
    expect(ctx.sharp).not.toHaveBeenCalled();
  });

  it('returns the original for a non-buffer input', async () => {
    const out = await compressImageBuffer('not-a-buffer', 'image/jpeg');
    expect(out.buffer).toBe('not-a-buffer');
  });

  it('re-encodes a JPEG when it saves meaningful space', async () => {
    const buf = bigBuffer(200000);
    ctx.toBuffer.mockResolvedValue(Buffer.alloc(100000, 2)); // 50% smaller
    const out = await compressImageBuffer(buf, 'image/jpeg');
    expect(out.buffer.length).toBe(100000);
    expect(ctx.calls.jpeg).toHaveBeenCalledWith(expect.objectContaining({ mozjpeg: true }));
  });

  it('uses the png encoder for PNGs', async () => {
    ctx.toBuffer.mockResolvedValue(Buffer.alloc(50000, 2));
    await compressImageBuffer(bigBuffer(), 'image/png');
    expect(ctx.calls.png).toHaveBeenCalled();
    expect(ctx.calls.jpeg).not.toHaveBeenCalled();
  });

  it('uses the webp encoder for WebP', async () => {
    ctx.toBuffer.mockResolvedValue(Buffer.alloc(50000, 2));
    await compressImageBuffer(bigBuffer(), 'image/webp');
    expect(ctx.calls.webp).toHaveBeenCalled();
  });

  it('keeps the original when compression does not save enough', async () => {
    const buf = bigBuffer(200000);
    ctx.toBuffer.mockResolvedValue(Buffer.alloc(195000, 2)); // only ~2.5% smaller
    const out = await compressImageBuffer(buf, 'image/jpeg');
    expect(out.buffer).toBe(buf);
  });

  it('falls back to the original when sharp throws', async () => {
    const buf = bigBuffer();
    ctx.toBuffer.mockRejectedValue(new Error('decode failed'));
    const out = await compressImageBuffer(buf, 'image/jpeg');
    expect(out).toEqual({ buffer: buf, contentType: 'image/jpeg' });
  });
});
