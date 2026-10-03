import { describe, it, expect } from 'vitest';
import {
  CARD_VIDEO_MAX_BYTES, hasVideoExtension, videoPosterPath, videoDurationError, videoFileError,
} from '@/utils/cardVideo.js';

describe('cardVideo helpers', () => {
  it('derives the poster path next to the video', () => {
    expect(videoPosterPath('u/123-video.mp4')).toBe('u/123-video.poster.jpg');
  });

  it('recognises video extensions case-insensitively', () => {
    expect(hasVideoExtension('u/a.MOV')).toBe(true);
    expect(hasVideoExtension('u/a.html')).toBe(false);
    expect(hasVideoExtension(null)).toBe(false);
  });

  it('allows up to 10s (with phone tolerance) and rejects longer or unreadable clips', () => {
    expect(videoDurationError(10)).toBeNull();
    expect(videoDurationError(10.2)).toBeNull();
    expect(videoDurationError(14.4)).toMatch(/10 seconds/);
    expect(videoDurationError(NaN)).toMatch(/Could not read/);
    expect(videoDurationError(0)).toMatch(/Could not read/);
  });

  it('rejects wrong types and oversize files', () => {
    expect(videoFileError({ type: 'video/mp4', size: 1000, name: 'a.mp4' })).toBeNull();
    expect(videoFileError({ type: 'image/png', size: 1000, name: 'a.png' })).toMatch(/MP4/);
    expect(videoFileError({ type: 'video/mp4', size: CARD_VIDEO_MAX_BYTES + 1, name: 'a.mp4' })).toMatch(/under/);
  });
});
