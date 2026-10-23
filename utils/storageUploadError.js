/**
 * Turn a failed Supabase Storage upload (or the profile save around it) into
 * something a person can act on.
 *
 * Supabase's StorageApiError carries a terse server message — "new row
 * violates row-level security policy", "The object exceeded the maximum
 * allowed size" — that, shown raw in a toast, reads like the user did
 * something wrong with their image. This maps each failure to a plain-English
 * title + explanation so the account pages can show it in a dialog the user
 * has to read, instead of a toast that vanishes.
 *
 * Dependency-free so it's trivially unit-tested.
 */

/** `avatars` bucket `file_size_limit` (storage.buckets) — 5 MB. */
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

/** Largest original the page will even try to resize. */
export const AVATAR_MAX_SOURCE_BYTES = 20 * 1024 * 1024;

export const SUPPORT_EMAIL = 'support@cardpop.com.au';

const mb = (bytes) => `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;

function statusOf(err) {
  const raw = err?.statusCode ?? err?.status ?? null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Classify a storage/save error.
 * @returns {'too-large'|'not-allowed'|'bad-type'|'offline'|'generic'}
 */
export function classifyUploadError(err) {
  if (!err) return 'generic';
  const status = statusOf(err);
  const text = `${err.message || ''} ${err.error || ''}`.toLowerCase();

  if (status === 413 || /exceeded the maximum allowed size|payload too large|too large|entity too large/.test(text)) {
    return 'too-large';
  }
  if (status === 415 || /mime type|not supported|invalid_mime|unsupported media/.test(text)) {
    return 'bad-type';
  }
  if (status === 403 || status === 401 || /row-level security|row level security|violates .*policy|unauthorized|not authorized|permission denied/.test(text)) {
    return 'not-allowed';
  }
  if (/failed to fetch|network|load failed|timed? ?out/.test(text)) {
    return 'offline';
  }
  return 'generic';
}

/**
 * Describe why a save failed, for the pop-up.
 *
 * @param {unknown} err                The thrown error (Supabase or plain).
 * @param {object}  [opts]
 * @param {string}  [opts.what]        What was being uploaded — "profile photo", "business logo".
 * @param {number}  [opts.maxBytes]    The bucket's limit, for the size message.
 * @param {number}  [opts.sizeBytes]   The file's size after resizing, if known.
 * @returns {{ reason: string, title: string, message: string, detail: string|null }}
 */
export function describeUploadError(err, { what = 'photo', maxBytes = AVATAR_MAX_BYTES, sizeBytes } = {}) {
  const reason = classifyUploadError(err);
  const detail = err?.message ? String(err.message) : null;
  const sized = Number.isFinite(sizeBytes) ? ` (yours is ${mb(sizeBytes)} after resizing)` : '';

  switch (reason) {
    case 'too-large':
      return {
        reason,
        title: `Your ${what} is too large to save`,
        message:
          `Profile images must be under ${mb(maxBytes)} once they've been resized${sized}. ` +
          `Nothing on this page was saved. Try a smaller or cropped image — a square photo around 400×400 px is ideal.`,
        detail,
      };
    case 'bad-type':
      return {
        reason,
        title: `That file type can't be used as a ${what}`,
        message:
          `Only JPG, PNG, WEBP or GIF images are accepted. Nothing on this page was saved — ` +
          `please choose a different image and try again.`,
        detail,
      };
    case 'not-allowed':
      return {
        reason,
        title: `Your ${what} couldn't be saved`,
        message:
          `CardPop's storage refused the upload ("row-level security policy"). This is a permissions problem on our side, ` +
          `not a problem with your image or its size — and because the upload failed, the rest of your changes on this page ` +
          `weren't saved either. Please try again in a few minutes; if it keeps happening, email ${SUPPORT_EMAIL} and we'll fix it.`,
        detail,
      };
    case 'offline':
      return {
        reason,
        title: `Couldn't reach CardPop`,
        message:
          `The upload didn't get through — check your connection and try saving again. Nothing on this page was saved.`,
        detail,
      };
    default:
      return {
        reason,
        title: `Your changes couldn't be saved`,
        message:
          `Something went wrong while saving. Nothing on this page was saved — please try again, ` +
          `or email ${SUPPORT_EMAIL} if it keeps happening.`,
        detail,
      };
  }
}

/**
 * Pre-flight checks the page can run before any network call. Returns a
 * description (same shape as `describeUploadError`) or null when the file is fine.
 */
export function checkImageFile(file, { what = 'photo', maxSourceBytes = AVATAR_MAX_SOURCE_BYTES } = {}) {
  if (!file) return null;
  if (!/^image\//i.test(file.type || '')) {
    return describeUploadError({ message: 'mime type not supported', statusCode: '415' }, { what });
  }
  if (file.size > maxSourceBytes) {
    return {
      reason: 'too-large',
      title: `Your ${what} is too large`,
      message:
        `Please choose an image under ${mb(maxSourceBytes)} (this one is ${mb(file.size)}). ` +
        `It will be resized to 512 px automatically once it's under that limit.`,
      detail: null,
    };
  }
  return null;
}
