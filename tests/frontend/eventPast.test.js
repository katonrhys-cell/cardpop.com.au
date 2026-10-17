import { describe, it, expect } from 'vitest';
import { eventLastDay, isPastEvent, canReviewEvent, validateAttendeeReview } from '@/utils/eventPast.js';

const TODAY = '2026-10-17';

describe('isPastEvent', () => {
  it('is over the day after its last day, not on it', () => {
    expect(isPastEvent({ status: 'approved', start_date: '2026-10-16' }, TODAY)).toBe(true);
    expect(isPastEvent({ status: 'approved', start_date: '2026-10-17' }, TODAY)).toBe(false);
    expect(isPastEvent({ status: 'approved', start_date: '2026-10-18' }, TODAY)).toBe(false);
  });

  it('uses the end date of a multi-day show', () => {
    const show = { status: 'approved', start_date: '2026-10-10', end_date: '2026-10-18' };
    expect(isPastEvent(show, TODAY)).toBe(false);
    expect(isPastEvent(show, '2026-10-19')).toBe(true);
    expect(eventLastDay(show)).toBe('2026-10-18');
  });

  it('treats an admin-archived (completed) event as past whatever its date', () => {
    expect(isPastEvent({ status: 'completed', start_date: '2027-01-01' }, TODAY)).toBe(true);
  });

  it('never calls an undated event past, and tolerates timestamps and bad input', () => {
    expect(isPastEvent({ status: 'approved' }, TODAY)).toBe(false);
    expect(isPastEvent({ status: 'approved', start_date: '2026-10-01T00:00:00+00:00' }, TODAY)).toBe(true);
    expect(isPastEvent({ status: 'approved', start_date: '2026-10-01' }, 'not a date')).toBe(false);
    expect(isPastEvent(null, TODAY)).toBe(false);
    expect(eventLastDay({ start_date: 20261001 })).toBeNull();
  });
});

describe('canReviewEvent', () => {
  it('opens reviews only for finished events that are (or were) public', () => {
    expect(canReviewEvent({ status: 'approved', start_date: '2026-10-01' }, TODAY)).toBe(true);
    expect(canReviewEvent({ status: 'completed', start_date: '2026-10-01' }, TODAY)).toBe(true);
    expect(canReviewEvent({ status: 'approved', start_date: '2026-12-01' }, TODAY)).toBe(false);
    expect(canReviewEvent({ status: 'cancelled', start_date: '2026-10-01' }, TODAY)).toBe(false);
  });
});

describe('validateAttendeeReview', () => {
  it('mirrors the table constraints', () => {
    expect(validateAttendeeReview({ rating: 4, body: 'Great vendor mix, parking was rough.' })).toBeNull();
    expect(validateAttendeeReview({ rating: 0, body: 'Great vendor mix, parking was rough.' })).toMatch(/star rating/);
    expect(validateAttendeeReview({ rating: 4.5, body: 'Great vendor mix, parking was rough.' })).toMatch(/star rating/);
    expect(validateAttendeeReview({ rating: 4, body: 'short' })).toMatch(/at least 10/);
    expect(validateAttendeeReview({ rating: 4, body: 'x'.repeat(2001) })).toMatch(/under 2000/);
    expect(validateAttendeeReview({ rating: 4, title: 'x'.repeat(121), body: 'Fine show overall.' })).toMatch(/title/);
  });
});
