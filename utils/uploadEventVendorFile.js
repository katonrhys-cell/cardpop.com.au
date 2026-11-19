// Upload a vendor document (trader pack PDF, floor plan, vendor FAQ sheet)
// into the `events` bucket and return its public URL.
//
// Path: vendor-info/<uuid>.<ext>. Deliberately NOT a Date.now()-stamped name —
// the events bucket infers a 480 px `.thumb.webp` companion from a timestamped
// filename (utils/imageUrl.js) and these files have none. A random UUID keeps
// the path immutable/unique (never overwrite a stored object; docs/image-cdn.md).
// PDFs go up untouched; images are compressed like any event photo.
import { supabase } from '@/lib/supabaseClient.js';
import { compressImage } from '@/utils/compressImage.js';
import { EVENT_IMAGE_TYPES, EVENT_IMAGE_MAX_BYTES } from '@/utils/eventFormValidation.js';

const BUCKET = 'events';
export const VENDOR_FILE_TYPES = ['application/pdf', ...EVENT_IMAGE_TYPES];
export const VENDOR_FILE_ACCEPT = ['.pdf', ...VENDOR_FILE_TYPES].join(',');

const isPdfFile = (file) => String(file?.type || '').toLowerCase() === 'application/pdf'
  || /\.pdf$/i.test(file?.name || '');

/** Why a picked vendor document can't be used, or null when it's fine. */
export function vendorFileError(file) {
  if (!file) return 'No file was selected.';
  const type = String(file.type || '').toLowerCase();
  if (/hei[cf]/.test(type) || /\.(heic|heif)$/i.test(file.name || '')) {
    return 'iPhone HEIC photos can’t be uploaded yet — please save it as a JPG or PNG and try again.';
  }
  if (!isPdfFile(file) && !EVENT_IMAGE_TYPES.includes(type)) return 'Please choose a PDF, or a JPG, PNG, WebP or GIF image.';
  if (file.size > EVENT_IMAGE_MAX_BYTES) return 'That file is over 20MB — please choose a smaller one.';
  return null;
}

function randomId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function uploadEventVendorFile(file) {
  const problem = vendorFileError(file);
  if (problem) throw new Error(problem);

  const pdf = isPdfFile(file);
  const upload = pdf ? file : await compressImage(file);
  const ext = pdf ? 'pdf' : ((upload.name.split('.').pop() || 'jpg').toLowerCase());
  const path = `vendor-info/${randomId()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, upload, {
    cacheControl: '31536000',
    contentType: pdf ? 'application/pdf' : (upload.type || file.type),
  });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export default uploadEventVendorFile;
