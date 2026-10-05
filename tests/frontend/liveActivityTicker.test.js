import { describe, it, expect } from 'vitest';
import { tickerImageUrl } from '@/components/LiveActivityTicker.jsx';
import { THUMBNAILS_SINCE, THUMB_SUFFIX } from '@/utils/imageUrl.js';

// The live strip shows cards at 36×48 px; it must serve the 480 px companion
// thumbnail when one exists rather than the full upload.

describe('tickerImageUrl', () => {
  it('uses the companion thumbnail for uploads that have one', () => {
    const ts = THUMBNAILS_SINCE + 1000;
    const url = tickerImageUrl({ card_image: `user/${ts}.webp` });
    expect(url).toContain(`user/${ts}${THUMB_SUFFIX}`);
  });

  it('falls back to the full image for older uploads', () => {
    const ts = THUMBNAILS_SINCE - 1000;
    const url = tickerImageUrl({ card_image: `user/${ts}.jpg` });
    expect(url).toContain(`user/${ts}.jpg`);
    expect(url).not.toContain(THUMB_SUFFIX);
  });

  it('prefers card_image, then the first vault image, then nothing', () => {
    const ts = THUMBNAILS_SINCE + 5000;
    expect(tickerImageUrl({ vault_images: [{ storage_path: `u/${ts}.webp` }] })).toContain(`u/${ts}${THUMB_SUFFIX}`);
    expect(tickerImageUrl({})).toBeNull();
    expect(tickerImageUrl(null)).toBeNull();
  });
});
