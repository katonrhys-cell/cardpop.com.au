import { describe, it, expect } from 'vitest';
import { eventReviewOutcomeEmail } from '../../src/emails/templates.js';

describe('eventReviewOutcomeEmail featuring offer', () => {
  const feature = { fromPrice: '$39.20', earlyBird: '20% early bird discount applied', url: 'https://cardpop.com.au/account/events?feature=e1' };

  it('offers featuring on approval', () => {
    const html = eventReviewOutcomeEmail({ name: 'Bec', eventTitle: 'Sydney Show', approved: true, eventUrl: 'https://cardpop.com.au/events/x', feature });
    expect(html).toContain('Want more collectors to see it?');
    expect(html).toContain('$39.20');
    expect(html).toContain('20% early bird discount applied');
    expect(html).toContain('href="https://cardpop.com.au/account/events?feature=e1"');
  });

  it('leaves it out when there is no offer, and never on a rejection', () => {
    expect(eventReviewOutcomeEmail({ eventTitle: 'S', approved: true })).not.toContain('Want more collectors');
    expect(eventReviewOutcomeEmail({ eventTitle: 'S', approved: false, note: 'x', feature })).not.toContain('Want more collectors');
  });

  it('escapes the offer fields', () => {
    const html = eventReviewOutcomeEmail({ eventTitle: 'S', approved: true, feature: { ...feature, fromPrice: '<b>' } });
    expect(html).not.toContain('<b>');
  });
});
