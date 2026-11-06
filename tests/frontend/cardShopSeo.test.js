import { describe, it, expect } from 'vitest';
import {
  MIN_COUNT_IN_TITLE, directoryMonth, cardShopCityTitle, cardShopCityDescription, cardShopCityFaqs, faqPageLd,
} from '@/utils/cardShopSeo.js';

const NOV = new Date('2026-11-06T12:00:00Z');

describe('directoryMonth', () => {
  it('is the month in Sydney time, not UTC', () => {
    expect(directoryMonth(NOV)).toBe('Nov 2026');
    // 31 Oct 14:00 UTC is already 1 Nov in Sydney.
    expect(directoryMonth(new Date('2026-10-31T14:00:00Z'))).toBe('Nov 2026');
  });
});

describe('cardShopCityTitle', () => {
  it('leads with the real store count and month once there are enough stores', () => {
    expect(cardShopCityTitle('Melbourne', 11, NOV)).toBe('11 Card Shops in Melbourne (Nov 2026) — Pokémon, TCG & Sports Cards');
  });

  it('drops the count below the threshold, and while stores are still loading', () => {
    const plain = 'Card Shops in Darwin — Pokémon, TCG & Sports Card Stores | CardPop';
    expect(cardShopCityTitle('Darwin', MIN_COUNT_IN_TITLE - 1, NOV)).toBe(plain);
    expect(cardShopCityTitle('Darwin', 0, NOV)).toBe(plain);
    expect(cardShopCityTitle('Darwin', undefined, NOV)).toBe(plain);
  });
});

describe('cardShopCityDescription', () => {
  it('states the store count only when it is in the title too', () => {
    expect(cardShopCityDescription('Sydney', 'NSW', 14)).toMatch(/^14 trading card shops in Sydney, NSW: /);
    expect(cardShopCityDescription('Darwin', 'NT', 2)).toMatch(/^Trading card shops in Darwin, NT: /);
  });
});

describe('cardShopCityFaqs / faqPageLd', () => {
  it('builds FAQPage JSON-LD from the same questions the page shows', () => {
    const faqs = cardShopCityFaqs('Perth', 'WA');
    const ld = faqPageLd(faqs);
    expect(ld['@type']).toBe('FAQPage');
    expect(ld.mainEntity).toHaveLength(faqs.length);
    expect(ld.mainEntity[0].name).toBe('Where can I buy Pokémon or sports cards in Perth?');
    expect(ld.mainEntity[0].acceptedAnswer.text).toBe(faqs[0].a);
  });
});
