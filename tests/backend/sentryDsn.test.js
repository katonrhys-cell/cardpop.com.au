// The browser and the API must report to the same Sentry organisation — the
// one the team actually signs in to. They once pointed at an older organisation
// nobody was watching, so production errors went unseen while the dashboard in
// use showed nothing at all.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const SENTRY_ORG_ID = 'o4511766283026432'; // cardpop-australia-yr
const dsnsIn = (file) => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8')
  .match(/https:\/\/[0-9a-f]{32}@o\d+\.ingest\.[a-z.]*sentry\.io\/\d+/g) || [];

describe('Sentry DSNs', () => {
  it.each(['main.jsx', 'src/instrument.js'])('%s falls back to a DSN in the current organisation', (file) => {
    const dsns = dsnsIn(file);
    expect(dsns.length).toBe(1);
    expect(dsns[0]).toContain(`@${SENTRY_ORG_ID}.`);
  });
});
