import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { vaultSlabStyle } from '@/utils/vaultGradeStyle.js';
import ConditionGradeBadge from '@/components/vault/ConditionGradeBadge.jsx';

const tier = (company, grade) => vaultSlabStyle(company, grade)?.tier;

describe('vaultSlabStyle', () => {
  it('draws PSA on its red-framed white label for every grade', () => {
    expect(tier('psa', '10')).toBe('psa');
    expect(tier('psa', '6')).toBe('psa');
  });

  it('picks the BGS label from what was listed', () => {
    expect(tier('bgs', '9')).toBe('silver');
    expect(tier('bgs', '9.5')).toBe('gold');
    expect(tier('beckett', 'Pristine 10')).toBe('gold');
    expect(tier('bgs', 'Black Label 10')).toBe('bgsBlack');
  });

  it('keeps CGC black unless listed as Pristine / gold', () => {
    expect(tier('cgc', '10')).toBe('black');
    expect(tier('cgc', '9.5')).toBe('black');
    expect(tier('cgc', 'Pristine 10')).toBe('gold');
  });

  it('gives ACE its gold label at 10', () => {
    expect(tier('ace', '9')).toBe('ace');
    expect(tier('ace', '10')).toBe('aceGold');
  });

  it('knows SGC and TAG, and nothing for other / raw', () => {
    expect(tier('sgc', '9.5')).toBe('sgc');
    expect(tier('tag', '10')).toBe('tag');
    expect(vaultSlabStyle('other', '8')).toBeNull();
    expect(vaultSlabStyle('raw', '')).toBeNull();
  });
});

describe('ConditionGradeBadge', () => {
  it('renders a slab chip with the company and grade', () => {
    const { container } = render(<ConditionGradeBadge gradingCompany="cgc" grade="Pristine 10" />);
    const chip = container.firstChild;
    expect(chip.dataset.slabTier).toBe('gold');
    expect(chip.textContent).toBe('CGCPristine 10');
  });

  it("doesn't double the company when the grade already starts with it", () => {
    const { container } = render(<ConditionGradeBadge gradingCompany="psa" grade="PSA 10" />);
    expect(container.firstChild.textContent).toBe('PSA10');
  });

  it('falls back to a toned condition chip for raw cards', () => {
    const { container } = render(<ConditionGradeBadge gradingCompany="raw" condition="near_mint" />);
    expect(container.firstChild.dataset.condition).toBe('near_mint');
    expect(container.firstChild.textContent).toBe('near mint');
  });
});
