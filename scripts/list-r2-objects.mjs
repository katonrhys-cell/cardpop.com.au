#!/usr/bin/env node
/**
 * List objects in the `cardpop-images` Cloudflare R2 bucket.
 *
 * R2 is the image store behind img.cardpop.com.au (see docs/image-cdn.md). It
 * speaks the S3 API, but it is NOT Amazon S3 — there is no `cardpop-images`
 * bucket in AWS, so the aws CLI pointed at Amazon returns NoSuchBucket. The
 * endpoint is always:
 *
 *   https://<CLOUDFLARE_ACCOUNT_ID>.r2.cloudflarestorage.com/<bucket>
 *
 * Requests are signed with SigV4 (region "auto"). Signing is hand-rolled here
 * with node:crypto rather than pulling in @aws-sdk/client-s3 — the repo has no
 * AWS SDK dependency and this script is the only thing that needs one.
 *
 * Environment:
 *   CLOUDFLARE_ACCOUNT_ID     Cloudflare account id (R2 → any bucket → S3 API)
 *   R2_ACCESS_KEY_ID          R2 API token access key id  (Object Read is enough)
 *   R2_SECRET_ACCESS_KEY      R2 API token secret access key
 *   R2_BUCKET                 optional, defaults to `cardpop-images`
 *
 * Usage:
 *   node scripts/list-r2-objects.mjs                          # whole bucket
 *   node scripts/list-r2-objects.mjs "palms off gaming/"      # one prefix
 *   node scripts/list-r2-objects.mjs "palms off gaming/binders/" --json
 *
 * `--json` emits {key, size, lastModified, url} records so other scripts can
 * consume the listing; the default output is a human-readable tree.
 */
import crypto from 'node:crypto';

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const ACCESS_KEY = process.env.R2_ACCESS_KEY_ID;
const SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY;
const BUCKET = process.env.R2_BUCKET || 'cardpop-images';

// Public read path for an R2 object, via the image Worker. The Worker keys R2
// by the path after /storage/v1/object/public/, so the object key maps 1:1 —
// see cloudflare/image-proxy-worker.js.
const PUBLIC_PREFIX = 'https://img.cardpop.com.au/storage/v1/object/public/';

const sha256Hex = (data) => crypto.createHash('sha256').update(data).digest('hex');
const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();

// S3 canonical URIs percent-encode every segment, but NOT the "/" separators —
// and unlike encodeURIComponent they also encode "!'()*". Object keys here
// contain spaces ("palms off gaming/"), so getting this exactly right is what
// makes the signature match.
const encodeSegment = (segment) =>
  encodeURIComponent(segment).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
const encodePath = (path) => path.split('/').map(encodeSegment).join('/');

function signedHeaders({ method, host, path, query, payloadHash, now }) {
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const region = 'auto';
  const service = 's3';
  const scope = `${dateStamp}/${region}/${service}/aws4_request`;

  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaderNames = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = [
    method,
    path,
    query,
    canonicalHeaders,
    signedHeaderNames,
    payloadHash,
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const signingKey = ['aws4_request'].reduce(
    (key, step) => hmac(key, step),
    hmac(hmac(hmac(`AWS4${SECRET_KEY}`, dateStamp), region), service),
  );
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

  return {
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
    authorization: `AWS4-HMAC-SHA256 Credential=${ACCESS_KEY}/${scope}, SignedHeaders=${signedHeaderNames}, Signature=${signature}`,
  };
}

// Minimal XML field readers — ListObjectsV2 returns a flat, predictable shape,
// so a full XML parser would be a dependency for no benefit.
const textBetween = (xml, tag) => {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return match ? match[1] : null;
};
const unescapeXml = (str = '') => str
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'")
  .replace(/&amp;/g, '&');

async function listPrefix(prefix) {
  const host = `${ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const payloadHash = sha256Hex('');
  const objects = [];
  let token = null;

  do {
    // Query params must be sorted by key for the canonical request.
    const params = new URLSearchParams({ 'list-type': '2', 'max-keys': '1000' });
    if (prefix) params.set('prefix', prefix);
    if (token) params.set('continuation-token', token);
    const query = [...params.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${encodeSegment(k)}=${encodeSegment(v)}`)
      .join('&');

    const path = `/${encodeSegment(BUCKET)}`;
    const headers = signedHeaders({
      method: 'GET', host, path, query, payloadHash, now: new Date(),
    });

    const res = await fetch(`https://${host}${path}?${query}`, { headers });
    const body = await res.text();
    if (!res.ok) {
      throw new Error(`R2 list failed (${res.status}): ${textBetween(body, 'Message') || body.slice(0, 300)}`);
    }

    for (const chunk of body.split('<Contents>').slice(1)) {
      const key = unescapeXml(textBetween(chunk, 'Key') || '');
      if (!key || key.endsWith('/')) continue; // skip folder placeholder objects
      objects.push({
        key,
        size: Number(textBetween(chunk, 'Size') || 0),
        lastModified: textBetween(chunk, 'LastModified'),
        url: PUBLIC_PREFIX + encodePath(key),
      });
    }

    token = textBetween(body, 'IsTruncated') === 'true'
      ? unescapeXml(textBetween(body, 'NextContinuationToken') || '')
      : null;
  } while (token);

  return objects.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

async function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const prefix = args.find((a) => !a.startsWith('--')) || '';

  const missing = [
    !ACCOUNT_ID && 'CLOUDFLARE_ACCOUNT_ID',
    !ACCESS_KEY && 'R2_ACCESS_KEY_ID',
    !SECRET_KEY && 'R2_SECRET_ACCESS_KEY',
  ].filter(Boolean);
  if (missing.length > 0) {
    console.error(`Missing environment variable(s): ${missing.join(', ')}`);
    console.error('Create an R2 API token (Cloudflare → R2 → Manage API tokens → Object Read)');
    console.error('and read the account id from R2 → any bucket → Settings → S3 API.');
    process.exit(1);
  }

  const objects = await listPrefix(prefix);

  if (asJson) {
    console.log(JSON.stringify(objects, null, 2));
    return;
  }

  if (objects.length === 0) {
    console.log(`No objects under "${prefix}" in r2://${BUCKET}`);
    return;
  }

  // Group by the object's folder so a listing reads like a directory tree.
  const byFolder = new Map();
  for (const obj of objects) {
    const cut = obj.key.lastIndexOf('/');
    const folder = cut === -1 ? '(root)' : obj.key.slice(0, cut);
    if (!byFolder.has(folder)) byFolder.set(folder, []);
    byFolder.get(folder).push(obj);
  }

  for (const [folder, items] of byFolder) {
    console.log(`\n${folder}/  (${items.length})`);
    for (const item of items) {
      const kb = (item.size / 1024).toFixed(0).padStart(6);
      console.log(`  ${kb} KB  ${item.key.slice(folder.length + 1)}`);
    }
  }
  console.log(`\n${objects.length} object(s) in r2://${BUCKET}${prefix ? `/${prefix}` : ''}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
