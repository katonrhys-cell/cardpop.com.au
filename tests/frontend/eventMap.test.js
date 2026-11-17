import { describe, it, expect } from 'vitest';
import { eventMapLinks } from '@/utils/eventMap.js';

describe('eventMapLinks', () => {
  it('builds embed, map and directions links for an address', () => {
    const links = eventMapLinks('740 Bourke St, Docklands VIC 3008, Australia');
    const q = encodeURIComponent('740 Bourke St, Docklands VIC 3008, Australia');
    expect(links.embedUrl).toBe(`https://www.google.com/maps?q=${q}&z=15&output=embed`);
    expect(links.mapUrl).toContain(`query=${q}`);
    expect(links.directionsUrl).toContain(`destination=${q}`);
  });

  it('returns null for blank or non-place locations', () => {
    expect(eventMapLinks('')).toBeNull();
    expect(eventMapLinks(null)).toBeNull();
    expect(eventMapLinks('Online')).toBeNull();
    expect(eventMapLinks('TBA')).toBeNull();
  });
});
