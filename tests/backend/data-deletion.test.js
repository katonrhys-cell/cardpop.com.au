import { vi, describe, it, expect, beforeAll } from 'vitest';
import crypto from 'crypto';

// A known app secret for building valid signed requests. Set before app.js is
// imported so the callback route can verify against it.
const APP_SECRET = 'vitest_fb_app_secret';
process.env.FACEBOOK_APP_SECRET = APP_SECRET;

// The route's deletion side-effects (Supabase auth scan + soft-delete) are
// covered by the service's own logic; here we mock the service so the route
// tests focus on signature verification and the exact Meta response shape.
const mockService = vi.hoisted(() => ({
  handleFacebookDeletionRequest: vi.fn(),
  getDeletionRequestStatus: vi.fn(),
}));

vi.mock('../../src/services/dataDeletionService.js', () => mockService);

let app;
let parseSignedRequest;

beforeAll(async () => {
  ({ default: app } = await import('../../src/app.js'));
  ({ parseSignedRequest } = await import('../../src/utils/facebookSignedRequest.js'));
});

function base64Url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function buildSignedRequest(payloadObj, secret = APP_SECRET) {
  const payload = base64Url(JSON.stringify(payloadObj));
  const sig = base64Url(crypto.createHmac('sha256', secret).update(payload).digest());
  return `${sig}.${payload}`;
}

describe('parseSignedRequest', () => {
  const payload = { algorithm: 'HMAC-SHA256', issued_at: 1291836800, user_id: '218471' };

  it('parses and returns the payload for a valid signature', () => {
    const data = parseSignedRequest(buildSignedRequest(payload), APP_SECRET);
    expect(data).not.toBeNull();
    expect(data.user_id).toBe('218471');
  });

  it('rejects a signature signed with the wrong secret', () => {
    const signed = buildSignedRequest(payload, 'the_wrong_secret');
    expect(parseSignedRequest(signed, APP_SECRET)).toBeNull();
  });

  it('rejects a tampered payload', () => {
    const signed = buildSignedRequest(payload);
    const [sig] = signed.split('.');
    const tampered = `${sig}.${base64Url(JSON.stringify({ ...payload, user_id: '999' }))}`;
    expect(parseSignedRequest(tampered, APP_SECRET)).toBeNull();
  });

  it('rejects a malformed request and a missing secret', () => {
    expect(parseSignedRequest('garbage', APP_SECRET)).toBeNull();
    expect(parseSignedRequest(buildSignedRequest(payload), '')).toBeNull();
  });
});

describe('POST /data-deletion/facebook', () => {
  it('is mounted and verifies the signature, returning Meta\'s { url, confirmation_code } shape', async () => {
    const { default: request } = await import('supertest');
    mockService.handleFacebookDeletionRequest.mockResolvedValueOnce({
      confirmationCode: 'CP-TESTCODE01',
      statusUrl: 'https://cardpop.com.au/data-deletion?code=CP-TESTCODE01',
    });

    const signedRequest = buildSignedRequest({ algorithm: 'HMAC-SHA256', user_id: '218471' });
    const res = await request(app)
      .post('/data-deletion/facebook')
      .type('form')
      .send({ signed_request: signedRequest });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      url: 'https://cardpop.com.au/data-deletion?code=CP-TESTCODE01',
      confirmation_code: 'CP-TESTCODE01',
    });
    expect(mockService.handleFacebookDeletionRequest).toHaveBeenCalledWith('218471');
  });

  it('rejects an invalid signed_request with 400 and never initiates deletion', async () => {
    const { default: request } = await import('supertest');
    mockService.handleFacebookDeletionRequest.mockClear();

    const res = await request(app)
      .post('/data-deletion/facebook')
      .type('form')
      .send({ signed_request: 'not.avalidsignature' });

    expect(res.status).toBe(400);
    expect(res.body.error).not.toBe('Route not found');
    expect(mockService.handleFacebookDeletionRequest).not.toHaveBeenCalled();
  });
});

describe('GET /data-deletion/status/:code', () => {
  it('returns the request status summary', async () => {
    const { default: request } = await import('supertest');
    mockService.getDeletionRequestStatus.mockResolvedValueOnce({
      confirmation_code: 'CP-TESTCODE01',
      status: 'completed',
      requested_at: '2026-07-12T00:00:00.000Z',
      completed_at: '2026-07-12T00:05:00.000Z',
    });

    const res = await request(app).get('/data-deletion/status/CP-TESTCODE01');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
  });

  it('returns 404 for an unknown confirmation code', async () => {
    const { default: request } = await import('supertest');
    mockService.getDeletionRequestStatus.mockResolvedValueOnce(null);

    const res = await request(app).get('/data-deletion/status/CP-NOPE');
    expect(res.status).toBe(404);
  });
});
