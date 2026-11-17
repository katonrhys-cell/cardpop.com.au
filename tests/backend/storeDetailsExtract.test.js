import { describe, it, expect } from 'vitest';
import {
  cleanPhone, cleanStoreDetails, extractStructuredStoreDetails, findContactPageUrl, formatTime,
  hoursFromOpeningHours, hoursFromSpecification, instagramProfileUrl, mergeStoreDetails,
} from '../../utils/storeDetailsExtract.js';
import { storeListItemLd, storePhoneHref } from '../../utils/storePage.js';

const ld = (data) => `<script type="application/ld+json">${JSON.stringify(data)}</script>`;

describe('store details from a shop website', () => {
  it('reads address, phone, hours and Instagram from LocalBusiness JSON-LD', () => {
    const html = ld({
      '@context': 'https://schema.org',
      '@graph': [{
        '@type': 'HobbyShop',
        name: 'Example Cards',
        telephone: '(03) 9123 4567',
        address: { '@type': 'PostalAddress', streetAddress: '12 Example St', addressLocality: 'Fitzroy', addressRegion: 'VIC', postalCode: '3065' },
        openingHoursSpecification: [
          { dayOfWeek: ['Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '11:00', closes: '19:00' },
          { dayOfWeek: 'https://schema.org/Saturday', opens: '10:00', closes: '17:30' },
          { dayOfWeek: 'Monday', opens: '00:00', closes: '00:00' },
        ],
        sameAs: ['https://facebook.com/example', 'https://www.instagram.com/example.cards/'],
      }],
    });
    expect(extractStructuredStoreDetails(html)).toEqual({
      address: '12 Example St, Fitzroy VIC 3065',
      suburb: 'Fitzroy',
      phone: '(03) 9123 4567',
      opening_hours: 'Monday: Closed\nTuesday to Friday: 11am – 7pm\nSaturday: 10am – 5:30pm',
      instagram_url: 'https://www.instagram.com/example.cards/',
    });
  });

  it('does not treat a suburb-only address as a street address', () => {
    const html = ld({ '@type': 'Organization', address: { addressLocality: 'Melbourne', addressRegion: 'VIC' } });
    expect(extractStructuredStoreDetails(html).address).toBeNull();
  });

  it('falls back to tel: and Instagram links in the markup', () => {
    const html = '<a href="tel:+61%20412%20345%20678">Call</a> <a href="https://www.instagram.com/p/abc123/">post</a> <a href="https://instagram.com/shop_name?igshid=1">ig</a>';
    const details = extractStructuredStoreDetails(html);
    expect(details.phone).toBe('+61 412 345 678');
    expect(details.instagram_url).toBe('https://www.instagram.com/shop_name/');
  });

  it('survives broken JSON-LD and pages with nothing on them', () => {
    expect(extractStructuredStoreDetails('<script type="application/ld+json">{oops</script>')).toEqual({
      address: null, suburb: null, phone: null, opening_hours: null, instagram_url: null,
    });
    expect(extractStructuredStoreDetails(null).phone).toBeNull();
  });

  it('expands the compact openingHours form', () => {
    expect(hoursFromOpeningHours(['Mo-Fr 09:00-17:00', 'Sa,Su 10:00-16:00'])).toEqual([
      'Monday to Friday: 9am – 5pm',
      'Saturday to Sunday: 10am – 4pm',
    ]);
    expect(hoursFromOpeningHours('by appointment')).toEqual([]);
    expect(hoursFromSpecification({ dayOfWeek: 'Funday', opens: '09:00', closes: '17:00' })).toEqual([]);
  });

  it('formats times and rejects nonsense', () => {
    expect(formatTime('09:00')).toBe('9am');
    expect(formatTime('12:30:00')).toBe('12:30pm');
    expect(formatTime('00:00')).toBe('12am');
    expect(formatTime('7pm')).toBe('7pm');
    expect(formatTime('25:00')).toBeNull();
    expect(formatTime('late')).toBeNull();
  });

  it('cleans whatever a page or a model reports', () => {
    const cleaned = cleanStoreDetails({
      address: '  <b>12 Example St</b>,\n Fitzroy ',
      phone: 'call us!',
      opening_hours: ['Monday: Closed', '', '<script>x</script>Tuesday: 11am – 7pm', ...Array(20).fill('Sunday: 10am – 4pm')],
      instagram_url: 'javascript:alert(1)',
    });
    expect(cleaned.address).toBe('12 Example St , Fitzroy');
    expect(cleaned.phone).toBeNull();
    expect(cleaned.instagram_url).toBeNull();
    expect(cleaned.opening_hours.split('\n')).toHaveLength(10);
    expect(cleaned.opening_hours).not.toContain('<');
    expect(cleanPhone('1300 123 456')).toBe('1300 123 456');
    expect(cleanPhone('12345')).toBeNull();
    expect(instagramProfileUrl('https://evil.example/instagram.com/x')).toBeNull();
  });

  it('finds the shop\'s own contact page and ignores other hosts', () => {
    const html = '<a href="https://other.example/contact">x</a><a href="/pages/about-us">About</a><a href="/pages/contact-us#form">Contact</a>';
    expect(findContactPageUrl(html, 'https://shop.example/')).toBe('https://shop.example/pages/contact-us');
    expect(findContactPageUrl('<a href="/pages/about-us">About</a>', 'https://shop.example/')).toBe('https://shop.example/pages/about-us');
    expect(findContactPageUrl('<a href="/collections/all">Shop</a>', 'https://shop.example/')).toBeNull();
    expect(findContactPageUrl('<a href="/contact">x</a>', 'not a url')).toBeNull();
  });

  it('merges without overwriting what was already found', () => {
    expect(mergeStoreDetails({ phone: '1', address: null }, { phone: '2', address: 'A' })).toMatchObject({ phone: '1', address: 'A' });
  });
});

describe('city page store markup', () => {
  it('adds street address and phone only when the directory has them', () => {
    expect(storeListItemLd({ name: 'A', suburb: 'Fitzroy', state: 'VIC', website: 'https://a.example' })).toEqual({
      '@type': 'LocalBusiness', name: 'A', url: 'https://a.example/',
      address: { '@type': 'PostalAddress', addressLocality: 'Fitzroy', addressRegion: 'VIC', addressCountry: 'AU' },
    });
    const full = storeListItemLd({ name: 'A', suburb: 'Fitzroy', state: 'VIC', address: '12 Example St, Fitzroy VIC 3065', phone: '(03) 9123 4567', website: 'javascript:x' });
    expect(full.telephone).toBe('(03) 9123 4567');
    expect(full.address.streetAddress).toBe('12 Example St, Fitzroy VIC 3065');
    expect(full.url).toBeUndefined();
  });

  it('builds a tel: link only from a real number', () => {
    expect(storePhoneHref('(03) 9123 4567')).toBe('tel:0391234567');
    expect(storePhoneHref('+61 412 345 678')).toBe('tel:+61412345678');
    expect(storePhoneHref('n/a')).toBeNull();
  });
});
