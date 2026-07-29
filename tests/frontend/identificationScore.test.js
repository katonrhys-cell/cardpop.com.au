import { describe, it, expect } from 'vitest';
import {
  scoreField, scoreCase, summarise, formatSummary, VERDICT,
} from '@/utils/identificationScore.js';

describe('scoreField', () => {
  it('marks an agreeing value correct', () => {
    expect(scoreField('name', 'Charizard', 'Charizard')).toBe(VERDICT.CORRECT);
  });

  it('marks a disagreeing value wrong', () => {
    expect(scoreField('name', 'Charizard', 'Blastoise')).toBe(VERDICT.WRONG);
  });

  it('distinguishes missing from wrong', () => {
    // The whole point of the split: a blank field costs typing, a wrong one
    // reaches a live listing.
    expect(scoreField('setName', 'Base Set', '')).toBe(VERDICT.MISSING);
    expect(scoreField('setName', 'Base Set', null)).toBe(VERDICT.MISSING);
    expect(scoreField('setName', 'Base Set', 'Jungle')).toBe(VERDICT.WRONG);
  });

  it('does not score a field the fixture leaves unasserted', () => {
    expect(scoreField('year', '', '1999')).toBe(VERDICT.UNSCORED);
    expect(scoreField('year', null, '1999')).toBe(VERDICT.UNSCORED);
  });

  it('allows the collector-number forms the pipeline treats as equal', () => {
    expect(scoreField('cardNumber', '4/102', '4')).toBe(VERDICT.CORRECT);
    expect(scoreField('cardNumber', '4/102', '004/102')).toBe(VERDICT.CORRECT);
    expect(scoreField('cardNumber', '4/102', '11')).toBe(VERDICT.WRONG);
  });

  it('allows set names differing only by a filler word', () => {
    expect(scoreField('setName', 'Base Set', 'Base')).toBe(VERDICT.CORRECT);
  });

  it('does not let a nested set name pass as correct', () => {
    expect(scoreField('setName', 'Base Set', 'Base Set 2')).toBe(VERDICT.WRONG);
  });

  it('compares names case- and punctuation-insensitively', () => {
    expect(scoreField('name', "Farfetch'd", 'FARFETCHD')).toBe(VERDICT.CORRECT);
  });

  it('does not accept a partial name as correct', () => {
    // The grounding step accepts partial containment when *searching*; scoring
    // against known truth must not.
    expect(scoreField('name', 'Charizard VMAX', 'Charizard')).toBe(VERDICT.WRONG);
  });
});

describe('scoreCase', () => {
  it('splits fields into correct, wrong and missing', () => {
    const score = scoreCase(
      { name: 'Charizard', setName: 'Base Set', cardNumber: '4/102', year: '1999', collection: 'Pokemon' },
      { name: 'Charizard', setName: 'Jungle', cardNumber: '', year: '1999', collection: 'Pokemon' },
    );

    expect(score.correct).toEqual(['name', 'year', 'collection']);
    expect(score.wrong).toEqual(['setName']);
    expect(score.missing).toEqual(['cardNumber']);
  });

  it('keeps both values so a report can show the disagreement', () => {
    const score = scoreCase({ name: 'Charizard' }, { name: 'Blastoise' });
    expect(score.fields.name).toMatchObject({ expected: 'Charizard', actual: 'Blastoise' });
  });

  it('handles a completely empty result', () => {
    const score = scoreCase({ name: 'Charizard', setName: 'Base Set' }, {});
    expect(score.missing).toEqual(['name', 'setName']);
    expect(score.wrong).toEqual([]);
  });
});

describe('summarise', () => {
  const results = [
    { id: 'a', score: scoreCase({ name: 'Charizard', setName: 'Base Set' }, { name: 'Charizard', setName: 'Base Set' }) },
    { id: 'b', score: scoreCase({ name: 'Pikachu', setName: 'Base Set' }, { name: 'Pikachu', setName: 'Jungle' }) },
    { id: 'c', score: scoreCase({ name: 'Mewtwo', setName: 'Base Set' }, { name: 'Mewtwo', setName: '' }) },
  ];

  it('counts a case as clean only when nothing is wrong', () => {
    const s = summarise(results);
    // 'c' has a missing field but nothing wrong, so it still counts as clean.
    expect(s.cleanCases).toBe(2);
    expect(s.cases).toBe(3);
  });

  it('reports correct and wrong rates per field', () => {
    const s = summarise(results);
    expect(s.perField.name).toMatchObject({ scored: 3, correct: 3, wrong: 0 });
    expect(s.perField.setName).toMatchObject({ scored: 3, correct: 1, wrong: 1, missing: 1 });
    expect(s.perField.setName.wrongRate).toBeCloseTo(1 / 3, 5);
  });

  it('leaves rates null for a field nothing asserted', () => {
    const s = summarise(results);
    expect(s.perField.year.scored).toBe(0);
    expect(s.perField.year.correctRate).toBeNull();
  });

  it('totals across every scored field', () => {
    const s = summarise(results);
    expect(s.totals).toMatchObject({ scored: 6, correct: 4, wrong: 1, missing: 1 });
  });

  it('handles an empty run without dividing by zero', () => {
    const s = summarise([]);
    expect(s.cases).toBe(0);
    expect(s.totals.correctRate).toBeNull();
  });
});

describe('formatSummary', () => {
  it('renders a table that names the priority', () => {
    const text = formatSummary(summarise([
      { id: 'a', score: scoreCase({ name: 'Charizard' }, { name: 'Blastoise' }) },
    ]));

    expect(text).toContain('TOTAL');
    expect(text).toContain('Drive `wrong` to zero');
  });
});
