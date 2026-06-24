import { vi, describe, it, expect, beforeEach } from 'vitest';

const ctx = vi.hoisted(() => {
  const calls = { resize: vi.fn(), webp: vi.fn(), composite: vi.fn() };
  const toBuffer = vi.fn();
  const metadata = vi.fn();
  const pipeline = {
    resize: (...a) => { calls.resize(...a); return pipeline; },
    png: () => pipeline,
    webp: (...a) => { calls.webp(...a); return pipeline; },
    composite: (...a) => { calls.composite(...a); return pipeline; },
    rotate: () => pipeline,
    metadata, toBuffer,
  };
  const sharp = vi.fn(() => pipeline);
  return { calls, toBuffer, metadata, sharp };
});

vi.mock('sharp', () => ({ default: ctx.sharp }));
vi.mock('../../../src/utils/logger.js', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { compressImage, createSlabImage } from '../../../src/utils/imageProcessor.js';

beforeEach(() => {
  ctx.sharp.mockClear();
  ctx.toBuffer.mockReset();
  ctx.metadata.mockReset();
  Object.values(ctx.calls).forEach((fn) => fn.mockClear());
});

describe('compressImage', () => {
  it('encodes the buffer to webp at the given quality', async () => {
    ctx.toBuffer.mockResolvedValue(Buffer.from('webp-bytes'));
    const out = await compressImage(Buffer.from('in'), 70);
    expect(out).toEqual(Buffer.from('webp-bytes'));
    expect(ctx.calls.webp).toHaveBeenCalledWith({ quality: 70 });
  });

  it('rethrows when sharp fails', async () => {
    ctx.toBuffer.mockRejectedValue(new Error('encode failed'));
    await expect(compressImage(Buffer.from('in'))).rejects.toThrow('encode failed');
  });
});

describe('createSlabImage', () => {
  it('reads metadata, composites the card on the backdrop and returns webp', async () => {
    ctx.metadata.mockResolvedValue({ width: 600, height: 800 });
    ctx.toBuffer.mockResolvedValue(Buffer.from('slab'));

    const out = await createSlabImage(Buffer.from('card'));
    expect(out).toEqual(Buffer.from('slab'));
    expect(ctx.metadata).toHaveBeenCalled();
    expect(ctx.calls.composite).toHaveBeenCalled();
    expect(ctx.calls.webp).toHaveBeenCalledWith({ quality: 85 });
  });

  it('rethrows when processing fails', async () => {
    ctx.metadata.mockResolvedValue({ width: 600, height: 800 });
    ctx.toBuffer.mockRejectedValue(new Error('compose failed'));
    await expect(createSlabImage(Buffer.from('card'))).rejects.toThrow('compose failed');
  });
});
