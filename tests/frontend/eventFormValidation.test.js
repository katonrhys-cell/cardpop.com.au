import { describe, it, expect } from 'vitest';
import {
  validateEventForm, normalizeEventUrl, isValidHttpUrl, describeEventSaveError, eventImageFileError,
} from '@/utils/eventFormValidation.js';

const base = { title: 'Card Show', start_date: '2027-04-03', is_free: true };

describe('normalizeEventUrl', () => {
  it('adds https:// to links typed without it', () => {
    expect(normalizeEventUrl('instagram.com/myshow')).toBe('https://instagram.com/myshow');
    expect(normalizeEventUrl(' www.show.com.au ')).toBe('https://www.show.com.au');
    expect(normalizeEventUrl('//discord.gg/abc')).toBe('https://discord.gg/abc');
  });
  it('leaves full links and blanks alone', () => {
    expect(normalizeEventUrl('https://x.com/show')).toBe('https://x.com/show');
    expect(normalizeEventUrl('')).toBe('');
    expect(normalizeEventUrl(null)).toBe('');
  });
  it('does not turn a non-link into one', () => {
    expect(isValidHttpUrl(normalizeEventUrl('my show page'))).toBe(false);
    expect(isValidHttpUrl(normalizeEventUrl('javascript:alert(1)'))).toBe(false);
  });
});

describe('validateEventForm', () => {
  it('passes a minimal event', () => {
    expect(validateEventForm(base)).toBeNull();
  });
  it('points at the title and start date on their tabs', () => {
    expect(validateEventForm({ ...base, title: '  ' })).toMatchObject({ field: 'title', tab: 'details' });
    expect(validateEventForm({ ...base, start_date: '' })).toMatchObject({ field: 'start_date', tab: 'venue' });
  });
  it('rejects an end before the start', () => {
    expect(validateEventForm({ ...base, end_date: '2027-04-01' })).toMatchObject({ field: 'end_date' });
    expect(validateEventForm({ ...base, start_time: '10:00', end_time: '09:00' })).toMatchObject({ field: 'end_time' });
    // Runs overnight into the next day — fine.
    expect(validateEventForm({ ...base, end_date: '2027-04-04', start_time: '18:00', end_time: '02:00' })).toBeNull();
  });
  it('checks the postcode and email', () => {
    expect(validateEventForm({ ...base, postcode: '30' })).toMatchObject({ field: 'postcode' });
    expect(validateEventForm({ ...base, postcode: '3000' })).toBeNull();
    expect(validateEventForm({ ...base, organizer_email: 'not-an-email' })).toMatchObject({ field: 'organizer_email', tab: 'organiser' });
  });
  it('accepts links without https:// but names a broken one', () => {
    expect(validateEventForm({ ...base, instagram_url: 'instagram.com/show' })).toBeNull();
    const err = validateEventForm({ ...base, ticket_url: 'buy tickets at the door' });
    expect(err).toMatchObject({ field: 'ticket_url', tab: 'organiser' });
    expect(err.message).toMatch(/Tickets/);
  });
  it('checks capacity and prices', () => {
    expect(validateEventForm({ ...base, capacity: '0' })).toMatchObject({ field: 'capacity' });
    expect(validateEventForm({ ...base, capacity: '2.5' })).toMatchObject({ field: 'capacity' });
    expect(validateEventForm({ ...base, is_free: false, entry_fee_aud: '-5' })).toMatchObject({ field: 'entry_fee_aud' });
  });
});

describe('eventImageFileError', () => {
  const file = (type, size = 1000, name = 'x') => ({ type, size, name });
  it('accepts the types the bucket stores', () => {
    for (const t of ['image/jpeg', 'image/png', 'image/webp', 'image/gif']) expect(eventImageFileError(file(t))).toBeNull();
  });
  it('explains HEIC and other formats before the upload fails', () => {
    expect(eventImageFileError(file('image/heic'))).toMatch(/HEIC/);
    expect(eventImageFileError(file('', 1000, 'IMG_1.HEIC'))).toMatch(/HEIC/);
    expect(eventImageFileError(file('image/bmp'))).toMatch(/JPG, PNG/);
    expect(eventImageFileError(file('image/png', 21 * 1024 * 1024))).toMatch(/20MB/);
  });
});

describe('describeEventSaveError', () => {
  it('turns database and network errors into plain English', () => {
    expect(describeEventSaveError({ code: '42501', message: 'new row violates row-level security policy for table "events"' })).toMatch(/Refresh My Events/);
    expect(describeEventSaveError({ message: 'mime type image/heic is not supported' })).toMatch(/JPG, PNG/);
    expect(describeEventSaveError(new TypeError('Failed to fetch'))).toMatch(/offline/);
    expect(describeEventSaveError({ message: 'Something specific' })).toBe('Something specific');
    expect(describeEventSaveError({})).toBe('Failed to save event');
  });
});
