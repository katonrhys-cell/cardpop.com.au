import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { uploadFiles } from '../../../src/middleware/file-upload.js';

// Real magic-byte fixtures — enough header for file-type to identify the format
// A complete, valid 1×1 transparent PNG (file-type parses PNG chunk structure)
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]);
const GIF = Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(64)]);
const WEBP = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0x40, 0x00, 0x00, 0x00]),
  Buffer.from('WEBP'),
  Buffer.from('VP8 '),
  Buffer.alloc(64),
]);
const TEXT = Buffer.from('#!/bin/sh\necho not an image\n');

const CARD_OCR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function makeApp(options = {}) {
  const app = express();
  app.post(
    '/upload',
    uploadFiles({ allowedMimeTypes: CARD_OCR_TYPES, fieldName: 'images', ...options }),
    (req, res) => {
      res.json({
        files: (req.files ?? []).map(f => ({
          name: f.originalname,
          mimetype: f.mimetype,
          detectedExt: f.detectedExt,
        })),
      });
    },
  );
  app.use((err, _req, res, _next) => {
    res.status(err.name === 'MulterError' ? 400 : 500).json({ error: err.message });
  });
  return app;
}

describe('uploadFiles middleware (real multer + magic-byte validation)', () => {
  it('accepts a genuine PNG', async () => {
    const res = await request(makeApp())
      .post('/upload')
      .attach('images', PNG, { filename: 'card.png', contentType: 'image/png' });

    expect(res.status).toBe(200);
    expect(res.body.files).toEqual([
      { name: 'card.png', mimetype: 'image/png', detectedExt: 'png' },
    ]);
  });

  it('accepts a genuine JPEG and WebP together', async () => {
    const res = await request(makeApp())
      .post('/upload')
      .attach('images', JPEG, { filename: 'front.jpg', contentType: 'image/jpeg' })
      .attach('images', WEBP, { filename: 'back.webp', contentType: 'image/webp' });

    expect(res.status).toBe(200);
    expect(res.body.files.map(f => f.mimetype)).toEqual(['image/jpeg', 'image/webp']);
  });

  it('rejects a script declared as image/png (spoofed Content-Type)', async () => {
    const res = await request(makeApp())
      .post('/upload')
      .attach('images', TEXT, { filename: 'evil.png', contentType: 'image/png' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not a valid image/i);
  });

  it('rejects a disallowed Content-Type at the first gate', async () => {
    const res = await request(makeApp())
      .post('/upload')
      .attach('images', TEXT, { filename: 'notes.txt', contentType: 'text/plain' });

    expect(res.status).toBe(500); // fileFilter error → generic error handler
    expect(res.body.error).toMatch(/invalid file type/i);
  });

  it('rejects a GIF smuggled in with a PNG Content-Type (magic bytes win)', async () => {
    const res = await request(makeApp())
      .post('/upload')
      .attach('images', GIF, { filename: 'sneaky.png', contentType: 'image/png' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not a valid image \(detected: image\/gif\)/i);
  });

  it('corrects a lying Content-Type to the detected MIME type', async () => {
    // JPEG bytes declared as PNG: both are allowed, so it passes —
    // but downstream code must see the REAL type
    const res = await request(makeApp())
      .post('/upload')
      .attach('images', JPEG, { filename: 'mislabelled.png', contentType: 'image/png' });

    expect(res.status).toBe(200);
    expect(res.body.files[0].mimetype).toBe('image/jpeg');
    expect(res.body.files[0].detectedExt).toBe('jpg');
  });

  it('rejects files over the size limit', async () => {
    const big = Buffer.concat([JPEG, Buffer.alloc(2 * 1024 * 1024)]);
    const res = await request(makeApp({ maxSizeMB: 1 }))
      .post('/upload')
      .attach('images', big, { filename: 'huge.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/file too large/i);
  });

  it('rejects more files than maxCount', async () => {
    const req = request(makeApp({ maxCount: 2 })).post('/upload');
    for (let i = 0; i < 3; i++) {
      req.attach('images', PNG, { filename: `card-${i}.png`, contentType: 'image/png' });
    }
    const res = await req;

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/unexpected field/i);
  });

  it('passes through when no files are attached', async () => {
    const res = await request(makeApp()).post('/upload');
    expect(res.status).toBe(200);
    expect(res.body.files).toEqual([]);
  });

  it('allows GIF when included in allowedMimeTypes', async () => {
    const res = await request(makeApp({ allowedMimeTypes: ['image/gif'] }))
      .post('/upload')
      .attach('images', GIF, { filename: 'anim.gif', contentType: 'image/gif' });

    expect(res.status).toBe(200);
    expect(res.body.files[0].mimetype).toBe('image/gif');
  });
});
