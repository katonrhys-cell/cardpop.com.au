import { canonicalStorageUrl } from '@/utils/imageUrl.js';

// Global safety net for an image-CDN outage.
//
// Card photos, avatars and product images are served through the optional image
// CDN (img.cardpop.com.au — see utils/imageUrl.js and docs/image-cdn.md) so
// repeat traffic is absorbed by Cloudflare instead of the metered Supabase
// egress quota. But if that CDN host ever fails to serve an object (a
// worker/route misconfiguration, an edge incident), EVERY image built through
// it errors at once and the site shows broken thumbnails — even though the
// underlying object is still perfectly readable straight from Supabase Storage.
//
// This installs a single capture-phase `error` listener that, the first time an
// <img> served from the CDN host fails to load, rewrites its src back to the
// canonical Supabase origin and lets the browser retry. One handler covers
// every raw <img> on the site, so a CDN outage self-heals without a per-call-
// site onError handler. CardImage runs its own richer multi-tier fallback and
// opts out via `data-managed-image`.
let installed = false;

export function installImageCdnFallback() {
  if (typeof document === 'undefined' || installed) return;
  installed = true;

  document.addEventListener(
    'error',
    (event) => {
      const el = event.target;
      // `error` fires for many element types; only <img> loads concern us.
      if (!el || el.tagName !== 'IMG') return;
      if (el.dataset.managedImage !== undefined) return; // CardImage self-manages
      if (el.dataset.cdnFallbackApplied !== undefined) return; // retried already

      const current = el.currentSrc || el.src;
      const canonical = canonicalStorageUrl(current);
      // Unchanged means it wasn't a CDN storage URL — nothing we can recover.
      if (!canonical || canonical === current) return;

      el.dataset.cdnFallbackApplied = '';
      // Drop any srcset so the browser can't just re-pick another CDN candidate.
      if (el.hasAttribute('srcset')) el.removeAttribute('srcset');
      el.src = canonical;
    },
    true, // capture — <img> error events don't bubble
  );
}
