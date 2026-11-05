import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  normaliseCompanyKey, companyForKey, gradingPartnersPath, partnerDomain, partnerLinkFor, cleanCompanies, cleanCompanyLinks,
  parseCategories, gradingPartnerSlug, partnersForCompany, partnerCountsByCompany, partnerLineText, PARTNER_COMPANY_KEYS, GRADING_PARTNERS_PATH,
} from '@/utils/gradingPartners.js';
import { GRADING_PARTNERS_SEED } from '@/data/gradingPartnersSeed.js';
import { GRADING_COMPANIES } from '@/data/gradingCompanies.js';
import { buildGradingPartnerRow } from '@/pages/admin/GradingPartnersAdminPage.jsx';

const ROOT = path.join(import.meta.dirname, '..', '..');
const MIGRATION = path.join(ROOT, 'supabase', 'migrations', '20261104192816_grading_submission_partners.sql');

describe('seed ↔ migration', () => {
  const sql = fs.readFileSync(MIGRATION, 'utf8');
  const rows = [...sql.matchAll(/^\s*\('([a-z0-9-]+)', '(?:[^']|'')+', 'https?:\/\/[^']+', (?:'(?:[^']|'')*'|null), (?:'(?:[^']|'')*'|null), array\[([^\]]+)\]::text\[\]/gm)]
    .map((m) => ({ slug: m[1], companies: m[2].split(',').map((c) => c.trim().replace(/^'|'$/g, '')) }));

  it('reads every seeded row back out of the SQL', () => {
    expect(rows.length).toBe(GRADING_PARTNERS_SEED.length);
  });

  it('has the same slugs and companies in the JS mirror', () => {
    const fromSql = Object.fromEntries(rows.map((r) => [r.slug, [...r.companies].sort()]));
    const fromJs = Object.fromEntries(GRADING_PARTNERS_SEED.map((r) => [r.slug, [...r.companies].sort()]));
    expect(fromJs).toEqual(fromSql);
  });

  it('only uses company keys the DB check constraint allows, and every company has at least one partner', () => {
    for (const r of GRADING_PARTNERS_SEED) {
      expect(r.companies.length).toBeGreaterThan(0);
      for (const c of r.companies) expect(PARTNER_COMPANY_KEYS).toContain(c);
      expect(r.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(r.website).toMatch(/^https?:\/\//);
      for (const [k, url] of Object.entries(r.company_links)) {
        expect(r.companies).toContain(k);
        expect(url).toMatch(/^https?:\/\//);
      }
    }
    const counts = partnerCountsByCompany(GRADING_PARTNERS_SEED);
    for (const k of PARTNER_COMPANY_KEYS) expect(counts[k]).toBeGreaterThan(0);
  });

  it('gives every grading company a direct-submission note and link', () => {
    for (const g of GRADING_COMPANIES) {
      expect(g.submit?.url).toMatch(/^https:\/\//);
      expect(g.submit?.note?.length).toBeGreaterThan(40);
    }
  });
});

describe('helpers', () => {
  it('normalises company keys and builds the filtered path', () => {
    expect(normaliseCompanyKey('PSA')).toBe('psa');
    expect(normaliseCompanyKey(' bgs ')).toBe('bgs');
    expect(normaliseCompanyKey('nope')).toBeNull();
    expect(normaliseCompanyKey(null)).toBeNull();
    expect(companyForKey('tag').name).toBe('TAG');
    expect(gradingPartnersPath('PSA')).toBe(`${GRADING_PARTNERS_PATH}?company=psa`);
    expect(gradingPartnersPath()).toBe(GRADING_PARTNERS_PATH);
    expect(gradingPartnersPath('bogus')).toBe(GRADING_PARTNERS_PATH);
  });

  it('derives the favicon domain and the per-company link', () => {
    expect(partnerDomain('https://www.slabbys.com.au/grading/beckett')).toBe('slabbys.com.au');
    expect(partnerDomain('not a url')).toBe('');
    const p = { website: 'https://a.example', company_links: { bgs: 'https://a.example/beckett', psa: 'javascript:alert(1)' } };
    expect(partnerLinkFor(p, 'BGS')).toBe('https://a.example/beckett');
    expect(partnerLinkFor(p, 'psa')).toBe('https://a.example');
    expect(partnerLinkFor(p, null)).toBe('https://a.example');
    expect(partnerLinkFor(null, 'psa')).toBe('#');
  });

  it('cleans companies, links and categories', () => {
    expect(cleanCompanies(['PSA', 'psa', 'tag', 'nope', 3])).toEqual(['psa', 'tag']);
    expect(cleanCompanyLinks({ PSA: 'https://x', bgs: 'ftp://y', cgc: '', nope: 'https://z' })).toEqual({ psa: 'https://x' });
    expect(cleanCompanyLinks(null)).toEqual({});
    expect(parseCategories('TCG, Sports Cards,,tcg , AFL')).toEqual(['TCG', 'Sports Cards', 'AFL']);
    expect(gradingPartnerSlug('Cherry Collectables')).toBe('cherry-collectables');
    expect(gradingPartnerSlug('  Pokémon & Co. ')).toBe('pokemon-co');
  });

  it('filters and counts partners by company in display order', () => {
    const rows = [
      { slug: 'b', name: 'B', companies: ['psa'], sort_order: 20 },
      { slug: 'a', name: 'A', companies: ['psa', 'bgs'], sort_order: 10 },
      { slug: 'off', name: 'Off', companies: ['psa'], sort_order: 1, is_active: false },
      { slug: 'c', name: 'C', companies: ['tag'], sort_order: 20 },
    ];
    expect(partnersForCompany(rows, 'psa').map((r) => r.slug)).toEqual(['a', 'b']);
    expect(partnersForCompany(rows, null).map((r) => r.slug)).toEqual(['a', 'b', 'c']);
    expect(partnersForCompany(rows, 'sgc')).toEqual([]);
    expect(partnerCountsByCompany(rows)).toMatchObject({ psa: 2, bgs: 1, tag: 1, sgc: 0 });
    expect(partnerLineText({ name: 'A', location: 'Perth, WA', description: 'Does PSA.' })).toBe('A, Perth, WA — Does PSA.');
    expect(partnerLineText({ name: 'A' })).toBe('A');
  });
});

describe('buildGradingPartnerRow', () => {
  it('builds a row from a valid form', () => {
    const { row, errors } = buildGradingPartnerRow({
      name: ' New Store ', slug: '', website: 'https://new.example', location: ' Perth, WA ', description: 'Submits.',
      companies: ['PSA', 'psa', 'ace'], company_links: { psa: 'https://new.example/psa', ace: '' }, categories: 'TCG, tcg', notes: '', sort_order: '7', is_active: true,
    });
    expect(errors).toBeUndefined();
    expect(row).toEqual({
      name: 'New Store', slug: 'new-store', website: 'https://new.example', location: 'Perth, WA', description: 'Submits.',
      companies: ['psa', 'ace'], company_links: { psa: 'https://new.example/psa' }, categories: ['TCG'], notes: null, sort_order: 7, is_active: true,
    });
  });

  it('refuses a missing name, a bare website, no companies and a non-http link', () => {
    const { errors } = buildGradingPartnerRow({ name: '', website: 'new.example', companies: [], company_links: { psa: 'www.x' } });
    expect(errors).toMatchObject({ name: expect.any(String), website: expect.any(String), companies: expect.any(String), link_psa: expect.any(String) });
  });
});
