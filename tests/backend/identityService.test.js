import { vi, describe, it, expect, beforeEach } from 'vitest';

// ─── mock the shared stripe + supabase clients before importing the service ────

const mockStripe = vi.hoisted(() => ({
  identity: { verificationSessions: { create: vi.fn(), retrieve: vi.fn() } },
}));
vi.mock('../../src/utils/stripeClient.js', () => ({ default: mockStripe }));

// Supabase double: select().eq().maybeSingle() resolves the configurable
// profile, updates and inserts are recorded per table.
const supabaseState = vi.hoisted(() => ({ profile: null, updates: [], inserts: [] }));
vi.mock('../../src/utils/supabaseClient.js', () => {
  const sb = {
    from: (table) => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => Promise.resolve({ data: supabaseState.profile, error: null }) }),
      }),
      update: (payload) => ({
        eq: () => {
          supabaseState.updates.push({ table, payload });
          return Promise.resolve({ error: null });
        },
      }),
      insert: (payload) => {
        supabaseState.inserts.push({ table, payload });
        return Promise.resolve({ error: null });
      },
    }),
  };
  return { supabase: sb, default: sb };
});

import { applyIdentitySession, createIdentitySession, getIdentityStatus, namesMatch } from '../../src/services/identityService.js';

const mockRes = () => {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
};

beforeEach(() => {
  mockStripe.identity.verificationSessions.create.mockReset();
  mockStripe.identity.verificationSessions.retrieve.mockReset();
  supabaseState.profile = null;
  supabaseState.updates = [];
  supabaseState.inserts = [];
});

describe('namesMatch', () => {
  it('matches on first and last tokens, ignoring case, middle names, diacritics and punctuation', () => {
    expect(namesMatch('Maya Chen', 'Maya Chen')).toBe(true);
    expect(namesMatch('maya chen', 'MAYA CHEN')).toBe(true);
    expect(namesMatch('Maya Chen', 'Maya Li Chen')).toBe(true);       // middle name on the document
    expect(namesMatch('Maya Li Chen', 'Maya Chen')).toBe(true);       // middle name on the profile
    expect(namesMatch('Maya Smith-Jones', 'Maya Smith Jones')).toBe(true);       // hyphenated surname
    expect(namesMatch('María Núñez', 'Maria Nunez')).toBe(true);      // diacritics stripped
  });

  it('rejects different names and missing data', () => {
    expect(namesMatch('Maya Chen', 'Maya Smith')).toBe(false);
    expect(namesMatch('John Chen', 'Maya Chen')).toBe(false);
    expect(namesMatch('', 'Maya Chen')).toBe(false);
    expect(namesMatch(undefined, 'Maya Chen')).toBe(false);
    expect(namesMatch('Maya Chen', '')).toBe(false);
  });
});

describe('applyIdentitySession', () => {
  it('marks the profile approved (with legal name) and notifies on verified', async () => {
    supabaseState.profile = { display_name: 'Maya Chen' };
    await applyIdentitySession({
      id: 'vs_1',
      status: 'verified',
      metadata: { userId: 'user-1' },
      verified_outputs: { first_name: 'Maya', last_name: 'Chen' },
    });

    const update = supabaseState.updates.find(u => u.table === 'profiles');
    expect(update.payload.is_verified).toBe(true);
    expect(update.payload.verification_status).toBe('approved');
    expect(update.payload.legal_name).toBe('Maya Chen');
    expect(update.payload.identity_name_mismatch).toBe(false);

    const notif = supabaseState.inserts.find(i => i.table === 'notifications');
    expect(notif.payload.user_id).toBe('user-1');
    expect(notif.payload.type).toBe('identity_verified');
  });

  it('routes a document/profile name mismatch to manual review instead of approving', async () => {
    supabaseState.profile = { display_name: 'Maya Smith' };
    await applyIdentitySession({
      id: 'vs_1',
      status: 'verified',
      metadata: { userId: 'user-1' },
      verified_outputs: { first_name: 'Maya', last_name: 'Chen' },
    });

    const update = supabaseState.updates.find(u => u.table === 'profiles');
    expect(update.payload.is_verified).toBeUndefined();
    expect(update.payload.verification_status).toBe('pending');
    expect(update.payload.identity_name_mismatch).toBe(true);
    expect(update.payload.legal_name).toBe('Maya Chen');

    const notif = supabaseState.inserts.find(i => i.table === 'notifications');
    expect(notif.payload.type).toBe('identity_review');
  });

  it('does not re-flag or re-notify a mismatch already awaiting review', async () => {
    supabaseState.profile = { display_name: 'Maya Smith', verification_status: 'pending', identity_name_mismatch: true };
    await applyIdentitySession({
      id: 'vs_1',
      status: 'verified',
      metadata: { userId: 'user-1' },
      verified_outputs: { first_name: 'Maya', last_name: 'Chen' },
    });
    expect(supabaseState.updates).toHaveLength(0);
    expect(supabaseState.inserts).toHaveLength(0);
  });

  it('still auto-approves when Stripe extracted no name from the document', async () => {
    supabaseState.profile = { display_name: 'Maya Chen' };
    await applyIdentitySession({
      id: 'vs_1',
      status: 'verified',
      metadata: { userId: 'user-1' },
      verified_outputs: {},
    });

    const update = supabaseState.updates.find(u => u.table === 'profiles');
    expect(update.payload.is_verified).toBe(true);
    expect(update.payload.verification_status).toBe('approved');
    expect(update.payload.legal_name).toBeUndefined();
  });

  it('does not re-update or re-notify an already approved profile', async () => {
    supabaseState.profile = { verification_status: 'approved', is_verified: true };
    await applyIdentitySession({ id: 'vs_1', status: 'verified', metadata: { userId: 'user-1' } });
    expect(supabaseState.updates).toHaveLength(0);
    expect(supabaseState.inserts).toHaveLength(0);
  });

  it('marks a failed check rejected, but never downgrades an approved profile', async () => {
    await applyIdentitySession({
      id: 'vs_1',
      status: 'requires_input',
      metadata: { userId: 'user-1' },
      last_error: { code: 'selfie_face_mismatch' },
    });
    expect(supabaseState.updates[0].payload.verification_status).toBe('rejected');

    supabaseState.updates = [];
    supabaseState.profile = { verification_status: 'approved', is_verified: true };
    await applyIdentitySession({
      id: 'vs_2',
      status: 'requires_input',
      metadata: { userId: 'user-1' },
      last_error: { code: 'document_expired' },
    });
    expect(supabaseState.updates).toHaveLength(0);
  });

  it('ignores an abandoned session (requires_input without last_error)', async () => {
    await applyIdentitySession({ id: 'vs_1', status: 'requires_input', metadata: { userId: 'user-1' } });
    expect(supabaseState.updates).toHaveLength(0);
  });

  it('does nothing without a userId in metadata', async () => {
    await applyIdentitySession({ id: 'vs_1', status: 'verified', metadata: {} });
    expect(supabaseState.updates).toHaveLength(0);
  });
});

describe('createIdentitySession', () => {
  const req = (body = {}) => ({ user: { id: 'user-1', email: 'a@b.com' }, body });

  beforeEach(() => {
    delete process.env.STRIPE_IDENTITY_FLOW_ID;
  });

  it('rejects with 409 when the profile is already verified', async () => {
    supabaseState.profile = { verification_status: 'approved', is_verified: true };
    const res = mockRes();
    await createIdentitySession(req(), res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(mockStripe.identity.verificationSessions.create).not.toHaveBeenCalled();
  });

  it('creates a document session tagged with the user and stores its id', async () => {
    mockStripe.identity.verificationSessions.create.mockResolvedValue({
      id: 'vs_new', url: 'https://verify.stripe.com/x',
    });
    const res = mockRes();
    await createIdentitySession(req({ returnPath: '/verify-identity?welcome=1' }), res);

    const params = mockStripe.identity.verificationSessions.create.mock.calls[0][0];
    expect(params.type).toBe('document');
    expect(params.metadata.userId).toBe('user-1');
    expect(params.options.document.require_matching_selfie).toBe(true);
    expect(params.return_url.endsWith('/verify-identity?welcome=1')).toBe(true);

    expect(supabaseState.updates[0].payload.stripe_identity_session_id).toBe('vs_new');
    expect(res.json).toHaveBeenCalledWith({ url: 'https://verify.stripe.com/x', sessionId: 'vs_new' });
  });

  it('uses the dashboard Verification Flow (no inline type/options) when configured', async () => {
    process.env.STRIPE_IDENTITY_FLOW_ID = 'vf_123';
    mockStripe.identity.verificationSessions.create.mockResolvedValue({
      id: 'vs_flow', url: 'https://verify.stripe.com/f',
    });
    const res = mockRes();
    await createIdentitySession(req(), res);

    const params = mockStripe.identity.verificationSessions.create.mock.calls[0][0];
    expect(params.verification_flow).toBe('vf_123');
    expect('type' in params).toBe(false);
    expect('options' in params).toBe(false);
    expect(params.metadata.userId).toBe('user-1');
    expect(supabaseState.updates[0].payload.stripe_identity_session_id).toBe('vs_flow');
  });

  it('refuses an absolute/protocol-relative returnPath and falls back to /verify-identity', async () => {
    mockStripe.identity.verificationSessions.create.mockResolvedValue({ id: 'vs_x', url: 'https://verify.stripe.com/x' });
    const res = mockRes();
    await createIdentitySession(req({ returnPath: '//evil.example' }), res);
    const params = mockStripe.identity.verificationSessions.create.mock.calls[0][0];
    expect(params.return_url.endsWith('/verify-identity')).toBe(true);
  });
});

describe('getIdentityStatus', () => {
  const req = () => ({ user: { id: 'user-1', email: 'a@b.com' } });

  it('short-circuits to verified for an approved profile without calling Stripe', async () => {
    supabaseState.profile = { verification_status: 'approved', is_verified: true };
    const res = mockRes();
    await getIdentityStatus(req(), res);
    expect(res.json).toHaveBeenCalledWith({ status: 'verified' });
    expect(mockStripe.identity.verificationSessions.retrieve).not.toHaveBeenCalled();
  });

  it('reports not_started when no session has been created', async () => {
    supabaseState.profile = { stripe_identity_session_id: null };
    const res = mockRes();
    await getIdentityStatus(req(), res);
    expect(res.json).toHaveBeenCalledWith({ status: 'not_started' });
  });

  it('returns the live session status with the failure reason', async () => {
    supabaseState.profile = { stripe_identity_session_id: 'vs_1', verification_status: 'pending' };
    mockStripe.identity.verificationSessions.retrieve.mockResolvedValue({
      id: 'vs_1',
      status: 'requires_input',
      metadata: { userId: 'user-1' },
      last_error: { code: 'document_expired', reason: 'The document is expired.' },
    });
    const res = mockRes();
    await getIdentityStatus(req(), res);
    expect(res.json).toHaveBeenCalledWith({
      status: 'requires_input',
      lastError: { code: 'document_expired', reason: 'The document is expired.' },
    });
  });
});
