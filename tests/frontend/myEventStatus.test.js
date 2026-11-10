import { describe, it, expect } from 'vitest';
import { myEventBucket, countMyEventBuckets, activeEventCount, normaliseBucket } from '@/utils/myEventStatus.js';

const today = '2026-11-10';

describe('myEventBucket', () => {
  it('maps every status to one lifecycle bucket', () => {
    expect(myEventBucket({ status: 'draft' }, today)).toBe('draft');
    expect(myEventBucket({ status: 'pending_review' }, today)).toBe('pending');
    expect(myEventBucket({ status: 'rejected' }, today)).toBe('declined');
    expect(myEventBucket({ status: 'cancelled' }, today)).toBe('declined');
    expect(myEventBucket({ status: 'completed', start_date: '2027-01-01' }, today)).toBe('past');
  });

  it('splits approved events by the calendar', () => {
    expect(myEventBucket({ status: 'approved', start_date: '2026-12-01' }, today)).toBe('live');
    expect(myEventBucket({ status: 'approved', start_date: '2026-11-10' }, today)).toBe('now');
    expect(myEventBucket({ status: 'approved', start_date: '2026-11-09', end_date: '2026-11-11' }, today)).toBe('now');
    expect(myEventBucket({ status: 'approved', start_date: '2026-11-01', end_date: '2026-11-09' }, today)).toBe('past');
  });
});

describe('counts', () => {
  it('counts each bucket and active = now + live', () => {
    const counts = countMyEventBuckets([
      { status: 'approved', start_date: '2026-12-01' },
      { status: 'approved', start_date: '2026-11-10' },
      { status: 'approved', start_date: '2026-10-01' },
      { status: 'draft' },
      { status: 'pending_review' },
    ], today);
    expect(counts).toMatchObject({ all: 5, live: 1, now: 1, past: 1, draft: 1, pending: 1, declined: 0 });
    expect(activeEventCount(counts)).toBe(2);
  });

  it('falls back to all for an unknown tab', () => {
    expect(normaliseBucket('live')).toBe('live');
    expect(normaliseBucket('nope')).toBe('all');
    expect(normaliseBucket(null)).toBe('all');
  });
});
