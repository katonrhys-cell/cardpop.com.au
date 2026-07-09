import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Deterministic Supabase origin (https://cdn) so canonicalStorageUrl can map a
// CDN URL back onto it.
vi.mock('@/lib/supabaseClient.js', () => ({
  supabase: {
    storage: {
      from: () => ({
        getPublicUrl: (path) => ({ data: { publicUrl: `https://cdn/object/vault-images/${path}` } }),
      }),
    },
  },
}));

import { installImageCdnFallback } from '@/utils/imageCdnFallback.js';
import { _setCdnHostForTests } from '@/utils/imageUrl.js';

// Fire a capturing error event at an element (jsdom/happy-dom img load errors
// don't fire on their own here, so we dispatch one that reaches the capture
// listener installed on document).
const fireImgError = (img) => {
  img.dispatchEvent(new Event('error', { bubbles: false }));
};

describe('installImageCdnFallback', () => {
  beforeEach(() => {
    _setCdnHostForTests('img.cardpop.com.au');
    document.body.innerHTML = '';
    installImageCdnFallback();
  });

  afterEach(() => {
    _setCdnHostForTests(null);
  });

  it('rewrites a failed CDN image to the Supabase origin and retries once', () => {
    const img = document.createElement('img');
    img.src = 'https://img.cardpop.com.au/storage/v1/object/public/vault-images/u/c.jpg';
    document.body.appendChild(img);

    fireImgError(img);

    expect(img.getAttribute('src')).toBe(
      'https://cdn/storage/v1/object/public/vault-images/u/c.jpg'
    );
    expect(img.dataset.cdnFallbackApplied).toBe('');
  });

  it('drops srcset so the browser cannot re-pick a CDN candidate', () => {
    const img = document.createElement('img');
    img.src = 'https://img.cardpop.com.au/storage/v1/render/image/public/vault-images/u/c.jpg?width=400';
    img.setAttribute(
      'srcset',
      'https://img.cardpop.com.au/storage/v1/render/image/public/vault-images/u/c.jpg?width=240 240w'
    );
    document.body.appendChild(img);

    fireImgError(img);

    expect(img.hasAttribute('srcset')).toBe(false);
    expect(img.getAttribute('src')).toContain('https://cdn/storage/v1/render/image/public/');
  });

  it('does not touch images already on a non-CDN origin', () => {
    const url = 'https://cdn/storage/v1/object/public/vault-images/u/c.jpg';
    const img = document.createElement('img');
    img.src = url;
    document.body.appendChild(img);

    fireImgError(img);

    expect(img.getAttribute('src')).toBe(url);
    expect(img.dataset.cdnFallbackApplied).toBeUndefined();
  });

  it('leaves CardImage-managed images alone (data-managed-image)', () => {
    const img = document.createElement('img');
    img.src = 'https://img.cardpop.com.au/storage/v1/object/public/vault-images/u/c.jpg';
    img.setAttribute('data-managed-image', '');
    document.body.appendChild(img);

    fireImgError(img);

    expect(img.getAttribute('src')).toBe(
      'https://img.cardpop.com.au/storage/v1/object/public/vault-images/u/c.jpg'
    );
  });

  it('only retries once (no infinite loop if the origin also fails)', () => {
    const img = document.createElement('img');
    img.src = 'https://img.cardpop.com.au/storage/v1/object/public/vault-images/u/c.jpg';
    document.body.appendChild(img);

    fireImgError(img);
    const afterFirst = img.getAttribute('src');
    fireImgError(img); // origin also fails — must not rewrite again
    expect(img.getAttribute('src')).toBe(afterFirst);
  });
});
