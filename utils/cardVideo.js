// One optional short video per vault card, shown beside the photos on the
// listing. Shared by the Add/Edit form, the listing carousel and the server
// validator (src/utils/vaultItemInput.js), so the limits live in one place.

export const CARD_VIDEO_MAX_SECONDS = 10;
// Phones routinely stop a "10 second" recording a few frames over the mark.
export const CARD_VIDEO_DURATION_TOLERANCE = 0.3;
// Matches the vault-images bucket's per-object cap.
export const CARD_VIDEO_MAX_BYTES = 20 * 1024 * 1024;
export const CARD_VIDEO_ACCEPT = 'video/mp4,video/webm,video/quicktime';
export const CARD_VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov', 'm4v'];

/** True when a storage path/filename carries an accepted video extension. */
export const hasVideoExtension = (path) => {
  const m = typeof path === 'string' ? path.match(/\.([a-z0-9]+)$/i) : null;
  return !!m && CARD_VIDEO_EXTENSIONS.includes(m[1].toLowerCase());
};

/** Storage path of the poster frame for a video storage path. */
export const videoPosterPath = (path) => path.replace(/\.[^./]+$/, '') + '.poster.jpg';

/** Pure check on a duration in seconds → error message, or null when fine. */
export const videoDurationError = (seconds) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'Could not read that video — try an MP4 or MOV from your phone.';
  if (seconds > CARD_VIDEO_MAX_SECONDS + CARD_VIDEO_DURATION_TOLERANCE) {
    return `Video must be ${CARD_VIDEO_MAX_SECONDS} seconds or shorter (yours is ${Math.round(seconds)}s).`;
  }
  return null;
};

/** Pure check on the picked File (type + size) → error message, or null. */
export const videoFileError = (file) => {
  if (!file) return 'No video selected.';
  const typeOk = /^video\/(mp4|webm|quicktime)$/i.test(file.type) || (!file.type && hasVideoExtension(file.name));
  if (!typeOk) return 'Video must be an MP4, MOV or WebM file.';
  if (file.size > CARD_VIDEO_MAX_BYTES) {
    return `Video must be under ${Math.round(CARD_VIDEO_MAX_BYTES / 1048576)}MB — record at 1080p or lower.`;
  }
  return null;
};

// Load a File into a detached <video> long enough to read metadata / a frame.
const withVideo = (file, run) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    const done = (fn, value) => { URL.revokeObjectURL(url); fn(value); };
    video.onerror = () => done(reject, new Error('Could not read that video.'));
    video.onloadedmetadata = () => {
      Promise.resolve(run(video)).then((v) => done(resolve, v), (e) => done(reject, e));
    };
    video.src = url;
  });

/** Duration of a video File in seconds (rejects if the browser can't decode it). */
export const readVideoDuration = (file) => withVideo(file, (video) => video.duration);

/**
 * Grab a JPEG poster frame (≈0.5s in, ≤480px wide) from a video File. Resolves
 * null rather than rejecting — the poster is cosmetic, so a failed capture must
 * never block the upload (the player falls back to the video's own first frame).
 */
export const captureVideoPoster = (file) =>
  withVideo(file, (video) => new Promise((resolve) => {
    video.onseeked = () => {
      try {
        const scale = Math.min(1, 480 / (video.videoWidth || 480));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.75);
      } catch {
        resolve(null);
      }
    };
    video.currentTime = Math.min(0.5, (video.duration || 1) / 2);
  })).catch(() => null);
