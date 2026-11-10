import React, { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import GradingPartnerList from '@/components/grading/GradingPartnerList.jsx';
import { GRADING_PARTNERS_SEED } from '@/data/gradingPartnersSeed.js';

function Harness({ initial = null, partners = GRADING_PARTNERS_SEED, ...rest }) {
  const [selected, setSelected] = useState(initial);
  return <GradingPartnerList partners={partners} selected={selected} onSelect={setSelected} {...rest} />;
}

describe('GradingPartnerList', () => {
  it('lists every active partner until a company is picked, then only that company’s, linking to its page for that company', () => {
    const { container } = render(<Harness />);
    expect(container.querySelectorAll('[data-partner]').length).toBe(GRADING_PARTNERS_SEED.length);

    fireEvent.click(screen.getByRole('tab', { name: /Beckett Grading Services/ }));
    const cards = [...container.querySelectorAll('[data-partner]')];
    const bgs = GRADING_PARTNERS_SEED.filter((p) => p.companies.includes('bgs'));
    expect(cards.map((c) => c.getAttribute('data-partner'))).toEqual(bgs.map((p) => p.slug));
    const cherry = container.querySelector('[data-partner="cherry-collectables"]');
    expect(cherry.getAttribute('href')).toBe('https://www.cherrycollectables.com.au/pages/beckett-grading');
    expect(container.querySelector('[data-company-note="BGS"]')).not.toBeNull();
  });

  it('shows each company’s partner count on its chip', () => {
    render(<Harness />);
    const tag = screen.getByRole('tab', { name: /TAG Grading/ });
    expect(within(tag).getByText(String(GRADING_PARTNERS_SEED.filter((p) => p.companies.includes('tag')).length))).toBeTruthy();
  });

  it('explains when a company has no partner yet and points at its own submission page', () => {
    const { container } = render(<Harness initial="sgc" partners={GRADING_PARTNERS_SEED.filter((p) => !p.companies.includes('sgc'))} />);
    const empty = container.querySelector('[data-empty-partners]');
    expect(empty.textContent).toContain('No Australian partner for SGC');
    expect(screen.getByRole('link', { name: /SGC's submission page/ }).getAttribute('href')).toMatch(/gosgc\.com/);
  });

  it('notes when the built-in list is showing instead of live data', () => {
    render(<Harness fromSeed />);
    expect(screen.getByText(/built-in list/)).toBeTruthy();
  });
});
