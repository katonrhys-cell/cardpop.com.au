import { describe, it, expect } from 'vitest';
import {
  AVATAR_MAX_BYTES,
  classifyUploadError,
  describeUploadError,
  checkImageFile,
  SUPPORT_EMAIL,
} from '@/utils/storageUploadError.js';

// Shapes copied from @supabase/storage-js StorageApiError responses.
const rlsError = { name: 'StorageApiError', message: 'new row violates row-level security policy', statusCode: '403', error: 'Unauthorized' };
const sizeError = { name: 'StorageApiError', message: 'The object exceeded the maximum allowed size', statusCode: '413', error: 'Payload too large' };
const mimeError = { name: 'StorageApiError', message: 'mime type text/plain is not supported', statusCode: '415', error: 'invalid_mime_type' };

describe('classifyUploadError', () => {
  it('recognises the storage RLS refusal as a permissions problem, not a size problem', () => {
    expect(classifyUploadError(rlsError)).toBe('not-allowed');
    expect(classifyUploadError({ message: 'new row violates row level security policy for table "objects"' })).toBe('not-allowed');
  });

  it('recognises the bucket size cap', () => {
    expect(classifyUploadError(sizeError)).toBe('too-large');
    expect(classifyUploadError({ status: 413, message: 'x' })).toBe('too-large');
  });

  it('recognises an unsupported MIME type and network failures', () => {
    expect(classifyUploadError(mimeError)).toBe('bad-type');
    expect(classifyUploadError(new TypeError('Failed to fetch'))).toBe('offline');
  });

  it('falls back to generic', () => {
    expect(classifyUploadError(null)).toBe('generic');
    expect(classifyUploadError(new Error('duplicate key value'))).toBe('generic');
  });
});

describe('describeUploadError', () => {
  it('explains the RLS error as a CardPop-side problem and says nothing was saved', () => {
    const d = describeUploadError(rlsError, { what: 'profile photo' });
    expect(d.reason).toBe('not-allowed');
    expect(d.title).toMatch(/profile photo couldn't be saved/i);
    expect(d.message).toMatch(/permissions problem on our side/i);
    expect(d.message).toMatch(/not a problem with your image or its size/i);
    expect(d.message).toMatch(/weren't saved/i);
    expect(d.message).toContain(SUPPORT_EMAIL);
    expect(d.detail).toBe(rlsError.message);
  });

  it('states the size limit and the resized size for a too-large upload', () => {
    const d = describeUploadError(sizeError, { what: 'profile photo', sizeBytes: 6.2 * 1024 * 1024 });
    expect(d.reason).toBe('too-large');
    expect(d.title).toMatch(/too large/i);
    expect(d.message).toContain('5 MB');
    expect(d.message).toContain('6.2 MB');
  });

  it('keeps the raw message as detail for a generic failure', () => {
    const d = describeUploadError(new Error('boom'));
    expect(d.reason).toBe('generic');
    expect(d.detail).toBe('boom');
    expect(d.message).toContain(SUPPORT_EMAIL);
  });
});

describe('checkImageFile', () => {
  it('passes a normal image', () => {
    expect(checkImageFile({ type: 'image/jpeg', size: 300_000 })).toBeNull();
    expect(checkImageFile(null)).toBeNull();
  });

  it('rejects non-images and oversized originals with an explanation', () => {
    expect(checkImageFile({ type: 'application/pdf', size: 1000 }).reason).toBe('bad-type');
    const big = checkImageFile({ type: 'image/png', size: 25 * 1024 * 1024 }, { what: 'profile photo' });
    expect(big.reason).toBe('too-large');
    expect(big.message).toContain('20 MB');
    expect(big.message).toContain('25 MB');
  });

  it('exposes the bucket limit the pages compare the resized file against', () => {
    expect(AVATAR_MAX_BYTES).toBe(5 * 1024 * 1024);
  });
});
