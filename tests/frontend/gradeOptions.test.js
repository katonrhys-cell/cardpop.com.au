import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { GRADERS, GRADER_VALUES, GRADING_COMPANY_VALUES, NUMERIC_GRADES, ALL_GRADES, graderFromText, graderLabel } from '../../data/gradeOptions.js';
import { mapGradingService } from '../../utils/ocrResult.js';
import { GRADING_SERVICE_QUERY } from '../../utils/listingFlow.js';

// The values the grading_company enum already had before the all-graders migration.
const ORIGINAL_ENUM = ['raw', 'psa', 'bgs', 'cgc', 'ace', 'sgc', 'other'];

describe('grader & grade options', () => {
  it('covers eBay\'s full grade scale and special grades', () => {
    expect(NUMERIC_GRADES).toHaveLength(19);
    expect(NUMERIC_GRADES[0]).toBe('10');
    expect(NUMERIC_GRADES).toContain('9.5');
    expect(NUMERIC_GRADES.at(-1)).toBe('1');
    expect(ALL_GRADES).toEqual(expect.arrayContaining(['Authentic', 'Authentic Altered', 'Authentic - Trimmed', 'Authentic - Coloured', 'Sample']));
  });

  it('has unique values and keeps Other last', () => {
    expect(new Set(GRADER_VALUES).size).toBe(GRADER_VALUES.length);
    expect(GRADER_VALUES.at(-1)).toBe('other');
    expect(GRADING_COMPANY_VALUES[0]).toBe('raw');
  });

  it('every grader exists in the grading_company enum (original values or the migration)', () => {
    const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261117020000_grading_company_all_graders.sql'), 'utf8');
    const added = [...sql.matchAll(/add value if not exists '([a-z]+)'/g)].map((m) => m[1]);
    for (const v of GRADING_COMPANY_VALUES) expect([...ORIGINAL_ENUM, ...added]).toContain(v);
  });

  it('reads graders out of free text without false positives', () => {
    expect(graderFromText('PSA')).toBe('psa');
    expect(graderFromText('Beckett')).toBe('bgs');
    expect(graderFromText('Beckett Vintage Grading')).toBe('bvg');
    expect(graderFromText('Beckett Collectors Club')).toBe('bccg');
    expect(graderFromText('Arena Club')).toBe('arena');
    expect(graderFromText('vintage tagged binder')).toBeNull();
    expect(graderFromText('None')).toBeNull();
    expect(mapGradingService('TAG Grading')).toBe('TAG');
    expect(mapGradingService('')).toBe('None');
  });

  it('labels and eBay queries cover every grader', () => {
    expect(graderLabel('beckett')).toBe('BGS');
    expect(graderLabel('raw')).toBe('Raw (ungraded)');
    for (const g of GRADERS.filter((x) => x.value !== 'other')) expect(GRADING_SERVICE_QUERY[g.value]).toBeTruthy();
  });
});
