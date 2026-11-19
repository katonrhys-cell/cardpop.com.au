import { describe, it, expect } from 'vitest';
import {
  cleanVendorInfo, hasVendorInfo, vendorInfoFormError, safeVendorUrl, isPdfUrl, MAX_VENDOR_FAQS,
} from '@/utils/eventVendorInfo.js';

describe('cleanVendorInfo', () => {
  it('always returns the full shape, whatever is stored', () => {
    for (const raw of [null, undefined, [], 'x', 42, {}]) {
      expect(cleanVendorInfo(raw)).toEqual({ intro: '', faqs: [], documents: [], links: [] });
    }
  });

  it('trims text, drops half FAQs and unsafe links, and names untitled ones', () => {
    const c = cleanVendorInfo({
      intro: '  Six-foot tables.  ',
      faqs: [{ question: ' Power? ', answer: ' Yes ' }, { question: 'Only a question', answer: '' }],
      documents: [
        { title: '', url: 'https://x.supabase.co/storage/v1/object/public/events/vendor-info/0b6f1d2e-3c4a-4b5c-8d9e-0f1a2b3c4d5e.pdf' },
        { title: 'Floor plan', url: 'https://cdn.test/floor-plan.png' },
        { title: 'Evil', url: 'javascript:alert(1)' },
      ],
      links: [{ label: '', url: 'https://show.test/vendors' }, { label: 'Bad', url: 'data:text/html,hi' }],
    });
    expect(c.intro).toBe('Six-foot tables.');
    expect(c.faqs).toEqual([{ question: 'Power?', answer: 'Yes' }]);
    expect(c.documents).toEqual([
      { title: 'Vendor document 1', url: expect.stringContaining('/vendor-info/') },
      { title: 'Floor plan', url: 'https://cdn.test/floor-plan.png' },
    ]);
    expect(c.links).toEqual([{ label: 'More vendor info', url: 'https://show.test/vendors' }]);
  });

  it('caps the FAQ list', () => {
    const faqs = Array.from({ length: MAX_VENDOR_FAQS + 5 }, (_, i) => ({ question: `Q${i}`, answer: 'A' }));
    expect(cleanVendorInfo({ faqs }).faqs).toHaveLength(MAX_VENDOR_FAQS);
  });
});

describe('hasVendorInfo', () => {
  it('is true for any vendor content or an application link, false otherwise', () => {
    expect(hasVendorInfo({})).toBe(false);
    expect(hasVendorInfo({ faqs: [{ question: 'Q', answer: '' }] })).toBe(false);
    expect(hasVendorInfo({}, 'javascript:alert(1)')).toBe(false);
    expect(hasVendorInfo({ intro: 'Hi' })).toBe(true);
    expect(hasVendorInfo({}, 'https://show.test/apply')).toBe(true);
  });
});

describe('vendorInfoFormError', () => {
  it('names a half-filled FAQ or a bad link', () => {
    expect(vendorInfoFormError({ faqs: [{ question: 'Power?', answer: '' }] })).toMatch(/needs an answer/);
    expect(vendorInfoFormError({ faqs: [{ question: '', answer: 'Yes' }] })).toMatch(/needs a question/);
    expect(vendorInfoFormError({ links: [{ label: 'FAQ', url: '' }] })).toMatch(/needs a web address/);
    expect(vendorInfoFormError({ links: [{ label: 'FAQ', url: 'ftp://x.test' }] })).toMatch(/full web address/);
    expect(vendorInfoFormError({ faqs: [{ question: '', answer: '' }], links: [{ label: '', url: '' }] })).toBeNull();
  });
});

describe('helpers', () => {
  it('recognises safe urls and PDFs', () => {
    expect(safeVendorUrl('https://a.test/x')).toBe('https://a.test/x');
    expect(safeVendorUrl('javascript:alert(1)')).toBe('');
    expect(isPdfUrl('https://a.test/pack.PDF?v=1')).toBe(true);
    expect(isPdfUrl('https://a.test/plan.png')).toBe(false);
  });
});
