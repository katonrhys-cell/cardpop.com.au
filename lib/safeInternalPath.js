// Accept a redirect target only when it is a plain path inside this app:
// starts with a single "/", never "//" (protocol-relative → open redirect),
// no scheme, no backslash tricks. Anything else → null, so callers fall back
// to their own default instead of sending the visitor off-site.
export function safeInternalPath(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!v.startsWith('/') || v.startsWith('//') || v.startsWith('/\\')) return null;
  if (/[\s<>]/.test(v)) return null;
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(v)) return null;
  return v;
}
